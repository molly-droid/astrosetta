import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: user.id });
    if (!charts.length) return json({ error: 'No chart found' }, { status: 404 });

    const chart = charts[0];
    const raw = chart.raw_data;

    // Fix Chiron in planets array
    const planets = (raw.planets || []).map(p => {
      if (p.name === 'Chiron') {
        return { ...p, sign: 'Cancer', degree: 18.0, longitude: 108.0, element: 'Water', modality: 'Cardinal', retrograde: true, house: 8 };
      }
      return p;
    });

    // Fix placement_keys: replace chiron_7h with chiron_8h
    const placement_keys = (chart.placement_keys || []).map(k => k === 'chiron_7h' ? 'chiron_8h' : k);

    // Add Chiron-Jupiter conjunction aspect if not present, remove old Uranus-Chiron opposition
    const aspects = (raw.aspects || []).filter(a => !(a.planet1 === 'Uranus' && a.planet2 === 'Chiron') && !(a.planet1 === 'Chiron' && a.planet2 === 'Uranus'));
    // Chiron at 108°, Jupiter at 110.2° → conjunction orb 2.2°
    aspects.push({ planet1: 'Chiron', planet2: 'Jupiter', aspect: 'conjunction', angle: 0, orb: 2.2031, strength: 'strong' });
    // Chiron at 108°, Sun at 101.76° → conjunction orb 6.24°
    aspects.push({ planet1: 'Sun', planet2: 'Chiron', aspect: 'conjunction', angle: 0, orb: 6.24, strength: 'wide' });

    const updatedRaw = { ...raw, planets, aspects };

    await base44.asServiceRole.entities.Chart.update(chart.id, {
      raw_data: updatedRaw,
      placement_keys,
    });

    return json({ success: true, chiron: planets.find(p => p.name === 'Chiron') });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
});