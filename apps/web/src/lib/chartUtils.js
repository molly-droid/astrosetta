export function extractPlacementKeys(chartData) {
  const keys = [];

  // Planet in sign: sun_taurus
  if (chartData.planets) {
    for (const planet of chartData.planets) {
      const planetKey = planet.name.toLowerCase().replace(/\s+/g, '_');
      const signKey = planet.sign.toLowerCase().replace(/\s+/g, '_');
      keys.push(`${planetKey}_${signKey}`);
      // Planet in house: sun_7h
      if (planet.house) {
        keys.push(`${planetKey}_${planet.house}h`);
      }
    }
  }

  // Aspects: sun_conjunct_moon
  if (chartData.aspects) {
    for (const aspect of chartData.aspects) {
      if (aspect.strength === 'strong') {
        const p1 = aspect.planet1.toLowerCase().replace(/\s+/g, '_');
        const p2 = aspect.planet2.toLowerCase().replace(/\s+/g, '_');
        const asp = aspect.aspect.toLowerCase().replace(/\s+/g, '_');
        keys.push(`${p1}_${asp}_${p2}`);
      }
    }
  }

  // Nodes
  if (chartData.nodes) {
    if (chartData.nodes.north_node) {
      const sign = chartData.nodes.north_node.sign.toLowerCase().replace(/\s+/g, '_');
      keys.push(`north_node_${sign}`);
    }
    if (chartData.nodes.south_node) {
      const sign = chartData.nodes.south_node.sign.toLowerCase().replace(/\s+/g, '_');
      keys.push(`south_node_${sign}`);
    }
  }

  return [...new Set(keys)];
}

export function formatPlacementKey(key) {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/(\d+)H$/, 'in House $1')
    .replace(' Conjunct ', ' ☌\uFE0E ')
    .replace(' Trine ', ' △\uFE0E ')
    .replace(' Sextile ', ' ⚹\uFE0E ')
    .replace(' Square ', ' □\uFE0E ')
    .replace(' Opposition ', ' ☍\uFE0E ');
}

export function getPlacementType(key) {
  if (key.includes('_conjunct_') || key.includes('_trine_') || key.includes('_sextile_') || key.includes('_square_') || key.includes('_opposition_')) return 'aspect';
  if (key.includes('_node_')) return 'node';
  if (/\d+h$/.test(key)) return 'planet_house';
  return 'planet_sign';
}

export const SIGN_ELEMENTS = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};

export const ELEMENT_COLORS = {
  fire: '#E8572A',
  earth: '#5BAD6F',
  air: '#4A9FD4',
  water: '#5B7FD4',
};

export const SIGN_GLYPHS = {
  Aries: '♈\uFE0E', Taurus: '♉\uFE0E', Gemini: '♊\uFE0E', Cancer: '♋\uFE0E',
  Leo: '♌\uFE0E', Virgo: '♍\uFE0E', Libra: '♎\uFE0E', Scorpio: '♏\uFE0E',
  Sagittarius: '♐\uFE0E', Capricorn: '♑\uFE0E', Aquarius: '♒\uFE0E', Pisces: '♓\uFE0E',
};

export const PLANET_GLYPHS = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E',
  Jupiter: '♃\uFE0E', Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E',
  Chiron: '⚷\uFE0E', 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E', 'Black Moon Lilith': '⚸\uFE0E', Lilith: 'lluminate\uFE0E', 'Black Moon': 'lluminate\uFE0E',   'Part of Fortune': '⊕\uFE0E', 'Part of Spirit': '⊖\uFE0E', 'Part of Eros': '⊗\uFE0E', 'Part of Necessity': '⊘\uFE0E', Tyche: '⊛\uFE0E', Juno: '∯\uFE0E', Pallas: '⛐\uFE0E', Vesta: '⛒\uFE0E', Juno: '\u26B5\uFE0E', Pallas: '\u26B4\uFE0E', Vesta: '\u26B6\uFE0E', Ascendant: 'AC', Midheaven: 'MC', Descendant: 'DC', IC: 'IC',
};

/**
 * Look up a chart point (planet, angle, or node) by name.
 * Returns the point object with sign, degree, longitude, and house.
 */
export function findChartPoint(chartData, name) {
  if (!chartData || !name) return null;
  const planet = chartData.planets?.find(p => p.name === name);
  if (planet) return planet;
  if (chartData.angles) {
    if (name === 'Ascendant' && chartData.angles.ascendant) return { ...chartData.angles.ascendant, house: 1 };
    if (name === 'Descendant' && chartData.angles.descendant) return { ...chartData.angles.descendant, house: 7 };
    if (name === 'Midheaven' && chartData.angles.midheaven) return { ...chartData.angles.midheaven, house: 10 };
    if (name === 'IC' && chartData.angles.ic) return { ...chartData.angles.ic, house: 4 };
  }
  if (chartData.nodes) {
    if (name === 'North Node' && chartData.nodes.north_node) return chartData.nodes.north_node;
    if (name === 'South Node' && chartData.nodes.south_node) return chartData.nodes.south_node;
  }
  return null;
}

/**
 * Determine which house a longitude falls into, given an array of house objects
 * with .longitude properties (cusp longitudes). Mirrors the backend getHouse() logic.
 */
export function getHouseForLongitude(longitude, houses) {
  if (!houses || !houses.length || longitude == null) return null;
  const cusps = houses.map(h => h.longitude);
  const l = ((longitude % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const c1 = ((cusps[i] % 360) + 360) % 360;
    const c2 = ((cusps[(i + 1) % 12] % 360) + 360) % 360;
    if (c2 < c1) {
      if (l >= c1 || l < c2) return i + 1;
    } else {
      if (l >= c1 && l < c2) return i + 1;
    }
  }
  return 1;
}

export const TONE_COLORS = {
  psychological: '#B8A5C8',
  spiritual: '#9DB4C8',
  predictive: '#D4AF85',
  lived_experience: '#D8B4C2',
  humorous: '#A8C8A8',
};

/**
 * Ensures any astrological Unicode character (planets, signs, aspects, nodes)
 * in a string is followed by the text variation selector (U+FE0E) so iOS
 * WebView renders them as text glyphs, not colorful emojis.
 * Also strips any existing emoji variation selector (U+FE0F).
 */
export function forceTextGlyph(str) {
  if (!str) return str;
  return str
    .replace(/\uFE0F/g, '')        // remove emoji variation selector
    .replace(/([\u2600-\u26FF\u26B7\u26B8\u2295\u2297\u25B3\u25A1\u260A\u260B\u260C\u260D\u2726\u2727\u2731\u2735\u272A])(?!\uFE0E)/g, '$1\uFE0E');
}

export const TONE_LABELS = {
  psychological: 'Psychological',
  spiritual: 'Spiritual',
  predictive: 'Predictive',
  lived_experience: 'Lived Experience',
  humorous: 'Humorous',
};