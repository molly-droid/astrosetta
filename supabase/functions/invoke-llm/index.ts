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
 * remains for the ported backend functions only.
 *
 * Model per the client scope: Claude Sonnet for synthesis/interpretations
 * (what the client-side calls are); override with the LLM_MODEL secret.
 * Requires secret: ANTHROPIC_API_KEY.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { json, handleOptions, getAuthUser, isServiceRole } from '../_shared/edge.ts';

const MODEL = Deno.env.get('LLM_MODEL') || 'claude-sonnet-5';

// Structured outputs requires additionalProperties: false on object schemas;
// Base44 call-site schemas omit it. Normalize recursively.
function strictify(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = { ...schema };
  if (out.type === 'object') {
    if (out.additionalProperties === undefined) out.additionalProperties = false;
    if (out.properties) {
      out.properties = Object.fromEntries(
        Object.entries(out.properties as Record<string, Record<string, unknown>>)
          .map(([k, v]) => [k, strictify(v)])
      );
    }
  }
  if (out.type === 'array' && out.items) {
    out.items = strictify(out.items as Record<string, unknown>);
  }
  return out;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user && !isServiceRole(req)) return json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, response_json_schema } = await req.json();
    if (!prompt) return json({ error: 'Missing prompt' }, { status: 400 });

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY secret is not set' }, { status: 500 });
    const client = new Anthropic({ apiKey });

    const request: Record<string, unknown> = {
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    };
    if (response_json_schema) {
      request.output_config = {
        format: { type: 'json_schema', schema: strictify(response_json_schema) },
      };
    }

    const response = await client.messages.create(request);

    const text = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    if (response_json_schema) return json(JSON.parse(text));
    return json(text);
  } catch (err) {
    console.error('invoke-llm error:', err);
    const status = err?.status && Number.isInteger(err.status) ? 502 : 500;
    return json({ error: err.message }, { status });
  }
});
