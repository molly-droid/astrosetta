/**
 * Relationship-layer (synastry) synthesis pipeline.
 *
 * Powers the Planner's relationship mode: a symmetric read of a period woven
 * through the relationship between the user's natal chart and a selected saved
 * chart (partner, friend, etc.). Reuses the existing chartCalculator transit
 * pipeline (one transit call per chart per date) and the chartCalculator
 * synastry endpoint for the static natal cross-aspects, then hands both to the
 * LLM with a symmetric framing directive.
 *
 * Shared by RelationshipDaySynthesis / RelationshipWeekSynthesis /
 * RelationshipMonthSynthesis so the three period views stay consistent.
 */
import { base44 } from '@/api/base44Client';
import { processTransits } from '@/components/planner/useTransits';
import { formatTransitLabelProse } from '@/lib/transitUtils';
import { getMoonPhaseName } from '@/lib/moonPhase';

/**
 * Fetch transits-to-natal for a single chart on a single date.
 * `hiddenPoints` (a Set from getHiddenChartPoints) is forwarded to
 * processTransits so hidden asteroids/lots/nodes/lilith drop out of the
 * transit data feeding the relationship prompts.
 * Returns the same shape as useTransits' processTransits.
 */
export async function fetchTransitsForChart(date, chart, hiddenPoints) {
  const raw = chart?.raw_data || {};
  if (!raw.birth_date || raw.birth_location?.latitude == null) return null;
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const utcOffset = raw.utc_offset ?? (date ? -date.getTimezoneOffset() / 60 : 0);
  const res = await base44.functions.invoke('chartCalculator', {
    chart_type: 'transit',
    birth_date: raw.birth_date,
    birth_time: raw.birth_time || '12:00:00',
    birth_location: raw.birth_location,
    transit_date: dateKey,
    transit_time: '12:00:00',
    utc_offset: utcOffset,
    natal_planets_override: raw.planets || [],
    house_system: raw.house_system || 'whole_sign',
  });
  return processTransits(res.data, raw, hiddenPoints);
}

/**
 * Fetch the static natal cross-aspects between two charts (synastry).
 * Cached in module memory keyed by chart pair so repeated period reads reuse it.
 */
