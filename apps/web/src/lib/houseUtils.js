export const HOUSE_NAMES = [
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

export const HOUSE_SHORT_NAMES = [
  '',
  'Identity',
  'Values',
  'Communication',
  'Home & Roots',
  'Creativity',
  'Health & Routine',
  'Partnerships',
  'Transformation',
  'Beliefs & Expansion',
  'Career & Status',
  'Community',
  'Unconscious',
];

export const HOUSE_EMOJIS = [
  '',
  '🌅',
  '💰',
  '💬',
  '🏡',
  '🎨',
  '⚕️',
  '🤝',
  '🔮',
  '🌍',
  '🏆',
  '🌐',
  '🌙',
];

export function getHouseName(number) {
  return HOUSE_NAMES[number] || `House ${number}`;
}

export function getHouseShort(number) {
  return HOUSE_SHORT_NAMES[number] || `H${number}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

/**
 * For Whole Sign houses, each house = one full zodiac sign.
 * House number = ((signIdx - ascendantSignIdx + 12) % 12) + 1
 */
export function wholeSignHouseForSign(sign, ascendantSign) {
  const signIdx = SIGNS.indexOf(sign);
  const ascIdx = SIGNS.indexOf(ascendantSign);
  if (signIdx < 0 || ascIdx < 0) return null;
  return ((signIdx - ascIdx + 12) % 12) + 1;
}

/**
 * Find which natal house a given ecliptic longitude falls into.
 * - Whole Sign: determine the sign of the longitude, then map by sign from the Ascendant.
 * - Placidus / quadrant systems: use cusp-longitude comparison.
 */
export function findNatalHouseForLongitude(longitude, natalHouses, houseSystem = 'whole_sign', ascendantSign = null) {
  if (!natalHouses?.length) return null;
  const norm = v => ((v % 360) + 360) % 360;
  const lon = norm(longitude);

  // Whole Sign: house is determined by the zodiac sign, NOT the cusp degree
  if (houseSystem === 'whole_sign') {
    const signIdx = Math.floor(lon / 30);
    const sign = SIGNS[signIdx];
    if (ascendantSign) {
      return wholeSignHouseForSign(sign, ascendantSign);
    }
    const house = natalHouses.find(h => h.sign === sign);
    return house?.number || null;
  }

  // Placidus / quadrant: cusp-longitude comparison
  for (let i = 0; i < natalHouses.length; i++) {
    const a = norm(natalHouses[i].longitude);
    const b = norm(natalHouses[(i + 1) % natalHouses.length].longitude);
    const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
    if (inside) return natalHouses[i].number;
  }
  return null;
}

/**
 * Find which natal house(s) a zodiac sign spans.
 * - Whole Sign: each sign = exactly one house (no crossings possible).
 * - Placidus: a sign may span two houses; detects crossings.
 * Returns { entryHouse, housesSpanned, crossesInto }
 */
export function findNatalHouseForSign(sign, natalHouses, houseSystem = 'whole_sign', ascendantSign = null) {
  if (!sign) return { entryHouse: null, housesSpanned: [], crossesInto: null };

  // Whole Sign: one sign = one house, no crossings
  if (houseSystem === 'whole_sign') {
    let house = null;
    if (ascendantSign) {
      house = wholeSignHouseForSign(sign, ascendantSign);
    } else {
      const h = natalHouses.find(h => h.sign === sign);
      house = h?.number || null;
    }
    return { entryHouse: house, housesSpanned: house ? [house] : [], crossesInto: null };
  }

  // Placidus / quadrant: sign may span two houses
  const signIdx = SIGNS.indexOf(sign);
  if (signIdx < 0) return { entryHouse: null, housesSpanned: [], crossesInto: null };
  const norm = v => ((v % 360) + 360) % 360;
  const startLon = signIdx * 30;

  const entryHouse = findNatalHouseForLongitude(startLon, natalHouses, 'placidus');
  const housesSpanned = [];
  const crossings = [];
  for (let i = 0; i < natalHouses.length; i++) {
    const a = norm(natalHouses[i].longitude);
    const b = norm(natalHouses[(i + 1) % natalHouses.length].longitude);
    for (let deg = 0; deg < 30; deg += 1) {
      const lon = norm(startLon + deg);
      const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
      if (inside) {
        const h = natalHouses[i].number;
        if (!housesSpanned.includes(h)) {
          housesSpanned.push(h);
          if (h !== entryHouse && crossings.length === 0) {
            crossings.push({ house: h, degree: deg });
          }
        }
        break;
      }
    }
  }
  const crossesInto = crossings.length > 0 ? crossings[0] : null;
  return { entryHouse, housesSpanned, crossesInto };
}