/**
 * Chart-engine cross-check: builtin (ported Base44 ephemeris) vs
 * astrology-api (Swiss Ephemeris) through the REAL chart-calculator function
 * on the local stack, using the per-request `engine` override.
 *
 * Prereqs: supabase start + db reset + functions serve --env-file (the env
 * file must hold ASTROLOGY_API_KEY). Run: node scripts/chart-engine-crosscheck.mjs
 *
 * Reports per-planet longitude deltas, sign/house mismatches, and angle
 * deltas for a spread of eras/latitudes, plus one transit-sky comparison.
 */
import { execSync } from 'node:child_process';

const CASES = [
  { label: '1958 London (placidus-ish north)', birth_date: '1958-11-03', birth_time: '06:15:00', utc_offset: 0, birth_location: { latitude: 51.5074, longitude: -0.1278 } },
  { label: '1971 Tokyo', birth_date: '1971-07-22', birth_time: '23:40:00', utc_offset: 9, birth_location: { latitude: 35.6762, longitude: 139.6503 } },
  { label: '1992 Denver (parity chart)', birth_date: '1992-03-15', birth_time: '14:32:00', utc_offset: -7, birth_location: { latitude: 39.7392, longitude: -104.9903 } },
  { label: '1988 Sydney (southern hemisphere)', birth_date: '1988-01-30', birth_time: '03:05:00', utc_offset: 11, birth_location: { latitude: -33.8688, longitude: 151.2093 } },
  { label: '2005 São Paulo', birth_date: '2005-09-08', birth_time: '18:50:00', utc_offset: -3, birth_location: { latitude: -23.5505, longitude: -46.6333 } },
];

function detectStack() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY };
  }
  const cwd = new URL('..', import.meta.url).pathname;
  let out;
  try { out = execSync('supabase status -o env', { encoding: 'utf8', cwd }); }
  catch { out = execSync('npx -y supabase status -o env', { encoding: 'utf8', cwd }); }
  const get = (k) => out.match(new RegExp(`${k}="?([^"\\n]+)"?`))?.[1];
  return { url: get('API_URL'), anon: get('ANON_KEY') };
}

const { url, anon } = detectStack();
const email = `engine-check-${Date.now()}@test.com`;
const signup = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'engine-check-123' }),
}).then((r) => r.json());
const headers = { apikey: anon, Authorization: `Bearer ${signup.access_token}`, 'Content-Type': 'application/json' };

const calc = (body) => fetch(`${url}/functions/v1/chart-calculator`, { method: 'POST', headers, body: JSON.stringify(body) })
  .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(JSON.stringify(d)); return d; });

const dLon = (a, b) => { let d = Math.abs(a - b); return d > 180 ? 360 - d : d; };

let worst = { delta: 0 };
for (const c of CASES) {
  const [builtin, remote] = await Promise.all([
    calc({ chart_type: 'natal', house_system: 'whole_sign', engine: 'builtin', ...c }),
    calc({ chart_type: 'natal', house_system: 'whole_sign', engine: 'astrology-api', ...c }),
  ]);
  if (remote.engine !== 'astrology-api') { console.log(`✗ ${c.label}: remote engine did not engage (${remote.engine})`); continue; }
  console.log(`\n== ${c.label}`);
  const rById = Object.fromEntries(remote.planets.map((p) => [p.name, p]));
  let signMiss = 0, houseMiss = 0, maxD = 0, maxName = '';
  for (const bp of builtin.planets) {
    const rp = rById[bp.name];
    if (!rp) continue;
    const d = dLon(bp.longitude, rp.longitude);
    if (d > maxD) { maxD = d; maxName = bp.name; }
    if (bp.sign !== rp.sign) { signMiss++; console.log(`   SIGN  ${bp.name}: builtin ${bp.sign} ${bp.degree?.toFixed(2)}° vs swiss ${rp.sign} ${rp.degree?.toFixed(2)}°`); }
    if (bp.house !== rp.house) { houseMiss++; console.log(`   HOUSE ${bp.name}: builtin H${bp.house} vs swiss H${rp.house} (Δlon ${d.toFixed(2)}°)`); }
  }
  const ascD = dLon(builtin.angles.ascendant.longitude, remote.angles.ascendant.longitude);
  const mcD = dLon(builtin.angles.midheaven.longitude, remote.angles.midheaven.longitude);
  console.log(`   max planet Δ: ${maxD.toFixed(3)}° (${maxName}) | ASC Δ ${ascD.toFixed(3)}° | MC Δ ${mcD.toFixed(3)}° | sign misses ${signMiss} | house misses ${houseMiss}`);
  console.log(`   aspects: builtin ${builtin.aspects.length} vs swiss ${remote.aspects.length}`);
  if (maxD > worst.delta) worst = { delta: maxD, name: maxName, chart: c.label };
}

// Transit sky comparison for today
const t = CASES[2];
const [tb, tr] = await Promise.all([
  calc({ chart_type: 'transit', engine: 'builtin', ...t, transit_time: '12:00:00' }),
  calc({ chart_type: 'transit', engine: 'astrology-api', ...t, transit_time: '12:00:00' }),
]);
console.log(`\n== transit sky (today, engine=${tr.engine})`);
const trById = Object.fromEntries(tr.transit_planets.map((p) => [p.name, p]));
let tMax = 0, tName = '';
for (const bp of tb.transit_planets) {
  const rp = trById[bp.name]; if (!rp) continue;
  const d = dLon(bp.longitude, rp.longitude);
  if (d > tMax) { tMax = d; tName = bp.name; }
  if (bp.sign !== rp.sign) console.log(`   SIGN ${bp.name}: builtin ${bp.sign} vs swiss ${rp.sign}`);
  if (bp.retrograde !== rp.retrograde) console.log(`   RETRO ${bp.name}: builtin ${bp.retrograde} vs swiss ${rp.retrograde}`);
}
console.log(`   max sky Δ: ${tMax.toFixed(3)}° (${tName}) | transit aspects: builtin ${tb.transit_aspects.length} vs swiss ${tr.transit_aspects.length}`);
console.log(`\nWorst natal delta overall: ${worst.delta?.toFixed(3)}° (${worst.name} — ${worst.chart})`);
