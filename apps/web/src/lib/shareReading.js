const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const validSign = value => SIGNS.find(sign => sign.toLowerCase() === String(value || '').trim().toLowerCase()) || null;

// Unknown birth times must never reuse an estimated ascendant from raw data.
export function resolveShareSign(chart) {
  const raw = chart?.raw_data || {};
  const rising = !raw.unknown_time && !chart?.unknown_time
    ? validSign(raw.ascendant_sign || raw.angles?.ascendant?.sign || chart?.ascendant_sign) : null;
  if (rising) return { sign: rising, basis: 'rising' };
  const sun = validSign(raw.sun_sign || chart?.sun_sign || raw.planets?.find(p => p.name === 'Sun' || p.planet === 'Sun')?.sign);
  return sun ? { sign: sun, basis: 'sun' } : null;
}
