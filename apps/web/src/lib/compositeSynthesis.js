/**
 * Composite-chart synthesis pipeline.
 *
 * Pairs with compositeChart.js — once the composite `raw_data` is built, this
 * fetches transits TO the composite chart (the relationship as a single entity)
 * for a given date and hands them to the LLM with a composite-framing directive.
 *
 * The composite has no real birth time/place, so transit planet positions are
 * sampled using the user's chart as the "shell" (birth_date/birth_location) —
 * transit positions depend only on the date, not the natal chart — while the
 * composite planets are passed in as the natal override so transit aspects are
 * computed against the relationship, not either person.
 */
import { base44 } from '@/api/base44Client';
import { processTransits } from '@/components/planner/useTransits';
import { mergeNatalPoints, formatTransitLabelProse } from '@/lib/transitUtils';
import { getMoonPhaseName } from '@/lib/moonPhase';
import { buildCompositeRaw } from '@/lib/compositeChart';

/** Wrap a composite raw_data in a chart-like object (mirrors SavedChart/Chart shape). */
export function buildCompositeChartObject(userChart, partnerChart, hiddenPoints) {
  const raw = buildCompositeRaw(userChart?.raw_data, partnerChart?.raw_data, hiddenPoints);
  if (!raw) return null;
  return {
    raw_data: raw,
    sun_sign: raw.sun_sign,
    moon_sign: raw.moon_sign,
    ascendant_sign: raw.ascendant_sign,
  };
}

/**
 * Fetch transits to the composite chart for a single date.
 * Uses the user's chart as the shell for birth_date/birth_location (transit
 * planet positions are date-dependent, not natal-dependent) and the composite
 * planets as the natal override so aspects hit the relationship.
 */
export async function fetchCompositeTransits(date, compositeRaw, shellChart, hiddenPoints) {
  const shell = shellChart?.raw_data || {};
  if (!shell.birth_date || shell.birth_location?.latitude == null) return null;
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const utcOffset = shell.utc_offset ?? (date ? -date.getTimezoneOffset() / 60 : 0);
  const res = await base44.functions.invoke('chartCalculator', {
    chart_type: 'transit',
    birth_date: shell.birth_date,
    birth_time: shell.birth_time || '12:00:00',
    birth_location: shell.birth_location,
    transit_date: dateKey,
    transit_time: '12:00:00',
    utc_offset: utcOffset,
    natal_planets_override: compositeRaw.planets || [],
    house_system: 'whole_sign',
  });
  const processed = processTransits(res.data, compositeRaw, hiddenPoints);
  // processTransits may fall back to the shell's natal from the backend
  // response — force natal planets to the composite so labels are correct.
  processed.natalPlanets = mergeNatalPoints(compositeRaw);
  return processed;
}

// ── Formatting helpers ──────────────────────────────────────────────────────
function compositeBig3(raw) {
  return `☉ ${raw.sun_sign || '?'} · ☽ ${raw.moon_sign || '?'} · ASC ${raw.ascendant_sign || '?'}`;
}

function compositePlanetsLine(raw) {
  return (raw.planets || [])
    .map((p) => `${p.name} in ${p.sign}${p.house ? ` (${p.house}H)` : ''}`)
    .join(', ');
}

function compositeAspectsLine(raw) {
  const a = raw.aspects || [];
  if (!a.length) return 'No major composite aspects.';
  return a.slice(0, 16).map((x) => `${x.planet1} ${x.aspect} ${x.planet2} (orb ${x.orb.toFixed(1)}°)`).join('; ');
}

function transitPositionsLine(transits) {
  if (!transits) return '';
  return (transits.transitPlanets || [])
    .filter((p) => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map((p) => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');
}

function transitsForPrompt(transits) {
  if (!transits) return 'Composite transits: data unavailable.';
  const tPls = transits.transitPlanets || [];
  const nPls = transits.natalPlanets || [];
  const natal = (transits.natalAspects || []).map((a) => formatTransitLabelProse(a, tPls, nPls, false));
  const lunar = (transits.lunarAspects || []).map((a) => formatTransitLabelProse(a, tPls, nPls, false));
  const mundane = (transits.mundaneAspects || []).map((a) => formatTransitLabelProse(a, tPls, tPls, true));
  const stations = (transits.stations || []).map((s) => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`);
  const ingresses = (transits.ingresses || []).map((ing) => `${ing.planet} enters ${ing.to_sign} (leaving ${ing.from_sign})`);
  const moon = tPls.find((p) => p.name === 'Moon');
  const sun = tPls.find((p) => p.name === 'Sun');
  const moonInfo = moon ? `Moon in ${moon.sign}${sun ? ` (${getMoonPhaseName(moon.longitude, sun.longitude)})` : ''}` : '';
  return `${moonInfo ? moonInfo + '.' : ''}
Transits to the composite chart: ${natal.length ? natal.join('; ') : 'none today.'}
Lunar (Moon to composite): ${lunar.length ? lunar.join('; ') : 'none today.'}
Mundane (sky weather): ${mundane.length ? mundane.join('; ') : 'none today.'}
Stations: ${stations.length ? stations.join('; ') : 'none today.'}
Ingresses: ${ingresses.length ? ingresses.join('; ') : 'none today.'}`;
}

// ── Task-param builder ──────────────────────────────────────────────────────
// Assembles the composite fact blocks for the 'composite-day-synthesis'
// server task (supabase/functions/_shared/llm_tasks/tasks_relationship.ts),
// which owns the composite directive, rules, and JSON schema.
export function buildCompositeDayParams({ date, partnerChart, compositeRaw, compositeTransits }) {
  const partnerName = partnerChart?.name || 'your partner';
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return {
    partnerName,
    dateStr,
    compositeBig3: compositeBig3(compositeRaw),
    compositePlanets: compositePlanetsLine(compositeRaw),
    compositeAspects: compositeAspectsLine(compositeRaw),
    transitPositions: transitPositionsLine(compositeTransits),
    transitsBlock: transitsForPrompt(compositeTransits),
  };
}
