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
import {
  PERSONA,
  TONE_DIRECTIVE,
  formatTransitLabelProse,
  PLANET_GLYPHS,
  ASPECT_GLYPHS,
} from '@/lib/transitUtils';
import { getMoonPhaseName } from '@/lib/moonPhase';

/**
 * Directive that makes the read SYMMETRIC — either person's activations are
 * fair game, and everything is framed through the bond rather than one chart.
 */
export const RELATIONSHIP_DIRECTIVE = `RELATIONSHIP LENS — SYMMETRIC, NOT ONE-SIDED:
- You are reading the period THROUGH THE RELATIONSHIP between two people. Either person's transits are fair game for the narrative — do not center one chart over the other. Weave them together.
- Frame every effect through the bond: how a transit landing on one person ripples into the connection, what it asks of the relationship, where it creates ease or friction between them.
- Use "you" for the user (the app owner) and the partner's first name for the saved chart. Never speak as if you know what either person is experiencing — keep the invitational tone from the TONE directive.
- Name BOTH people's placements when a transit activates one and connects to the other (e.g. "Saturn's square to your partner's Venus, landing on their 7th house, asks the relationship to get real about commitment").
- The static natal cross-aspects are the RELATIONSHIP'S anatomy — the wired-in chemistry. The transits are what's ACTIVATING that anatomy this period. Connect the two: a transit to one person's planet that sits in a tight cross-aspect to the other person's planet is especially charged.`;

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

// ── Prompt builders ──────────────────────────────────────────────────────────

/**
 * Build the DAY relationship prompt.
 */
