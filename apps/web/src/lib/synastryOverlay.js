/**
 * Build a synastry overlay for the ChartWheel — entirely client-side from two
 * stored charts. Produces the shape ChartWheel expects as `transitData` in
 * synastry mode: partner planets (the "outer ring"), partner houses, and
 * cross-aspects (partner planet → user natal point). Honors the user's hidden
 * chart-point toggles so disabled asteroids/lots/nodes never surface.
 *
 * No network call — both charts' longitudes are already in raw_data.
 */
import { filterHiddenPlanets } from '@/lib/chartPointVisibility';

const ASPECTS = [
  { name: 'conjunction', angle: 0, orb: 3 },
  { name: 'opposition', angle: 180, orb: 3 },
  { name: 'trine', angle: 120, orb: 2.5 },
  { name: 'square', angle: 90, orb: 2.5 },
  { name: 'sextile', angle: 60, orb: 2 },
];

function aspectBetween(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  let best = null;
  for (const a of ASPECTS) {
    const orb = Math.abs(diff - a.angle);
    if (orb <= a.orb && (!best || orb < best.orb)) {
      best = { aspect: a.name, orb: Math.round(orb * 100) / 100 };
    }
  }
  return best;
}

function collectPoints(raw, hidden) {
  const pts = [...filterHiddenPlanets(raw?.planets || [], hidden)];
  const angles = raw?.angles || {};
  if (angles.ascendant) pts.push({ name: 'Ascendant', ...angles.ascendant, house: 1 });
  if (angles.descendant) pts.push({ name: 'Descendant', ...angles.descendant, house: 7 });
  if (angles.midheaven) pts.push({ name: 'Midheaven', ...angles.midheaven, house: 10 });
  if (angles.ic) pts.push({ name: 'IC', ...angles.ic, house: 4 });
  const nodes = raw?.nodes || {};
  if (!hidden.has('North Node')) {
    if (nodes.north_node) pts.push({ name: 'North Node', ...nodes.north_node });
    if (nodes.south_node) pts.push({ name: 'South Node', ...nodes.south_node });
  }
  return pts;
}

export function buildSynastryOverlay(userRaw, partnerRaw, hidden) {
  if (!userRaw || !partnerRaw) return null;
  const h = hidden?.size ? hidden : new Set();
  const overlayPlanets = collectPoints(partnerRaw, h);
  const userPoints = collectPoints(userRaw, h);

  const transit_aspects = [];
  for (const pp of overlayPlanets) {
    if (pp.longitude == null) continue;
    for (const up of userPoints) {
      if (up.longitude == null) continue;
      const asp = aspectBetween(pp.longitude, up.longitude);
      if (asp) transit_aspects.push({ transit_planet: pp.name, natal_planet: up.name, aspect: asp.aspect, orb: asp.orb });
    }
  }

  return {
    planets: overlayPlanets,
    partnerHouses: partnerRaw.houses || [],
    partnerAscSign: partnerRaw.angles?.ascendant?.sign || '',
    transit_aspects,
  };
}