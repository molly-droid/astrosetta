/**
 * XP and tier calculation utilities
 */

export type Tier = 'Apprentice' | 'Adept' | 'Maestro';

export interface TierThresholds {
  Apprentice: number;
  Adept: number;
  Maestro: number;
}

export const TIER_THRESHOLDS: TierThresholds = {
  Apprentice: 0,
  Adept: 2000,
  Maestro: 5000,
};

/**
 * Calculate tier from total XP
 */
export function calculateTier(xp: number): Tier {
  if (xp >= TIER_THRESHOLDS.Maestro) {
    return 'Maestro';
  }
  if (xp >= TIER_THRESHOLDS.Adept) {
    return 'Adept';
  }
  return 'Apprentice';
}

/**
 * Calculate progress to next tier (0-1)
 */
export function calculateTierProgress(xp: number): number {
  const tier = calculateTier(xp);

  if (tier === 'Maestro') {
    return 1; // Max tier
  }

  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextTier = tier === 'Apprentice' ? 'Adept' : 'Maestro';
  const nextThreshold = TIER_THRESHOLDS[nextTier];

  const progress = (xp - currentThreshold) / (nextThreshold - currentThreshold);
  return Math.max(0, Math.min(1, progress));
}

/**
 * Calculate XP needed for next tier
 */
export function xpToNextTier(xp: number): number {
  const tier = calculateTier(xp);

  if (tier === 'Maestro') {
    return 0; // Max tier
  }

  const nextTier = tier === 'Apprentice' ? 'Adept' : 'Maestro';
  const nextThreshold = TIER_THRESHOLDS[nextTier];

  return nextThreshold - xp;
}

/**
 * XP rewards for various actions
 */
export const XP_REWARDS = {
  DAILY_QUIZ: 25,
  MODULE_COMPLETE: 50,
  MODULE_QUIZ_PERFECT: 25, // Bonus for 100% quiz score
  FIRST_CHART: 100,
  FIRST_SYNTHESIS: 50,
  BOOKMARK_SYNTHESIS: 5,
  RATE_SYNTHESIS: 5,
  DAILY_LOGIN: 10,
  WEEK_STREAK: 50,
} as const;

/**
 * Calculate level from XP (linear progression)
 * Level 1 = 0 XP, each level requires 100 XP
 */
export function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/**
 * Calculate XP needed for next level
 */
export function xpToNextLevel(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const nextLevelXP = (currentLevel) * 100;
  return nextLevelXP - xp;
}

/**
 * Calculate level progress (0-1)
 */
export function calculateLevelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelXP = (currentLevel - 1) * 100;
  const nextLevelXP = currentLevel * 100;

  const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
  return Math.max(0, Math.min(1, progress));
}
