/**
 * Essential Dignities — classical planetary strength scoring.
 *
 * Based on the traditional system used by Ptolemy, Lilly, and classical astrologers:
 * a planet's sign placement determines whether it is strengthened (domicile, exaltation)
 * or weakened (detriment, fall). A planet with no dignity is "peregrine" — a wanderer.
 *
 * Pure computation — no LLM calls. Instant and free.
 */

// Traditional domicile rulers (Mars rules Scorpio, Saturn rules Aquarius, Jupiter rules Pisces)
const DOMICILE = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

// Traditional exaltation degrees (sign → exalted planet)
const EXALTATION = {
  Aries: 'Sun', Taurus: 'Moon', Cancer: 'Jupiter', Virgo: 'Mercury',
  Libra: 'Saturn', Capricorn: 'Mars', Pisces: 'Venus',
};

const OPPOSITE = {
  Aries: 'Libra', Taurus: 'Scorpio', Gemini: 'Sagittarius', Cancer: 'Capricorn',
  Leo: 'Aquarius', Virgo: 'Pisces', Libra: 'Aries', Scorpio: 'Taurus',
  Sagittarius: 'Gemini', Capricorn: 'Cancer', Aquarius: 'Leo', Pisces: 'Virgo',
};

const SCORES = {
  domicile: +5, exaltation: +4, detriment: -5, fall: -4, peregrine: 0,
};

const LABELS = {
  domicile: 'Domicile (Rulership)',
  exaltation: 'Exaltation',
  detriment: 'Detriment',
  fall: 'Fall',
  peregrine: 'Peregrine',
};

const DESCRIPTIONS = {
  domicile: 'In its home sign — the planet expresses its nature freely and powerfully, as if on its own territory. Its energy is constructive, natural, and self-assured.',
  exaltation: 'Elevated and honored — the planet\'s energy is amplified and celebrated. It operates at its highest, most visible expression.',
  detriment: 'In the sign opposite its rulership — the planet is a stranger in a foreign land, its energy constrained and working against the grain of the sign.',
  fall: 'In the sign opposite its exaltation — the planet\'s energy is humbled and weakened, its expression distorted or forced into humility.',
  peregrine: 'A wanderer with no essential dignity in this sign — neutral territory. The planet relies on aspects, house placement, and accidental dignities for its expression.',
};

/**
 * Evaluate a single planet's essential dignity in a given sign.
 * @param {string} planet - Planet name (Sun, Moon, Mercury, ...)
 * @param {string} sign - Zodiac sign name
 * @returns {{ status: string, score: number, label: string, description: string }}
 */
export function evaluateDignity(planet, sign) {
  if (!planet || !sign) {
    return { status: 'peregrine', score: 0, label: LABELS.peregrine, description: DESCRIPTIONS.peregrine };
  }

  // Domicile — planet rules this sign
  if (DOMICILE[sign] === planet) {
    return { status: 'domicile', score: SCORES.domicile, label: LABELS.domicile, description: DESCRIPTIONS.domicile };
  }
  // Exaltation — planet is exalted in this sign
  if (EXALTATION[sign] === planet) {
    return { status: 'exaltation', score: SCORES.exaltation, label: LABELS.exaltation, description: DESCRIPTIONS.exaltation };
  }
  // Detriment — planet rules the opposite sign
  const oppositeSign = OPPOSITE[sign];
  if (DOMICILE[oppositeSign] === planet) {
    return { status: 'detriment', score: SCORES.detriment, label: LABELS.detriment, description: DESCRIPTIONS.detriment };
  }
  // Fall — planet is exalted in the opposite sign
  if (EXALTATION[oppositeSign] === planet) {
    return { status: 'fall', score: SCORES.fall, label: LABELS.fall, description: DESCRIPTIONS.fall };
  }
  return { status: 'peregrine', score: 0, label: LABELS.peregrine, description: DESCRIPTIONS.peregrine };
}

const DIGNITY_PLANETS = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron',
]);

/**
 * Analyze all planets in a natal chart for essential dignity.
 * @param {object} rawData - chart.raw_data (with planets array)
 * @returns {Array<{ planet, sign, house, status, score, label, description }>}
 */
export function analyzeChartDignities(rawData) {
  if (!rawData?.planets) return [];
  return rawData.planets
    .filter(p => p.sign && DIGNITY_PLANETS.has(p.name))
    .map(p => ({
      planet: p.name,
      sign: p.sign,
      house: p.house,
      ...evaluateDignity(p.name, p.sign),
    }));
}

/**
 * Get transit planets currently in notable dignity or debility (non-peregrine).
 * Used for Live Sky banners on Home and Planner.
 * @param {Array} transitPlanets - Array of { name, sign, degree, retrograde }
 * @returns {Array<{ planet, sign, degree, retrograde, status, score, label, description }>}
 */
export function getNotableTransitDignities(transitPlanets) {
  if (!transitPlanets) return [];
  return transitPlanets
    .filter(p => p.sign && DIGNITY_PLANETS.has(p.name))
    .map(p => ({
      planet: p.name,
      sign: p.sign,
      degree: p.degree,
      retrograde: p.retrograde,
      ...evaluateDignity(p.name, p.sign),
    }))
    .filter(d => d.status !== 'peregrine');
}

// ── Educational reference data for Learn curriculum ──────────────────────────

export const DIGNITY_TABLES = {
  domicile: DOMICILE,
  exaltation: EXALTATION,
  opposite: OPPOSITE,
};

export const DIGNITY_CATEGORIES = [
  {
    key: 'domicile',
    label: 'Domicile (Rulership)',
    score: '+5',
    description: 'The planet is in a sign it rules. It expresses its nature freely, powerfully, and constructively — as if at home. This is the strongest essential dignity.',
  },
  {
    key: 'exaltation',
    label: 'Exaltation',
    score: '+4',
    description: 'The planet is elevated and honored. Its energy is amplified to its highest, most visible expression. Traditionally associated with the planet\'s "best self."',
  },
  {
    key: 'peregrine',
    label: 'Peregrine',
    score: '0',
    description: 'The planet has no essential dignity in this sign. It is a wanderer in neutral territory, relying on aspects, house placement, and accidental dignities for its expression.',
  },
  {
    key: 'fall',
    label: 'Fall',
    score: '-4',
    description: 'The planet is in the sign opposite its exaltation. Its energy is humbled and weakened — expression is distorted or forced into humility.',
  },
  {
    key: 'detriment',
    label: 'Detriment',
    score: '-5',
    description: 'The planet is in the sign opposite its rulership. It is a stranger in a foreign land, its energy constrained and working against the grain of the sign.',
  },
];

export { DOMICILE, EXALTATION, OPPOSITE };