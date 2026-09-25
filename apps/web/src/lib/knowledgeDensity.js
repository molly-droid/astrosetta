/**
 * Knowledge Density — global accessibility layer for Astrosetta.
 *
 * Three levels scale the depth of interpretations, curriculum content blocks,
 * and email synthesis across the entire app:
 *   - 'essential'  : Plain language, minimal jargon, brief explanations
 *   - 'insightful' : Balanced — some astrological terminology with context (DEFAULT)
 *   - 'technical'  : Full mechanical/traditional depth, no hand-holding
 *
 * This is distinct from the gamification "learning tiers" (apprentice/adept/maestro),
 * which track progression. Knowledge Density is a real-time user preference that
 * controls how content is *delivered*, not how far they've progressed.
 */

export const KNOWLEDGE_LEVELS = ['essential', 'insightful', 'technical'];

export const KNOWLEDGE_LABELS = {
  essential: 'Essential',
  insightful: 'Insightful',
  technical: 'Technical',
};

export const KNOWLEDGE_DESCRIPTIONS = {
  essential: 'Beginner-friendly plain language — every term explained, even the basics.',
  insightful: 'Balanced depth with astrological terms explained in context.',
  technical: 'Full mechanical & traditional depth. No hand-holding.',
};

/** Default depth for users with no preference set (null/undefined) */
export const DEFAULT_KNOWLEDGE_DEPTH = 'insightful';

/**
 * Map onboarding astro-level to an initial knowledge_depth.
 * New users get a sensible default based on their self-reported familiarity,
 * which they can change at any time via the Profile slider.
 */
export function depthFromOnboardingLevel(levelKey) {
  switch (levelKey) {
    case 'new':
    case 'some':
      return 'essential';
    case 'familiar':
      return 'insightful';
    case 'advanced':
      return 'technical';
    default:
      return DEFAULT_KNOWLEDGE_DEPTH;
  }
}

/**
 * Resolve a raw stored depth value into a valid level.
 * Handles null/undefined (existing users without the field yet) by
 * falling back to the DEFAULT.
 */
export function resolveDepth(raw) {
  if (raw && KNOWLEDGE_LEVELS.includes(raw)) return raw;
  return DEFAULT_KNOWLEDGE_DEPTH;
}

/**
 * Numeric rank for comparison: essential=0, insightful=1, technical=2.
 * Used to decide whether a curriculum block should be shown.
 */
export function depthRank(depth) {
  return KNOWLEDGE_LEVELS.indexOf(resolveDepth(depth));
}

/**
 * Should a curriculum content block be shown at the current depth?
 * Blocks may optionally carry a `required_depth` tag:
 *   - 'technical'  → only shown when user is at technical depth
 *   - 'insightful' → shown at insightful or technical
 *   - omitted/other → always shown
 */
export function shouldShowBlock(block, currentDepth) {
  if (!block || !block.required_depth) return true;
  return depthRank(block.required_depth) <= depthRank(currentDepth);
}

/**
 * Compose a density-aware system-prompt suffix for LLM interpretation calls.
 * Inject this into synthesis/interpretation prompts so the generated text
 * matches the user's chosen depth.
 */
export function densityPromptSuffix(depth) {
  const d = resolveDepth(depth);
  switch (d) {
    case 'essential':
      return `KNOWLEDGE DENSITY: Essential. Write for someone brand new to astrology — warm, plain, everyday language only. Assume NO prior astrology vocabulary: explain every term the first time it appears, including basics like "natal" (the chart of the sky at the moment you were born), "transit" (where a planet is today), and "aspect" (two planets linked by angle). Prefer short concrete sentences about what the reader may actually notice or feel in daily life. Never mention orbs, dignities, dispositors, applying/separating, or house systems unless the user's question explicitly asks.`;
    case 'technical':
      return `KNOWLEDGE DENSITY: Technical. Use precise astrological terminology freely — orbs, essential dignities, dispositors, house systems, applying/separating. Assume the reader understands the mechanics. You may reference traditional and classical technique without explanation.`;
    case 'insightful':
    default:
      return `KNOWLEDGE DENSITY: Insightful. Use astrological terminology but briefly contextualize each term the first time it appears in a reading. Balance depth with approachability — name the mechanic, then explain it in one clause.`;
  }
}