import { base44 } from '@/api/base44Client';

/**
 * Shared DB-backed synthesis cache.
 *
 * All synthesis components (Day, Week, Month, Lunar, Ingress) use this to:
 * 1. Check CalendarSynthesis for a pre-generated record before calling the LLM
 * 2. Persist on-demand generation results for instant future loads
 *
 * Memory cache prevents redundant DB queries within the same session.
 *
 * Relationship-layer (synastry) reads pass `targetChartId` so they cache under
 * their own target dimension and never collide with (or overwrite) the user's
 * personal reads, which have no target_chart_id.
 */

const memCache = {};

function memKey(userId, periodType, periodKey) {
  return `${userId}_${periodType}_${periodKey}`;
}

/**
 * Fetch a cached synthesis from the database.
 * Returns the structured `data` object, or null if not found.
 */
export async function getCachedSynthesis(periodType, periodKey, userId, targetChartId) {
  if (!userId || !periodType || !periodKey) return null;

  const key = memKey(userId, periodType, periodKey);
  if (memCache[key] !== undefined) return memCache[key];

  try {
    const filter = {
      user_id: userId,
      period_type: periodType,
      period_key: periodKey,
    };
    if (targetChartId) filter.target_chart_id = targetChartId;
    const records = await base44.entities.CalendarSynthesis.filter(filter);
    const result = records[0]?.data || null;
    memCache[key] = result;
    return result;
  } catch {
    return null;
  }
}

/**
 * Persist a synthesis result to the database.
 * Called after on-demand LLM generation so future visits are instant.
 */
export async function saveCachedSynthesis(periodType, periodKey, userId, data, extra = {}) {
  if (!userId || !periodType || !periodKey) return;

  const key = memKey(userId, periodType, periodKey);
  memCache[key] = data;

  const dateStr = extra.date_start || new Date().toISOString().split('T')[0];
  try {
    const filter = {
      user_id: userId,
      period_type: periodType,
      period_key: periodKey,
    };
    if (extra.target_chart_id) filter.target_chart_id = extra.target_chart_id;
    // Check if a record already exists (from overnight pre-generation)
    const existing = await base44.entities.CalendarSynthesis.filter(filter);
    const payload = {
      user_id: userId,
      period_type: periodType,
      period_key: periodKey,
      topic_key: extra.topic_key || '',
      date_start: dateStr,
      date_end: extra.date_end || dateStr,
      summary: extra.summary || '',
      description: typeof data === 'string' ? data : JSON.stringify(data),
      data,
      generated_at: new Date().toISOString(),
    };
    if (extra.target_chart_id) payload.target_chart_id = extra.target_chart_id;
    if (existing[0]) {
      await base44.entities.CalendarSynthesis.update(existing[0].id, payload);
    } else {
      await base44.entities.CalendarSynthesis.create(payload);
    }
  } catch {
    // Silent fail — caching is an optimization, not critical
  }
}

/**
 * Clear the memory cache for a specific synthesis (used by "Regenerate").
 */
export function clearMemCache(periodType, periodKey, userId) {
  const key = memKey(userId, periodType, periodKey);
  delete memCache[key];
}