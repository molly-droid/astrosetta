/**
 * RevenueCat wrapper — STAGED BEHIND A FLAG until the client's RevenueCat
 * project exists (scope phase 3). Everything no-ops unless the app runs
 * natively AND a platform API key is configured:
 *
 *   VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY
 *
 * Once keys exist: initPurchases(userId) is called after sign-in (identifies
 * the RevenueCat customer as the Supabase user id so webhooks reconcile),
 * and the Subscribe page swaps Stripe checkout for getOfferings()/
 * purchasePackage() on native. Restore stays in lib/restorePurchases.js and
 * will be rewired to Purchases.restorePurchases() in the same phase.
 */
import { getPlatform, isNativePlatform } from '@/lib/platform';

function apiKey() {
  const platform = getPlatform();
  if (platform === 'ios') return import.meta.env.VITE_REVENUECAT_IOS_KEY || '';
  if (platform === 'android') return import.meta.env.VITE_REVENUECAT_ANDROID_KEY || '';
  return '';
}

export function purchasesEnabled() {
  return isNativePlatform() && !!apiKey();
}

let configured = false;

/** Configure RevenueCat and identify the customer. Safe to call anywhere. */
export async function initPurchases(appUserID) {
  if (!purchasesEnabled() || configured) return false;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.configure({ apiKey: apiKey(), appUserID: appUserID || undefined });
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/** Current entitlements ({ active: { <id>: {...} } }) or null when unavailable. */
export async function getEntitlements() {
  if (!configured) return null;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo?.entitlements ?? null;
  } catch {
    return null;
  }
}
