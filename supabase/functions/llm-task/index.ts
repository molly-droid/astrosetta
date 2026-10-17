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
import { json, handleOptions, getAuthUser, serviceClient, CORS_HEADERS } from '../_shared/edge.ts';
import { invokeLLM } from '../_shared/llm.ts';
import { reserveAiUsage } from '../_shared/aiAccess.ts';
import { TASKS } from '../_shared/llm_tasks/registry.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { task, params } = body;
    const def = TASKS[task];
    if (!def) return json({ error: `Unknown task: ${task}` }, { status: 400 });

    const svc = serviceClient();
    const gate = typeof def.gate === 'function' ? def.gate(params ?? {}) : def.gate;
    const denied = await reserveAiUsage(svc, String(user.id), gate, `llm-task:${task}`);
    if (denied) return denied;

    const prompt = def.build(params ?? {});

    // PF-06: opt-in progressive delivery. Generation latency is output length
    // (~11ms per output token; day-synthesis averages 4,779 tokens, so ~52s),
    // and the whole of that was dead time because the response was buffered
    // until the final token. Streaming does not speed generation up — it puts
    // the first words on screen in a couple of seconds instead of a minute.
    //
    // Protocol is newline-delimited JSON, one object per line:
    //   {"t":"delta","v":"<text fragment>"}   zero or more, in order
    //   {"t":"done","v":<parsed result>}      exactly one, on success
    //   {"t":"error","v":"<message>"}         instead of done, on failure
    //
    // The `done` payload is the SAME value the non-streaming path returns —
    // parsed and dash-stripped (AI-04) server-side — so a client can ignore
    // every delta and still be correct. Deltas are raw model text (partial
    // JSON) and are for display only; never parse them as the result.
    if (body?.stream === true) {
      const encoder = new TextEncoder();
      const ndjson = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) => {
            try { controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n')); }
            catch { /* client disconnected */ }
          };
          try {
            const result = await invokeLLM({
              prompt,
              response_json_schema: def.schema,
              model: def.model,
              telemetry: { userId: user.id, task },
              onDelta: (text) => send({ t: 'delta', v: text }),
            });
            send({ t: 'done', v: result });
          } catch (err) {
            // The stream has already begun, so the status line is long gone:
            // failures have to travel in-band or the client hangs — which is
            // exactly the B-23 failure mode.
            console.error('llm-task stream error:', err);
            send({ t: 'error', v: err instanceof Error ? err.message : 'AI request failed' });
          } finally {
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });
      return new Response(ndjson, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
          // Defeat proxy buffering, which would reinstate the wait we just removed.
          'X-Accel-Buffering': 'no',
        },
      });
    }

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
