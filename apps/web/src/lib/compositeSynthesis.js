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
import {
  mergeNatalPoints,
  PERSONA,
  formatTransitLabelProse,
  PLANET_GLYPHS,
  ASPECT_GLYPHS,
  TONE_DIRECTIVE,
} from '@/lib/transitUtils';
import { getMoonPhaseName } from '@/lib/moonPhase';
import { buildCompositeRaw } from '@/lib/compositeChart';

/**
 * Framing directive — the composite chart is read as the relationship itself,
 * not either person. Distinct from the synastry directive, which weaves two
 * individual charts together.
 */
export const COMPOSITE_DIRECTIVE = `COMPOSITE LENS — THE RELATIONSHIP AS ONE ENTITY:
- The composite chart is the chart of the RELATIONSHIP ITSELF: a single entity born from the midpoint of two people's placements. It is NOT either person.
- Transits to the composite chart show what is ACTIVATING THE RELATIONSHIP as a whole — not either individual. Frame every effect through the relationship as the subject ("the relationship is being asked to…", "this transit lands on the relationship's Venus…").
- The composite's internal aspects are the relationship's BUILT-IN DYNAMICS — its wired-in chemistry and tension points. The transits are what's activating those dynamics now. Connect them: a transit hitting a composite planet that sits in a tight internal aspect names exactly where the relationship gets lit up.
- Use "the relationship" or "your bond with [partner name]" as the subject. Use "you" only when directly addressing the user. Never speak as if you know what either person is experiencing — keep the invitational tone from the TONE directive.
- Composite Sun = the relationship's core identity; composite Moon = the relationship's emotional climate; composite Ascendant = how the relationship presents to the world; composite Venus = how the relationship loves; composite Saturn = the relationship's structure, limits, and commitments.`;

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

// ── Prompt builder ──────────────────────────────────────────────────────────
export function buildCompositeDayPrompt({ date, partnerChart, compositeRaw, compositeTransits }) {
  const partnerName = partnerChart?.name || 'your partner';
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const transitPositions = transitPositionsLine(compositeTransits);

  return `${PERSONA}

${COMPOSITE_DIRECTIVE}

Today: ${dateStr}
Reading the relationship between you and ${partnerName} as a single composite entity.

COMPOSITE CHART (the relationship itself):
Big 3: ${compositeBig3(compositeRaw)}
Composite planets: ${compositePlanetsLine(compositeRaw) || 'unavailable'}

COMPOSITE INTERNAL ASPECTS (the relationship's built-in dynamics — its wired-in chemistry and tension points):
${compositeAspectsLine(compositeRaw)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

=== TODAY'S TRANSITS, TO THE COMPOSITE CHART ===
${transitsForPrompt(compositeTransits)}

Rules:
- THIS IS A COMPOSITE READ. The subject is the RELATIONSHIP, not either person. Frame every transit through what it activates in the relationship as a whole.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed. If a category says "none," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- Every time you name a transit, name the transiting planet, its current sign, the aspect, and the composite planet + house — in full WORDS (no glyph symbols; the frontend adds glyphs). Then explain how it activates the relationship.
- Connect transits to the composite's internal aspects where charged: if a transit hits a composite planet that sits in a tight internal aspect, name it — that's where the relationship gets activated.
- Use "the relationship" or "your bond with ${partnerName}" as the subject. Never use bare "your" for either person's placements.
- Do NOT include raw glyph symbols, em-dash labels, "applying," or "separating." Write only prose.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening for the relationship today — weave transits to the composite chart into one coherent narrative naming the key configurations and where the relationship is lit up.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme today, framed through the composite chart.",
  "personal_reading": ["TransitLabel — 2-3 sentence interpretation of the mechanic and how it activates the relationship's built-in dynamics", "..."],
  "collective_reading": ["PlanetName aspectName PlanetName — 1 sentence on collective meaning", "..."],
  "collective_highlight": "1 sentence on the single most significant mundane transit",
  "maximize": "1 action sentence for the relationship today",
  "focus": "1 attention sentence for the relationship today",
  "watch": "1 caution sentence for the relationship today",
  "best_areas": ["area1", "area2"],
  "power_planet": "planet name",
  "key_themes": ["theme1", "theme2", "theme3"]
}`;
}

// Reuse the synastry day schema — the composite read returns the same shape so
// the rendering component can stay identical.
export { DAY_SCHEMA } from '@/lib/relationshipSynthesis';
export { PLANET_GLYPHS, ASPECT_GLYPHS, TONE_DIRECTIVE };