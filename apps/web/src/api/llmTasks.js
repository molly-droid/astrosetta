// Named server-side LLM tasks — replaces the client-composed InvokeLLM
// prompts (scope: tier checks + usage logging server-side). Each call names
// a task from supabase/functions/_shared/llm_tasks/registry.ts and sends
// only the structured astrological facts; the prompt template, tier gate,
// and daily quota live in the llm-task Edge Function.
//
// Returns the model output directly (parsed object when the task declares a
// schema, else the text) — the same shape InvokeLLM returned.
import { supabase } from './shim/supabase.js';

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
