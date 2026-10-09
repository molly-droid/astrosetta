import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type PaidTier = 'interpret' | 'calendar';
export interface Entitlement {
  tier: PaidTier;
  expires_at: string | null;
  source: 'stripe' | 'apple' | 'google';
}
type Env = (key: string) => string | undefined;
type RecordValue = Record<string, any>;

export function stripePriceTiers(env: Env): Record<string, PaidTier> {
  const prices: Record<string, PaidTier> = {};
  for (const tier of ['interpret', 'calendar'] as const) {
    for (const suffix of ['PRICE_ID', 'YEARLY_PRICE_ID', 'FOUNDING_PRICE_ID', 'STANDARD_PRICE_ID']) {
      const price = env(`STRIPE_${tier.toUpperCase()}_${suffix}`);
      if (price) prices[price] = tier;
    }
  }
  return prices;
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Invalid provider expiration');
  }
  return new Date(value).toISOString();
}

export function stripeEntitlements(
  subscriptions: RecordValue[], prices: Record<string, PaidTier>, now = Date.now(),
): Entitlement[] {
  const grants: Entitlement[] = [];
  for (const sub of subscriptions) {
    // Cancellation at period end remains active. Never grant unpaid/incomplete
    // subscriptions. Past-due access lasts only to the paid period end.
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) continue;
    const items = sub.items?.data;
    if (!Array.isArray(items)) throw new Error('Invalid Stripe subscription items');
    for (const item of items) {
      const tier = prices[item.price?.id];
      if (!tier) {
        if (['interpret', 'calendar'].includes(sub.metadata?.tier)) {
          throw new Error(`Unmapped Astrosetta Stripe price: ${item.price?.id}`);
        }
        continue;
      }
      const end = item.current_period_end ?? sub.current_period_end;
      if (typeof end !== 'number' || !Number.isFinite(end)) throw new Error('Missing Stripe period end');
      if (end * 1000 > now) grants.push({ tier, expires_at: new Date(end * 1000).toISOString(), source: 'stripe' });
    }
  }
  return grants;
}

export function revenueCatEntitlements(payload: RecordValue, now = Date.now()): Entitlement[] {
  const subscriber = payload?.subscriber;
  if (!subscriber || !subscriber.entitlements || !subscriber.subscriptions) {
    throw new Error('Invalid RevenueCat subscriber response');
  }
  const grants: Entitlement[] = [];
  for (const tier of ['interpret', 'calendar'] as const) {
    const entitlement = subscriber.entitlements[tier];
    if (!entitlement) continue;
    const product = entitlement.product_identifier;
    const purchase = subscriber.subscriptions[product]
      ?? subscriber.non_subscriptions?.[product]?.at(-1);
    if (!purchase) throw new Error('Missing RevenueCat entitlement purchase');
    const store = String(purchase.store ?? '').toLowerCase();
    if (store === 'stripe') continue; // direct Stripe snapshot is authoritative
    const source = store === 'play_store' ? 'google'
      : ['app_store', 'mac_app_store'].includes(store) ? 'apple' : null;
    if (!source) throw new Error(`Unsupported RevenueCat store: ${store}`);
    if (!Object.hasOwn(entitlement, 'expires_date')) throw new Error('Missing RevenueCat expiration');
    let expires = entitlement.expires_date === null ? null : isoDate(entitlement.expires_date);
    const grace = entitlement.grace_period_expires_date ?? purchase.grace_period_expires_date;
    if (grace != null && expires !== null) {
      expires = new Date(Math.max(Date.parse(expires), Date.parse(isoDate(grace)))).toISOString();
    }
    if (expires === null || Date.parse(expires) > now) grants.push({ tier, expires_at: expires, source });
  }
  return grants;
}

export function revenueCatUserIds(event: RecordValue): string[] {
  const values = event.type === 'TRANSFER'
    ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
    : [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return [...new Set(values.filter((id): id is string => typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))];
}

export async function applyBillingSnapshot(
  db: SupabaseClient, userId: string, provider: 'stripe' | 'revenuecat',
  observedAt: string, grants: Entitlement[],
) {
  const { error } = await db.rpc('apply_billing_snapshot', {
    p_user_id: userId, p_provider: provider, p_observed_at: observedAt, p_entitlements: grants,
  });
  if (error) throw new Error(`Billing reconciliation failed: ${error.message}`);
}

/** Fetch current state, not event deltas (TRANSFER lacks entitlement data). */
export async function syncRevenueCatUser(db: SupabaseClient, userId: string) {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) throw new Error('REVENUECAT_SECRET_API_KEY is required for billing reconciliation');
  const observedAt = new Date().toISOString();
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  // Provider errors are NOT empty entitlements. Preserve access and retry.
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  const grants = revenueCatEntitlements(await response.json());
  await applyBillingSnapshot(db, userId, 'revenuecat', observedAt, grants);
}
