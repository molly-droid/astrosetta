import { FEATURE_ANNOUNCEMENTS } from './featureAnnouncements';
import { fetchActiveHighlight } from './featureSchedule';

const FIRST_VISIT_KEY = 'astrosetta_first_visit_done';
const SESSION_KEY = 'astrosetta_active_spotlight';

// Admin-scheduled spotlight (set by prefetchScheduledSpotlight). When set and
// not yet seen, it takes priority over the static newest-feature default so the
// admin controls which feature popup is "live" at any given time.
let scheduledSpotlightKey = null;
let scheduledLoaded = false;

export async function prefetchScheduledSpotlight() {
  if (scheduledLoaded) return scheduledSpotlightKey;
  scheduledLoaded = true;
  try {
    const live = await fetchActiveHighlight('notification');
    scheduledSpotlightKey = live?.spotlight_key || null;
  } catch {
    scheduledSpotlightKey = null;
  }
  return scheduledSpotlightKey;
}

// First-time users see only the app tutorial; feature pop-ups are suppressed
// until the tutorial has been completed (the flag is set on tutorial dismiss).
export function isFirstVisit() {
  try { return !localStorage.getItem(FIRST_VISIT_KEY); } catch { return false; }
}

// Auto-show feature pop-up candidates, newest first.
function buildCandidates() {
  // Feature pop-ups only surface within one week of a feature's date — after
  // that the feature stays in the notifications running list but no longer
  // pops up. This keeps a single active highlight at any given time.
  const now = Date.now();
  const withinWindow = (d) => (now - new Date(d.slice(0, 10)).getTime()) / 86400000 < 7;
  const list = FEATURE_ANNOUNCEMENTS
    .filter(a => !a.is_tour && !a.is_quick_tip && withinWindow(a.date))
    .map(a => ({ key: a.spotlight_key, date: a.date }));
  // Email digest opt-in prompt isn't in the announcements list — lowest priority
  list.push({ key: 'email_digest_opt_in', date: '2026-07-09' });
  list.sort((a, b) => b.date.localeCompare(a.date));
  return list;
}

// Returns the single spotlight_key allowed to show this session, or null.
// Cached in sessionStorage so every spotlight agrees and at most one shows per
// session. If the cached winner has since been marked seen, recompute so the
// next-newest unseen feature can surface.
export function getActiveSpotlight(seenSpotlights = []) {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached !== null) {
      if (cached && !seenSpotlights.includes(cached)) return cached;
      if (cached === '') return null;
    }
  } catch {}
  // Prefer an admin-scheduled spotlight that the user hasn't seen yet
  if (scheduledSpotlightKey && !seenSpotlights.includes(scheduledSpotlightKey)) {
    try { sessionStorage.setItem(SESSION_KEY, scheduledSpotlightKey); } catch {}
    return scheduledSpotlightKey;
  }
  const winner = buildCandidates().find(c => !seenSpotlights.includes(c.key));
  const key = winner ? winner.key : '';
  try { sessionStorage.setItem(SESSION_KEY, key); } catch {}
  return key || null;
}