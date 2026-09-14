// Event signup tagging — persists the QR src param (or a promo-code entry)
// from the landing page through signup and onboarding, so the checkout flow
// can attach the incentive gift to the right event.

const KEY = 'astrosetta_event_tag';

export function getEventTag() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setEventTag(tag) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tag));
  } catch {
    /* private mode etc. — tagging is best-effort */
  }
}

export function clearEventTag() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Resolves the incentive SKU for a given tier + billing cycle.
 * SKU ids are built (not stored) so new events work with zero code changes:
 *   promo code  → <event>_remote_gift (scaled-down mailed keepsake)
 *   monthly     → <event>_<tier>_monthly_keychain
 *   premium yr  → <event>_premium_yearly_necklace_<metal>
 *   core yearly → <event>_core_yearly_<jewelry>_<metal>
 */
export function resolveSkuId(eventId, tier, billing, metal, jewelry, channel) {
  if (channel === 'promo_code') return `${eventId}_remote_gift`;
  const t = tier === 'calendar' ? 'premium' : 'core';
  if (billing !== 'yearly') return `${eventId}_${t}_monthly_keychain`;
  if (t === 'premium') return `${eventId}_premium_yearly_necklace_${metal || 'silver'}`;
  return `${eventId}_core_yearly_${jewelry || 'necklace'}_${metal || 'silver'}`;
}