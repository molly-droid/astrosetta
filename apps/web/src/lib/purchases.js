/**
 * RevenueCat wrapper — live as of phase 3 (RevenueCat project configured
 * 2026-10-07). Everything no-ops unless the app runs natively AND a platform
 * API key is configured:
 *
 *   VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY
 *
 * initPurchases(userId) is called after sign-in (identifies the RevenueCat
 * customer as the Supabase user id so webhooks reconcile). Purchases flow
 * through offerings: tier `interpret` → offering `core`, tier `calendar` →
 * offering `premium`, each with $rc_monthly / $rc_annual packages. The
 * server-side tier update happens via the `revenuecat-webhook` Edge Function
 * (the client never writes its own tier).
 */
import { getPlatform, isNativePlatform } from '@/lib/platform';

const TIER_OFFERINGS = { interpret: 'core', calendar: 'premium' };
const PERIOD_PACKAGES = { monthly: '$rc_monthly', yearly: '$rc_annual' };

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

/** Highest active tier in a RevenueCat CustomerInfo, or null. */
export function tierFromCustomerInfo(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  if (active.calendar) return 'calendar';
  if (active.interpret) return 'interpret';
  return null;
}

let offeringsCache = null;

async function getOfferings() {
  if (!configured) return null;
  if (offeringsCache) return offeringsCache;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const offerings = await Purchases.getOfferings();
    offeringsCache = offerings;
    return offerings;
  } catch {
    return null;
  }
}

/** The store package for a tier + period, or null when unavailable. */
export async function getTierPackage(tier, period = 'monthly') {
  const offerings = await getOfferings();
  const offering = offerings?.all?.[TIER_OFFERINGS[tier]];
  if (!offering) return null;
  const packageKey = PERIOD_PACKAGES[period] || PERIOD_PACKAGES.monthly;
  return (offering.availablePackages || []).find(p => p.identifier === packageKey) || null;
}

/**
 * The store's localized price string for a tier + period (e.g. "$5.59"),
 * or null when offerings can't be fetched. ALWAYS prefer this over
 * hardcoded copy on native — the store price is what the user is charged.
 */
export async function getNativePriceString(tier, period = 'monthly') {
  const pkg = await getTierPackage(tier, period);
  return pkg?.product?.priceString || null;
}

/**
 * Runs the store purchase flow for a tier + period.
 * Returns { success, cancelled, tier, error }.
 * The authoritative users-row tier update arrives via the
 * revenuecat-webhook Edge Function moments later — callers should
 * poll reloadUser() until the tier reflects.
 */
export async function purchaseTier(tier, period = 'monthly') {
  if (!configured) return { success: false, cancelled: false, error: 'purchases_unavailable' };
  const pkg = await getTierPackage(tier, period);
  if (!pkg) return { success: false, cancelled: false, error: 'package_not_found' };
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { success: true, cancelled: false, tier: tierFromCustomerInfo(customerInfo) || tier };
  } catch (err) {
    const cancelled = !!(err?.userCancelled || `${err?.code}` === '1');
    return { success: false, cancelled, error: err?.message || 'purchase_failed' };
  }
}

/**
 * Store-account restore (Apple-required). Returns { success, tier } when an
 * active entitlement is found; { success: false, reason } otherwise.
 */
export async function restoreNative() {
  if (!configured) return { success: false, reason: 'unavailable' };
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await Purchases.restorePurchases();
    const tier = tierFromCustomerInfo(customerInfo);
    return tier ? { success: true, tier } : { success: false, reason: 'none' };
  } catch {
    return { success: false, reason: 'none' };
  }
}
