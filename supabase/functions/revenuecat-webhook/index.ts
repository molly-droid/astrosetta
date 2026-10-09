import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import { revenueCatUserIds, syncRevenueCatUser } from '../_shared/billing.ts';

// Current subscriber state is authoritative. Replace only the RC snapshot,
// and refresh both parties when purchases move between accounts.
const SYNC_EVENTS = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'TRANSFER',
  'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'EXPIRATION', 'CANCELLATION',
  'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED', 'REFUND_REVERSED', 'TEMPORARY_ENTITLEMENT_GRANT',
]);

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }
  let event;
  try {
    event = (await req.json())?.event;
    if (!event || typeof event.type !== 'string') throw new Error('Missing event');
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }
  if (!SYNC_EVENTS.has(event.type)) return json({ received: true });
  try {
    const db = serviceClient();
    const ids = revenueCatUserIds(event);
    const { data: users, error } = ids.length
      ? await db.from('users').select('id').in('id', ids)
      : { data: [], error: null };
    if (error) throw error;
    // Unknown/deleted profiles and anonymous-only events have no row to sync.
    await Promise.all((users ?? []).map(({ id }) => syncRevenueCatUser(db, id)));
    return json({ received: true });
  } catch (error) {
    console.error('revenuecat-webhook reconciliation failed:', error);
    return json({ error: 'Billing reconciliation failed; retry delivery' }, { status: 500 });
  }
});
