// Named server-side LLM tasks — replaces the client-composed InvokeLLM
// prompts (scope: tier checks + usage logging server-side). Each call names
// a task from supabase/functions/_shared/llm_tasks/registry.ts and sends
// only the structured astrological facts; the prompt template, tier gate,
// and daily quota live in the llm-task Edge Function.
//
// Returns the model output directly (parsed object when the task declares a
// schema, else the text) — the same shape InvokeLLM returned.
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './shim/supabase.js';

export async function invokeLLMTask(task, params) {
  const { data, error } = await supabase.functions.invoke('llm-task', {
    body: { task, params: params ?? {} },
  });
  if (error) {
    let body = null;
    try {
      body = await error.context?.json();
    } catch { /* non-JSON error body */ }
    const err = new Error(body?.error || error.message || `llm-task ${task} failed`);
    err.status = error.context?.status ?? 500;
    // 'upgrade_required' | 'limit_reached' | 'user_not_registered'
    err.code = body?.code;
    throw err;
  }
  return data;
}

/**
 * Streaming variant (PF-06). Same task, same params, same return value as
 * `invokeLLMTask` — but `onDelta` is called with raw model text as it
 * arrives, so a long reading can render progressively.
 *
 * Generation is not faster: latency is output length (~11ms per output
 * token, and day-synthesis averages 4,779 of them). What changes is that the
 * first words appear in a couple of seconds instead of ~52.
 *
 * The deltas are PARTIAL JSON, for display only. The resolved value comes
 * from the final `done` line, which the server has already parsed and
 * dash-stripped, so it is identical to the non-streaming path.
 *
 * Falls back to the buffered call if streaming is unavailable (no session,
 * no ReadableStream, or a non-stream response), so a caller can always use
 * this and never be worse off.
 */
export async function invokeLLMTaskStreaming(task, params, onDelta) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || typeof ReadableStream === 'undefined') {
    return invokeLLMTask(task, params);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ task, params: params ?? {}, stream: true }),
  });

  if (!res.ok || !res.body) {
    // Quota/tier denials and auth errors still arrive as plain JSON.
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    const err = new Error(body?.error || `llm-task ${task} failed`);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }

  // Version skew: a function deployed before streaming existed ignores the
  // `stream` flag and answers with ordinary JSON. Detect that and return it,
  // rather than waiting for NDJSON lines that will never come.
  if (!/ndjson/i.test(res.headers.get('content-type') || '')) {
    return res.json();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result;
  let streamError;

  // NDJSON: one JSON object per line. A chunk can split a line, so only
  // complete lines are parsed and the remainder is carried over.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.t === 'delta') { try { onDelta?.(msg.v); } catch { /* render error */ } }
      else if (msg.t === 'done') result = msg.v;
      else if (msg.t === 'error') streamError = msg.v;
    }
  }

  if (streamError) throw new Error(streamError);
  if (result === undefined) {
    // Stream ended without a terminator — treat as failure rather than
    // returning undefined, which is what let B-23 hang forever.
    throw new Error(`llm-task ${task} ended without a result`);
  }
  return result;
}
