/**
 * recalcAllCharts — Admin job to refresh stored Chart records.
 *
 * Recalculates each chart via the canonical `chartCalculator` function (single
 * source of truth) so lots, dignities, and all computed points always stay in
 * sync automatically — no duplicated ephemeris math to maintain here.
 *
 * Body options:
 *   - scope: 'me'  → only the calling admin's charts (for verification before
 *                    regenerating everyone)
 *   - scope: 'all' → every chart in the system (default)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TZ = { 'UTC': 0, 'GMT': 0, 'America/New_York': -5, 'America/Chicago': -6, 'America/Denver': -7, 'America/Los_Angeles': -8, 'America/Anchorage': -9, 'America/Honolulu': -10, 'America/Sao_Paulo': -3, 'America/Toronto': -5, 'America/Mexico_City': -6, 'America/Vancouver': -8, 'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Berlin': 1, 'Europe/Rome': 1, 'Europe/Madrid': 1, 'Europe/Amsterdam': 1, 'Europe/Zurich': 1, 'Europe/Helsinki': 2, 'Europe/Athens': 2, 'Europe/Istanbul': 3, 'Europe/Moscow': 3, 'Asia/Jerusalem': 2, 'Asia/Dubai': 4, 'Asia/Kolkata': 5.5, 'Asia/Bangkok': 7, 'Asia/Singapore': 8, 'Asia/Shanghai': 8, 'Asia/Tokyo': 9, 'Asia/Seoul': 9, 'Australia/Sydney': 10, 'Pacific/Auckland': 12, 'Africa/Cairo': 2, 'Africa/Johannesburg': 2 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch { /* no body = default scope */ }
    const scope = body.scope === 'me' ? 'me' : 'all';

    let charts = await base44.asServiceRole.entities.Chart.list();
    if (scope === 'me') charts = charts.filter(c => c.user_id === user.id);

    // Pre-fetch all UserProgress records to look up house_system preference per user
    const allProgress = await base44.asServiceRole.entities.UserProgress.list();
    const progressByUserId: Record<string, any> = {};
    for (const p of allProgress) { if (p.user_id) progressByUserId[p.user_id] = p; }
    const results = [];

    for (const chart of charts) {
      const rd = chart.raw_data;
      if (!rd?.birth_date || !rd?.birth_location?.latitude) {
        results.push({ id: chart.id, status: 'skipped', reason: 'missing birth data' });
        continue;
      }
      const loc = rd.birth_location;
      // Prefer stored utc_offset; otherwise compute DST-aware offset via Intl API
      let tz: number;
      if (typeof rd.utc_offset === 'number') {
        tz = rd.utc_offset;
      } else {
        try {
          const [y, mo, d] = rd.birth_date.split('-').map(Number);
          const [h, mi] = (rd.birth_time || '12:00:00').split(':').map(n => parseInt(n) || 0);
          const testDate = new Date(Date.UTC(y, mo - 1, d, h, mi));
          const tzName = loc.timezone || 'UTC';
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tzName, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
          }).formatToParts(testDate);
          const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
          const localH = get('hour') % 24;
          const localMi = get('minute');
          tz = (localH - testDate.getUTCHours()) + (localMi - testDate.getUTCMinutes()) / 60;
          if (tz > 14) tz -= 24;
          if (tz < -12) tz += 24;
        } catch {
          tz = TZ[loc.timezone] ?? 0;
        }
      }
      // Look up user's house system preference; default to whole_sign
      const userProgress = chart.user_id ? progressByUserId[chart.user_id] : null;
      const houseSystem = userProgress?.house_system || rd.house_system || 'whole_sign';

      // Recalculate via the canonical chartCalculator — single source of truth.
      let fresh: any;
      try {
        const res = await base44.functions.invoke('chartCalculator', {
          chart_type: 'natal',
          birth_date: rd.birth_date,
          birth_time: rd.birth_time,
          birth_location: loc,
          utc_offset: tz,
          house_system: houseSystem,
          tradition: userProgress?.active_tradition || 'modern',
        });
        fresh = res.data;
      } catch (err: any) {
        results.push({ id: chart.id, status: 'error', reason: err?.message || 'chartCalculator failed' });
        continue;
      }
      if (!fresh || !fresh.planets) {
        results.push({ id: chart.id, status: 'error', reason: 'no chart data returned' });
        continue;
      }

      const resp = { chart_type: 'natal', birth_date: rd.birth_date, birth_time: rd.birth_time ?? '12:00:00', birth_location: loc, utc_offset: tz, house_system: houseSystem, ...fresh };

      const placementKeys = [];
      for (const p of fresh.planets) {
        placementKeys.push(`${p.name.toLowerCase().replace(/ /g, '_')}_${p.sign.toLowerCase()}`);
        placementKeys.push(`${p.name.toLowerCase().replace(/ /g, '_')}_${p.house}h`);
      }
      if (fresh.nodes?.north_node) placementKeys.push(`north_node_${fresh.nodes.north_node.sign.toLowerCase()}`);
      if (fresh.nodes?.south_node) placementKeys.push(`south_node_${fresh.nodes.south_node.sign.toLowerCase()}`);
      for (const asp of fresh.aspects) {
        if (['exact', 'strong'].includes(asp.strength)) {
          placementKeys.push(`${asp.planet1.toLowerCase().replace(/ /g, '_')}_${asp.aspect}_${asp.planet2.toLowerCase().replace(/ /g, '_')}`);
        }
      }

      const sun = fresh.planets.find((p: any) => p.name === 'Sun');
      const moon = fresh.planets.find((p: any) => p.name === 'Moon');

      await base44.asServiceRole.entities.Chart.update(chart.id, {
        raw_data: resp,
        sun_sign: sun?.sign,
        moon_sign: moon?.sign,
        ascendant_sign: fresh.angles?.ascendant?.sign,
        placement_keys: [...new Set(placementKeys)],
        calculated_at: new Date().toISOString(),
      });

      results.push({
        id: chart.id,
        name: chart.name || rd.name || null,
        asc: fresh.angles?.ascendant?.sign,
        planets: fresh.planets.length,
        has_pof: !!fresh.planets.find((p: any) => p.name === 'Part of Fortune'),
        has_tyche: !!fresh.planets.find((p: any) => p.name === 'Tyche'),
        has_bml: !!fresh.planets.find((p: any) => p.name === 'Black Moon Lilith'),
      });
    }

    return Response.json({ scope, total: results.length, results });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});