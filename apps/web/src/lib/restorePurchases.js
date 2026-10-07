import { purchasesEnabled, initPurchases, restoreNative } from '@/lib/purchases';

/**
 * Restores previous in-app purchases on a native (iOS/Android) build —
 * the Apple-required "Restore Purchases" action for auto-renewable
 * subscriptions. Runs RevenueCat's restore for the signed-in store
 * account; the authoritative users-row tier update arrives via the
 * revenuecat-webhook Edge Function (restore events fire it when the
 * entitlement changes hands or reactivates).
 *
 * Returns { success: true, tier } on success, or { success: false, reason }:
 *   'unavailable' — not a native build / RevenueCat not configured
 *   'none'        — no restorable purchases found for the store account
 */
export async function restorePurchases() {
  if (!purchasesEnabled()) return { success: false, reason: 'unavailable' };
  await initPurchases();
  return restoreNative();
}
