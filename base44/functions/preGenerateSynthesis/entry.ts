/**
 * preGenerateSynthesis — Overnight job that pre-generates ALL synthesis types
 * for every user with a chart. Stores structured JSON in CalendarSynthesis.data
 * so the frontend can render instantly without LLM calls.
 *
 * Generates: day, week, month, lunar (if exact), ingress (if any).
 * Uses simplified J2000 orbital math (same as generateCalendarSynthesis).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchKnowledgeDepth } from '../../shared/knowledgeDensity.ts';
import {
  SIGNS, PLANET_GLYPHS, ASPECT_GLYPHS, ASPECT_ABBREV, ASPECT_ANGLES, PERSONA,
  SLOW_SET, ALL_TP, DOW_SHORT, HOUSE_THEMES, PLANET_DURATIONS, CHART_RULERS, TRAD_RULERS, PROF_THEMES,
  getSolarReturnContext, dateToJD, planetLongitude, longitudeToSign, isRetrograde, getMoonPhaseName,
  checkAspect, formatTransitLabel, dateKey, reassignHouses, processTransits,
  classifyCalculatorTransits, generateDaySynthesis
} from '../../shared/daySynthesisGenerator.ts';

async function generateWeekSynthesis(base44, raw, weekDays) {
  const natalPlanets = [...(raw.planets || [])];
  const dayContexts = weekDays.map(d => {
    const t = processTransits(d, raw);
    const moonInfo = `Moon in ${t.moonSign}${t.moonPhase && (t.moonPhase === 'New Moon' || t.moonPhase === 'Full Moon') ? ` (${t.moonPhase})` : ''}`;
    const aspects = t.natalAspects.map(a => formatTransitLabel(
      t.transitPlanets.find(p => p.name === a.transit_planet) || { name: a.transit_planet, longitude: 0 },
      natalPlanets.find(p => p.name === a.natal_planet) || { name: a.natal_planet, longitude: 0 },
      a.aspect));
    return `${DOW_SHORT[d.getUTCDay()]} ${d.getUTCDate()}: ${moonInfo}. ${aspects.length ? aspects.join(', ') : 'no major personal aspects'}`;
  });

  const weekRange = `${weekDays[0].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' })} – ${weekDays[6].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
  const solarContext = getSolarReturnContext(raw, weekDays[0]);

  const firstDayTransits = processTransits(weekDays[0], raw);
  const weekTransitPositions = (firstDayTransits.transitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');

  const prompt = `${PERSONA}

Week: ${weekRange}
NATAL: ☉ ${raw.sun_sign} · ☽ ${raw.moon_sign}${raw.unknown_time ? ' · birth time unknown — rising and houses not determined; NEVER mention houses, rising, the Ascendant, or angles' : ` · ASC ${raw.ascendant_sign}`}
${solarContext}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${weekTransitPositions || 'Data unavailable.'}

DAILY TRANSITS (slow planets ≤2° orb):
${dayContexts.join('\n')}

Rules:
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, stations, or lunar events that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- For days with no personal aspects, write day_sentence about Moon sign energy + any active mundane aspects
- Never write the same energy twice across day_sentences
- Each day_sentences entry max 15 words
- Do NOT include raw glyph symbols (☉☽☿♀♂♃♄♅♆♇ etc.) or the em-dash label format in your output. Write only prose using full planet and aspect names — glyphs are added automatically by the frontend.

Return JSON:
{
  "overview": "2 sentences summarizing the week's overall energy, referencing specific transit labels",
  "day_sentences": {
    "0": "Monday sentence",
    "1": "Tuesday sentence",
    "2": "Wednesday sentence",
    "3": "Thursday sentence",
    "4": "Friday sentence",
    "5": "Saturday sentence",
    "6": "Sunday sentence"
  },
  "best_days": ["DayName", "DayName"],
  "best_areas": ["area1", "area2"]
}`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        day_sentences: {
          type: 'object',
          properties: {
            '0': { type: 'string' }, '1': { type: 'string' }, '2': { type: 'string' },
            '3': { type: 'string' }, '4': { type: 'string' }, '5': { type: 'string' },
            '6': { type: 'string' },
          },
          required: ['0', '1', '2', '3', '4', '5', '6'],
          additionalProperties: false,
        },
        best_days: { type: 'array', items: { type: 'string' } },
        best_areas: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'day_sentences', 'best_days', 'best_areas'],
    },
  });

  const wkStart = dateKey(weekDays[0]);
  const wkEnd = dateKey(weekDays[6]);
  return {
    period_type: 'week',
    period_key: `week-v9-${wkStart}`,
    date_start: wkStart,
    date_end: wkEnd,
    summary: `Week at a Glance · ${weekRange}`,
    description: result.overview || '',
    data: result,
  };
}

async function generateMonthSynthesis(base44, raw, baseDate) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const monthName = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const midDay = new Date(Date.UTC(year, month, 15, 12, 0, 0));
  const t1 = processTransits(firstDay, raw);
  const t15 = processTransits(midDay, raw);

  const slowPositions = t1.transitPlanets
    .filter(p => SLOW_SET.has(p.name))
    .map(p => `${p.name} in ${p.sign}${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  const aspects1 = t1.natalAspects.map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
  const aspects15 = t15.natalAspects.map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
  const allAspects = [...new Set([...aspects1, ...aspects15])];

  const getLunation = (t) => {
    if (t.moonPhase === 'New Moon') return `New Moon in ${t.moonSign}`;
    if (t.moonPhase === 'Full Moon') return `Full Moon in ${t.moonSign}`;
    return null;
  };
  const lunarEvents = [getLunation(t1), getLunation(t15)].filter(Boolean);

  const natalPlanetsStr = (raw.planets || [])
    .map(p => `${p.name} in ${p.sign}${raw.unknown_time || p.house == null ? '' : ` (House ${p.house})`}`)
    .join('; ');

  const monthTransitPositions = (t1.transitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  const prompt = `${PERSONA}

Month: ${monthName}
NATAL: Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}${raw.unknown_time ? ', birth time unknown — rising and houses not determined; NEVER mention houses, rising, the Ascendant, or angles' : `, Rising: ${raw.ascendant_sign}`}
Planets: ${natalPlanetsStr || 'not provided'}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${monthTransitPositions || 'Data unavailable.'}

Slow planet positions this month: ${slowPositions}
Active personal transits: ${allAspects.join('; ') || 'none exact'}
Lunations: ${lunarEvents.join(', ') || 'none at sample dates'}

Rules:
- Use ONLY the transit data provided above. Do NOT mention or reference any planetary transits, aspects, or lunations that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.

Return JSON:
- overview: 2-3 sentences summarizing the overall energy of the month, referencing specific slow planet transits and lunations
- personal_focus: 1-2 sentences on the most significant personal transit theme this month and which life area it activates
- collective_theme: 1 sentence on the collective/mundane backdrop for everyone
- collective_tags: array of 2-3 one-or-two-word thematic labels for the collective energy this month
- maximize: array of 3 specific opportunities or actions for this month
- watch: array of 2 challenges or cautions for this month
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        personal_focus: { type: 'string' },
        collective_theme: { type: 'string' },
        collective_tags: { type: 'array', items: { type: 'string' } },
        maximize: { type: 'array', items: { type: 'string' } },
        watch: { type: 'array', items: { type: 'string' } },
        best_areas: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'watch', 'best_areas'],
    },
  });

  const mm = String(month + 1).padStart(2, '0');
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  const nextMM = String(nextMonth.getUTCMonth() + 1).padStart(2, '0');
  return {
    period_type: 'month',
    period_key: `month-v9-${year}-${mm}`,
    date_start: `${year}-${mm}-01`,
    date_end: `${nextMonth.getUTCFullYear()}-${nextMM}-01`,
    summary: `Month at a Glance · ${monthName}`,
    description: result.overview || '',
    data: result,
  };
}

async function generateLunarSynthesis(base44, raw, date, moonSign, exactPhase) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  // Unknown birth time — rising/houses cannot be determined; report no houses.
  const unknownTime = !!raw.unknown_time;
  const natalPlanets = (raw.planets || [])
    .map(p => `${p.name} in ${p.sign}${unknownTime || p.house == null ? '' : ` (House ${p.house})`}`).join('; ');
  const natalHouses = unknownTime ? '' : (raw.houses || []).map(h => `House ${h.number}: ${h.sign}`).join(', ');

  const moonHouseObj = unknownTime ? null : raw.houses?.find(h => h.sign === moonSign);
  const moonHouseNum = moonHouseObj?.number;
  const moonHouseContext = moonHouseNum
    ? `The ${exactPhase} falls in ${moonSign}, which is the ${moonHouseNum}th house for this person.`
    : `The ${exactPhase} is in ${moonSign}.`;

  const planetsInMoonSign = (raw.planets || []).filter(p => p.sign === moonSign);
  const conjunctionNote = planetsInMoonSign.length
    ? `Natal planets in ${moonSign}: ${planetsInMoonSign.map(p => p.name).join(', ')} — the transiting moon is conjunct these natal points.`
    : '';

  const prompt = `${PERSONA}

Today is ${dateStr} and there is a ${exactPhase} in ${moonSign}.

NATAL CHART:
Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}${unknownTime ? ', birth time unknown — rising and houses not determined; NEVER mention houses, rising, the Ascendant, or angles' : `, Rising: ${raw.ascendant_sign}`}
Planets: ${natalPlanets || 'not provided'}
${unknownTime ? '' : `House cusps: ${natalHouses || 'not provided'}`}
${moonHouseContext}
${conjunctionNote}

Write a focused reading for this ${exactPhase} in ${moonSign}.

CRITICAL: Use ONLY the natal chart data provided above. Do NOT invent signs, houses, or planetary positions not listed. The Moon is in ${moonSign} — use ONLY this sign. Do NOT reference natal planets in signs other than those explicitly listed above.

Return JSON:
- collective: 2 sentences on what this ${exactPhase} means for everyone collectively — themes, archetypes, what is illuminated/released/seeded
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. ${unknownTime ? `Reference the natal planets in ${moonSign} by sign only — their birth time is unknown, so do NOT mention houses or rising.` : `Reference the specific house it activates, any natal planets in ${moonSign}.`} Be concrete and personal.
- ritual: 1 short practical suggestion for honoring this moon phase today`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        collective: { type: 'string' },
        personal: { type: 'string' },
        ritual: { type: 'string' },
      },
      required: ['collective', 'personal', 'ritual'],
    },
  });

  const dk = dateKey(date);
  const phaseKey = exactPhase.replace(/ /g, '_');
  return {
    period_type: 'lunar',
    period_key: `lunar-${dk}-${phaseKey}`,
    date_start: dk,
    date_end: dk,
    summary: `${exactPhase} in ${moonSign}`,
    description: result.collective || '',
    data: result,
  };
}

async function generateIngressSynthesis(base44, raw, date, ing) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  // Unknown birth time — rising/houses cannot be determined; report no houses.
  const unknownTime = !!raw.unknown_time;
  const natalPlanets = (raw.planets || [])
    .map(p => `${p.name} in ${p.sign}${unknownTime || p.house == null ? '' : ` (House ${p.house})`}`).join('; ');
  const natalHouses = unknownTime ? '' : (raw.houses || []).map(h => `House ${h.number}: ${h.sign}`).join(', ');

  // Find natal house for the ingressing sign
  const signIdx = SIGNS.indexOf(ing.to_sign);
  const houseSystem = raw.house_system || 'whole_sign';
  const ascSign = unknownTime ? null : raw.ascendant_sign;
  let entryHouse = null;
  if (houseSystem === 'whole_sign' && ascSign) {
    const ascIdx = SIGNS.indexOf(ascSign);
    if (signIdx >= 0 && ascIdx >= 0) entryHouse = ((signIdx - ascIdx + 12) % 12) + 1;
  } else if (signIdx >= 0) {
    const norm = v => ((v % 360) + 360) % 360;
    const startLon = signIdx * 30;
    const natalHousesArr = raw.houses || [];
    for (let i = 0; i < natalHousesArr.length; i++) {
      const a = norm(natalHousesArr[i].longitude), b = norm(natalHousesArr[(i+1)%12].longitude);
      const inEntry = a <= b ? (norm(startLon) >= a && norm(startLon) < b) : (norm(startLon) >= a || norm(startLon) < b);
      if (inEntry) { entryHouse = natalHousesArr[i].number; break; }
    }
  }
  const entryTheme = entryHouse ? HOUSE_THEMES[entryHouse] : '';
  const houseContext = entryHouse
    ? `${ing.planet} entering ${ing.to_sign} places it in your ${entryHouse}th house of ${entryTheme}.`
    : `${ing.planet} is entering ${ing.to_sign}.`;

  const planetsInNewSign = (raw.planets || []).filter(p => p.sign === ing.to_sign);
  const conjunctionNote = planetsInNewSign.length
    ? `Natal planets in ${ing.to_sign}: ${planetsInNewSign.map(p => `${p.name}${unknownTime || p.house == null ? '' : ` (House ${p.house})`}`).join(', ')} — ${ing.planet} will conjunct these.`
    : '';

  const ruler = unknownTime ? null : CHART_RULERS[raw.ascendant_sign];
  const isChartRuler = ruler && ing.planet === ruler.planet;
  const rulerNote = isChartRuler
    ? `⭐ This is YOUR CHART RULER — ${ruler.planet} rules your ${raw.ascendant_sign} Ascendant. This ingress is personally significant because it directly activates your identity, life direction, and how you meet the world.`
    : '';

  const duration = PLANET_DURATIONS[ing.planet] || 'an extended period';

  const prompt = `${PERSONA}

Today is ${dateStr} and ${ing.planet} enters ${ing.to_sign}, leaving ${ing.from_sign}.

NATAL CHART:
Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}${unknownTime ? ', birth time unknown — rising and houses not determined; NEVER mention houses, rising, the Ascendant, or angles' : `, Rising: ${raw.ascendant_sign}`}
Planets: ${natalPlanets || 'not provided'}
${unknownTime ? '' : `House cusps: ${natalHouses || 'not provided'}`}
${houseContext}
${conjunctionNote}

${ing.planet} will stay in ${ing.to_sign} for ${duration}.

Write a focused reading for this ${ing.planet} ingress into ${ing.to_sign}.

${rulerNote}

CRITICAL: Use ONLY the natal chart data provided above. Do NOT invent signs, houses, or planetary positions not listed. ${ing.planet} is entering ${ing.to_sign} — use ONLY this sign. Do NOT reference natal planets in signs other than those explicitly listed above.

Return JSON:
- headline: a short evocative title (max 6 words), e.g. "Jupiter Enters Your 9th House"
- collective: 2 sentences on what this ingress means for everyone collectively — the archetypal shift, what themes ${ing.to_sign} activates for ${ing.planet}
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. ${unknownTime ? `Reference the natal planets in ${ing.to_sign} by sign only — their birth time is unknown, so do NOT mention houses or rising.` : `Reference the house it enters and any natal planets in ${ing.to_sign}.`} Be concrete and personal.
- ritual: 1 short practical suggestion for working with this ingress energy`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        collective: { type: 'string' },
        personal: { type: 'string' },
        ritual: { type: 'string' },
      },
      required: ['headline', 'collective', 'personal', 'ritual'],
    },
  });

  const dk = dateKey(date);
  return {
    period_type: 'ingress',
    period_key: `ingress-${dk}-${ing.planet}-${ing.to_sign}`,
    date_start: dk,
    date_end: dk,
    summary: `${ing.planet} enters ${ing.to_sign}`,
    description: result.headline || '',
    data: result,
  };
}

// ── chartCalculator integration ─────────────────────────────────────────────
// Calls the chartCalculator backend function to get accurate transit data
// (matching exactly what the frontend uses). This ensures ingress period_keys
// match between pre-generation and frontend cache lookups.
async function getCalculatorTransits(base44, raw, dateStr) {
  const res = await base44.functions.invoke('chartCalculator', {
    chart_type: 'transit',
    birth_date: raw.birth_date,
    birth_time: raw.birth_time || '12:00:00',
    birth_location: raw.birth_location,
    transit_date: dateStr,
    transit_time: '12:00:00',
    utc_offset: 0,
    natal_planets_override: raw.planets || [],
    house_system: raw.house_system || 'whole_sign',
  });
  return res.data || res;
}



// ── Handler ──────────────────────────────────────────────────────────────────
// Processes ONE chart per call to avoid timeouts. The scheduled automation
// runs every 5 minutes, so all charts get processed over ~1 hour.
// Pass { chart_id: "xxx" } to target a specific chart, or { process_all: true }
// to process every chart in one call (may timeout for many users).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* no body — scheduled run */ }
    const { chart_id, process_all } = body;

    const charts = await base44.asServiceRole.entities.Chart.list();
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const dk = dateKey(today);

    // Select which chart(s) to process
    let toProcess;
    if (chart_id) {
      toProcess = charts.filter(c => c.id === chart_id);
    } else if (process_all) {
      toProcess = charts;
    } else {
      // Find first chart without today's day synthesis (at the user's current depth)
      toProcess = [];
      for (const c of charts) {
        const raw = c.raw_data || {};
        if (!raw.birth_date || !raw.planets?.length) continue;
        const depth = await fetchKnowledgeDepth(base44, c.user_id);
        const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
          user_id: c.user_id,
          period_key: `day-v20-${dk}-${depth}`,
        });
        if (!existing.length) { toProcess = [c]; break; }
      }
    }

    if (!toProcess.length) {
      return Response.json({ status: 'complete', message: 'All charts already have today\'s synthesis', remaining: 0 });
    }

    // Week starts on Sunday
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      return d;
    });

    const monthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12, 0, 0));
    const results = [];

    for (const chart of toProcess) {
      const raw = chart.raw_data || {};
      if (!raw.birth_date || !raw.planets?.length) {
        results.push({ id: chart.id, status: 'skipped', reason: 'missing data' });
        continue;
      }

      try {
        // Use chartCalculator for accurate transit data (matching the frontend exactly)
        // This ensures ingress period_keys match between pre-generation and frontend cache lookups
        let transits;
        try {
          const calcData = await getCalculatorTransits(base44, raw, dk);
          transits = classifyCalculatorTransits(calcData, raw);
          console.log(`[preGen] chartCalculator OK for chart ${chart.id}, ingresses: ${transits.ingresses?.length || 0}`);
        } catch (calcErr) {
          console.error(`[preGen] chartCalculator failed for chart ${chart.id}: ${calcErr.message}`);
          // Skip — using simplified fallback math would produce inaccurate transit
          // data that gets cached and shown to users as if it were real.
          results.push({ id: chart.id, status: 'skipped', reason: 'chartCalculator unavailable' });
          continue;
        }
        const syntheses = [];

        // Day synthesis (generated at the user's current knowledge density)
        const depth = await fetchKnowledgeDepth(base44, chart.user_id);
        syntheses.push(await generateDaySynthesis(base44, raw, today, transits, depth));

        // Lunar event synthesis (if exact new/full moon)
        if (transits.isExactFullMoon || transits.isExactNewMoon) {
          const exactPhase = transits.isExactFullMoon ? 'Full Moon' : 'New Moon';
          syntheses.push(await generateLunarSynthesis(base44, raw, today, transits.moonSign, exactPhase));
        }

        // Ingress syntheses (for each exact ingress today)
        for (const ing of transits.ingresses) {
          syntheses.push(await generateIngressSynthesis(base44, raw, today, ing));
        }

        // Week synthesis
        syntheses.push(await generateWeekSynthesis(base44, raw, weekDays));

        // Month synthesis
        syntheses.push(await generateMonthSynthesis(base44, raw, monthDate));

        // Store all records (update if exists, create if not)
        const genAt = new Date().toISOString();
        for (const synth of syntheses) {
          const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
            user_id: chart.user_id,
            period_key: synth.period_key,
          });
          const payload = { user_id: chart.user_id, ...synth, generated_at: genAt };
          if (existing[0]) {
            await base44.asServiceRole.entities.CalendarSynthesis.update(existing[0].id, payload);
          } else {
            await base44.asServiceRole.entities.CalendarSynthesis.create(payload);
          }
        }

        results.push({ id: chart.id, user_id: chart.user_id, status: 'ok', items: syntheses.length });
      } catch (err) {
        results.push({ id: chart.id, status: 'error', error: err.message });
      }
    }

    // Count remaining charts needing synthesis
    let remaining = 0;
    if (!chart_id && !process_all) {
      for (const c of charts) {
        const raw = c.raw_data || {};
        if (!raw.birth_date || !raw.planets?.length) continue;
        if (toProcess.find(p => p.id === c.id)) continue;
        const depth = await fetchKnowledgeDepth(base44, c.user_id);
        const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
          user_id: c.user_id,
          period_key: `day-v20-${dk}-${depth}`,
        });
        if (!existing.length) remaining++;
      }
    }

    return Response.json({ total: results.length, results, remaining });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});