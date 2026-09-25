/**
 * Shared voice, tier, and quota primitives for the named LLM tasks
 * (llm-task Edge Function). Per the migration scope, every client-side
 * InvokeLLM call site becomes a named task here: the client sends only
 * structured astrological facts; the instruction/template text lives
 * server-side, and each task declares its tier gate.
 *
 * PERSONA / TONE_DIRECTIVE / HOUSE_THEMES / densityPromptSuffix are
 * verbatim ports of apps/web/src/lib/transitUtils.jsx and
 * apps/web/src/lib/knowledgeDensity.js — the app's voice. If the client
 * copies change, change these to match.
 */

export const TONE_DIRECTIVE = `TONE — INVITATIONAL, NOT DIAGNOSTIC:
- You are a guide and teacher, not an astrologer pronouncing truths about the user. Never speak as if you know what the user is experiencing.
- Frame every insight as an invitation to notice, reflect, or consider. Prefer language like "you may notice," "this can surface," "notice if," "you might find," "some people experience," "this may echo," rather than diagnostic declarations like "you are," "you feel," "this means," "you will," or "you struggle with."
- Never prescribe behavior or outcomes. Offer possibilities and gentle prompts for self-reflection, never commands or certainties.
- Keep the user positioned as their own astrologer: name the astrological mechanic, then invite them to find where it lands in their lived experience. Trust them to do the noticing.
- Do NOT hedge every sentence into vagueness — be specific about the astrology. The invitation is about how it lands in their life, not about the symbols themselves.`;

export const PERSONA = `You are a psychologically astute astrologer and educator — specific, warm, and grounded. You never use generic affirmations or vague spiritual language. You always show your work: you name the specific planetary configurations (planet, sign, aspect, natal planet, house) creating each interpretation and explain the astrological mechanic of how those elements interact to produce the effect. Your goal is to teach the reader how astrology works, not just deliver a horoscope. The Part of Fortune (⊕, Pars Fortunae) is a calculated lot marking where ease, luck, and material opportunity naturally express; Tyche (asteroid 258) is the lot of fortunate coincidence and providence. Juno (asteroid 3) governs committed partnership, marriage, and soul-contracts; Pallas (asteroid 2) is the strategist — creative intelligence, pattern-vision, and skilled craft; Vesta (asteroid 4) is the keeper of the sacred flame — devotion, focused service, and the inner hearth. Treat transits to these points as activations of those life areas, weaving them in where relevant.

${TONE_DIRECTIVE}`;

export const HOUSE_THEMES: Record<number, string> = {
  1: 'identity, appearance',
  2: 'money, values',
  3: 'communication, siblings',
  4: 'home, family',
  5: 'creativity, romance',
  6: 'health, daily work',
  7: 'partnerships, marriage',
  8: 'transformation, shared resources',
  9: 'travel, beliefs, higher learning',
  10: 'career, public reputation',
  11: 'community, friendships, goals',
  12: 'solitude, hidden matters, spirituality',
};

export function ordinal(n: number | null | undefined): string {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Knowledge Density suffix — port of knowledgeDensity.js densityPromptSuffix. */
export function densityPromptSuffix(depth: unknown): string {
  const d = depth === 'essential' || depth === 'technical' ? depth : 'insightful';
  switch (d) {
    case 'essential':
      return `KNOWLEDGE DENSITY: Essential. Write for someone brand new to astrology — warm, plain, everyday language only. Assume NO prior astrology vocabulary: explain every term the first time it appears, including basics like "natal" (the chart of the sky at the moment you were born), "transit" (where a planet is today), and "aspect" (two planets linked by angle). Prefer short concrete sentences about what the reader may actually notice or feel in daily life. Never mention orbs, dignities, dispositors, applying/separating, or house systems unless the user's question explicitly asks.`;
    case 'technical':
      return `KNOWLEDGE DENSITY: Technical. Use precise astrological terminology freely — orbs, essential dignities, dispositors, house systems, applying/separating. Assume the reader understands the mechanics. You may reference traditional and classical technique without explanation.`;
    default:
      return `KNOWLEDGE DENSITY: Insightful. Use astrological terminology but briefly contextualize each term the first time it appears in a reading. Balance depth with approachability — name the mechanic, then explain it in one clause.`;
  }
}

// ── Param sanitizers ────────────────────────────────────────────────────────
// Task params arrive from the client; they are astrological FACTS (labels,
// placement lines, formatted transit lists), never instructions. Coerce and
// bound them so a malformed payload can't blow up a template or the model.

/** Bounded string param. */
export function s(v: unknown, max = 2000): string {
  if (v == null) return '';
  return String(v).slice(0, max);
}

/** Large fact block (formatted transit lists, synthesis sections). */
export function block(v: unknown, max = 20000): string {
  return s(v, max);
}

/** Finite number or null. */
export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Boolean coercion. */
export function bool(v: unknown): boolean {
  return v === true || v === 'true';
}

// ── Tiers, gates, quotas ────────────────────────────────────────────────────

export type Tier = 'free' | 'interpret' | 'calendar';
export type Gate = 'free' | 'core' | 'premium';

interface UserRow {
  role?: string | null;
  subscription_tier?: string | null;
  subscription_expires?: string | null;
}

/**
 * Mirror of apps/web/src/lib/permissions.js getEffectiveTier — the
 * server-side authority. KEEP THE TWO IN SYNC, including the launch flags:
 * GATING_ADMIN_ONLY grants full access to non-admins during the soft-launch
 * preview; flip it to false here AND in permissions.js at the real launch.
 */
export function effectiveTier(user: UserRow | null): Tier {
  if (!user) return 'free';
  const BETA_ALL_PAID = false;
  if (BETA_ALL_PAID) return 'calendar';
  const GATING_ADMIN_ONLY = true;
  if (GATING_ADMIN_ONLY && user.role !== 'admin') return 'calendar';
  const tier = user.subscription_tier;
  if (!tier || tier === 'free') return 'free';
  if (user.subscription_expires && new Date(user.subscription_expires) < new Date()) return 'free';
  return tier as Tier;
}

export function meetsGate(tier: Tier, gate: Gate): boolean {
  if (gate === 'free') return true;
  if (gate === 'core') return tier === 'interpret' || tier === 'calendar';
  return tier === 'calendar';
}

/**
 * Proposed per-tier daily LLM-call limits (admins unlimited). The planner and
 * chart views fan out one call per transit/aspect row, so a normal active
 * session is dozens of calls — limits are cost circuit-breakers, not feature
 * meters. PENDING CLIENT CONFIRMATION (scope: client supplies desired limits
 * or approves proposed ones).
 */
export const DAILY_LIMITS: Record<Tier, number> = {
  free: 50,
  interpret: 300,
  calendar: 600,
};

// ── Task definition ─────────────────────────────────────────────────────────

export interface LLMTaskDef {
  /** Tier gate — mirrors the permission that shows the feature in the UI. */
  gate: Gate | ((params: Record<string, unknown>) => Gate);
  /** Structured-output schema (Base44 response_json_schema shape). */
  schema?: Record<string, unknown>;
  /** Model override (defaults to LLM_MODEL / claude-sonnet-5 in llm.ts). */
  model?: string;
  /** Compose the full prompt from client-supplied facts. */
  build: (params: Record<string, unknown>) => string;
}
