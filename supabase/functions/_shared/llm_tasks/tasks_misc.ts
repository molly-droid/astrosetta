/**
 * Misc LLM tasks — the "Explain it" simplifier (lib/explainIt.js) and the
 * Navigator follow-up suggestion chips (components/navigator/*).
 */
import { TONE_DIRECTIVE, s, block, LLMTaskDef } from './core.ts';

// "Explain it" dumbs the content down TWO levels below the user's current
// Knowledge Density — see apps/web/src/lib/explainIt.js for the mapping.
const EXPLAIN_TONES: Record<string, string> = {
  technical: 'a layperson with no astrology background — use plain everyday language; if you mention a planet or sign, immediately explain it with a simple real-life analogy',
  insightful: 'a curious 10-year-old — use a single concrete real-life analogy anyone can picture; no astrological jargon at all',
  essential: 'a complete beginner who knows nothing about astrology — use the simplest everyday words and one very basic real-life analogy; avoid all jargon entirely',
};

// Free-gated: it only re-explains a reading the user could already see.
const explainSimply: LLMTaskDef = {
  gate: 'free',
  build: (p) => {
    const tone = EXPLAIN_TONES[s(p.knowledgeDepth, 20)] || EXPLAIN_TONES.insightful;
    return `You are a warm, gifted teacher. Rewrite the following astrology reading so it is easy to understand for ${tone}. Keep the meaning intact but strip the jargon. 2-4 short sentences. No headers, no markdown, no greetings.

${TONE_DIRECTIVE}

Astrology reading to simplify:
${block(p.context, 6000)}`;
  },
};

// ContextualSuggestions.jsx — follow-up question chips under Navigator
// replies. Navigator is Core (permissions.js canUseNavigator).
const navigatorSuggestions: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['questions'],
  },
  build: (p) =>
    `You are an astrology chat assistant. Based on this conversation, suggest 2 short follow-up questions the user might want to ask next. Make them specific to their chart details or the topics discussed. Each question should be 12 words or fewer, genuinely curious, and written in the user's voice.\n\nConversation:\n${block(p.conversation, 6000)}\n\nReturn only the questions as a JSON array of strings.`,
};

// FloatingNavigator.jsx — parse a date reference out of a planner question so
// the Navigator can fetch that date's transits. Navigator is Core.
const extractDate: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: { date: { type: 'string' } },
    required: ['date'],
  },
  build: (p) =>
    `Extract the specific date the user is referring to from their message. Today is ${s(p.todayStr, 60)}.\n\nUser message: "${block(p.message, 2000)}"\n\nIf the user is referring to a specific date or a range, respond with the START date in YYYY-MM-DD format. If they say "this week" or "next week", give the Monday of that week. If no specific date is found, respond with "NONE".`,
};

export const miscTasks: Record<string, LLMTaskDef> = {
  'explain-simply': explainSimply,
  'navigator-suggestions': navigatorSuggestions,
  'extract-date': extractDate,
};
