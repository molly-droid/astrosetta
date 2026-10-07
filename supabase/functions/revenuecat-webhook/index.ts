import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

/**
 * RevenueCat webhook — the authoritative server-side tier update for
 * App Store / Google Play subscriptions (the IAP counterpart of
 * stripe-webhook). RevenueCat customers are identified as the Supabase
 * user id (initPurchases(userId) in apps/web/src/lib/purchases.js), so
 * event.app_user_id addresses the users row directly.
 *
 * Auth: RevenueCat sends the literal Authorization header configured in
 * the webhook's dashboard settings; it must equal
 * `Bearer ${REVENUECAT_WEBHOOK_AUTH}`. Unset secret = reject everything.
 *
 * Event semantics (https://www.revenuecat.com/docs/webhooks):
 * - INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE /
 *   TRANSFER grant the tier until expiration_at_ms.
 * - CANCELLATION only turns off auto-renew — access runs until the
 *   period ends, so it does NOT downgrade here; EXPIRATION does.
 * - SANDBOX events are processed too (pre-launch testing); the
 *   environment is logged on every update.
 */

const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);

const STORE_SOURCES: Record<string, string> = {
  APP_STORE: 'apple',
  MAC_APP_STORE: 'apple',
  PLAY_STORE: 'google',
  STRIPE: 'stripe',
};

function tierFromEvent(event: Record<string, unknown>): string | null {
  const ids = (event.entitlement_ids as string[] | null) ?? [];
  if (ids.includes('calendar')) return 'calendar';
  if (ids.includes('interpret')) return 'interpret';
  return null;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  const got = req.headers.get('Authorization') ?? '';
  if (!expected || got !== `Bearer ${expected}`) {
    console.error('revenuecat-webhook: bad or missing Authorization header');
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = (await req.json())?.event ?? {};
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }

  const type = String(event.type ?? '');
  const userId = String(event.app_user_id ?? '');
  const environment = String(event.environment ?? '');

  // Purchases made before sign-in identify as RevenueCat anonymous ids;
  // they reconcile via TRANSFER once the user logs in.
  if (!userId || userId.startsWith('$RCAnonymousID:')) {
    console.warn(`revenuecat-webhook: ${type} for anonymous id, skipping`);
    return json({ received: true });
  }

  const base44 = compatClient(req);

  try {
    if (GRANT_EVENTS.has(type)) {
      const tier = tierFromEvent(event);
      if (!tier) {
        console.warn(`revenuecat-webhook: ${type} without known entitlement for user ${userId}`);
        return json({ received: true });
      }
      const expiresMs = Number(event.expiration_at_ms ?? 0);
      const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;
      const source = STORE_SOURCES[String(event.store ?? '')] ?? 'apple';

      await base44.asServiceRole.entities.User.update(userId, {
        subscription_tier: tier,
        subscription_expires: expiresAt,
        subscription_source: source,
      });
      console.log(`revenuecat-webhook: ${type} [${environment}] user ${userId} -> tier=${tier}, expires=${expiresAt}, source=${source}`);
    }

    if (type === 'EXPIRATION') {
      await base44.asServiceRole.entities.User.update(userId, {
        subscription_tier: 'free',
        subscription_expires: null,
        subscription_source: null,
      });
      console.log(`revenuecat-webhook: EXPIRATION [${environment}] user ${userId} downgraded to free`);
    }

    // CANCELLATION / BILLING_ISSUE / SUBSCRIPTION_PAUSED: no tier change —
    // access persists until EXPIRATION arrives.

    return json({ received: true });
  } catch (error) {
    console.error('revenuecat-webhook handler error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }
});
