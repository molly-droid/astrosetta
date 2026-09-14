// Single source of truth for the "feature highlight" shown in email digests.
// Mirrors src/lib/featureAnnouncements.js. A highlight appears in the digest
// for one week after its date, then drops out (no cycling) so only the most
// recent addition is ever featured at a time.

export const HIGHLIGHT_WINDOW_DAYS = 7;

export interface FeatureHighlight {
  spotlight_key: string;
  title: string;
  subtitle: string;
  description: string;
  deep_link: string;
  date: string;
}

// Real feature additions only — quick tips and the full-app tour are not
// featured as email highlights (they live in the notifications running list).
export const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  { spotlight_key: 'relationship_planner_v1', title: 'Relationship Planner — Synastry & Composite', subtitle: 'Read the sky through your bond', description: "The Chart and Planner now read the sky through your relationship. Choose any saved chart as your base, then switch into Synastry to weave two charts together or Composite to merge them into one relationship chart — with today's transits overlaid. Your active bond sits front and center; tap to step back and compare with anyone.", deep_link: '/planner', date: '2026-08-27' },
  { spotlight_key: 'chart_display_v1', title: 'Arabic Lots & Chart Display', subtitle: 'Shape your chart — learn the Lots', description: "Your chart now holds more than planets. The Arabic Lots of Spirit, Eros, and Necessity — calculated points of purpose, desire, and duty — join the Lunar Nodes, Black Moon Lilith, and Chiron. Choose which points appear on your wheels with the new Chart Display settings, then learn what each one means in six new curriculum modules.", deep_link: '/profile?tab=chart', date: '2026-08-21' },
  { spotlight_key: 'transit_movement_v1', title: 'Transit Movement Arcs', subtitle: "Watch the week's planetary journeys", description: "The Week & Month planner now draws each transiting planet's path as a colored arc — from its start glyph to where it lands by period's end. Arrows show direction, dashed lines mark retrogrades, and any arc is clickable for a personalized reading.", deep_link: '/planner', date: '2026-08-12' },
  { spotlight_key: 'knowledge_density_v1', title: 'Knowledge Density', subtitle: 'Learn at your own depth — anytime', description: 'A new slider in your Profile scales interpretation and curriculum depth from plain-language Essential to full Technical. Plus every astrological term is now tappable to learn more. It reshapes your readings, curriculum, and this email instantly.', deep_link: '/profile', date: '2026-08-07' },
  { spotlight_key: 'synastry_v1', title: 'Synastry Readings', subtitle: 'Compare charts with anyone', description: 'Save birth charts for partners, family, and friends — then explore cross-chart aspects, house overlays, and relationship dynamics with guided interpretations.', deep_link: '/chart', date: '2026-07-22' },
  { spotlight_key: 'chart_interactivity_v1', title: 'Interactive Chart Wheel', subtitle: 'Click for instant meanings', description: 'Tap any planet, aspect line, or transit-to-natal connection in the chart wheel to reveal a deep, contextual interpretation — including collective sky aspects.', deep_link: '/planner', date: '2026-07-17' },
  { spotlight_key: 'chart_dynamics_v1', title: 'Chart Dynamics', subtitle: "Discover your chart's hidden architecture", description: 'Stelliums, empty houses, chart ruler, and aspect patterns. When today\'s transits activate your natal concentrations, they\'re called out in your daily reading.', deep_link: '/learn', date: '2026-07-10' },
];

function parseDate(d: string): Date {
  return new Date(d.slice(0, 10));
}

// Returns the single active highlight when the newest feature is still within
// its one-week window; otherwise null (no highlight in the digest).
export function pickFeatureHighlight(now: Date = new Date()): FeatureHighlight | null {
  const sorted = [...FEATURE_HIGHLIGHTS].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) return null;
  const newest = sorted[0];
  const daysSince = (now.getTime() - parseDate(newest.date).getTime()) / 86400000;
  return daysSince <= HIGHLIGHT_WINDOW_DAYS ? newest : null;
}