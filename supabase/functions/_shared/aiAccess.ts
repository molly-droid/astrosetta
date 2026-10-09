import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { effectiveTier, meetsGate, DAILY_LIMITS, type Gate } from './llm_tasks/core.ts';
import { json } from './edge.ts';

/** Same server-side entitlement and atomic daily reservation for all user AI. */
export async function reserveAiUsage(
  db: SupabaseClient, userId: string, gate: Gate, description: string,
): Promise<Response | null> {
  const { error: refreshError } = await db.rpc('refresh_billing_access', { p_user_id: userId });
  if (refreshError) throw new Error(`billing refresh failed: ${refreshError.message}`);
  const { data: user, error } = await db.from('users')
    .select('role, subscription_tier, subscription_expires').eq('id', userId).maybeSingle();
  if (error) throw new Error(`user lookup failed: ${error.message}`);
  if (!user) return json({ error: 'user_not_registered', code: 'user_not_registered' }, { status: 403 });
  const tier = effectiveTier(user);
  if (!meetsGate(tier, gate)) {
    return json({ error: 'This feature requires an upgraded plan', code: 'upgrade_required' }, { status: 403 });
  }
  const { data: usage, error: usageError } = await db.rpc('increment_llm_usage', {
    p_user_id: userId, p_date_key: new Date().toISOString().slice(0, 10),
    p_limit: user.role === 'admin' ? -1 : DAILY_LIMITS[tier], p_description: description,
  });
  if (usageError) throw new Error(`usage log failed: ${usageError.message}`);
  if (!usage?.allowed) {
    return json({ error: 'Daily AI usage limit reached', code: 'limit_reached' }, { status: 429 });
  }
  return null;
}
