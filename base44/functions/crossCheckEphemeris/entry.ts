/**
 * crossCheckEphemeris — Fetches authoritative planetary positions from
 * Astro-Seek (Swiss Ephemeris) and compares them against our astroEngine
 * calculations. Returns discrepancy report and correction offsets.
 *
 * Also stores corrections in the PlanetCorrection entity so astroEngine
 * can apply them to transit calculations.
 *
 * No auth required — this is a data validation tool.
 * Can be triggered manually or via scheduled automation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function n360(d) { return ((d % 360) + 360) % 360; }
function sd(d) { return Math.sin(d * D2R); }
function cd(d) { return Math.cos(d * D2R); }
function at2(y, x) { return Math.atan2(y, x) * R2D; }
function r4(n) { return Math.round(n * 10000) / 10000; }

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

// Lunar theory (Meeus, Astronomical Algorithms ch.47) — mirrors chartCalculator's
// moonLon so the cross-check can validate the Moon at the reference timestamp.
const MOON_L = [[0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],[2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],[4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0]];

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
function obliq(T){const U=T/100;return 23+26/60+21.448/3600+(-4680.93*U-1.55*U*U+1999.25*U*U*U-51.38*Math.pow(U,4)-249.67*Math.pow(U,5)-39.05*Math.pow(U,6)+7.12*Math.pow(U,7)+27.87*Math.pow(U,8)+5.79*Math.pow(U,9)+2.45*Math.pow(U,10))/3600;}
function nutat(T){const om=n360(125.04452-1934.136261*T+0.0020708*T*T),L0=n360(280.4665+36000.7698*T),Lp=n360(218.3165+481267.8813*T);return{dpsi:((-17.20-0.01742*T)*sd(om)-1.32*sd(2*L0)-0.23*sd(2*Lp)+0.21*sd(2*om))/3600,deps:((9.20+0.00089*T)*cd(om)+0.57*cd(2*L0)+0.10*cd(2*Lp)-0.09*cd(2*om))/3600};}
function moonLon(T){
  const Lp=n360(218.3164477+481267.88123421*T-0.0015786*T*T+T*T*T/538841-Math.pow(T,4)/65194000),
        D=n360(297.8501921+445267.1114034*T-0.0018819*T*T+T*T*T/545868-Math.pow(T,4)/113065000),
        M=n360(357.5291092+35999.0502909*T-0.0001536*T*T+T*T*T/24490000),
        Mp=n360(134.9633964+477198.8675055*T+0.0087414*T*T+T*T*T/69699-Math.pow(T,4)/14712000),
        F=n360(93.2720950+483202.0175233*T-0.0036539*T*T-T*T*T/3526000+Math.pow(T,4)/863310000),
        E=1-0.002516*T-0.0000074*T*T,
        A1=n360(119.75+131.849*T),A2=n360(53.09+479264.290*T);
  let sL=0;
  for(const[td2,tm,tmp,tf,cl]of MOON_L){let e=1;if(Math.abs(tm)===1)e=E;if(Math.abs(tm)===2)e=E*E;sL+=e*cl*sd(td2*D+tm*M+tmp*Mp+tf*F);}
  sL+=3958*sd(A1)+1962*sd(Lp-F)+318*sd(A2);
  return n360(Lp+sL/1000000+nutat(T).dpsi);
}
function jd(y, mo, d, hut) {
  let yr = y, m = mo;
  if (m <= 2) { yr--; m += 12; }
  const A = Math.floor(yr / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25*(yr+4716)) + Math.floor(30.6001*(m+1)) + d + hut/24 + B - 1524.5;
}

function precessionPA(T) { return (5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T) / 3600; }
function ourLon(planet, T) {
  if (planet === 'Sun') return sunLon(T);
  if (planet === 'Moon') return moonLon(T);
  return n360(kepGeo(planet, T) + precessionPA(T));
}

function si(lon) {
  const l = n360(lon);
  return { sign: SIGNS[Math.floor(l / 30)], degree: r4(l % 30), longitude: r4(l) };
}

function angularDiff(a, b) {
  let d = n360(a) - n360(b);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return r4(d);
}

// Planet name mapping: Astro-Seek URL param -> our planet name
const ASTRO_SEEK_MAP = {
  'p_slunce': 'Sun',
  'p_luna': 'Moon',
  'p_merkur': 'Mercury',
  'p_venuse': 'Venus',
  'p_mars': 'Mars',
  'p_jupiter': 'Jupiter',
  'p_saturn': 'Saturn',
  'p_uran': 'Uranus',
  'p_neptun': 'Neptune',
  'p_pluto': 'Pluto',
};

Deno.serve(async (req) => {
  try {
    const url = 'https://horoscopes.astro-seek.com/current-planets-astrology-transits-planetary-positions';
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AstrosettaBot/1.0)' },
    });
    const html = await resp.text();

    // Extract planetary positions from the SVG chart URL parameters
    const positions = {};
    for (const [param, planet] of Object.entries(ASTRO_SEEK_MAP)) {
      const match = html.match(new RegExp(param + '=(\\d+\\.?\\d*)'));
      if (match) positions[planet] = parseFloat(match[1]);
    }

    // Extract the timestamp from the page
    const dayMatch = html.match(/narozeni_den=(\d+)/);
    const monthMatch = html.match(/narozeni_mesic=(\d+)/);
    const yearMatch = html.match(/narozeni_rok=(\d+)/);
    const hourMatch = html.match(/narozeni_hodina=(\d+)/);
    const minuteMatch = html.match(/narozeni_minuta=(\d+)/);

    if (!yearMatch || !positions['Jupiter']) {
      return Response.json({ error: 'Failed to parse Astro-Seek page', positions }, { status: 502 });
    }

    const year = parseInt(yearMatch[1]);
    const month = parseInt(monthMatch[1]);
    const day = parseInt(dayMatch[1]);
    const hour = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minute = minuteMatch ? parseInt(minuteMatch[1]) : 0;

    // Compute Julian Day for the Astro-Seek timestamp
    const utH = hour + minute / 60;
    const JD = jd(year, month, day, utH);
    const T = (JD - 2451545) / 36525;

    // Compare each planet
    const comparisons = [];
    const corrections = {};
    let maxError = 0;
    let worstPlanet = '';

    for (const [param, planet] of Object.entries(ASTRO_SEEK_MAP)) {
      const refLon = positions[planet];
      if (refLon === undefined) continue;
      const ourVal = ourLon(planet, T);
      const diff = angularDiff(refLon, ourVal);
      const refInfo = si(refLon);
      const ourInfo = si(ourVal);
      const signMismatch = refInfo.sign !== ourInfo.sign;

      comparisons.push({
        planet,
        reference: { longitude: refLon, ...refInfo },
        ours: { longitude: ourVal, ...ourInfo },
        difference_deg: diff,
        sign_mismatch: signMismatch,
      });

      // Persist a correction for every planet EXCEPT the Moon. The Moon moves
      // ~0.5°/hour, so any stored offset is stale within the hour and would
      // degrade transit calculations if applied later. The Moon is shown in the
      // report for visibility but never written to PlanetCorrection.
      if (planet !== 'Moon') corrections[planet] = diff;
      if (planet !== 'Moon' && Math.abs(diff) > Math.abs(maxError)) {
        maxError = diff;
        worstPlanet = planet;
      }
    }

    // Store corrections for use by astroEngine (always — runs from admin or schedule)
    let stored = false;
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.PlanetCorrection.deleteMany({});
      const records = Object.entries(corrections).map(([planet, offset]) => ({
        planet,
        longitude_offset: offset,
        checked_at: new Date().toISOString(),
        source: 'astro-seek-swiss-ephemeris',
      }));
      await base44.asServiceRole.entities.PlanetCorrection.bulkCreate(records);
      stored = true;
    } catch (e) {
      // Non-fatal — corrections still returned in response
    }

    return Response.json({
      checked_at: new Date().toISOString(),
      reference_source: 'Astro-Seek (Swiss Ephemeris)',
      reference_time: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UTC`,
      julian_day: r4(JD),
      comparisons,
      corrections,
      max_error: { planet: worstPlanet, degrees: maxError },
      corrections_stored: stored,
      summary: comparisons.map(c =>
        `${c.planet}: ref=${c.reference.sign} ${c.reference.degree}° | ours=${c.ours.sign} ${c.ours.degree}° | diff=${c.difference_deg}°${c.sign_mismatch ? ' ⚠ SIGN MISMATCH' : ''}`
      ),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});