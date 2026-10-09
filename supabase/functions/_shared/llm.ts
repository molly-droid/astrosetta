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
import Anthropic from "npm:@anthropic-ai/sdk";
import { withAiTelemetry } from "./aiTelemetry.ts";

const DEFAULT_MODEL = Deno.env.get("LLM_MODEL") || "claude-sonnet-5";

// Structured outputs requires additionalProperties: false on object schemas;
// Base44 call-site schemas omit it. Normalize recursively.
export function strictify(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = { ...schema };
  if (out.type === "object") {
    if (out.additionalProperties === undefined) {
      out.additionalProperties = false;
    }
    if (out.properties) {
      out.properties = Object.fromEntries(
        Object.entries(
          out.properties as Record<string, Record<string, unknown>>,
        )
          .map(([k, v]) => [k, strictify(v)]),
      );
    }
  }
  if (out.type === "array" && out.items) {
    out.items = strictify(out.items as Record<string, unknown>);
  }
  return out;
}

export async function invokeLLM({
  prompt,
  response_json_schema,
  model,
  telemetry,
}: {
  prompt: string;
  response_json_schema?: Record<string, unknown>;
  model?: string;
  telemetry?: { userId?: string; task: string };
}) {
  return withAiTelemetry({
    userId: telemetry?.userId,
    task: telemetry?.task || "scheduled-or-legacy",
    provider: "anthropic",
    model: model || DEFAULT_MODEL,
  }, async (record) => {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY secret is not set");
    const client = new Anthropic({ apiKey });

    const request: Parameters<typeof client.messages.stream>[0] = {
      model: model || DEFAULT_MODEL,
      // Thinking off by default: Base44's InvokeLLM was a non-thinking fast
      // path, and sonnet-5's adaptive thinking burned ~10k tokens/140s per
      // day-synthesis, truncating the JSON answer under a tight budget
      // (measured 2026-10-07: disabled = same output contract at 2.7x speed,
      // ~70% fewer output tokens). Set the LLM_THINKING=enabled secret to turn
      // it back on — note the latency: generations run ~3x longer, which the
      // send-daily-email on-the-spot fallback cannot absorb (150s idle limit).
      max_tokens: 32000,
      ...(Deno.env.get("LLM_THINKING") === "enabled"
        ? {}
        : { thinking: { type: "disabled" } }),
      messages: [{ role: "user", content: prompt }],
    };
    if (response_json_schema) {
      request.output_config = {
        format: {
          type: "json_schema",
          schema: strictify(response_json_schema),
        },
      };
    }

    // Stream and accumulate rather than one long non-streaming read: generation
    // can run 60s+ (day synthesis), and the Edge runtime cuts idle response
    // bodies — which surfaced as truncated JSON ("Unterminated string").
    const stream = client.messages.stream(request);
    const response = await stream.finalMessage();
    record({
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens || 0,
      cache_write_tokens: response.usage.cache_creation_input_tokens || 0,
    });
    const text = response.content
      .flatMap((b) => b.type === "text" ? [b.text] : [])
      .join("");

    if (response.stop_reason === "max_tokens") {
      console.warn(
        `invokeLLM: output truncated at max_tokens (${text.length} chars)`,
      );
    }
    if (response_json_schema) return JSON.parse(text);
    return text;
  });
}
