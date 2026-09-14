/**
 * Composite chart (midpoint method) — pure client-side arithmetic.
 *
 * A composite chart is the chart of a *relationship itself*: each point is the
 * shortest-arc midpoint of the two people's placements. It has no real birth
 * time/place, so houses are whole-sign from the composite Ascendant (midpoint
 * of the two Ascendants). No ephemeris or backend call is needed — this is all
 * midpoint math on longitudes the charts already hold.
 *
 * The returned object mirrors the `raw_data` shape the chart wheel and transit
 * pipeline already expect (planets, angles, houses, aspects, nodes) so it can
 * be dropped in anywhere a natal `raw_data` is used.
 */

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

function norm(lon) {
  return ((lon % 360) + 360) % 360;
}

function lonToSign(lon) {
  const l = norm(lon);
  const i = Math.floor(l / 30);
  return { sign: SIGNS[i], degree: l - i * 30, longitude: l };
}

function signIndex(sign) {
  return SIGNS.indexOf(sign);
}

/** Shortest-arc midpoint of two longitudes (handles the 0/360 wrap). */
function midLon(a, b) {
  const la = norm(a);
  const lb = norm(b);
  const diff = ((lb - la + 540) % 360) - 180; // signed shortest from a → b
  return norm(la + diff / 2);
}

const ASPECT_DEFS = [
  { name: 'conjunction', angle: 0, orb: 8 },
  { name: 'opposition', angle: 180, orb: 8 },
  { name: 'trine', angle: 120, orb: 8 },
  { name: 'square', angle: 90, orb: 8 },
  { name: 'sextile', angle: 60, orb: 6 },
];

/** Major aspects among the composite planets — the relationship's built-in dynamics. */
function computeAspects(planets) {
  const out = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const a of ASPECT_DEFS) {
        const orb = Math.abs(diff - a.angle);
        if (orb <= a.orb) {
          out.push({
            planet1: p1.name,
            planet2: p2.name,
            aspect: a.name,
            orb: Math.round(orb * 100) / 100,
          });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/**
 * Build a composite `raw_data` object from two charts' raw_data.
 * Returns null if either chart lacks planets.
 */
export function buildCompositeRaw(userRaw, partnerRaw, hiddenPoints) {
  if (!userRaw || !partnerRaw) return null;
  const up = userRaw.planets || [];
  const pp = partnerRaw.planets || [];
  if (!up.length || !pp.length) return null;

  // Points the user has hidden via Chart Display preferences — drop them from
  // the composite so the relationship chart and its synthesis never surface a
  // point the user has turned off (e.g. asteroids or lots).
  const hidden = hiddenPoints?.size ? hiddenPoints : new Set();

  const partnerByName = {};
  for (const p of pp) partnerByName[p.name] = p;

  const compositePlanets = [];
  for (const p of up) {
    if (hidden.has(p.name)) continue;
    const pb = partnerByName[p.name];
    if (!pb || p.longitude == null || pb.longitude == null) continue;
    const lon = midLon(p.longitude, pb.longitude);
    const { sign, degree } = lonToSign(lon);
    compositePlanets.push({ name: p.name, longitude: lon, sign, degree, retrograde: false });
  }

  // Composite angles — midpoints of the two Ascendants and Midheavens.
  const ua = userRaw.angles || {};
  const pa = partnerRaw.angles || {};
  let compositeAsc = null;
  let compositeMC = null;
  if (ua.ascendant?.longitude != null && pa.ascendant?.longitude != null) {
    const lon = midLon(ua.ascendant.longitude, pa.ascendant.longitude);
    compositeAsc = { ...lonToSign(lon), longitude: lon };
  }
  if (ua.midheaven?.longitude != null && pa.midheaven?.longitude != null) {
    const lon = midLon(ua.midheaven.longitude, pa.midheaven.longitude);
    compositeMC = { ...lonToSign(lon), longitude: lon };
  }

  const ascLon = compositeAsc?.longitude ?? 0;
  const ascSign = compositeAsc?.sign ?? 'Aries';
  const ascIdx = signIndex(ascSign);

  // Whole-sign houses from the composite Ascendant.
  const houses = Array.from({ length: 12 }, (_, i) => {
    const cusp = norm(ascLon + i * 30);
    return { number: i + 1, ...lonToSign(cusp) };
  });

  // Assign whole-sign houses to composite planets.
  for (const p of compositePlanets) {
    const pIdx = signIndex(p.sign);
    p.house = ((pIdx - ascIdx + 12) % 12) + 1;
  }

  const angles = {};
  if (compositeAsc) {
    angles.ascendant = { ...compositeAsc, house: 1 };
    const dscLon = norm(compositeAsc.longitude + 180);
    angles.descendant = { ...lonToSign(dscLon), house: 7 };
  }
  if (compositeMC) {
    angles.midheaven = { ...compositeMC, house: 10 };
    const icLon = norm(compositeMC.longitude + 180);
    angles.ic = { ...lonToSign(icLon), house: 4 };
  }

  const aspects = computeAspects(compositePlanets);

  // Composite lunar nodes (optional — only if both charts carry them AND the
  // user hasn't hidden nodes via Chart Display preferences).
  let nodes;
  const un = userRaw.nodes?.north_node;
  const pn = partnerRaw.nodes?.north_node;
  if (!hidden.has('North Node') && un?.longitude != null && pn?.longitude != null) {
    const lon = midLon(un.longitude, pn.longitude);
    const s = lonToSign(lon);
    const southLon = norm(lon + 180);
    nodes = {
      north_node: { ...s, longitude: lon },
      south_node: { ...lonToSign(southLon), longitude: southLon },
    };
  }

  const sunP = compositePlanets.find((p) => p.name === 'Sun');
  const moonP = compositePlanets.find((p) => p.name === 'Moon');

  return {
    planets: compositePlanets,
    angles,
    houses,
    aspects,
    nodes,
    sun_sign: sunP?.sign,
    moon_sign: moonP?.sign,
    ascendant_sign: ascSign,
    house_system: 'whole_sign',
  };
}