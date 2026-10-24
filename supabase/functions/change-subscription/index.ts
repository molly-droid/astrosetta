// Plan change for an EXISTING web (Stripe) subscriber — the web counterpart of
// the stores' native plan-change flows. Mirrors the Apple subscription-group
// semantics (and the Android replacement modes in lib/purchases.js):
//   upgrade   -> immediate, prorated credit for unused time
//   downgrade -> keeps the paid plan until the period end, then switches
// Checkout (create-checkout-session) is for NEW subscriptions only; calling it
// with an active subscription would double-bill, which is why this exists.
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import Stripe from 'npm:stripe@14';
import { checkoutPrice } from '../_shared/pricing.ts';
import { applyBillingSnapshot, stripeEntitlements, stripePriceTiers } from '../_shared/billing.ts';

const RANK: Record<string, number> = { interpret: 1, calendar: 2 };
const scheduleIdOf = (value: any): string | undefined => typeof value === 'string' ? value : value?.id;

// Re-project the user's tier from live Stripe state, exactly as stripe-webhook
// does. The webhook remains the backstop, but the caller is polling its
// profile RIGHT NOW — don't make the UI wait on webhook delivery (or on the
// endpoint's enabled-events list including customer.subscription.updated).
async function refreshStripeSnapshot(db: any, stripe: Stripe, userId: string, customerId: string) {
  const subscriptions = [];
  for await (const sub of stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })) {
    subscriptions.push(sub);
  }
  const grants = stripeEntitlements(subscriptions, stripePriceTiers((key: string) => Deno.env.get(key)));
  await applyBillingSnapshot(db, userId, 'stripe', new Date().toISOString(), grants);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // action: 'status' — is a plan change pending? (read-only; lets the UI show
    // "switches to X on [date]" with an undo across page loads)
    if (body?.action === 'status') {
      if (!user.stripe_customer_id) return json({ pending: null });
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
      const subs = await stripe.subscriptions.list({
        customer: user.stripe_customer_id, status: 'active', limit: 10,
      });
      const sub = subs.data.find((s) => s.metadata?.base44_user_id === user.id) || subs.data[0];
      const schedId = sub ? scheduleIdOf(sub.schedule) : undefined;
      if (!sub || !schedId) return json({ pending: null });
      const schedule = await stripe.subscriptionSchedules.retrieve(schedId);
      const next = schedule.phases[schedule.phases.length - 1];
      if (!next || schedule.phases.length < 2) return json({ pending: null });
      const nextPriceId = scheduleIdOf(next.items[0]?.price);
      const nextTier = nextPriceId ? stripePriceTiers((key) => Deno.env.get(key))[nextPriceId] : undefined;
      if (!nextTier) return json({ pending: null });
      return json({
        pending: { tier: nextTier, effective_at: new Date(next.start_date * 1000).toISOString() },
      });
    }

    const { tier, period = 'monthly' } = body;
    if (!['interpret', 'calendar'].includes(tier) || !['monthly', 'yearly'].includes(period)) {
      return json({ error: 'Invalid subscription plan' }, { status: 400 });
    }
    if (!user.stripe_customer_id) return json({ error: 'no_active_subscription' }, { status: 409 });

    const db = serviceClient();
    const { error: refreshError } = await db.rpc('refresh_billing_access', { p_user_id: user.id });
    if (refreshError) throw refreshError;
    const { data: profile, error: profileError } = await db.from('users')
      .select('is_founding_member, founding_rate_forfeited_at').eq('id', user.id).single();
    if (profileError) throw profileError;
    // Founding DISCOUNT, not cohort membership — same read as create-checkout-session.
    const foundingRate = profile.is_founding_member === true && !profile.founding_rate_forfeited_at;

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const subs = await stripe.subscriptions.list({
      customer: user.stripe_customer_id, status: 'active', limit: 10,
    });
    const sub = subs.data.find((s) => s.metadata?.base44_user_id === user.id) || subs.data[0];
    if (!sub) return json({ error: 'no_active_subscription' }, { status: 409 });

    const targetPrice = checkoutPrice(tier, period, foundingRate, (key) => Deno.env.get(key));
    const item = sub.items.data[0];
    if (item.price.id === targetPrice) {
      // Already paying for this plan. If a downgrade is pending, re-choosing
      // the current plan is the undo: release the schedule, nothing changes.
      const pending = scheduleIdOf(sub.schedule);
      if (pending) {
        await stripe.subscriptionSchedules.release(pending);
        await refreshStripeSnapshot(db, stripe, user.id, user.stripe_customer_id);
        return json({ reverted: true, tier, period });
      }
      await refreshStripeSnapshot(db, stripe, user.id, user.stripe_customer_id);
      return json({ unchanged: true, tier, period });
    }

    const fromTier = sub.metadata?.tier || 'interpret';
    const fromPeriod = sub.metadata?.period || 'monthly';
    const isUpgrade = (RANK[tier] ?? 0) > (RANK[fromTier] ?? 0)
      || (tier === fromTier && period === 'yearly' && fromPeriod === 'monthly');

    if (isUpgrade) {
      // A pending scheduled downgrade must be released before the items can change.
      const pending = scheduleIdOf(sub.schedule);
      if (pending) await stripe.subscriptionSchedules.release(pending);
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: targetPrice }],
        // Charge the prorated difference NOW — same feel as an Apple upgrade.
        proration_behavior: 'always_invoice',
        cancel_at_period_end: false,
        metadata: { ...sub.metadata, tier, period },
      });
      await refreshStripeSnapshot(db, stripe, user.id, user.stripe_customer_id);
      return json({ deferred: false, tier, period });
    }

    // Downgrade: a subscription schedule holds the current price to the end of
    // the paid period, then releases the subscription on the new price.
    const existingId = scheduleIdOf(sub.schedule);
    const schedule = existingId
      ? await stripe.subscriptionSchedules.retrieve(existingId)
      : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });
    const phaseStart = schedule.current_phase?.start_date ?? schedule.phases[0].start_date;
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: [{ price: item.price.id, quantity: 1 }],
          start_date: phaseStart,
          end_date: sub.current_period_end,
        },
        {
          items: [{ price: targetPrice, quantity: 1 }],
          metadata: { base44_user_id: user.id, tier, period, founding: foundingRate ? 'true' : 'false' },
        },
      ],
    });
    await refreshStripeSnapshot(db, stripe, user.id, user.stripe_customer_id);
    return json({
      deferred: true, tier, period,
      effective_at: new Date(sub.current_period_end * 1000).toISOString(),
    });
  } catch (error) {
    console.error('changeSubscription error:', (error as Error).message);
    return json({ error: (error as Error).message }, { status: 500 });
  }
});
