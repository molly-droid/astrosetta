/**
 * Server mirror of apps/web/src/lib/chartPointVisibility.js (E-04).
 *
 * Lilith and the asteroid pack are Premium-only AND follow the user's Chart
 * Display toggles; Lots and Nodes follow theirs. Every server path that builds
 * a reading must apply this BEFORE generating: the day reading is shared by
 * the app, the digest, and the nightly pre-generation (same period_key), so
 * an unfiltered generator leaks hidden bodies onto every surface.
 */
export const ASTEROID_POINTS = ['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Hygiea', 'Eris', 'Tyche'];
export const LOT_POINTS = ['Part of Fortune', 'Part of Spirit', 'Part of Eros', 'Part of Necessity'];
export const NODE_POINTS = ['North Node', 'South Node'];
export const LILITH_POINTS = ['Black Moon Lilith'];

export function hiddenChartPoints(user): Set<string> {
  const hidden = new Set<string>();
  const expired = user?.subscription_expires && new Date(user.subscription_expires) < new Date();
  const isPremium = user?.subscription_tier === 'calendar' && !expired;
  if (user?.show_asteroids !== true || !isPremium) ASTEROID_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_lots !== true) LOT_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_nodes !== true) NODE_POINTS.forEach((n) => hidden.add(n));
  if (user?.show_lilith !== true || !isPremium) LILITH_POINTS.forEach((n) => hidden.add(n));
  return hidden;
}

/** Natal chart with hidden points removed (planets list only). */
export function visibleNatal(raw, hidden: Set<string>) {
  if (!raw || !hidden?.size) return raw;
  return { ...raw, planets: (raw.planets || []).filter((p) => !hidden.has(p.name)) };
}

/** chart-calculator transit response with hidden points removed everywhere. */
export function visibleTransits(calc, hidden: Set<string>) {
  if (!calc || !hidden?.size) return calc;
  const shown = (n) => !hidden.has(n);
  return {
    ...calc,
    transit_planets: (calc.transit_planets || []).filter((p) => shown(p.name)),
    transit_aspects: (calc.transit_aspects || []).filter((a) => shown(a.transit_planet) && shown(a.natal_planet)),
    stations: (calc.stations || []).filter((s) => shown(s.planet)),
    ingresses: (calc.ingresses || []).filter((i) => shown(i.planet)),
    natal: calc.natal ? { ...calc.natal, planets: (calc.natal.planets || []).filter((p) => shown(p.name)) } : calc.natal,
  };
}
