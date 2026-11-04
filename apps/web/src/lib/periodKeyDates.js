/**
 * F-05: the key dates of a week or month — stations, sign ingresses, and New /
 * Full Moons — for the Stories-sized share card. Fetched on demand when the
 * user taps Share (one transit call per day; the ephemeris is cached
 * server-side). Only events that happen ON a day count (transitEvents.js /
 * B-22): an approaching station must not be dated to the day it was previewed.
 */
import { base44 } from '@/api/base44Client';
import { onDayOnly } from '@/lib/transitEvents';
import { findNatalHouseForLongitude, ordinal } from '@/lib/houseUtils';
import { chartAscendantSign } from '@/lib/shareCard';

const ZODIAC = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// Moon travels ~13°/day, so ±6.5° of exact at noon picks a single calendar day.
const LUNATION_ORB = 6.5;

const toKey = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString('en-CA');
const shortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export async function fetchPeriodKeyDates(dates, chart) {
  const raw = chart?.raw_data || {};
  if (!raw.birth_date || !dates?.length) return [];
  const results = await Promise.all(dates.map(d =>
    base44.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time,
      birth_location: raw.birth_location,
      transit_date: toKey(d),
      transit_time: '12:00:00',
    }).then(r => r.data).catch(() => null)
  ));

  const houseAt = (lon) => (lon == null || raw.unknown_time || !raw.houses?.length)
    ? null
    : findNatalHouseForLongitude(lon, raw.houses, raw.house_system || 'whole_sign', chartAscendantSign(chart));

  const events = [];
  const seen = new Set();
  const push = (key, d, text, lon) => {
    if (seen.has(key)) return;
    seen.add(key);
    events.push({ when: d, date: shortDate(d), text, house: houseAt(lon) });
  };

  results.forEach((res, i) => {
    if (!res) return;
    const d = dates[i];
    for (const s of onDayOnly(res.stations)) {
      const lon = ZODIAC.indexOf(s.sign) * 30 + (s.degree || 0);
      push(`st-${s.planet}-${s.type}`, d, `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`, lon);
    }
    for (const ing of onDayOnly(res.ingresses)) {
      push(`in-${ing.planet}-${ing.to_sign}`, d, `${ing.planet} enters ${ing.to_sign}`, ZODIAC.indexOf(ing.to_sign) * 30 + 0.5);
    }
    const sun = res.transit_planets?.find(p => p.name === 'Sun');
    const moon = res.transit_planets?.find(p => p.name === 'Moon');
    if (sun && moon) {
      const diff = ((moon.longitude - sun.longitude) + 360) % 360;
      if (diff <= LUNATION_ORB || diff >= 360 - LUNATION_ORB) push(`new-${moon.sign}`, d, `New Moon in ${moon.sign}`, moon.longitude);
      else if (Math.abs(diff - 180) <= LUNATION_ORB) push(`full-${moon.sign}`, d, `Full Moon in ${moon.sign}`, moon.longitude);
    }
  });
  return events.sort((a, b) => a.when - b.when);
}

/** Rows for the card: "mine" adds which house of the user's chart each lands in. */
export function keyDateRows(events, audience) {
  return events.map(e => ({
    date: e.date,
    text: audience === 'mine' && e.house ? `${e.text}, my ${ordinal(e.house)} house` : e.text,
  }));
}
