// Server-side schedule resolver for feature highlights.
// The admin-managed FeatureHighlight entity is the source of truth for which
// feature is currently being featured across surfaces. This helper picks the
// single live highlight for the email digest; if none is scheduled/live it
// falls back to the static catalog (shared/featureHighlights.ts).
//
// A highlight is "live" when:
//   - not archived
//   - show_in_email is not false
//   - go_live_date <= now
//   - end_date is blank OR end_date >= now
// The most recently gone-live live highlight wins (so a newly launched
// feature supersedes an older one even before the older one's end_date).

import { pickFeatureHighlight } from './featureHighlights.ts';

export interface ScheduledHighlight {
  spotlight_key: string;
  title: string;
  subtitle: string;
  description: string;
  deep_link: string;
  date: string;
}

function parseDate(d: string): Date {
  return new Date((d || '').slice(0, 10));
}

export async function getActiveEmailHighlight(base44: any, now: Date = new Date()): Promise<ScheduledHighlight | null> {
  try {
    const recs = await base44.asServiceRole.entities.FeatureHighlight.list('-go_live_date', 100);
    const nowMs = now.getTime();
    const live = (recs || [])
      .filter((r: any) => r && r.spotlight_key && r.title && r.go_live_date && !r.is_archived && r.show_in_email !== false)
      .filter((r: any) => {
        if (parseDate(r.go_live_date).getTime() > nowMs) return false;
        if (r.end_date && parseDate(r.end_date).getTime() < nowMs) return false;
        return true;
      });
    // list() already sorts by go_live_date desc, but re-sort defensively
    live.sort((a: any, b: any) => parseDate(b.go_live_date).getTime() - parseDate(a.go_live_date).getTime());
    const top: any = live[0];
    if (top) {
      return {
        spotlight_key: top.spotlight_key,
        title: top.title || '',
        subtitle: top.subtitle || '',
        description: top.description || '',
        deep_link: top.deep_link || '/home',
        date: top.go_live_date,
      };
    }
  } catch {
    // entity missing or query error — fall back to static
  }
  return pickFeatureHighlight(now);
}