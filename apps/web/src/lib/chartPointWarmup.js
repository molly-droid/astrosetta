/**
 * Chart-point warm-up (PF-01, second half).
 *
 * The overnight pre-generation job covers the ten classic planets and the
 * twelve houses — the points every chart shows. The extra points (nodes,
 * Lilith, Arabic Lots, asteroids) are deliberately left out of it, because
 * most accounts never switch them on. Since UX-02 made all five toggles
 * default OFF, though, every one of those points was a first-tap wait.
 *
 * So: the moment a Chart Display toggle is switched ON, generate the readings
 * it just revealed, rather than waiting for the user to tap each card.
 *
 * The item shapes here must match what MyChart's Placements tab passes to
 * InterpretCard, because `buildTaskParams` hashes them into the persistence
 * key. A mismatch is harmless (the tap just regenerates) but wastes the work,
 * so the two chartContext choices below mirror MyChart exactly: planets get
 * the house-stripped `wheelData`, nodes get the untouched `raw`.
 */
import { preloadInterpretation } from '@/components/chart/InterpretationDrawer';
import { pointsForToggle } from './chartPointVisibility';

/**
 * MyChart's `wheelData`: an unknown-time chart carries no houses, angles or
 * rising sign, and its planets have no house. Mirrored here so the params
 * (and therefore the cache key) match what the card will ask for.
 */
function wheelDataFor(raw) {
  if (!raw?.unknown_time) return raw;
  return {
    ...raw,
    houses: [],
    angles: {},
    ascendant_sign: '',
    planets: (raw.planets || []).map((p) => ({ ...p, house: null })),
    nodes: Object.fromEntries(
      Object.entries(raw.nodes || {}).map(([k, n]) => [k, { ...n, house: null }]),
    ),
  };
}

function nodeItem(raw, which) {
  const nodes = raw?.nodes || {};
  const self = which === 'north' ? nodes.north_node : nodes.south_node;
  const other = which === 'north' ? nodes.south_node : nodes.north_node;
  if (!self) return null;
  const name = which === 'north' ? 'North Node' : 'South Node';
  return {
    key: `planet_${name}`,
    type: 'node',
    nodeType: which,
    name,
    sign: self.sign,
    house: self.house,
    longitude: self.longitude,
    degree: self.degree,
    oppositeSign: other?.sign,
  };
}

/**
 * Warm the interpretations a freshly-enabled toggle reveals.
 *
 * Fire-and-forget: `preloadInterpretation` stores the in-flight promise, so a
 * tap arriving mid-generation joins it rather than starting a second call.
 *
 * No-ops when the reading would not be readable anyway — a non-Core account
 * sees a paywall on these cards instead of text, and generating for it would
 * spend the account's daily LLM quota on something it can't open.
 */
export function warmChartPointsForToggle({ toggleKey, chart, canInterpret }) {
  if (!canInterpret) return;
  const raw = chart?.raw_data || chart;
  if (!raw?.planets?.length) return;

  const names = pointsForToggle(toggleKey);
  if (!names.length) return; // show_angles: nothing to generate

  const wheelData = wheelDataFor(raw);

  for (const name of names) {
    if (name === 'North Node' || name === 'South Node') {
      const item = nodeItem(raw, name === 'North Node' ? 'north' : 'south');
      if (item) preloadInterpretation(item, raw);
      continue;
    }
    // Lots, Lilith and the asteroid pack all live in the planets array.
    const p = (wheelData.planets || []).find((x) => x.name === name);
    if (!p) continue; // not every chart carries every asteroid
    preloadInterpretation({ key: `planet_${p.name}`, type: 'planet', ...p }, wheelData);
  }
}
