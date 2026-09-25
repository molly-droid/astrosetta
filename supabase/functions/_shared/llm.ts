/**
 * invokeLLM — Claude-backed replacement for Base44's InvokeLLM integration,
 * shared by the invoke-llm bridge function and the ported backend functions.
 *
 * Contract (every Base44 call site uses exactly this):
 *   invokeLLM({ prompt, response_json_schema? })
 *   -> parsed object when a schema was given, else the response text.
 *
 * Model per the client scope: Claude Sonnet for synthesis/interpretations,
 * overridable per call (the quiz functions pass Haiku) or globally with the
 * LLM_MODEL secret. Requires secret: ANTHROPIC_API_KEY.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';

const DEFAULT_MODEL = Deno.env.get('LLM_MODEL') || 'claude-sonnet-5';

// Structured outputs requires additionalProperties: false on object schemas;
// Base44 call-site schemas omit it. Normalize recursively.
export function strictify(schema: Record<string, unknown>): Record<string, unknown> {
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

export async function invokeLLM({
  prompt,
  response_json_schema,
  model,
}: {
  prompt: string;
  response_json_schema?: Record<string, unknown>;
  model?: string;
}) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret is not set');
  const client = new Anthropic({ apiKey });

  const request: Record<string, unknown> = {
    model: model || DEFAULT_MODEL,
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

  if (response_json_schema) return JSON.parse(text);
  return text;
}
