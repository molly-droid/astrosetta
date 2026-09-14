import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { getHouseName, ordinal, findNatalHouseForLongitude } from '@/lib/houseUtils';

// Traditional rulerships — used for annual profections
const TRADITIONAL_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

const PROFECTION_THEMES = {
  1: 'Identity, self-discovery, and new beginnings. A year to redefine who you are and how you present to the world.',
  2: 'Resources, values, and material security. A year focused on what you earn, own, and truly value.',
  3: 'Communication, learning, and your immediate environment. A year of connections, ideas, and short journeys.',
  4: 'Home, family, and emotional foundations. A year to tend roots and settle inner matters.',
  5: 'Creativity, pleasure, and self-expression. A year for play, romance, and creative risk.',
  6: 'Health, daily routines, and service. A year to refine habits and attend to the body.',
  7: 'Partnerships, contracts, and significant others. A year defined by relationships and commitments.',
  8: 'Transformation, shared resources, and deep change. A year of letting go and rebirth.',
  9: 'Beliefs, higher education, and long-distance travel. A year to expand horizons and seek meaning.',
  10: 'Career, public standing, and authority. A year of ambition, visibility, and legacy-building.',
  11: 'Community, friendships, and future vision. A year of networks, hopes, and collective endeavor.',
  12: 'Solitude, retreat, and the unconscious. A year for rest, reflection, and inner work.',
};

// Returns true if `date` falls on the user's solar return (birthday).
export function isSolarReturn(date, chart) {
  return getSolarReturnInfo(date, chart).isBirthday;
}

export function getSolarReturnInfo(date, chart) {
  if (!date || !chart?.raw_data?.birth_date) {
    return { isBirthday: false, age: null, daysUntilBirthday: null, solarReturnYear: null };
  }
  const parts = chart.raw_data.birth_date.split('-');
  if (parts.length !== 3) return { isBirthday: false, age: null, daysUntilBirthday: null, solarReturnYear: null };

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  const nowYear = date.getFullYear();
  const isBirthday = date.getMonth() === birthMonth && date.getDate() === birthDay;

  const birthdayThisYear = new Date(nowYear, birthMonth, birthDay);
  const birthdayPassed = date > birthdayThisYear;

  // Age right now (on birthday itself, they're turning this age)
  const currentAge = isBirthday || birthdayPassed ? nowYear - birthYear : nowYear - birthYear - 1;

  // Days until next birthday
  let nextBirthday = new Date(nowYear, birthMonth, birthDay);
  if (date > nextBirthday) nextBirthday = new Date(nowYear + 1, birthMonth, birthDay);
  const daysUntilBirthday = Math.ceil((nextBirthday - date) / 86400000);

  return {
    isBirthday,
    age: currentAge,
    solarReturnYear: isBirthday ? currentAge : currentAge + 1,
    daysUntilBirthday,
  };
}

export function getProfectionInfo(chart, date = new Date()) {
  const sr = getSolarReturnInfo(date, chart);
  if (sr.age === null || sr.age < 0) return null;

  const profectedHouse = (sr.age % 12) + 1;

  const houses = chart?.raw_data?.houses || [];
  const houseData = houses.find(h => h.number === profectedHouse);
  const profectedSign = houseData?.sign || chart?.raw_data?.ascendant_sign || null;
  if (!profectedSign) return null;

  const yearLord = TRADITIONAL_RULERS[profectedSign] || null;

  const planets = chart?.raw_data?.planets || [];
  const lordPlacement = planets.find(p => p.name === yearLord);

  return {
    profectedHouse,
    profectedSign,
    yearLord,
    yearLordGlyph: PLANET_GLYPHS[yearLord] || '✦',
    yearLordSign: lordPlacement?.sign || null,
    yearLordHouse: lordPlacement?.house || null,
    age: sr.age,
    theme: PROFECTION_THEMES[profectedHouse] || '',
    houseName: getHouseName(profectedHouse),
  };
}

// Returns the year lord's current transit position from transit data
export function getYearLordTransitInfo(chart, transits) {
  if (!chart || !transits) return null;
  const profInfo = getProfectionInfo(chart);
  if (!profInfo?.yearLord) return null;

  const transitPlanets = transits.transitPlanets || transits.planets || [];
  const lordTransit = transitPlanets.find(p => p.name === profInfo.yearLord);
  if (!lordTransit) return null;

  const natalHouses = chart?.raw_data?.houses || [];
  const houseSystem = chart?.raw_data?.house_system || 'whole_sign';
  const ascendantSign = chart?.raw_data?.ascendant_sign || null;
  const transitHouse = findNatalHouseForLongitude(lordTransit.longitude, natalHouses, houseSystem, ascendantSign);

  return {
    name: profInfo.yearLord,
    glyph: profInfo.yearLordGlyph,
    sign: lordTransit.sign,
    longitude: lordTransit.longitude,
    degree: lordTransit.degree,
    retrograde: lordTransit.retrograde || false,
    natalHouseTransiting: transitHouse,
  };
}

export { PROFECTION_THEMES, TRADITIONAL_RULERS };