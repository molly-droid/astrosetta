/**
 * invoke-llm — replaces the Base44 InvokeLLM integration with Claude.
 *
 * Base44 contract (every call site uses exactly this):
 *   request:  { prompt, response_json_schema? }
 *   response: the parsed object when a schema was given, else the text.
 *
 * TRANSITIONAL BRIDGE: this preserves the app's current client-composed
 * prompts so the migrated app works at parity. Per the migration scope,
 * the 31 client call sites are to be converted to named server-side tasks
 * (own prompt templates, tier checks, usage limits); this endpoint then
 * remains for internal use only. Model selection lives in _shared/llm.ts.
 */
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';
import { invokeLLM } from '../_shared/llm.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user && !isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });

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
