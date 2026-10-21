/**
 * Centralized tier permission logic.
 * Import `usePermissions` in any component to gate features.
 */
import { isNativePlatform } from './platform';

/**
 * Derives effective tier from user data.
 * If a paid subscription has expired, falls back to "free".
 */
export function getEffectiveTier(user) {
  if (!user) return 'free';
  // BETA: all users treated as paid. Set to false once payments launch.
  const BETA_ALL_PAID = false;
  if (BETA_ALL_PAID) return 'calendar';
  // Launch gating is LIVE (flipped 2026-10-20 for the App Store RC build —
  // Apple must be able to find the paywalls to review the subscriptions).
  // The server-side mirror in llm_tasks/core.ts flips at cutover deploy.
  const GATING_ADMIN_ONLY = false;
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
 * Founding RATE eligibility, which is not the same thing as founding
 * membership. The cohort flag `is_founding_member` is permanent — it drives
 * the Founding Patron badge and survives everything. The discounted rate does
 * not: Molly's 2026-10-16 ruling is that a founding member who cancels and
 * later resubscribes comes back at standard prices, so the billing projection
 * stamps `founding_rate_forfeited_at` the moment a paid subscription lapses
 * to free. Pricing and "locked in" copy must read THIS, never the raw flag.
 */
export function hasFoundingRate(user) {
  return !!user?.is_founding_member && !user?.founding_rate_forfeited_at;
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

// Upsell teaser copy. Native builds must not quote the web price — the
// stores charge their own price points ($5.59/$7.79), and copy contradicting
// the purchase sheet is an App Review rejection. Teasers go price-free on
// native; the paywall itself shows the store's localized price.
export const CORE_CTA_LABEL = isNativePlatform()
  ? 'Unlock Core'
  : 'Unlock Core — $5.55/mo';

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