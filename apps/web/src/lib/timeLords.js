/**
 * AI-08 Tier 3 — the history/timing modules (Molly's spec, 2026-11-04).
 *
 * Houses here are WHOLE-SIGN, counted from the rising sign: that is how
 * profections are traditionally counted and what Molly specified for the
 * Great Conjunctions. Without a birth time the Sun's sign stands in for the
 * rising sign (solar whole-sign houses).
 */

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const TRAD_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury',
  Libra: 'Venus', Scorpio: 'Mars', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};
const TEN_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

/**
 * Jupiter–Saturn conjunctions, pulled from chart-calculator (Astrology-API
 * engine) on 2026-11-04: each date is the day of minimum separation (all
 * ≤ 0.05°). Triple passes are one event; `hits` keeps each exact pass.
 */
export const GREAT_CONJUNCTIONS = [
  { label: '1901', hits: [{ date: '1901-11-28', lon: 283.97 }], sign: 'Capricorn' },
  { label: '1921', hits: [{ date: '1921-09-10', lon: 176.65 }], sign: 'Virgo' },
  { label: '1940–41', hits: [{ date: '1940-08-08', lon: 44.48 }, { date: '1940-10-20', lon: 42.43 }, { date: '1941-02-15', lon: 39.15 }], sign: 'Taurus' },
  { label: '1961', hits: [{ date: '1961-02-19', lon: 295.28 }], sign: 'Capricorn' },
  { label: '1980–81', hits: [{ date: '1980-12-31', lon: 189.48 }, { date: '1981-03-04', lon: 188.13 }, { date: '1981-07-24', lon: 184.97 }], sign: 'Libra' },
  { label: '2000', hits: [{ date: '2000-05-28', lon: 52.69 }], sign: 'Taurus' },
  { label: '2020', hits: [{ date: '2020-12-21', lon: 300.44 }], sign: 'Aquarius' },
  { label: '2040', hits: [{ date: '2040-10-31', lon: 197.93 }], sign: 'Libra' },
];

const parseDate = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
function ageOn(birth, when) {
  let age = when.getFullYear() - birth.getFullYear();
  if (when.getMonth() < birth.getMonth() || (when.getMonth() === birth.getMonth() && when.getDate() < birth.getDate())) age -= 1;
  return age;
}
const fmtDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** The sign that counts as the 1st house, and how it was chosen. */
export function houseBasis(chart) {
  const raw = chart?.raw_data || {};
  const rising = raw.unknown_time ? null : (raw.ascendant_sign || raw.angles?.ascendant?.sign || chart?.ascendant_sign || null);
  if (rising) return { sign: rising, basis: 'rising' };
  const sun = (raw.planets || []).find(p => p.name === 'Sun')?.sign;
  return sun ? { sign: sun, basis: 'sun' } : null;
}

/** Whole-sign house of a sign, counted from the basis sign. */
export function wholeSignHouse(sign, basisSign) {
  const a = SIGNS.indexOf(basisSign), b = SIGNS.indexOf(sign);
  if (a < 0 || b < 0) return null;
  return ((b - a + 12) % 12) + 1;
}

function profectionFor(age, basis, raw) {
  const offset = ((age % 12) + 12) % 12;
  const sign = SIGNS[(SIGNS.indexOf(basis.sign) + offset) % 12];
  const lord = TRAD_RULERS[sign];
  const lordPlanet = (raw.planets || []).find(p => p.name === lord);
  return {
    house: offset + 1,
    sign,
    lord,
    lordSign: lordPlanet?.sign || null,
    lordHouse: lordPlanet?.sign ? wholeSignHouse(lordPlanet.sign, basis.sign) : null,
  };
}

/** Annual profection for today (Molly's spec). */
export function computeProfection(chart, today = new Date()) {
  const raw = chart?.raw_data || {};
  if (!raw.birth_date) return null;
  const basis = houseBasis(chart);
  if (!basis) return null;
  const birth = parseDate(raw.birth_date);
  const age = ageOn(birth, today);
  if (age < 0) return null;
  const start = new Date(birth); start.setFullYear(birth.getFullYear() + age);
  const end = new Date(birth); end.setFullYear(birth.getFullYear() + age + 1);
  const now = profectionFor(age, basis, raw);
  const next = profectionFor(age + 1, basis, raw);
  return {
    age, ...now, basis: basis.basis,
    bigYear: [1, 4, 7, 10].includes(now.house),
    range: `${fmtDay(start)} – ${fmtDay(end)}`,
    next,
  };
}

/** Great Conjunctions placed in the user's whole-sign houses (Molly's spec). */
export function computeGreatConjunctions(chart, today = new Date()) {
  const raw = chart?.raw_data || {};
  if (!raw.birth_date) return null;
  const basis = houseBasis(chart);
  if (!basis) return null;
  const birth = parseDate(raw.birth_date);
  const place = (gc) => {
    const first = parseDate(gc.hits[0].date);
    return { ...gc, house: wholeSignHouse(gc.sign, basis.sign), age: ageOn(birth, first), year: first.getFullYear() };
  };
  const recentIdx = GREAT_CONJUNCTIONS.map(gc => parseDate(gc.hits[0].date) <= today).lastIndexOf(true);
  if (recentIdx < 0) return null;
  const recent = place(GREAT_CONJUNCTIONS[recentIdx]);
  const next = GREAT_CONJUNCTIONS[recentIdx + 1] ? place(GREAT_CONJUNCTIONS[recentIdx + 1]) : null;
  // The last conjunction before birth (for the collapsed "More" section).
  const beforeIdx = GREAT_CONJUNCTIONS.map(gc => parseDate(gc.hits[gc.hits.length - 1].date) < birth).lastIndexOf(true);
  const beforeBirth = beforeIdx >= 0 ? place(GREAT_CONJUNCTIONS[beforeIdx]) : null;

  // Natal planets within 5° of the most recent conjunction's degree. Without a
  // birth time the Moon is skipped: noon placement can be off by several degrees.
  const recentLon = recent.hits[recent.hits.length - 1].lon;
  const near = (raw.planets || [])
    .filter(p => TEN_PLANETS.includes(p.name) && p.longitude != null)
    .filter(p => !(raw.unknown_time && p.name === 'Moon'))
    .filter(p => { let d = Math.abs(p.longitude - recentLon) % 360; if (d > 180) d = 360 - d; return d <= 5; })
    .map(p => p.name);

  return { basis: basis.basis, recent, next, beforeBirth, near, recentDegree: +(recentLon % 30).toFixed(1) };
}
