import { base44 } from '@/api/base44Client';
import { TONE_DIRECTIVE } from '@/lib/transitUtils';

// "Explain it" dumbs the content down TWO levels below the user's current
// Knowledge Density. With three densities (essential < insightful < technical):
//   technical  -> layperson (essential) — plain language, define jargon with analogies
//   insightful -> 10-year-old — single concrete analogy, no jargon
//   essential  -> absolute beginner — simplest words, very basic analogy
const TONES = {
  technical: 'a layperson with no astrology background — use plain everyday language; if you mention a planet or sign, immediately explain it with a simple real-life analogy',
  insightful: 'a curious 10-year-old — use a single concrete real-life analogy anyone can picture; no astrological jargon at all',
  essential: 'a complete beginner who knows nothing about astrology — use the simplest everyday words and one very basic real-life analogy; avoid all jargon entirely',
};

const cache = new Map();

export function buildExplainPrompt(context, knowledgeDepth) {
  const tone = TONES[knowledgeDepth] || TONES.insightful;
  return `You are a warm, gifted teacher. Rewrite the following astrology reading so it is easy to understand for ${tone}. Keep the meaning intact but strip the jargon. 2-4 short sentences. No headers, no markdown, no greetings.

${TONE_DIRECTIVE}

Astrology reading to simplify:
${context}`;
}

export async function fetchExplanation(context, knowledgeDepth) {
  if (!context) return null;
  const key = `${knowledgeDepth}::${context}`;
  if (cache.has(key)) return cache.get(key);
  const res = await base44.integrations.Core.InvokeLLM({ prompt: buildExplainPrompt(context, knowledgeDepth) });
  cache.set(key, res);
  return res;
}