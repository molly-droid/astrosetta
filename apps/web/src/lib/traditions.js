/**
 * Astrological Traditions — shared frontend config.
 *
 * Each tradition maps to a canonical chart-calculation profile (zodiac + house
 * system) and a distinct interpretive lens. The Tradition selector (Profile)
 * is gated to Core/Premium tiers; the curriculum is free for all users.
 */

export const TRADITIONS = [
  {
    key: 'modern',
    label: 'Modern Psychological',
    short: 'Modern',
    glyph: '♅\uFE0E',
    descriptor: 'Tropical · Placidus · archetypal depth & outer-planet co-rulerships',
    color: '#B8A5C8',
    houseSystem: 'placidus',
    zodiac: 'tropical',
  },
  {
    key: 'hellenistic',
    label: 'Hellenistic',
    short: 'Hellenistic',
    glyph: '⊕',
    descriptor: 'Tropical · Whole Sign · sect, essential dignities & lots',
    color: '#5B8FB9',
    houseSystem: 'whole_sign',
    zodiac: 'tropical',
  },
  {
    key: 'vedic',
    label: 'Vedic / Jyotish',
    short: 'Vedic',
    glyph: '✦',
    descriptor: 'Sidereal (Lahiri) · Whole Sign · nakshatras & divisional charts',
    color: '#E8A030',
    houseSystem: 'whole_sign',
    zodiac: 'sidereal',
  },
];

export const TRADITION_MAP = TRADITIONS.reduce((m, t) => {
  m[t.key] = t;
  return m;
}, {});

export function getTradition(key) {
  return TRADITION_MAP[key] || TRADITION_MAP.modern;
}

/**
 * The canonical house system a tradition defaults to when activated.
 * The user can still override via the House System toggle afterward.
 */
export function traditionHouseSystem(key) {
  return getTradition(key).houseSystem;
}

/**
 * What changes when a user activates a tradition — shown in the confirmation dialog.
 */
export function traditionChangeSummary(key) {
  const t = getTradition(key);
  const zodiac = t.zodiac === 'sidereal' ? 'sidereal zodiac (Lahiri ayanamsa)' : 'tropical zodiac';
  const houses = t.houseSystem === 'whole_sign' ? 'Whole Sign houses' : 'Placidus houses';
  const lens = {
    modern: 'Outer-planet co-rulerships and archetypal, psychological depth are emphasised.',
    hellenistic: 'Sect determination, essential dignities, bonifications, and the lots are brought to the foreground.',
    vedic: 'Sidereal positions, nakshatras, and divisional-chart notes are flagged throughout.',
  }[key];
  return { zodiac, houses, lens };
}