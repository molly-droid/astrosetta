// When a user has more than one UserProgress record (a known edge case from a
// legacy duplicate-creation path), pick the highest-tier one so progress is
// never visually "pushed back." Ties break on most modules completed, then the
// most recently updated record.

const TIER_RANK: Record<string, number> = { maestro: 3, adept: 2, apprentice: 1 };

export function pickBestProgress<T extends { current_tier?: string; modules_completed?: number; updated_date?: string; created_date?: string }>(
  records: T[] | null | undefined
): T | null {
  if (!records || records.length === 0) return null;
  return records.reduce((best, r) => {
    if (!best) return r;
    const rRank = TIER_RANK[r.current_tier ?? ''] || 0;
    const bRank = TIER_RANK[best.current_tier ?? ''] || 0;
    if (rRank !== bRank) return rRank > bRank ? r : best;
    const rMod = r.modules_completed || 0;
    const bMod = best.modules_completed || 0;
    if (rMod !== bMod) return rMod > bMod ? r : best;
    const rDate = new Date(r.updated_date || r.created_date || 0).getTime();
    const bDate = new Date(best.updated_date || best.created_date || 0).getTime();
    return rDate >= bDate ? r : best;
  }, null as T | null);
}