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
import { supabase } from '@/api/shim/supabase.js';

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
let identifiedUser = null;
let identityQueue = Promise.resolve();
/** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
const serial = (operation) => {
  const pending = identityQueue.then(operation);
  identityQueue = pending.then(() => {}, () => {});
  return pending;
};
async function sessionUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.user?.id || null;
}

/** Configure RevenueCat and identify the customer. Safe to call anywhere. */
export async function initPurchases(appUserID = undefined) {
  if (!purchasesEnabled()) return false;
  return serial(async () => {
    try {
      const current = await sessionUserId();
      if (!current || (appUserID && current !== appUserID)) return false;
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      if (!configured) {
        await Purchases.configure({ apiKey: apiKey(), appUserID: current });
        configured = true;
      } else if (identifiedUser !== current) {
        await Purchases.logIn({ appUserID: current });
      }
      if (identifiedUser !== current) offeringsCache = null;
      identifiedUser = current;
      return true;
    } catch {
      identifiedUser = null;
      return false;
    }
  });
}

/** Clear identity on sign-out; serialize against configure/login/purchases. */
export function resetPurchases() {
  identifiedUser = null;
  offeringsCache = null;
  return serial(async () => {
    if (!configured) return;
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    if (!(await Purchases.isAnonymous()).isAnonymous) await Purchases.logOut();
    identifiedUser = null;
  });
}

/** Current entitlements ({ active: { <id>: {...} } }) or null when unavailable. */
export async function getEntitlements() {
  if (!await initPurchases()) return null;
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
  if (!await initPurchases()) return null;
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
  try {
    const offerings = await getOfferings();
    const userId = await sessionUserId();
    if (!userId) return null;
    const { data: profile, error } = await supabase.from('users').select('is_founding_member').eq('id', userId).maybeSingle();
    if (error || !profile) return null;
    const base = TIER_OFFERINGS[tier];
    // Annual rates are shared; monthly standard offerings must be configured
    // separately before ending the founding window. Never fall back to a
    // founding monthly product for a non-founding customer.
    const offeringId = period === 'monthly' && !profile.is_founding_member ? `${base}_standard` : base;
    const offering = offerings?.all?.[offeringId];
    if (!offering) return null;
    const packageKey = PERIOD_PACKAGES[period] || PERIOD_PACKAGES.monthly;
    return (offering.availablePackages || []).find(p => p.identifier === packageKey) || null;
  } catch {
    return null;
  }
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
  if (!await initPurchases()) return { success: false, cancelled: false, error: 'purchases_unavailable' };
  const purchasingUser = identifiedUser;
  const pkg = await getTierPackage(tier, period);
  if (!pkg) return { success: false, cancelled: false, error: 'package_not_found' };
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await serial(async () => {
      if (purchasingUser !== identifiedUser || purchasingUser !== await sessionUserId()) {
        throw new Error('Account changed. Please try again.');
      }
      return Purchases.purchasePackage({ aPackage: pkg });
    });
    if (purchasingUser !== await sessionUserId()) throw new Error('Account changed. Sign in again to check your subscription.');
    // A store success must not become a "failed purchase" if reconciliation
    // is delayed; the webhook will retry. The caller already polls its profile.
    await supabase.functions.invoke('validate-iap-receipt', { body: {} }).catch(() => {});
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
  if (!await initPurchases()) return { success: false, reason: 'unavailable' };
  const restoringUser = identifiedUser;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    const { customerInfo } = await serial(async () => {
      if (restoringUser !== identifiedUser || restoringUser !== await sessionUserId()) throw new Error('Account changed');
      return Purchases.restorePurchases();
    });
    if (restoringUser !== await sessionUserId()) return { success: false, reason: 'account_changed' };
    await supabase.functions.invoke('validate-iap-receipt', { body: {} }).catch(() => {});
    const tier = tierFromCustomerInfo(customerInfo);
    return tier ? { success: true, tier } : { success: false, reason: 'none' };
  } catch {
    return { success: false, reason: 'none' };
  }
}
