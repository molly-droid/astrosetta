import { invokeLLMTask } from '@/api/llmTasks';

// "Explain it" dumbs the content down TWO levels below the user's current
// Knowledge Density. The tone mapping and prompt template live server-side
// in the 'explain-simply' task (supabase/functions/_shared/llm_tasks) —
// this module just sends the reading text and the user's depth setting.

const cache = new Map();

export async function fetchExplanation(context, knowledgeDepth) {
  if (!context) return null;
  const key = `${knowledgeDepth}::${context}`;
  if (cache.has(key)) return cache.get(key);
  const res = await invokeLLMTask('explain-simply', { context, knowledgeDepth });
  cache.set(key, res);
  return res;
}
