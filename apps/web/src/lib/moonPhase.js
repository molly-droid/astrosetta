// Precise astronomical moon phase calculation for lunation icons.
// Uses Julian Date + solar/lunar longitude formulas (same as week view).
// Tight 6° orb = within ~12 hours of exact = same calendar day.

export function dateToJD(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + d + 1721013.5;
}

export function sunLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T;
  const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
  return ((L0 + (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M)) % 360 + 360) % 360;
}

export function moonLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L = 218.3164477 + 481267.88123421 * T;
  const Mp = (134.9633964 + 477198.8675055 * T) * Math.PI / 180;
  const F = (93.2720950 + 483202.0175233 * T) * Math.PI / 180;
  return (((L + 6.289 * Math.sin(Mp) - 1.274 * Math.sin(2 * F - Mp) + 0.658 * Math.sin(2 * F) - 0.214 * Math.sin(2 * Mp)) % 360) + 360) % 360;
}

/**
 * Returns '🌑' for new moon, '🌕' for full moon, or null for other phases.
 * Uses a tight 6° orb so the icon only shows on the actual day of exactness.
 */
/**
 * Returns the named moon phase from Sun/Moon longitudes using the standard
 * 8-phase system with boundaries centered on the exact phase angles (±22.5°).
 * This prevents mislabeling days near a phase boundary (e.g. calling a waning
 * gibbous moon a "Full Moon" when the exact full moon was 2 days ago).
 */
export function getMoonPhaseName(moonLon, sunLon) {
  const diff = ((moonLon - sunLon) + 360) % 360;
  if (diff < 22.5 || diff >= 337.5) return 'New Moon';
  if (diff < 67.5) return 'Crescent';
  if (diff < 112.5) return 'First Quarter';
  if (diff < 157.5) return 'Gibbous';
  if (diff < 202.5) return 'Full Moon';
  if (diff < 247.5) return 'Disseminating';
  if (diff < 292.5) return 'Last Quarter';
  return 'Balsamic';
}

/**
 * Always returns the moon emoji for the date's current phase (8-phase system) —
 * for surfaces that show the moon every day, not only on exact lunations.
 */
export function getMoonPhaseIcon(date) {
  const jd = dateToJD(date);
  const diff = ((moonLon(jd) - sunLon(jd)) + 360) % 360;
  if (diff < 22.5 || diff >= 337.5) return '🌑';
  if (diff < 67.5) return '🌒';
  if (diff < 112.5) return '🌓';
  if (diff < 157.5) return '🌔';
  if (diff < 202.5) return '🌕';
  if (diff < 247.5) return '🌖';
  if (diff < 292.5) return '🌗';
  return '🌘';
}

export function getMoonPhaseEmoji(date) {
  const jd = dateToJD(date);
  const diff = ((moonLon(jd) - sunLon(jd)) + 360) % 360;
  if (diff < 6 || diff >= 354) return '🌑';
  if (diff >= 174 && diff < 186) return '🌕';
  return null;
}