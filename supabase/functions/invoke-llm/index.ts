/**
 * invoke-llm — replaces the Base44 InvokeLLM integration with Claude.
 *
 * Base44 contract:
 *   request:  { prompt, response_json_schema? }
 *   response: the parsed object when a schema was given, else the text.
 *
 * SERVICE-ROLE ONLY. The client call sites that used this bridge have all
 * been converted to named server-side tasks (the llm-task function), which
 * own their prompt templates, tier gates, and usage quotas. This endpoint
 * remains for internal function-to-function use; ported backend functions
 * call _shared/llm.ts directly via the compat layer.
 */
import { json, handleOptions, isServiceRole } from '../_shared/edge.ts';
import { invokeLLM } from '../_shared/llm.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, response_json_schema } = await req.json();
    if (!prompt) return json({ error: 'Missing prompt' }, { status: 400 });

    const result = await invokeLLM({ prompt, response_json_schema });
    return json(result);
  } catch (err) {
    console.error('invoke-llm error:', err);
    const status = err?.status && Number.isInteger(err.status) ? 502 : 500;
    return json({ error: err.message }, { status });
  }
});
