import { base44 } from '@/api/base44Client';
import { getPlatform } from '@/lib/platform';

/**
 * Restores previous in-app purchases on a native (iOS/Android) build —
 * the Apple-required "Restore Purchases" action for auto-renewable
 * subscriptions. Fetches the store account's purchases via the Capacitor
 * IAP plugin and re-validates each subscription receipt through the
 * existing validateIapReceipt function, which re-applies the correct
 * tier to the current user.
 *
 * Returns { success: true, tier } on success, or { success: false, reason }:
 *   'unavailable' — no native IAP plugin (web preview or plugin missing)
 *   'none'        — no restorable purchases found for the store account
 */
export async function restorePurchases() {
  const platform = getPlatform();
  const storePlatform = platform === 'ios' ? 'apple' : 'google';
  const plugin = typeof window !== 'undefined' && window.Capacitor?.Plugins?.InAppPurchases;
  if (!plugin) return { success: false, reason: 'unavailable' };

  let purchases = [];
  try {
    const result = plugin.restorePurchases
      ? await plugin.restorePurchases()
      : await plugin.restore();
    purchases = result?.purchases || result?.receipts || (Array.isArray(result) ? result : []);
  } catch {
    return { success: false, reason: 'none' };
  }

  for (const purchase of purchases) {
    const productId = purchase?.productId || purchase?.product_id;
    const receipt = purchase?.receipt || purchase?.transactionReceipt || purchase?.purchaseToken || purchase?.token;
    if (!productId || !receipt) continue;
    const tier = productId.includes('calendar') ? 'calendar' : productId.includes('interpret') ? 'interpret' : null;
    if (!tier) continue;
    try {
      const res = await base44.functions.invoke('validateIapReceipt', {
        platform: storePlatform,
        receipt,
        productId,
        tier,
      });
      if (res?.data?.success) return { success: true, tier };
    } catch { /* try the next purchase */ }
  }

  return { success: false, reason: 'none' };
}