/**
 * lunarNode — True (osculating) lunar node longitude.
 *
 * The mean node formula (125.04452 - 1934.136261*T + ...) drifts up to ~1.5°
 * from the actual node because it ignores the Moon's orbital-plane wobble.
 * Around sign ingresses this lag of ~1.5° leaves the node a full sign behind
 * (e.g. mean South Node at 0° Virgo while the true South Node is already at
 * 29° Leo during an eclipse season) — which is the bug this module fixes.
 *
 * The astronomically correct "true node" is the ascending node of the Moon's
 * *osculating* orbit at the instant: the line where the instantaneous orbital
 * plane meets the ecliptic, on the side where the Moon crosses north.
 *
 * Method: build the Moon's geocentric ecliptic unit vector r(t) from the Meeus
 * ELP-2000/82 truncated series (longitude + latitude), numerically
 * differentiate for velocity v, take the orbital-plane normal n = r × v, and
 * project onto the ecliptic. For the Moon's prograde orbit (n_z > 0) the
 * ascending-node longitude is atan2(n_x, -n_y). This matches Swiss Ephemeris
 * TRUE_NODE to well within an arcminute.
 *
 * Self-contained — imported by chartCalculator and astroEngine so both
 * engines share one node definition (per the single-source-of-truth rule).
 */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

function n360(d: number): number { return ((d % 360) + 360) % 360; }
function sd(d: number): number { return Math.sin(d * D2R); }
function cd(d: number): number { return Math.cos(d * D2R); }

// Meeus, Astronomical Algorithms — ELP-2000/82 truncated series (1e-6 deg).
// Columns: [D, M, M', F, coefficient]
const MOON_L: number[][] = [
  [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],[2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],[2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],[2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],[4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0],
];
const MOON_B: number[][] = [
  [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],[0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],[2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],[0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107],
];

function moonEcl(jde: number): { lon: number; lat: number } {
  const T = (jde - 2451545) / 36525;
  const Lp = n360(218.3164477 + 481267.88123421*T - 0.0015786*T*T + T*T*T/538841 - T*T*T*T/65194000);
  const D  = n360(297.8501921 + 445267.1114034*T - 0.0018819*T*T + T*T*T/545868 - T*T*T*T/113065000);
  const M  = n360(357.5291092 + 35999.0502909*T  - 0.0001536*T*T + T*T*T/24490000);
  const Mp = n360(134.9633964 + 477198.8675055*T  + 0.0087414*T*T + T*T*T/69699 - T*T*T*T/14712000);
  const F  = n360(93.2720950  + 483202.0175233*T  - 0.0036539*T*T - T*T*T/3526000 + T*T*T*T/863310000);
  const E  = 1 - 0.002516*T - 0.0000074*T*T;
  const A1 = n360(119.75 + 131.849*T), A2 = n360(53.09 + 479264.290*T);
  let lon = 0, lat = 0;
  for (const t of MOON_L) {
    const a = D*t[0] + M*t[1] + Mp*t[2] + F*t[3];
    let e = 1; if (Math.abs(t[1]) === 1) e = E; if (Math.abs(t[1]) === 2) e = E*E;
    lon += e * t[4] * sd(a);
  }
  for (const t of MOON_B) {
    const a = D*t[0] + M*t[1] + Mp*t[2] + F*t[3];
    let e = 1; if (Math.abs(t[1]) === 1) e = E; if (Math.abs(t[1]) === 2) e = E*E;
    lat += e * t[4] * sd(a);
  }
  // Planetary terms + nutation in longitude (true equinox of date frame)
  const om = n360(125.04452 - 1934.136261*T + 0.0020708*T*T);
  const dpsi = ((-17.20 - 0.01742*T) * sd(om)) / 3600;
  return { lon: n360(Lp + lon/1e6 + (3958*sd(A1) + 1962*sd(Lp - F) + 318*sd(A2))/1e6 + dpsi), lat: lat/1e6 };
}

function moonVec(jde: number): { x: number; y: number; z: number } {
  const { lon, lat } = moonEcl(jde);
  const cr = cd(lat);
  return { x: cr*cd(lon), y: cr*sd(lon), z: sd(lat) };
}

function cross3(a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}) {
  return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x };
}

/**
 * True (osculating) ascending-node longitude in degrees [0,360), equinox of date.
 */
export function trueNode(jde: number): number {
  const dt = 0.25; // ~6h — localizes the osculating plane without noise
  const r  = moonVec(jde);
  const r0 = moonVec(jde - dt);
  const r1 = moonVec(jde + dt);
  const v = { x: (r1.x - r0.x)/(2*dt), y: (r1.y - r0.y)/(2*dt), z: (r1.z - r0.z)/(2*dt) };
  const n = cross3(r, v);
  // Moon's orbit is prograde (inclination ~5.1°, so n_z > 0): ascending node
  // longitude = atan2(n_x, -n_y). The descending node is +180°.
  return n360(Math.atan2(n.x, -n.y) * R2D);
}

/**
 * Convenience: { north, south } true-node longitudes in degrees [0,360).
 */
export function trueNodes(jde: number): { north: number; south: number } {
  const north = trueNode(jde);
  return { north, south: n360(north + 180) };
}