import { supabase } from '@/api/shim/supabase.js';
import { getCachedSynthesis, saveCachedSynthesis } from './synthesisCache';

/**
 * Per-account persistence for generated chart interpretations (PF-03).
 *
 * Rows live in CalendarSynthesis with period_type "interpretation" — the same
 * store the planner syntheses and chart dynamics use. The period_key is a
 * stable hash of the task's fact params, so the text a reading depends on
 * (sign, house, retrograde, chart context) IS the cache key: editing birth
 * data changes the params, the hash stops matching, and a fresh reading
 * generates — no explicit invalidation needed.
 *
 * KEEP IN SYNC: the hash and key format are mirrored server-side in
 * supabase/functions/_shared/interpretationPregen.ts so overnight
 * pre-generation writes keys this store finds. Drift is safe (cache miss →
 * on-demand generation) but wastes the pre-generated rows.
 */
export function interpretationKey(task, params) {
  const sorted = {};
  for (const k of Object.keys(params || {}).sort()) sorted[k] = params[k];
  const str = `${task}|${JSON.stringify(sorted)}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return `interp-v1-${h.toString(36)}`;
}

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Saved interpretation text for this task+params, or null. */
export async function loadInterpretation(task, params) {
  const userId = await currentUserId();
  if (!userId) return null;
  return getCachedSynthesis('interpretation', interpretationKey(task, params), userId);
}

/** Persist a generated interpretation (fire-and-forget safe). */
export async function saveInterpretation(task, params, text, summary) {
  const userId = await currentUserId();
  if (!userId) return;
  await saveCachedSynthesis('interpretation', interpretationKey(task, params), userId, text, {
    summary: summary || '',
    topic_key: task,
  });
}
