/**
 * Minimal client-side planetary longitude calculator
 * Mirrors the core math from astroEngine for use without auth.
 */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const ELEMENTS = {Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',Gemini:'Air',Libra:'Air',Aquarius:'Air',Cancer:'Water',Scorpio:'Water',Pisces:'Water'};

function n360(d) { return ((d % 360) + 360) % 360; }
function sd(d) { return Math.sin(d * D2R); }
function cd(d) { return Math.cos(d * D2R); }
function at2(y, x) { return Math.atan2(y, x) * R2D; }
function r4(n) { return Math.round(n * 10000) / 10000; }
function si(lon) {
  const l = n360(lon), sg = SIGNS[Math.floor(l / 30)];
  return { sign: sg, degree: r4(l % 30), longitude: r4(l), element: ELEMENTS[sg] };
}

const KE = {
  Mercury: [[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593],[0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081]],
  Venus:   [[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255],[0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418]],
  Earth:   [[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0],[0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0]],
  Mars:    [[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891],[0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343]],
  Jupiter: [[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106]],
  Saturn:  [[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]],
  Uranus:  [[19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503],[-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589]],
  Neptune: [[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664]],
  Pluto:   [[39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684],[-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482]],
};

const KE_EX = {
  Jupiter: [-0.00012452, 0.06064060, -0.35635438, 38.35125000],
  Saturn:  [0.00025899, -0.13434469, 0.87320147, 38.35125000],
  Uranus:  [0.00058331, -0.97731848, 0.17689245, 7.67025000],
  Neptune: [-0.00041348, 0.68346318, -0.10162547, 7.67025000],
  Pluto:   [-0.01262724, 0, 0, 0],
};

function kepH(nm, T) {
  const [els, rates] = KE[nm];
  const [a, e, I, L, wb, Om] = els.map((v, i) => v + rates[i] * T);
  let M = L - wb;
  const ex = KE_EX[nm];
  if (ex) { const [b, c, s, f] = ex; M += b*T*T + c*cd(f*T) + s*sd(f*T); }
  M = ((M % 360) + 360) % 360;
  if (M > 180) M -= 360;
  const w = wb - Om;
  let E = M + R2D * e * sd(M);
  for (let i = 0; i < 15; i++) { const dM = M - (E - R2D*e*sd(E)), dE = dM / (1 - e*cd(E)); E += dE; if (Math.abs(dE) < 1e-8) break; }
  const xp = a * (cd(E) - e), yp = a * Math.sqrt(1 - e*e) * sd(E);
  const cw = cd(w), sw = sd(w), cO = cd(Om), sO = sd(Om), cI = cd(I);
  return { x: (cw*cO - sw*sO*cI)*xp + (-sw*cO - cw*sO*cI)*yp, y: (cw*sO + sw*cO*cI)*xp + (-sw*sO + cw*cO*cI)*yp };
}

function kepGeo(nm, T) { const p = kepH(nm, T), e = kepH('Earth', T); return n360(at2(p.y - e.y, p.x - e.x)); }

function sunLon(T) {
  const L0 = n360(280.46646 + 36000.76983*T + 0.0003032*T*T);
  const M = n360(357.52911 + 35999.05029*T - 0.0001537*T*T);
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*sd(M) + (0.019993 - 0.000101*T)*sd(2*M) + 0.000289*sd(3*M);
  return n360(L0 + C - 0.00569);
}

const MOON_L_SHORT = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758]];

function moonLon(T) {
  const Lp = n360(218.3164477 + 481267.88123421*T - 0.0015786*T*T);
  const D  = n360(297.8501921 + 445267.1114034*T - 0.0018819*T*T);
  const M  = n360(357.5291092 + 35999.0502909*T);
  const Mp = n360(134.9633964 + 477198.8675055*T + 0.0087414*T*T);
  const F  = n360(93.2720950  + 483202.0175233*T - 0.0036539*T*T);
  let sL = 0;
  for (const [td2, tm, tmp, tf, cl] of MOON_L_SHORT) sL += cl * sd(td2*D + tm*M + tmp*Mp + tf*F);
  return n360(Lp + sL / 1000000);
}