const crossAspectCache = {};
export async function fetchNatalCrossAspects(userChart, partnerChart) {
  const key = `${userChart?.id}__${partnerChart?.id}`;
  if (crossAspectCache[key]) return crossAspectCache[key];
  const natalRaw = userChart?.raw_data || {};
  const partnerRaw = partnerChart?.raw_data || {};
  if (!natalRaw.birth_date || !partnerRaw.birth_date) return [];
  try {
    const res = await base44.functions.invoke('chartCalculator', {
      chart_type: 'synastry',
      chart1: {
        birth_date: natalRaw.birth_date,
        birth_time: natalRaw.birth_time || '12:00:00',
        birth_location: natalRaw.birth_location,
        utc_offset: natalRaw.utc_offset ?? 0,
      },
      chart2: {
        birth_date: partnerRaw.birth_date,
        birth_time: partnerRaw.birth_time || '12:00:00',
        birth_location: partnerRaw.birth_location,
        utc_offset: partnerRaw.utc_offset ?? 0,
      },
      house_system: natalRaw.house_system || 'whole_sign',
    });
    const aspects = res.data?.cross_aspects || [];
    crossAspectCache[key] = aspects;
    return aspects;
  } catch {
    return [];
  }
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function chartBig3(chart) {
  const r = chart?.raw_data || {};
  return `☉ ${chart.sun_sign || r.sun_sign || '?'} · ☽ ${chart.moon_sign || r.moon_sign || '?'} · ASC ${chart.ascendant_sign || r.ascendant_sign || '?'}`;
}

function chartPlanetsLine(chart) {
  const r = chart?.raw_data || {};
  return (r.planets || [])
    .map(p => `${p.name} in ${p.sign}${p.house ? ` (${p.house}H)` : ''}${p.retrograde ? ' ℞' : ''}`)
    .join(', ');
}

function transitsForPrompt(transits, label) {
  if (!transits) return `${label}: data unavailable.`;
  const tPls = transits.transitPlanets || [];
  const natalPls = transits.natalPlanets || [];
  const natal = (transits.natalAspects || [])
    .map(a => formatTransitLabelProse(a, tPls, natalPls, false));
  const lunar = (transits.lunarAspects || [])
    .map(a => formatTransitLabelProse(a, tPls, natalPls, false));
  const mundane = (transits.mundaneAspects || [])
    .map(a => formatTransitLabelProse(a, tPls, tPls, true));
  const stations = (transits.stations || [])
    .map(s => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`);
  const ingresses = (transits.ingresses || [])
    .map(ing => `${ing.planet} enters ${ing.to_sign} (leaving ${ing.from_sign})`);
  const moon = tPls.find(p => p.name === 'Moon');
  const sun = tPls.find(p => p.name === 'Sun');
  const moonInfo = moon ? `Moon in ${moon.sign}${(moon && sun) ? ` (${getMoonPhaseName(moon.longitude, sun.longitude)})` : ''}` : '';
  return `${label}:
${moonInfo ? moonInfo + '.' : ''}
Personal transits to natal: ${natal.length ? natal.join('; ') : 'none today.'}
Lunar (Moon to natal): ${lunar.length ? lunar.join('; ') : 'none today.'}
Mundane (sky weather): ${mundane.length ? mundane.join('; ') : 'none today.'}
Stations: ${stations.length ? stations.join('; ') : 'none today.'}
Ingresses: ${ingresses.length ? ingresses.join('; ') : 'none today.'}`;
}

function crossAspectsForPrompt(crossAspects, userName, partnerName) {
  if (!crossAspects?.length) return 'No major natal cross-aspects.';
  // Sort by orb (tightest first), keep the most significant
  const sorted = [...crossAspects].sort((a, b) => (a.orb ?? 9) - (b.orb ?? 9));
  return sorted.slice(0, 16).map(a =>
    `${userName}'s ${a.person1_planet} ${a.aspect} ${partnerName}'s ${a.person2_planet} (orb ${a.orb?.toFixed(1)}°)`
  ).join('; ');
}

function transitPositionsLine(transits) {
  if (!transits) return '';
  return (transits.transitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');
}

// ── Task-param builders ─────────────────────────────────────────────────────
// Each assembles the astrological fact blocks for the corresponding named
// server-side task (supabase/functions/_shared/llm_tasks/tasks_relationship.ts),
// which owns the directives, rules, and JSON schemas.

/**
 * Build the DAY relationship task params ('relationship-day-synthesis').
 */
export function buildDayParams({ date, userChart, partnerChart, userTransits, partnerTransits, crossAspects }) {
  const userName = 'You';
  const partnerName = partnerChart?.name || 'your partner';
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return {
    partnerName,
    relationship: partnerChart?.relationship || '',
    dateStr,
    userBig3: chartBig3(userChart),
    userPlanets: chartPlanetsLine(userChart),
    partnerBig3: chartBig3(partnerChart),
    partnerPlanets: chartPlanetsLine(partnerChart),
    crossAspects: crossAspectsForPrompt(crossAspects, userName, partnerName),
    transitPositions: transitPositionsLine(userTransits),
    userTransitsBlock: transitsForPrompt(userTransits, 'TRANSITS TO YOUR CHART'),
    partnerTransitsBlock: transitsForPrompt(partnerTransits, `TRANSITS TO ${partnerName.toUpperCase()}'S CHART`),
  };
}

/**
 * Build the WEEK relationship task params ('relationship-week-synthesis').
 */
export function buildWeekParams({ days, userChart, partnerChart, userDayTransits, partnerDayTransits, crossAspects }) {
  const partnerName = partnerChart?.name || 'your partner';
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekRange = `${days[0].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}`;

  const dayLines = days.map((d, i) => {
    const u = userDayTransits[i];
    const p = partnerDayTransits[i];
    const uNatal = (u?.natalAspects || []).map(a => {
      const tPls = u.transitPlanets || []; const nPls = u.natalPlanets || [];
      return formatTransitLabelProse(a, tPls, nPls, false);
    });
    const pNatal = (p?.natalAspects || []).map(a => {
      const tPls = p.transitPlanets || []; const nPls = p.natalPlanets || [];
      return formatTransitLabelProse(a, tPls, nPls, false);
    });
    const uMoon = u?.transitPlanets?.find(x => x.name === 'Moon');
    const moonInfo = uMoon ? `Moon in ${uMoon.sign}` : '';
    return `${DOW[d.getDay()]} ${d.getDate()}: ${moonInfo}. To you: ${uNatal.join(', ') || 'quiet'}. To ${partnerName}: ${pNatal.join(', ') || 'quiet'}.`;
  });

  return {
    partnerName,
    relationship: partnerChart?.relationship || '',
    weekRange,
    userBig3: chartBig3(userChart),
    partnerBig3: chartBig3(partnerChart),
    crossAspects: crossAspectsForPrompt(crossAspects, 'You', partnerName),
    transitPositions: transitPositionsLine(userDayTransits[0]),
    dayLines: dayLines.join('\n'),
  };
}

/**
 * Build the MONTH relationship task params ('relationship-month-synthesis').
 */
export function buildMonthParams({ date, userChart, partnerChart, userTransits, partnerTransits, crossAspects }) {
  const partnerName = partnerChart?.name || 'your partner';
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const uNatal = (userTransits?.natalAspects || []).map(a => {
    const tPls = userTransits.transitPlanets || []; const nPls = userTransits.natalPlanets || [];
    return formatTransitLabelProse(a, tPls, nPls, false);
  });
  const pNatal = (partnerTransits?.natalAspects || []).map(a => {
    const tPls = partnerTransits.transitPlanets || []; const nPls = partnerTransits.natalPlanets || [];
    return formatTransitLabelProse(a, tPls, nPls, false);
  });
  const slowPositions = (userTransits?.transitPlanets || [])
    .filter(p => ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'].includes(p.name))
    .map(p => `${p.name} in ${p.sign}${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  // Lunations from the user's transit sample
  const moon = userTransits?.transitPlanets?.find(p => p.name === 'Moon');
  const sun = userTransits?.transitPlanets?.find(p => p.name === 'Sun');
  let lunation = '';
  if (moon && sun) {
    const phase = getMoonPhaseName(moon.longitude, sun.longitude);
    if (phase === 'New Moon') lunation = `New Moon in ${moon.sign}`;
    else if (phase === 'Full Moon') lunation = `Full Moon in ${moon.sign}`;
  }

  return {
    partnerName,
    relationship: partnerChart?.relationship || '',
    monthName,
    userBig3: chartBig3(userChart),
    userPlanets: chartPlanetsLine(userChart),
    partnerBig3: chartBig3(partnerChart),
    partnerPlanets: chartPlanetsLine(partnerChart),
    crossAspects: crossAspectsForPrompt(crossAspects, 'You', partnerName),
    transitPositions: transitPositionsLine(userTransits),
    slowPositions,
    userActive: uNatal.join('; '),
    partnerActive: pNatal.join('; '),
    lunation,
  };
}
