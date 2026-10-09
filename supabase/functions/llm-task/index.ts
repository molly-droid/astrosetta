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
import { reserveAiUsage } from '../_shared/aiAccess.ts';
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
    const gate = typeof def.gate === 'function' ? def.gate(params ?? {}) : def.gate;
    const denied = await reserveAiUsage(svc, String(user.id), gate, `llm-task:${task}`);
    if (denied) return denied;

    const prompt = def.build(params ?? {});
    const result = await invokeLLM({
      prompt,
      response_json_schema: def.schema,
      model: def.model,
      telemetry: { userId: user.id, task },
    });
    return json(result);
  } catch (err) {
    console.error('llm-task error:', err);
    return json({ error: err instanceof Error ? err.message : 'AI request failed' }, { status: 500 });
  }
});
