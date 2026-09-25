/**
 * Chart-point visibility — shared logic that turns the user's Chart Display
 * toggles (Profile > Chart tab) into a set of point names to hide.
 *
 * The toggles live on the user entity: show_asteroids, show_lots, show_nodes,
 * show_lilith (each defaults to ON when not === false). This module is the
 * single source of truth so natal wheels, transit lists, synastry overlays,
 * and relationship/composite synthesis all hide the same points consistently.
 */

export const ASTEROID_POINTS = [
  'Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Hygiea', 'Eris', 'Tyche',
];

export const LOT_POINTS = [
  'Part of Fortune', 'Part of Spirit', 'Part of Eros', 'Part of Necessity',
];

export const NODE_POINTS = ['North Node', 'South Node'];

export const LILITH_POINTS = ['Black Moon Lilith'];

/**
 * Build the set of point names the user has chosen to hide.
 * Returns a Set (empty when nothing is hidden).
 *
 * Lilith & the asteroid pack are Premium-only — they're hidden for every
 * non-Premium user regardless of the display toggle, so free/Core users never
 * see them on any chart surface.
 */
export function getHiddenChartPoints(user) {
  const hidden = new Set();
  // Resolve subscription tier once; Premium-only points stay hidden otherwise.
  let isPremium = false;
  try {
    // Inline minimal tier check to avoid a circular import with permissions.js
    const tier = user?.subscription_tier;
    const expired = user?.subscription_expires && new Date(user.subscription_expires) < new Date();
    isPremium = tier === 'calendar' && !expired;
  } catch { /* default off */ }

  if (user?.show_asteroids !== true || !isPremium) ASTEROID_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_lots !== true) LOT_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_nodes === false) NODE_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_lilith === false || !isPremium) LILITH_POINTS.forEach((n) => hidden.add(n));
  return hidden;
}

/** True when hidden set is non-empty and contains the name. */
export function isPointHidden(name, hidden) {
  return !!hidden?.size && hidden.has(name);
}

/** Filter a planets array (objects with .name) by the hidden set. */
export function filterHiddenPlanets(planets, hidden) {
  if (!hidden?.size || !Array.isArray(planets)) return planets;
  return planets.filter((p) => !hidden.has(p.name));
}

/**
 * Filter an aspects array by the hidden set. Aspects use a variety of key
 * shapes (transit_planet/natal_planet, person1_planet/person2_planet,
 * planet1/planet2) — any side referencing a hidden point drops the aspect.
 */
export function filterHiddenAspects(aspects, hidden) {
  if (!hidden?.size || !Array.isArray(aspects)) return aspects;
  return aspects.filter((a) =>
    !hidden.has(a.transit_planet) &&
    !hidden.has(a.natal_planet) &&
    !hidden.has(a.person1_planet) &&
    !hidden.has(a.person2_planet) &&
    !hidden.has(a.planet1) &&
    !hidden.has(a.planet2),
  );
}