export function buildDayPrompt({ date, userChart, partnerChart, userTransits, partnerTransits, crossAspects }) {
  const userName = 'You';
  const partnerName = partnerChart?.name || 'your partner';
  const relationship = partnerChart?.relationship;
  const relLine = relationship && relationship !== 'Other'
    ? `${partnerName} is your ${relationship.toLowerCase()}. Frame the read through the lens of a ${relationship.toLowerCase()} bond where relevant.`
    : '';
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const transitPositions = transitPositionsLine(userTransits);

  return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Today: ${dateStr}
${relLine}

YOUR CHART (the app user): ${chartBig3(userChart)}
Your planets: ${chartPlanetsLine(userChart) || 'unavailable'}

${partnerName.toUpperCase()}'S CHART: ${chartBig3(partnerChart)}
${partnerName}'s planets: ${chartPlanetsLine(partnerChart) || 'unavailable'}

NATAL CROSS-ASPECTS (the wired-in chemistry between you two — the relationship's anatomy):
${crossAspectsForPrompt(crossAspects, userName, partnerName)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

=== TODAY'S TRANSITS, TO EACH CHART ===
${transitsForPrompt(userTransits, 'TRANSITS TO YOUR CHART')}

${transitsForPrompt(partnerTransits, `TRANSITS TO ${partnerName.toUpperCase()}'S CHART`)}

Rules:
- THIS IS A RELATIONSHIP READ, NOT TWO SOLO READS. Weave the two charts together symmetrically — either person's transits can lead a sentence, and every transit should be connected to what it means for the BOND.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed. If a category says "none," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are.
- Every time you name a transit, name the transiting planet, its current sign, the aspect, and the natal planet + house — in full WORDS (no glyph symbols; the frontend adds glyphs). Then explain how it lands on the relationship.
- Connect transits to the natal cross-aspects where charged: if a transit hits a planet that's in a tight cross-aspect to the other person's planet, say so — that's where the relationship gets activated.
- Use "you" for the user and "${partnerName}" (first name) for the partner. Never use bare "your" for the partner's placements.
- Do NOT include raw glyph symbols, em-dash labels, "applying," or "separating." Write only prose.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening for the relationship today — weave transits to both charts into one coherent narrative naming the key configurations and where the relationship is lit up.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme today, framed through the bond (not one person).",
  "personal_reading": ["TransitLabel (which chart it hits) — 2-3 sentence interpretation of the mechanic and how it lands on the relationship", "..."],
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

/**
 * Build the WEEK relationship prompt.
 */
export function buildWeekPrompt({ days, userChart, partnerChart, userDayTransits, partnerDayTransits, crossAspects }) {
  const partnerName = partnerChart?.name || 'your partner';
  const relationship = partnerChart?.relationship;
  const relLine = relationship && relationship !== 'Other'
    ? `${partnerName} is your ${relationship.toLowerCase()}. Frame the read through the lens of a ${relationship.toLowerCase()} bond where relevant.`
    : '';
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

  const transitPositions = transitPositionsLine(userDayTransits[0]);

  return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Week: ${weekRange}
${relLine}

YOUR CHART: ${chartBig3(userChart)}
${partnerName.toUpperCase()}'S CHART: ${chartBig3(partnerChart)}

NATAL CROSS-ASPECTS (the relationship's wired-in chemistry):
${crossAspectsForPrompt(crossAspects, 'You', partnerName)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

DAILY TRANSITS (slow planets, to each chart):
${dayLines.join('\n')}

Rules:
- THIS IS A RELATIONSHIP READ. Weave both charts symmetrically; frame the week through the bond.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- For days with no personal aspects to either chart, write the day_sentence about Moon sign energy.
- Each day_sentences entry max 18 words. Never repeat the same energy across days.
- When naming aspects in prose, write them as "PlanetName aspectName PlanetName" using FULL names. Never abbreviations.
- Do NOT include raw glyph symbols or em-dash labels. Write only prose.

Return JSON:
{
  "overview": "2-3 sentences on the overall energy of the week for the relationship, referencing specific transits to either chart.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme this week, framed through the bond.",
  "personal_focus": "1-2 sentences on the most significant personal transit theme for the user this week.",
  "collective_theme": "1 sentence on the collective backdrop for everyone.",
  "collective_tags": ["theme1", "theme2"],
  "maximize": ["opportunity1", "opportunity2", "opportunity3"],
  "focus": "1 attention sentence tied to a specific transit this week",
  "watch": ["caution1", "caution2"],
  "best_areas": ["area1", "area2", "area3"],
  "day_sentences": {
    "0": "Sun sentence", "1": "Mon sentence", "2": "Tue sentence",
    "3": "Wed sentence", "4": "Thu sentence", "5": "Fri sentence", "6": "Sat sentence"
  }
}`;
}

/**
 * Build the MONTH relationship prompt.
 */
export function buildMonthPrompt({ date, userChart, partnerChart, userTransits, partnerTransits, crossAspects }) {
  const partnerName = partnerChart?.name || 'your partner';
  const relationship = partnerChart?.relationship;
  const relLine = relationship && relationship !== 'Other'
    ? `${partnerName} is your ${relationship.toLowerCase()}. Frame the read through the lens of a ${relationship.toLowerCase()} bond where relevant.`
    : '';
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
  const transitPositions = transitPositionsLine(userTransits);

  // Lunations from the user's transit sample
  const moon = userTransits?.transitPlanets?.find(p => p.name === 'Moon');
  const sun = userTransits?.transitPlanets?.find(p => p.name === 'Sun');
  let lunation = '';
  if (moon && sun) {
    const phase = getMoonPhaseName(moon.longitude, sun.longitude);
    if (phase === 'New Moon') lunation = `New Moon in ${moon.sign}`;
    else if (phase === 'Full Moon') lunation = `Full Moon in ${moon.sign}`;
  }

  return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Month: ${monthName}
${relLine}

YOUR CHART: ${chartBig3(userChart)}
Your planets: ${chartPlanetsLine(userChart) || 'unavailable'}

${partnerName.toUpperCase()}'S CHART: ${chartBig3(partnerChart)}
${partnerName}'s planets: ${chartPlanetsLine(partnerChart) || 'unavailable'}

NATAL CROSS-ASPECTS (the relationship's wired-in chemistry):
${crossAspectsForPrompt(crossAspects, 'You', partnerName)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

Slow planet positions this month: ${slowPositions || 'unavailable'}
Active transits to YOUR chart: ${uNatal.join('; ') || 'none exact'}
Active transits to ${partnerName.toUpperCase()}'S chart: ${pNatal.join('; ') || 'none exact'}
${lunation ? `Lunation: ${lunation}` : ''}

Rules:
- THIS IS A RELATIONSHIP READ. Weave both charts symmetrically; frame the month through the bond.
- Use ONLY the transit data provided. Do NOT mention any transit, aspect, or lunation not listed.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- Connect the month's transits to the natal cross-aspects where charged.
- Do NOT include raw glyph symbols or em-dash labels. Write only prose.

Return JSON:
- overview: 2-3 sentences summarizing the month's energy for the relationship, referencing specific transits to either chart and lunations
- relationship_focus: 1-2 sentences on the single most important relationship theme this month, framed through the bond
- personal_focus: 1-2 sentences on the most significant personal transit theme for the user this month
- collective_theme: 1 sentence on the collective backdrop
- collective_tags: array of 2-3 thematic labels
- maximize: array of 3 opportunities for the relationship this month
- focus: 1 attention sentence tied to a specific transit this month
- watch: array of 2 cautions for the relationship this month
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]`;
}

// ── JSON schemas (shared so the LLM call is consistent) ─────────────────────
export const DAY_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    relationship_focus: { type: 'string' },
    personal_reading: { type: 'array', items: { type: 'string' } },
    collective_reading: { type: 'array', items: { type: 'string' } },
    collective_highlight: { type: 'string' },
    maximize: { type: 'string' },
    focus: { type: 'string' },
    watch: { type: 'string' },
    best_areas: { type: 'array', items: { type: 'string' } },
    power_planet: { type: 'string' },
    key_themes: { type: 'array', items: { type: 'string' } },
  },
  required: ['overview', 'relationship_focus', 'personal_reading', 'collective_reading', 'maximize', 'focus', 'watch', 'best_areas'],
};

export const WEEK_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    relationship_focus: { type: 'string' },
    personal_focus: { type: 'string' },
    collective_theme: { type: 'string' },
    collective_tags: { type: 'array', items: { type: 'string' } },
    maximize: { type: 'array', items: { type: 'string' } },
    focus: { type: 'string' },
    watch: { type: 'array', items: { type: 'string' } },
    best_areas: { type: 'array', items: { type: 'string' } },
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
  },
  required: ['overview', 'relationship_focus', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas', 'day_sentences'],
};

export const MONTH_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    relationship_focus: { type: 'string' },
    personal_focus: { type: 'string' },
    collective_theme: { type: 'string' },
    collective_tags: { type: 'array', items: { type: 'string' } },
    maximize: { type: 'array', items: { type: 'string' } },
    focus: { type: 'string' },
    watch: { type: 'array', items: { type: 'string' } },
    best_areas: { type: 'array', items: { type: 'string' } },
  },
  required: ['overview', 'relationship_focus', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas'],
};

export { PLANET_GLYPHS, ASPECT_GLYPHS, TONE_DIRECTIVE };