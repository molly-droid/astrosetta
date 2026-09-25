/**
 * llm-task — the named server-side LLM task runner (scope requirement:
 * "Claude calls run only through authenticated server-side tasks with usage
 * logging and tier enforcement").
 *
 * request:  { task: string, params?: object }
 * response: the task's model output (parsed object when the task declares a
 *           schema, else the text) — same shape the old invoke-llm bridge
 *           returned, so call sites keep their response handling.
 *
 * errors:   400 unknown task / bad request
 *           401 no session          403 { code: 'upgrade_required' }
 *           403 { code: 'user_not_registered' }
 *           429 { code: 'limit_reached' }
 *
 * Tier gates and prompt templates live in _shared/llm_tasks/; usage is one
 * llm_usage_log row per user per UTC day via the increment_llm_usage RPC.
 */
import { json, handleOptions, getAuthUser, serviceClient } from '../_shared/edge.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { effectiveTier, meetsGate, DAILY_LIMITS } from '../_shared/llm_tasks/core.ts';
import { TASKS } from '../_shared/llm_tasks/registry.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { task, params } = await req.json();
    const def = TASKS[task];
    if (!def) return json({ error: `Unknown task: ${task}` }, { status: 400 });

    const svc = serviceClient();
    const { data: userRow } = await svc
      .from('users')
      .select('role, subscription_tier, subscription_expires')
      .eq('id', user.id)
      .maybeSingle();
    if (!userRow) {
      return json({ error: 'user_not_registered', code: 'user_not_registered' }, { status: 403 });
    }

    const tier = effectiveTier(userRow);
    const gate = typeof def.gate === 'function' ? def.gate(params ?? {}) : def.gate;
    if (!meetsGate(tier, gate)) {
      return json({ error: 'This feature requires an upgraded plan', code: 'upgrade_required' }, { status: 403 });
    }

    // Daily quota — the RPC both checks and logs. Admins pass -1 (no limit)
    // so their calls are still logged but never refused.
    const dateKey = new Date().toISOString().slice(0, 10);
    const limit = userRow.role === 'admin' ? -1 : DAILY_LIMITS[tier];
    const { data: usage, error: usageError } = await svc.rpc('increment_llm_usage', {
      p_user_id: String(user.id),
      p_date_key: dateKey,
      p_limit: limit,
      p_description: `llm-task:${task}`,
    });
    if (usageError) throw new Error(`usage log failed: ${usageError.message}`);
    if (!usage?.allowed) {
      return json({ error: 'Daily AI usage limit reached', code: 'limit_reached' }, { status: 429 });
    }

    const prompt = def.build(params ?? {});
    const result = await invokeLLM({
      prompt,
      response_json_schema: def.schema,
      model: def.model,
    });
    return json(result);
  } catch (err) {
    console.error('llm-task error:', err);
    return json({ error: err.message }, { status: 500 });
  }
});
