/**
 * Transit–Natal Formation Detection
 *
 * Detects aspect patterns (Grand Trine, T-Square, Kite, Mystic Rectangle, Yod)
 * that span BOTH the current transiting planets AND the user's natal placements.
 *
 * A formation is "mixed" only if it contains at least one transit planet AND one
 * natal planet — i.e. a transiting body is completing or triggering a
 * configuration against the natal chart. Pure-natal and pure-transit (mundane)
 * formations are detected elsewhere and excluded here.
 *
 * Transit-involved aspect legs must be near-exact (≤ 3°) so a formation is
 * genuinely active on the day; natal–natal legs use the standard 8° orb.
 *
 * Pure computation — no LLM calls.
 */

import { aspectBetween, aspectOrb, SIGN_ELEMENTS } from './mundanePatterns';

// Planets eligible as formation vertices. Moon excluded from the transit pool
// (too fast / noisy for day-spanning formations); natal Moon is included.
const TRANSIT_POOL = new Set(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node', 'Chiron']);
const NATAL_POOL = new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node', 'Chiron']);

const TRANSIT_ORB = 3;  // transit-involved legs must be active today
const NATAL_ORB = 8;    // natal–natal legs use the standard orb

function tag(planets, source) {
  const pool = source === 'transit' ? TRANSIT_POOL : NATAL_POOL;
  return (planets || [])
    .filter(p => p && p.longitude != null && p.sign && pool.has(p.name))
    .map(p => ({ ...p, source }));
}

// Returns { aspect, orb } if the aspect is within orb (tighter for transit legs).
function leg(p1, p2) {
  const asp = aspectBetween(p1.longitude, p2.longitude);
  if (!asp) return null;
  const orb = aspectOrb(p1.longitude, p2.longitude, asp);
  const transitInvolved = p1.source === 'transit' || p2.source === 'transit';
  if (orb > (transitInvolved ? TRANSIT_ORB : NATAL_ORB)) return null;
  return { aspect: asp, orb };
}

function isMixed(grp) {
  const sources = new Set(grp.map(p => p.source));
  return sources.has('transit') && sources.has('natal');
}

function detailsOf(grp) {
  return grp.map(p => ({ name: p.name, sign: p.sign, degree: p.degree, house: p.house, retrograde: p.retrograde, source: p.source }));
}

function aspectLine(p1, p2, asp) {
  return {
    planet1: p1.name,
    planet2: p2.name,
    aspect: asp,
    orb: Math.round(aspectOrb(p1.longitude, p2.longitude, asp) * 100) / 100,
    transitInvolved: p1.source === 'transit' || p2.source === 'transit',
  };
}

// ── Description helpers ────────────────────────────────────────────────────
function who(p) {
  return `${p.name}${p.source === 'transit' ? ' (transiting)' : ''} in ${p.sign}`;
}
function listPlanets(grp) {
  return grp.map(who).join(', ');
}
function descGrandTrine(grp) {
  return `A transit-activated Grand Trine — ${listPlanets(grp)}. The transiting body completes a flowing 120° triangle with your natal placements, briefly unlocking an effortless, supportive channel between these areas of life today.`;
}
function descTSquare(grp, apex) {
  return `A transit-triggered T-Square — ${listPlanets(grp)}. An opposition creates tension while both ends square ${who(apex)} at the apex. The transiting planet is temporarily activating this pressure point, surfacing a growth challenge around the apex placement.`;
}
function descKite(grp, focal) {
  return `A transit-completed Kite — ${listPlanets(grp)}. A Grand Trine gains a focal point at ${who(focal)}, which opposes one vertex and sextiles the other two. The transit gives your natal talent a temporary direction and release valve — a window where latent ability can be channeled into purposeful action.`;
}
function descMystic(grp) {
  return `A transit-spanning Mystic Rectangle — ${listPlanets(grp)}. Two oppositions create productive tension while trines and sextiles offer channels for resolution. The transiting planet weaves together a balanced, workable polarity between your natal placements and the current sky.`;
}
function descYod(grp, apex) {
  return `A transit-activated Yod ("Finger of God") — ${listPlanets(grp)}. Two bodies sextile, both quincunx ${who(apex)} at the apex. The transiting planet is momentarily pointing a fated adjustment at the apex placement — a brief window of special-purpose recalibration around its house and sign themes.`;
}

/**
 * @param {Array} transitPlanets — { name, sign, longitude, degree, retrograde }
 * @param {Array} natalPlanets  — same shape
 * @returns {Array} Mixed formations, each with planetDetails + aspect web.
 */
export function getTransitNatalFormations(transitPlanets, natalPlanets) {
  if (!transitPlanets?.length || !natalPlanets?.length) return [];
  const pool = [...tag(transitPlanets, 'transit'), ...tag(natalPlanets, 'natal')];
  if (pool.length < 3) return [];

  const results = [];
  const seen = new Set();
  const add = (f) => {
    const key = `${f.type}|${[...f.planets].sort().join('|')}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(f);
  };

  // Grand Trine — three bodies each trine
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].name === pool[j].name) continue;
      if (leg(pool[i], pool[j])?.aspect !== 'trine') continue;
      for (let k = j + 1; k < pool.length; k++) {
        if (pool[k].name === pool[i].name || pool[k].name === pool[j].name) continue;
        if (leg(pool[i], pool[k])?.aspect !== 'trine') continue;
        if (leg(pool[j], pool[k])?.aspect !== 'trine') continue;
        const grp = [pool[i], pool[j], pool[k]];
        if (!isMixed(grp)) continue;
        const names = grp.map(p => p.name);
        add({
          type: 'Grand Trine',
          category: 'pattern',
          planets: names,
          element: [...new Set(grp.map(p => SIGN_ELEMENTS[p.sign]))].length === 1 ? SIGN_ELEMENTS[grp[0].sign] : undefined,
          planetDetails: detailsOf(grp),
          aspects: [aspectLine(pool[i], pool[j], 'trine'), aspectLine(pool[i], pool[k], 'trine'), aspectLine(pool[j], pool[k], 'trine')],
          description: descGrandTrine(grp),
        });
      }
    }
  }

  // T-Square — two planets opposition, both square an apex
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].name === pool[j].name) continue;
      if (leg(pool[i], pool[j])?.aspect !== 'opposition') continue;
      for (let k = 0; k < pool.length; k++) {
        if (k === i || k === j || pool[k].name === pool[i].name || pool[k].name === pool[j].name) continue;
        if (leg(pool[i], pool[k])?.aspect !== 'square') continue;
        if (leg(pool[j], pool[k])?.aspect !== 'square') continue;
        const grp = [pool[i], pool[j], pool[k]];
        if (!isMixed(grp)) continue;
        const names = grp.map(p => p.name);
        add({
          type: 'T-Square',
          category: 'pattern',
          planets: names,
          apex: pool[k].name,
          planetDetails: detailsOf(grp),
          aspects: [aspectLine(pool[i], pool[j], 'opposition'), aspectLine(pool[i], pool[k], 'square'), aspectLine(pool[j], pool[k], 'square')],
          description: descTSquare(grp, pool[k]),
        });
      }
    }
  }

  // Kite — Grand Trine + a 4th planet opposing one vertex, sextiling the other two
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].name === pool[j].name) continue;
      if (leg(pool[i], pool[j])?.aspect !== 'trine') continue;
      for (let k = j + 1; k < pool.length; k++) {
        if (pool[k].name === pool[i].name || pool[k].name === pool[j].name) continue;
        if (leg(pool[i], pool[k])?.aspect !== 'trine') continue;
        if (leg(pool[j], pool[k])?.aspect !== 'trine') continue;
        const trine = [pool[i], pool[j], pool[k]];
        for (let m = 0; m < pool.length; m++) {
          if (m === i || m === j || m === k) continue;
          if ([pool[i].name, pool[j].name, pool[k].name].includes(pool[m].name)) continue;
          for (let v = 0; v < 3; v++) {
            const apex = trine[v];
            const others = [trine[(v + 1) % 3], trine[(v + 2) % 3]];
            if (leg(apex, pool[m])?.aspect !== 'opposition') continue;
            if (leg(others[0], pool[m])?.aspect !== 'sextile') continue;
            if (leg(others[1], pool[m])?.aspect !== 'sextile') continue;
            const grp = [pool[i], pool[j], pool[k], pool[m]];
            if (!isMixed(grp)) continue;
            const names = grp.map(p => p.name);
            add({
              type: 'Kite',
              category: 'pattern',
              planets: names,
              apex: pool[m].name,
              planetDetails: detailsOf(grp),
              aspects: [
                aspectLine(pool[i], pool[j], 'trine'), aspectLine(pool[i], pool[k], 'trine'), aspectLine(pool[j], pool[k], 'trine'),
                aspectLine(apex, pool[m], 'opposition'), aspectLine(others[0], pool[m], 'sextile'), aspectLine(others[1], pool[m], 'sextile'),
              ],
              description: descKite(grp, pool[m]),
            });
          }
        }
      }
    }
  }

  // Mystic Rectangle — two opposition pairs linked by trines & sextiles
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].name === pool[j].name) continue;
      if (leg(pool[i], pool[j])?.aspect !== 'opposition') continue;
      for (let k = 0; k < pool.length; k++) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < pool.length; l++) {
          if (l === i || l === j) continue;
          if ([pool[i].name, pool[j].name].includes(pool[k].name) || [pool[i].name, pool[j].name].includes(pool[l].name)) continue;
          if (leg(pool[k], pool[l])?.aspect !== 'opposition') continue;
          const a1 = leg(pool[i], pool[k]);
          const a2 = leg(pool[i], pool[l]);
          const a3 = leg(pool[j], pool[k]);
          const a4 = leg(pool[j], pool[l]);
          let trineLegs, sextileLegs;
          if (a1?.aspect === 'trine' && a2?.aspect === 'sextile' && a3?.aspect === 'sextile' && a4?.aspect === 'trine') {
            trineLegs = [[pool[i], pool[k]], [pool[j], pool[l]]];
            sextileLegs = [[pool[i], pool[l]], [pool[j], pool[k]]];
          } else if (a1?.aspect === 'sextile' && a2?.aspect === 'trine' && a3?.aspect === 'trine' && a4?.aspect === 'sextile') {
            trineLegs = [[pool[i], pool[l]], [pool[j], pool[k]]];
            sextileLegs = [[pool[i], pool[k]], [pool[j], pool[l]]];
          } else continue;
          const grp = [pool[i], pool[j], pool[k], pool[l]];
          if (!isMixed(grp)) continue;
          const names = grp.map(p => p.name);
          add({
            type: 'Mystic Rectangle',
            category: 'pattern',
            planets: names,
            planetDetails: detailsOf(grp),
            aspects: [
              aspectLine(pool[i], pool[j], 'opposition'), aspectLine(pool[k], pool[l], 'opposition'),
              ...trineLegs.map(([p, q]) => aspectLine(p, q, 'trine')),
              ...sextileLegs.map(([p, q]) => aspectLine(p, q, 'sextile')),
            ],
            description: descMystic(grp),
          });
        }
      }
    }
  }

  // Yod — two planets sextile, both quincunx a third (the apex)
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (pool[i].name === pool[j].name) continue;
      if (leg(pool[i], pool[j])?.aspect !== 'sextile') continue;
      for (let k = 0; k < pool.length; k++) {
        if (k === i || k === j || pool[k].name === pool[i].name || pool[k].name === pool[j].name) continue;
        if (leg(pool[i], pool[k])?.aspect !== 'quincunx') continue;
        if (leg(pool[j], pool[k])?.aspect !== 'quincunx') continue;
        const grp = [pool[i], pool[j], pool[k]];
        if (!isMixed(grp)) continue;
        const names = grp.map(p => p.name);
        add({
          type: 'Yod',
          category: 'pattern',
          planets: names,
          apex: pool[k].name,
          planetDetails: detailsOf(grp),
          aspects: [aspectLine(pool[i], pool[j], 'sextile'), aspectLine(pool[i], pool[k], 'quincunx'), aspectLine(pool[j], pool[k], 'quincunx')],
          description: descYod(grp, pool[k]),
        });
      }
    }
  }

  // Prioritise formations whose apex is a transiting planet, then larger ones
  results.sort((a, b) => {
    const aTransitApex = a.apex && a.planetDetails.find(p => p.name === a.apex)?.source === 'transit' ? 0 : 1;
    const bTransitApex = b.apex && b.planetDetails.find(p => p.name === b.apex)?.source === 'transit' ? 0 : 1;
    if (aTransitApex !== bTransitApex) return aTransitApex - bTransitApex;
    return b.planets.length - a.planets.length;
  });
  return results;
}