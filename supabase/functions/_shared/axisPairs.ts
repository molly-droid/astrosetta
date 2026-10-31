/**
 * B-31: the two ends of a fixed axis (North Node–South Node, Ascendant–
 * Descendant, Midheaven–IC) are always exactly opposite by construction, so
 * an "aspect" between them is geometry, not astrology. Every aspect-building
 * loop must skip these pairs — including across the transit/natal boundary,
 * where a node-to-opposite-node contact merely duplicates the matching
 * node-to-same-node one. Mirrored client-side in apps/web/src/lib/axisPairs.js.
 */
const AXIS_PARTNER: Record<string, string> = {
  'North Node': 'South Node',
  'South Node': 'North Node',
  Ascendant: 'Descendant',
  Descendant: 'Ascendant',
  Midheaven: 'IC',
  IC: 'Midheaven',
};

export function isAxisPair(nameA: string, nameB: string): boolean {
  return (AXIS_PARTNER[nameA] ?? null) === nameB;
}
