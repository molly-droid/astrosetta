/**
 * Centralized tier permission logic.
 * Import `usePermissions` in any component to gate features.
 */

/**
 * Derives effective tier from user data.
 * If a paid subscription has expired, falls back to "free".
 */
export function getEffectiveTier(user) {
  if (!user) return 'free';
  // BETA: all users treated as paid. Set to false once payments launch.
  const BETA_ALL_PAID = false;
  if (BETA_ALL_PAID) return 'calendar';
  // Soft-launch preview: only admins see the paywalls/gating when published.
  // Non-admins get full access until we flip this to false for the real launch.
  const GATING_ADMIN_ONLY = true;
  if (GATING_ADMIN_ONLY && user.role !== 'admin') return 'calendar';
  const tier = user.subscription_tier;
  if (!tier || tier === 'free') return 'free';
  // Check expiry
  if (user.subscription_expires) {
    const expires = new Date(user.subscription_expires);
    if (expires < new Date()) return 'free';
  }
  return tier; // 'interpret' or 'calendar'
}

/**
 * Returns a permissions object for a given user.
 */
export function getPermissions(user) {
  const tier = getEffectiveTier(user);
  const isCore = tier === 'interpret' || tier === 'calendar';
  const isPremium = tier === 'calendar';
  return {
    tier,
    isExpired: (user?.subscription_tier !== 'free') && getEffectiveTier(user) === 'free',
    // Free: transit list + natal chart wheel (no interpretations, no synthesis)
    canViewTransits: true,
    canViewNatalInterpretations: isCore,
    // Free users get deep dives for the Big Three (Sun, Moon, Rising) only;
    // all other natal interpretations are Core-gated.
    canViewBigThreeInterpretations: true,
    canViewTransitInterpretations: isCore,
    canViewPeriodSynthesis: isCore,   // weekly & monthly synthesis
    canExportCalendar: isCore,        // ICS feed + Google Calendar sync
    canUseRelationship: isCore,       // synastry / relationship planner
    canSwitchTradition: isCore,       // tradition switcher
    // Toggle-only points (Profile > Chart Display) — free for all
    canViewLots: true,
    canViewNodes: true,
    // Premium-only chart points
    canViewLilith: isPremium,
    canViewAsteroids: isPremium,
    canUseMultiChartPerspective: isPremium,
    // Core feature: AI Navigator chatbot
    canUseNavigator: isCore,
  };
}

/**
 * React hook — reads from the AuthContext user.
 * Usage: const { canViewTransitInterpretations, tier } = usePermissions(user);
 */
export function usePermissions(user) {
  return getPermissions(user);
}

export const TIER_LABELS = {
  free: 'Free',
  interpret: 'Core · $5.55/mo',
  calendar: 'Premium · $7.77/mo',
};

export const TIER_COLORS = {
  free: 'text-brass',
  interpret: 'text-celestial-blue',
  calendar: 'text-gold-accent',
};