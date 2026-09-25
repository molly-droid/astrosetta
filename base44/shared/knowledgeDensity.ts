/**
 * Knowledge Density — shared backend helper.
 *
 * Mirrors src/lib/knowledgeDensity.js but for backend (Deno) functions.
 * Fetches a user's stored knowledge_depth from UserProgress and returns a
 * prompt-instruction string that can be appended to any LLM synthesis prompt
 * so generated content matches the user's chosen depth.
 */

const DEFAULT_DEPTH = 'insightful';
const VALID_LEVELS = ['essential', 'insightful', 'technical'];

export function resolveDepth(raw) {
  if (raw && VALID_LEVELS.includes(raw)) return raw;
  return DEFAULT_DEPTH;
}

/**
 * Fetch the user's knowledge_depth from UserProgress.
 * Returns 'insightful' as a safe default if no record or error.
 */
export async function fetchKnowledgeDepth(base44, userId) {
  if (!userId) return DEFAULT_DEPTH;
  try {
    const records = await base44.asServiceRole.entities.UserProgress.filter({ user_id: userId });
    return resolveDepth(records[0]?.knowledge_depth);
  } catch {
    return DEFAULT_DEPTH;
  }
}

/**
 * Build a density-aware instruction string for LLM prompts.
 * Append the returned string to your system/user prompt.
 */
export function densityInstruction(depth) {
  const d = resolveDepth(depth);
  switch (d) {
    case 'essential':
      return `KNOWLEDGE DENSITY: Essential. Write for someone brand new to astrology — warm, plain, everyday language only. Assume NO prior astrology vocabulary: explain every term the first time it appears, including basics like "natal" (the chart of the sky at the moment you were born), "transit" (where a planet is today), and "aspect" (two planets linked by angle). Prefer short concrete sentences about what the reader may actually notice or feel in daily life. Never mention orbs, dignities, dispositors, applying/separating, or house systems unless explicitly asked.`;
    case 'technical':
      return `KNOWLEDGE DENSITY: Technical. Use precise astrological terminology freely — orbs, essential dignities, dispositors, house systems, applying/separating. Assume the reader understands the mechanics. Reference traditional and classical technique without explanation.`;
    case 'insightful':
    default:
      return `KNOWLEDGE DENSITY: Insightful. Use astrological terminology but briefly contextualize each term the first time it appears. Balance depth with approachability — name the mechanic, then explain it in one clause.`;
  }
}