function jd(y, mo, d, hut) {
  let yr = y, m = mo;
  if (m <= 2) { yr--; m += 12; }
  const A = Math.floor(yr / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25*(yr+4716)) + Math.floor(30.6001*(m+1)) + d + hut/24 + B - 1524.5;
}

function precessionPA(T) { return (5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T) / 3600; }
function pLon(nm, T) {
  let lon;
  if (nm === 'Sun') lon = sunLon(T);
  else if (nm === 'Moon') lon = moonLon(T);
  else lon = kepGeo(nm, T);
  if (nm !== 'Sun' && nm !== 'Moon') lon = n360(lon + precessionPA(T));
  return lon;
}

const ASPECTS_DEF = [
  { name: 'conjunction', angle: 0, orb: 8 },
  { name: 'opposition', angle: 180, orb: 8 },
  { name: 'trine', angle: 120, orb: 7 },
  { name: 'square', angle: 90, orb: 7 },
  { name: 'sextile', angle: 60, orb: 5 },
];

export function getTodayChartData() {
  const now = new Date();
  const JD = jd(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours() + now.getUTCMinutes() / 60);
  const T = (JD - 2451545) / 36525;

  const PNAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const planets = PNAMES.map(nm => ({ name: nm, ...si(pLon(nm, T)), house: 1, retrograde: false }));

  const houses = Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    longitude: i * 30,
    ...si(i * 30),
  }));

  const aspects = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let d = Math.abs(planets[i].longitude - planets[j].longitude);
      if (d > 180) d = 360 - d;
      for (const ad of ASPECTS_DEF) {
        const orb = Math.abs(d - ad.angle);
        if (orb <= ad.orb) {
          aspects.push({ planet1: planets[i].name, planet2: planets[j].name, aspect: ad.name, orb: r4(orb), strength: orb < 2 ? 'exact' : orb < ad.orb * 0.5 ? 'strong' : 'moderate' });
          break;
        }
      }
    }
  }

  return { planets, houses, angles: {}, aspects };
}

/**
 * Detect sign ingresses today — planets that enter a new zodiac sign
 * between the start and end of the current UTC day.
 * Returns array of { planet, from_sign, to_sign }
 */
export function getTodayIngresses() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const JD_start = jd(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth() + 1, startOfDay.getUTCDate(), 0);
  const JD_end = jd(endOfDay.getUTCFullYear(), endOfDay.getUTCMonth() + 1, endOfDay.getUTCDate(), 0);
  const T_start = (JD_start - 2451545) / 36525;
  const T_end = (JD_end - 2451545) / 36525;

  const PNAMES = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const ingresses = [];
  for (const nm of PNAMES) {
    const lonStart = pLon(nm, T_start);
    const lonEnd = pLon(nm, T_end);
    const signStart = Math.floor(n360(lonStart) / 30);
    const signEnd = Math.floor(n360(lonEnd) / 30);
    if (signStart !== signEnd) {
      ingresses.push({ planet: nm, from_sign: SIGNS[signStart], to_sign: SIGNS[signEnd], exact: true });
    } else {
      // Approaching ingress — planet within 1° of next sign boundary, moving direct
      const lonMid = pLon(nm, (T_start + T_end) / 2);
      const degInSign = n360(lonMid) % 30;
      const isRetro = (function() {
        const d = pLon(nm, T_end) - pLon(nm, T_start);
        let dd = d; if (dd > 180) dd -= 360; if (dd < -180) dd += 360;
        return dd < 0;
      })();
      if (!isRetro && degInSign >= 29.0) {
        const nextSignIdx = (signEnd + 1) % 12;
        ingresses.push({ planet: nm, from_sign: SIGNS[signEnd], to_sign: SIGNS[nextSignIdx], approaching: true });
      }
    }
  }
  return ingresses;
}