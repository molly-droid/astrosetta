import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import Stripe from 'npm:stripe@14';
import { createEventOrder } from '../_shared/eventOrders.ts';
import { applyBillingSnapshot, stripeEntitlements, stripePriceTiers } from '../_shared/billing.ts';

const SYNC_EVENTS = new Set([
  'checkout.session.completed', 'invoice.paid', 'customer.subscription.created',
  'customer.subscription.updated', 'customer.subscription.deleted',
]);
const objectId = (value: any): string | undefined => typeof value === 'string' ? value : value?.id;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(), req.headers.get('stripe-signature')!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch {
    return json({ error: 'Invalid webhook signature' }, { status: 400 });
  }
  if (!SYNC_EVENTS.has(event.type)) return json({ received: true });
  try {
    const record = event.data.object as any;
    const customerId = objectId(record.customer);
    if (!customerId) return json({ received: true });
    const db = serviceClient();
    let { data: user, error } = await db.from('users').select('id, stripe_customer_id')
      .eq('stripe_customer_id', customerId).maybeSingle();
    if (error) throw error;
    if (!user) {
      const customer = await stripe.customers.retrieve(customerId);
      const userId = !customer.deleted && customer.metadata?.base44_user_id;
      if (userId) {
        const result = await db.from('users').select('id, stripe_customer_id').eq('id', userId).maybeSingle();
        if (result.error) throw result.error;
        user = result.data;
        if (user?.stripe_customer_id && user.stripe_customer_id !== customerId) {
          throw new Error('Stripe customer does not match user');
        }
      }
    }
    if (!user) return json({ received: true });
    const observedAt = new Date().toISOString();
    const subscriptions = [];
    // Auto-pagination includes older/cancelled subscriptions past the first page.
    for await (const sub of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
      subscriptions.push(sub);
    }
    const grants = stripeEntitlements(subscriptions, stripePriceTiers((key) => Deno.env.get(key)));
    await applyBillingSnapshot(db, user.id, 'stripe', observedAt, grants);

    // Portal/support identifiers do not control the effective cross-store tier.
    const primary = subscriptions.find((sub) => ['active', 'trialing', 'past_due'].includes(sub.status));
    const { error: saveError } = await db.from('users').update({
      stripe_customer_id: customerId, stripe_subscription_id: primary?.id ?? null,
    }).eq('id', user.id);
    if (saveError) throw saveError;

    if (event.type === 'checkout.session.completed' && record.metadata?.event_id) {
      try { await createEventOrder(compatClient(req), record); }
      catch (error) { console.error('Event order creation failed:', error); }
    }
    return json({ received: true });
  } catch (error) {
    console.error('stripe-webhook reconciliation failed:', error);
    return json({ error: 'Billing reconciliation failed; retry delivery' }, { status: 500 });
  }
});
