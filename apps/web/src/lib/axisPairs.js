/**
 * B-31: the two ends of a fixed axis (North Node–South Node, Ascendant–
 * Descendant, Midheaven–IC) are always exactly opposite by construction, so
 * an "aspect" between them is geometry, not astrology. Every aspect-building
 * loop must skip these pairs — including across the transit/natal boundary,
 * where a node-to-opposite-node contact merely duplicates the matching
 * node-to-same-node one. Mirrored server-side in _shared/axisPairs.ts.
 */
const AXIS_PARTNER = {
  'North Node': 'South Node',
  'South Node': 'North Node',
  Ascendant: 'Descendant',
  Descendant: 'Ascendant',
  Midheaven: 'IC',
  IC: 'Midheaven',
};

export function isAxisPair(nameA, nameB) {
  return (AXIS_PARTNER[nameA] || null) === nameB;
}
