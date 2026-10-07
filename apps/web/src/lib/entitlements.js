/**
 * Centralized entitlement / IAP configuration.
 *
 * Maps subscription tiers to product identifiers for each platform.
 * Apple & Google product IDs are configured in App Store Connect / Google Play Console.
 * Replace these placeholder IDs with your real product IDs before launching.
 */

/** Tier to IAP product identifier mappings */
export const IAP_PRODUCTS = {
  interpret: {
    apple: {
      monthly: 'com.astrosetta.interpret.monthly',
      yearly: 'com.astrosetta.interpret.yearly',
    },
    google: {
      monthly: 'com.astrosetta.interpret.monthly', // placeholder — created in Play Console after first AAB upload
      yearly: 'com.astrosetta.interpret.yearly',   // placeholder
    },
  },
  calendar: {
    apple: {
      monthly: 'com.astrosetta.calendar.monthly',
      yearly: 'com.astrosetta.calendar.yearly',
    },
    google: {
      monthly: 'com.astrosetta.calendar.monthly',  // placeholder
      yearly: 'com.astrosetta.calendar.yearly',    // placeholder
    },
  },
};

/** Tier to Stripe price IDs (for reference / web) */
export const STRIPE_TIERS = ['interpret', 'calendar'];

/**
 * Returns the platform-appropriate product ID for a given tier and billing
 * period ('monthly' | 'yearly', defaults to monthly).
 * Falls back to null if platform is 'web' (use Stripe checkout instead).
 */
export function getProductId(tier, platform, period = 'monthly') {
  return IAP_PRODUCTS[tier]?.[platform]?.[period] || null;
}

/**
 * Subscription source labels for display.
 */
export const SOURCE_LABELS = {
  stripe: 'via Stripe',
  apple: 'via App Store',
  google: 'via Google Play',
};

/** How long to consider a receipt as "stale" before requiring revalidation (ms) */
export const RECEIPT_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours