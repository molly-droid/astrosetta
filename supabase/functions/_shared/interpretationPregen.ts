/**
 * interpretationPregen — shared pieces for pre-generating chart
 * interpretations (PF-03): the persistence key and the fact-param builders.
 *
 * KEEP IN SYNC with apps/web/src/lib/interpretationStore.js
 * (interpretationKey) and the planet/house branches of buildTaskParams in
 * apps/web/src/components/chart/InterpretationDrawer.jsx — the client finds a
 * pre-generated row only when the hash of identically-built params matches.
 * Drift is safe (the client just regenerates on demand) but wastes the
 * pre-generated rows.
 */

// Mirrors HOUSE_NAMES in apps/web/src/lib/houseUtils.js
const HOUSE_NAMES = [
  '',
  '1st House of Identity & First Impressions',
  '2nd House of Values & Resources',
  '3rd House of Communication & Community',
  '4th House of Home & Roots',
  '5th House of Creativity & Joy',
  '6th House of Health & Daily Routine',
  '7th House of Partnerships & Relationships',
  '8th House of Transformation & Shared Resources',
  '9th House of Beliefs & Expansion',
  '10th House of Career & Public Life',
  '11th House of Community & Future Vision',
  '12th House of Solitude & the Unconscious',
];

function getHouseName(number: number): string {
  return HOUSE_NAMES[number] || `House ${number}`;
}

/** Same djb2-over-sorted-JSON key the client's interpretationStore computes. */
export function interpretationKey(task: string, params: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(params || {}).sort()) sorted[k] = params[k];
  const str = `${task}|${JSON.stringify(sorted)}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return `interp-v1-${h.toString(36)}`;
}

// The classic planets the Placements tab always shows (extra points — nodes,
// asteroids, lots — stay on-demand).
const PREGEN_PLANETS = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

export interface PregenItem {
  label: string; // for logs/summary — matches the client's item.key
  params: Record<string, unknown>;
  key: string; // period_key
}

/**
 * The deep-dive items to pre-generate for a chart: each classic planet
 * placement and each house. Known-birth-time charts only — unknown-time
 * charts hide houses and build different params, and stay on-demand.
 */
export function pregenItemsForChart(raw: Record<string, unknown>): PregenItem[] {
  if (raw.unknown_time) return [];
  const planets = (raw.planets as Array<Record<string, unknown>>) || [];
  const houses = (raw.houses as Array<Record<string, unknown>>) || [];
  if (!planets.length || !houses.length) return [];

  // Identical to the client's ctx in buildTaskParams.
  const ctx = `Sun in ${raw.sun_sign || ''}, Moon in ${raw.moon_sign || ''}, Rising ${raw.ascendant_sign || ''}`;

  const items: PregenItem[] = [];
  for (const p of planets) {
    if (!PREGEN_PLANETS.has(p.name as string) || p.house == null) continue;
    const params = {
      kind: 'planet',
      ctx,
      name: p.name,
      sign: p.sign,
      houseName: getHouseName(p.house as number),
      retrograde: !!p.retrograde,
    };
    items.push({ label: `planet_${p.name}`, params, key: interpretationKey('interpretation-deep-dive', params) });
  }
  for (let i = 0; i < Math.min(houses.length, 12); i++) {
    const h = houses[i];
    const params = { kind: 'house', ctx, houseName: getHouseName(i + 1), sign: h.sign };
    items.push({ label: `house_${i + 1}`, params, key: interpretationKey('interpretation-deep-dive', params) });
  }
  return items;
}
