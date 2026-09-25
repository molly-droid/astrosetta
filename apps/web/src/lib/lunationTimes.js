// Exact new- and full-moon times via Jean Meeus' "Astronomical Algorithms"
// (ch. 49), attributed to the user's *browser* local date of the exact moment.
//
// Why this exists: the older `getMoonPhaseEmoji` evaluated the Sun–Moon angle at
// local MIDNIGHT of each calendar date. A lunation that perfects in the evening
// (e.g. the Sept 10 2026 new moon at 10:27pm Central) lands ~11° from exact at
// that date's midnight, so the emoji would not show — it would jump to the next
// day. Computing the exact instant and reading its browser-local calendar date
// fixes the attribution and keeps lunations in the user's actual timezone.
//
// Accuracy: the Meeus phase JDE is dynamical time (TDB); we subtract an
// approximate ΔT to get UT. Remaining error is well under a minute, far smaller
// than a calendar day, so the date attribution is reliable.

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function n360(d) { return ((d % 360) + 360) % 360; }

// ΔT in seconds for a given decimal year (esp. 2005+). Same approximation the
// chartCalculator backend uses; good to a few seconds in the 2020s–2030s.
function deltaTSeconds(year) {
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

// Meeus ch. 49 — Julian Ephemeris Day of a moon phase.
// phase: 0 = new, 0.5 = full.
function phaseJDE(cycle, phase) {
  const k = cycle + phase;
  const T = k / 1236.85;
  let JDE = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T * T
    - 0.000000150 * T * T * T
    + 0.00000000073 * T * T * T * T;

  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  const M  = n360(2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T * T * T) * D2R;
  const Mp = n360(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T - 0.000000058 * T * T * T * T) * D2R;
  const F  = n360(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T + 0.000000011 * T * T * T * T) * D2R;
  const Om = n360(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T * T * T) * D2R;

  let correction;
  if (phase === 0) {
    correction = 0.00002*Math.sin(4*Mp) + -0.00002*Math.sin(3*Mp + M) + -0.00002*Math.sin(Mp - M - 2*F) + 0.00003*Math.sin(Mp - M + 2*F) + -0.00003*Math.sin(Mp + M + 2*F)
      + 0.00003*Math.sin(2*Mp + 2*F) + 0.00003*Math.sin(Mp + M - 2*F) + 0.00004*Math.sin(3*M) + 0.00004*Math.sin(2*Mp - 2*F) + -0.00007*Math.sin(Mp + 2*M) + -0.00017*Math.sin(Om)
      + -0.00024*E*Math.sin(2*Mp - M) + 0.00038*E*Math.sin(M - 2*F) + 0.00042*E*Math.sin(M + 2*F) + -0.00042*Math.sin(3*Mp) + 0.00056*E*Math.sin(2*Mp + M) + -0.00057*Math.sin(Mp + 2*F)
      + -0.00111*Math.sin(Mp - 2*F) + 0.00208*E*E*Math.sin(2*M) + -0.00514*E*Math.sin(Mp + M) + 0.00739*E*Math.sin(Mp - M) + 0.01039*Math.sin(2*F) + 0.01608*Math.sin(2*Mp)
      + 0.17241*E*Math.sin(M) + -0.40720*Math.sin(Mp);
  } else { // phase === 0.5 (full)
    correction = 0.00002*Math.sin(4*Mp) + -0.00002*Math.sin(3*Mp + M) + -0.00002*Math.sin(Mp - M - 2*F) + 0.00003*Math.sin(Mp - M + 2*F) + -0.00003*Math.sin(Mp + M + 2*F) + 0.00003*Math.sin(2*Mp + 2*F)
      + 0.00003*Math.sin(Mp + M - 2*F) + 0.00004*Math.sin(3*M) + 0.00004*Math.sin(2*Mp - 2*F) + -0.00007*Math.sin(Mp + 2*M) + -0.00017*Math.sin(Om) + -0.00024*E*Math.sin(2*Mp - M)
      + 0.00038*E*Math.sin(M - 2*F) + 0.00042*E*Math.sin(M + 2*F) + -0.00042*Math.sin(3*Mp) + 0.00056*E*Math.sin(2*Mp + M) + -0.00057*Math.sin(Mp + 2*F) + -0.00111*Math.sin(Mp - 2*F)
      + 0.00209*E*E*Math.sin(2*M) + -0.00514*E*Math.sin(Mp + M) + 0.00734*E*Math.sin(Mp - M) + 0.01043*Math.sin(2*F) + 0.01614*Math.sin(2*Mp) + 0.17302*E*Math.sin(M) + -0.40614*Math.sin(Mp);
  }
  JDE += correction;

  // Planetary corrections (Meeus p. 252)
  const A = (c1, c2) => n360(c1 + c2 * k) * D2R;
  JDE += 0.000325*Math.sin(A(299.77, 0.107408))
       + 0.000165*Math.sin(A(251.88, 0.016321))
       + 0.000164*Math.sin(A(251.83, 26.651886))
       + 0.000126*Math.sin(A(349.42, 36.412478))
       + 0.000110*Math.sin(A(84.66, 18.206239))
       + 0.000062*Math.sin(A(141.74, 53.303771))
       + 0.000060*Math.sin(A(207.14, 2.453732))
       + 0.000056*Math.sin(A(154.84, 7.306860))
       + 0.000047*Math.sin(A(34.52, 27.261239))
       + 0.000042*Math.sin(A(207.19, 0.121824))
       + 0.000040*Math.sin(A(291.34, 1.844379))
       + 0.000037*Math.sin(A(161.72, 24.198154))
       + 0.000035*Math.sin(A(239.56, 25.513099))
       + 0.000023*Math.sin(A(331.55, 3.592518));

  return JDE;
}

// Apparent Sun ecliptic longitude (degrees, 0–360) at a JDE — accurate to
// ~0.01°, more than enough to resolve the 30° sign sectors.
function sunLongitude(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  return n360(L0 + C - 0.00569);
}

// Convert a TDB phase JDE to a browser-local YYYY-MM-DD date key.
function jdeToLocalDateKey(jde, year) {
  const ut = jde - deltaTSeconds(year) / 86400;
  const ms = (ut - 2440587.5) * 86400000;
  // toLocaleDateString('en-CA') yields YYYY-MM-DD in the runtime's timezone —
  // in the browser that is the user's actual timezone.
  return new Date(ms).toLocaleDateString('en-CA');
}

// Estimate the lunation cycle number near a given year/month (Meeus 49.2).
function cycleEstimate(year, month) {
  const yearfrac = (month * 30 + 15) / 365;
  return Math.floor(12.3685 * ((year + yearfrac) - 2000));
}

/**
 * Returns all new- and full-moon events whose browser-local date falls in the
 * given calendar month, keyed by local date string (YYYY-MM-DD).
 *
 * Each entry: { type: 'new'|'full', sign: <sign name>, emoji, dateKey, jde }
 *   - sign: the sign the LUNATION occurs in. For a new moon this is the sign of
 *     the Sun–Moon conjunction; for a full moon it is the Moon's sign (opposite
 *     the Sun).
 */
export function getMonthLunations(year, month) {
  const out = {};
  const k0 = cycleEstimate(year, month);
  // A synodic month is ~29.5 days, so a calendar month always contains 1 new
  // and 1 full (occasionally a second of one). Iterate a few cycles either side
  // to catch any edge-of-month lunation.
  for (let i = -1; i <= 3; i++) {
    const cycle = k0 + i;
    for (const [phase, type, emoji] of [[0, 'new', '🌑'], [0.5, 'full', '🌕']]) {
      const jde = phaseJDE(cycle, phase);
      // The phase JDE's year ≈ the decimal year of the cycle — use it for ΔT.
      const phaseYear = 2000 + (cycle + phase) / 12.3685;
      const dateKey = jdeToLocalDateKey(jde, Math.round(phaseYear));
      const [yy, mm] = dateKey.split('-').map(Number);
      if (yy !== year || (mm - 1) !== month) continue;
      const sunSignIdx = Math.floor(sunLongitude(jde) / 30);
      const sign = type === 'new'
        ? SIGNS[sunSignIdx]
        : SIGNS[(sunSignIdx + 6) % 12]; // full moon: Moon is opposite the Sun
      out[dateKey] = { type, sign, emoji, dateKey, jde };
    }
  }
  return out;
}

/** Lunation for a single date (browser-local), or null. */
export function getLunationForDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const map = getMonthLunations(year, month);
  const dateKey = new Date(year, month, date.getDate()).toLocaleDateString('en-CA');
  return map[dateKey] || null;
}