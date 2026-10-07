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
    // Thinking disabled: Base44's InvokeLLM was a non-thinking fast path, and
    // sonnet-5's adaptive thinking burned ~10k tokens/140s per day-synthesis,
    // truncating the JSON answer under a tight budget (measured 2026-10-07:
    // disabled = same output contract at 2.7x speed, ~70% fewer output tokens).
    max_tokens: 32000,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: prompt }],
  };
  if (response_json_schema) {
    request.output_config = {
      format: { type: 'json_schema', schema: strictify(response_json_schema) },
    };
  }

  // Stream and accumulate rather than one long non-streaming read: generation
  // can run 60s+ (day synthesis), and the Edge runtime cuts idle response
  // bodies — which surfaced as truncated JSON ("Unterminated string").
  const stream = client.messages.stream(request);
  const response = await stream.finalMessage();
  const text = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');

  if (response.stop_reason === 'max_tokens') {
    console.warn(`invokeLLM: output truncated at max_tokens (${text.length} chars)`);
  }
  if (response_json_schema) return JSON.parse(text);
  return text;
}
