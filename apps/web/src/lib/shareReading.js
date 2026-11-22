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

export function formatPersonalReadingTitle(subject, selection) {
  const sign = validSign(selection?.sign);
  if (!sign) return null;
  const basis = selection.basis === 'sun' ? 'Sun' : 'Rising';
  return `What ${String(subject || "today's sky").trim()} means for ${sign} ${basis}`;
}

// Keep the image heading and Copy Text heading identical. No changes to the
// reading itself, and never invent a Rising sign when birth time is unknown.
export function personalizeShareCard(card, chart, subject) {
  if (!card) return card;
  const title = formatPersonalReadingTitle(subject || card.personalSubject || card.title, resolveShareSign(chart));
  if (!title) return card;
  const text = card.textFallback || '';
  return { ...card, title, personalReadingTitle: true,
    textFallback: text ? [title, ...text.split('\n').slice(1)].join('\n') : title };
}
