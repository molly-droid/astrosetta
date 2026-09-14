import { Layers, Compass, Eye, Sparkles, CalendarCheck, Smartphone, Mail, Users, Route, Gauge, MousePointer, Scroll, Heart } from 'lucide-react';

// Icon registry shared by NotificationsBell, InteractiveFeatures, etc.
export const ANNOUNCEMENT_ICONS = { Layers, Compass, Eye, Sparkles, CalendarCheck, Smartphone, Mail, Users, Route, Gauge, MousePointer, Scroll, Heart };

// Feature announcements — curated list shown in the notifications bell.
// Add new entries here when a new spotlight is created.
// spotlight_key must match the SPOTLIGHT_KEY in FeatureSpotlight.jsx.
export const FEATURE_ANNOUNCEMENTS = [
  {
    spotlight_key: 'advanced_terminology_v1',
    title: 'Advanced Techniques Curriculum',
    subtitle: '12 new modules — cazimi to dashas',
    description:
      "Twelve new curriculum modules teach the techniques practitioners actually use — cazimi, combustion & under the beams, antiscia, sect, profections, nakshatras, and dashas — plus an expanded tappable glossary. Follow the NEW badges through Foundations, Aspects, Classical, and Traditions.",
    unlock: 'Free for everyone',
    icon: 'Scroll',
    deep_link: '/learn',
    date: '2026-09-07',
  },
  {
    spotlight_key: 'relationship_planner_v1',
    title: 'Relationship Planner — Synastry & Composite',
    subtitle: 'Read the sky through your bond',
    description:
      "The Chart and Planner now read the sky through your relationship. Choose any saved chart as your base, then switch into Synastry to weave two charts together or Composite to merge them into one relationship chart — with today's transits overlaid. Your active bond sits front and center; tap to step back and compare with anyone.",
    unlock: 'Core+',
    icon: 'Heart',
    deep_link: '/planner',
    date: '2026-08-27',
  },
  {
    spotlight_key: 'chart_display_v1',
    title: 'Arabic Lots & Chart Display',
    subtitle: 'Shape your chart — learn the Lots',
    description:
      "Your chart now includes the Arabic Lots of Spirit, Eros, and Necessity — calculated points of purpose, desire, and duty — alongside the Lunar Nodes, Black Moon Lilith, and Chiron. Choose which points appear on your wheels with the new Chart Display settings, and learn what each one means in six new curriculum modules.",
    unlock: 'Lots & Nodes free · Lilith & asteroids with Premium',
    icon: 'Eye',
    deep_link: '/profile?tab=chart',
    date: '2026-08-21',
  },
  {
    spotlight_key: 'traditions_v1',
    title: 'Three Traditions',
    subtitle: 'Modern, Hellenistic & Vedic',
    description:
      "Astrosetta now reads your chart through three lenses — Modern, Hellenistic, and Vedic. Switch your live chart's zodiac, house system, and rulerships in Profile and every reading recalculates to match. Everyone can explore the free Traditions curriculum; switching your live chart unlocks with Core and above.",
    unlock: 'Free to learn · Core+ to switch your chart',
    icon: 'Scroll',
    deep_link: '/profile',
    date: '2026-08-13',
  },
  {
    spotlight_key: 'transit_movement_v1',
    title: 'Transit Movement Arcs',
    subtitle: "Watch the week's planetary journeys",
    description:
      "The Week & Month planner now draws each transiting planet's path as a colored arc — from its start glyph to where it lands by period's end. Arrows show direction, dashed lines mark retrogrades, and any arc is clickable for a personalized reading.",
    icon: 'Route',
    deep_link: '/planner',
    date: '2026-08-12',
  },
  {
    spotlight_key: 'full_app_tour',
    title: 'Full App Tour',
    subtitle: 'New here? Take the grand tour',
    description:
      'A guided walk through every feature — your chart, planner, learning, and more.',
    icon: 'Compass',
    deep_link: '/home',
    date: '2026-07-11',
    is_tour: true,
  },
  {
    spotlight_key: 'sync_calendar_tip',
    title: 'Sync Your Calendar',
    subtitle: 'See transits alongside your schedule',
    description:
      'Connect Google Calendar to see your astrological insights right alongside your real events.',
    icon: 'CalendarCheck',
    deep_link: '/profile',
    date: '2026-07-10b',
    is_quick_tip: true,
    tip_key: 'sync_calendar',
  },
  {
    spotlight_key: 'homescreen_tip',
    title: 'Save to Home Screen',
    subtitle: 'Install Astrosetta as an app',
    description:
      "Add Astrosetta to your phone's home screen for a native app experience — no app store needed.",
    icon: 'Smartphone',
    deep_link: '/home',
    date: '2026-07-10a',
    is_quick_tip: true,
    tip_key: 'homescreen',
  },
  {
    spotlight_key: 'chart_interactivity_v1',
    title: 'Interactive Chart Wheel',
    subtitle: 'Click aspects & transits for instant meanings',
    description:
      'Tap any planet, aspect line, or transit-to-natal connection in the chart wheel to reveal its interpretation. Selections sync live between the wheel, transit list, and daily reading.',
    icon: 'MousePointer',
    deep_link: '/planner',
    date: '2026-07-17',
  },
  {
    spotlight_key: 'chart_dynamics_v1',
    title: 'Chart Dynamics',
    subtitle: "Discover your chart's hidden architecture",
    description:
      'Stelliums, empty houses, chart ruler, and aspect patterns. When today\'s transits activate your natal concentrations, they\'re called out in your daily reading — and you can learn the fundamentals in the Dynamics curriculum.',
    icon: 'Layers',
    deep_link: '/learn',
    date: '2026-07-10',
  },
  {
    spotlight_key: 'synastry_v1',
    title: 'Synastry Readings',
    subtitle: 'Compare charts with anyone',
    description:
      'Save birth charts for the people in your life — partners, family, friends — and explore cross-chart aspects, house overlays, and relationship dynamics with AI-guided interpretations.',
    icon: 'Users',
    deep_link: '/chart',
    date: '2026-07-22',
  },
  {
    spotlight_key: 'knowledge_density_v1',
    title: 'Knowledge Density',
    subtitle: 'Learn at your own depth — anytime',
    description:
      'A new slider lets you scale interpretation and curriculum depth from plain-language Essential to full Technical. Plus every astrological term is now tappable to learn more. Set in your Profile — it reshapes your readings, curriculum, and daily email instantly.',
    icon: 'Gauge',
    deep_link: '/profile',
    date: '2026-08-07',
  },
];

// ── Highlight selection helpers ─────────────────────────────────────────────
// A feature is an "active highlight" (popup + email digest) for one week after
// its date. The "New in Beta" section always shows the 2 most recent features,
// and the notifications bell keeps the full running list. Only one highlight is
// active at any given time.
export const HIGHLIGHT_WINDOW_DAYS = 7;

function parseDate(d) { return new Date(d.slice(0, 10)); }

export function getRecentFeatures(n = 2) {
  return FEATURE_ANNOUNCEMENTS
    .filter(a => !a.is_tour && !a.is_quick_tip)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

export function getActiveHighlight(now = new Date()) {
  const recent = FEATURE_ANNOUNCEMENTS
    .filter(a => !a.is_tour && !a.is_quick_tip)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!recent.length) return null;
  const top = recent[0];
  const daysSince = (now.getTime() - parseDate(top.date).getTime()) / 86400000;
  return daysSince <= HIGHLIGHT_WINDOW_DAYS ? top : null;
}