// Exact new- and full-moon times via Jean Meeus' "Astronomical Algorithms"
// (ch. 49). This is the SAME math the planner frontend uses
// (src/lib/lunationTimes.js), extracted here so the calendar sync surfaces
// (calendarICSFeed + syncAstroToCalendar) attribute each lunation to exactly
// ONE calendar day in the user's timezone — a single event per new/full moon,
// matching what the Planner shows.
//
// The previous approach used a ±1.5-day window around a mean synodic cycle,
// which painted a new moon across up to three consecutive days.

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const D2R = Math.PI / 180;

function n360(d) { return ((d % 360) + 360) % 360; }

// ΔT in seconds for a given decimal year (esp. 2005+). Good to a few seconds
// in the 2020s–2030s.
export function deltaTSeconds(year) {
  const t = year - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

// Meeus ch. 49 — Julian Ephemeris Day of a moon phase.
// phase: 0 = new, 0.5 = full.
export function phaseJDE(cycle, phase) {
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
// ~0.01°, enough to resolve the 30° sign sectors.
export function sunLongitude(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  return n360(L0 + C - 0.00569);
}

// Convert a TDB phase JDE to UT milliseconds since epoch.
function phaseUTMs(jde) {
  const ut = jde - deltaTSeconds(2000 + (jde - 2451545) / 365.25) / 86400;
  return (ut - 2440587.5) * 86400000;
}

function localDateKey(ms, timeZone) {
  // en-CA yields YYYY-MM-DD in the given timezone
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function localHourMinute(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms));
  const get = t => parts.find(p => p.type === t)?.value || '00';
  return { hour: parseInt(get('hour'), 10), minute: parseInt(get('minute'), 10) };
}

/**
 * All new- and full-moon events whose exact moment falls between startMs and
 * endMs (epoch ms), each attributed to a single calendar date in `timeZone`
 * (IANA string, default 'UTC') — the same attribution the Planner uses.
 *
 * Each entry: {
 *   type: 'new' | 'full',
 *   phaseName: 'New Moon' | 'Full Moon',
 *   sign: sign of the lunation (Sun's sign for new, Moon's sign for full),
 *   sunLon: Sun's longitude at the exact moment,
 *   lunationLon: longitude of the lunation point (Sun for new, Sun+180 for full),
 *   dateKey: YYYY-MM-DD in the given timezone,
 *   hour, minute: exact local time,
 *   utMs: exact moment in epoch ms (UTC)
 * }
 */
export function getLunationsBetween(startMs, endMs, timeZone = 'UTC') {
  const out = [];
  // Cycle estimate near the start of the range (Meeus 49.2), with margin so we
  // never miss an edge-of-range lunation.
  const startYear = new Date(startMs).getUTCFullYear();
  const k0 = Math.floor(12.3685 * (startYear - 2000)) - 2;
  for (let cycle = k0; ; cycle++) {
    const cycleNewMs = phaseUTMs(phaseJDE(cycle, 0));
    if (cycleNewMs > endMs + 2 * 86400000) break;
    for (const [phase, type, phaseName] of [[0, 'new', 'New Moon'], [0.5, 'full', 'Full Moon']]) {
      const jde = phaseJDE(cycle, phase);
      const utMs = phaseUTMs(jde);
      if (utMs < startMs - 86400000 || utMs > endMs + 2 * 86400000) continue;
      const sunLon = sunLongitude(jde);
      const lunationLon = type === 'new' ? sunLon : n360(sunLon + 180);
      const sign = SIGNS[Math.floor(lunationLon / 30)];
      const { hour, minute } = localHourMinute(utMs, timeZone);
      out.push({
        type,
        phaseName,
        sign,
        sunLon,
        lunationLon,
        dateKey: localDateKey(utMs, timeZone),
        hour,
        minute,
        utMs,
      });
    }
  }
  return out;
}