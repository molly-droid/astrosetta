// Client-side schedule resolver for feature highlights.
// Mirrors base44/shared/featureSchedule.ts for the homepage + spotlight.
// The admin-managed FeatureHighlight entity is the source of truth; the static
// catalog (featureAnnouncements.js) is the fallback.

import { base44 } from '@/api/base44Client';

function parseDate(d) { return new Date((d || '').slice(0, 10)); }

function isLive(r, channel, nowMs) {
  if (!r || r.is_archived) return false;
  if (!r.go_live_date) return false;
  if (r[`show_on_${channel}`] === false) return false;
  if (parseDate(r.go_live_date).getTime() > nowMs) return false;
  if (r.end_date && parseDate(r.end_date).getTime() < nowMs) return false;
  return true;
}

// Returns the single live scheduled highlight for a channel ('homepage' | 'email' | 'notification'),
// or null if none is currently live.
export async function fetchActiveHighlight(channel = 'homepage') {
  try {
    const recs = await base44.entities.FeatureHighlight.list('-go_live_date', 100);
    const nowMs = Date.now();
    const live = (recs || [])
      .filter(r => isLive(r, channel, nowMs))
      .sort((a, b) => parseDate(b.go_live_date).getTime() - parseDate(a.go_live_date).getTime());
    return live[0] || null;
  } catch {
    return null;
  }
}

// Returns all scheduled highlights (admin view), newest go_live first.
export async function fetchAllScheduledHighlights() {
  try {
    return await base44.entities.FeatureHighlight.list('-go_live_date', 100);
  } catch {
    return [];
  }
}