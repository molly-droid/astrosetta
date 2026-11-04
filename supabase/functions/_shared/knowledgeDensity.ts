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

/**
 * AI-06: the level rule as an OUTPUT rule. densityInstruction() opens a prompt
 * and reads as tone; long readings follow the concrete rules next to the JSON
 * spec, so this goes in the Rules list. Essential defines every term inline the
 * first time it appears; higher levels drop the definitions, not the warmth.
 */
export function densityRules(depth) {
  const d = resolveDepth(depth);
  if (d === 'essential') {
    return `- KNOWLEDGE LEVEL: ESSENTIAL (beginner). DEFINITIONS ARE REQUIRED. The first time each of these appears in the overview or a personal_reading bullet, define it right beside it in a short plain-words phrase: every PLANET or point (e.g. "Saturn, the planet of structure and responsibility"), every SIGN (e.g. "Leo, the sign of confidence and self-expression"), every ASPECT word — conjunct, opposite, square, trine, sextile (e.g. "a square, a tense 90° angle that pushes for change"; "a trine, an easy 120° angle where energy flows"), and every HOUSE or angle (e.g. "your 8th house, the area of shared resources and intimacy"). Define each term once per reading, then use it freely. Do not skip aspect words — beginners do not know them. Keep sentences short and everyday.`;
  }
  if (d === 'technical') {
    return `- KNOWLEDGE LEVEL: TECHNICAL. Do NOT define planets, signs, aspects, or houses; use precise terminology freely (orbs, dignities, dispositors). Stay warm and personal — drop the definitions, not the warmth.`;
  }
  return `- KNOWLEDGE LEVEL: INSIGHTFUL. Do NOT define planets, signs, houses, or the major aspects; the reader knows them. Briefly gloss only a less common technique if you use one. Stay warm and personal — drop the definitions, not the warmth.`;
}

/**
 * AI-06: Essential-level addendum for the JSON spec of the overview field.
 * The overview's "synthesize the WHOLE day" spec crowds out definitions, so at
 * Essential it covers the three most important configurations and defines
 * every term in them. Empty string at other levels.
 */
export function densityOverviewSpec(depth) {
  return resolveDepth(depth) === 'essential'
    ? ' ESSENTIAL LEVEL: cover only the 3 most important configurations, and define every planet, sign, aspect word (conjunct, opposite, square, trine, sextile), and house the first time it appears, e.g. "Mars, the planet of drive, is square (a tense 90° angle) your Moon".'
    : '';
}
