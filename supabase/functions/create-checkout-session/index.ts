import { betaTrialOffer, betaTrialCheckoutOptions, BETA_TRIAL_CAMPAIGN } from '../_shared/betaTrial.ts';
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import Stripe from 'npm:stripe@14';
import { resolveEventSignup, buildEventMetadata } from '../_shared/eventOrders.ts';
import { checkoutPrice } from '../_shared/pricing.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    const db = serviceClient();
    const { error: refreshError } = await db.rpc('refresh_billing_access', { p_user_id: user.id });
    if (refreshError) throw refreshError;
    const { data: profile, error: profileError } = await db.from('users')
      .select('*').eq('id', user.id).single();
    if (profileError) throw profileError;
    Object.assign(user, profile);
    // The founding DISCOUNT, not the cohort flag. refresh_billing_access ran
    // above, so a subscription that lapsed is already stamped by the time we
    // read this — a founder who cancelled and came back prices as standard.
    const foundingRate = profile.is_founding_member === true && !profile.founding_rate_forfeited_at;

    const { tier, period = 'monthly', successUrl, cancelUrl, eventSignup, betaTrial = false } = await req.json();

    if (!['interpret', 'calendar'].includes(tier)) {
      return json({ error: 'Invalid tier' }, { status: 400 });
    }

    const offer = await betaTrialOffer(db, user);
    if (['interpret','calendar'].includes(user.subscription_tier) && (!user.subscription_expires || Date.parse(user.subscription_expires) > Date.now()) && user.subscription_source) {
      return json({ error: 'Use Manage billing to change your existing subscription', code: 'subscription_exists' }, { status: 409 });
    }
    if (betaTrial && (!offer.eligible || tier !== 'calendar' || eventSignup)) {
      return json({ error: 'This beta trial is not available for this account', code: 'beta_trial_unavailable' }, { status: 409 });
    }
    if (offer.eligible && !betaTrial) {
      return json({ error: 'Reload the plan page to start your beta Premium trial', code: 'beta_trial_available' }, { status: 409 });
    }
    const priceId = checkoutPrice(tier, period, foundingRate, key => Deno.env.get(key));

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Upsert Stripe customer — if stored ID doesn't exist in this mode, create a new one
    let customerId = user.stripe_customer_id;
    if (customerId) {
      try {
        const existingCustomer = await stripe.customers.retrieve(customerId);
        if (existingCustomer.deleted) customerId = null;
      } catch (error) {
        if (error.code !== 'resource_missing') throw error;
        customerId = null;
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
        metadata: { base44_user_id: user.id },
      }, { idempotencyKey: `checkout-customer-${user.id}` });
      customerId = customer.id;
      await base44.auth.updateMe({ stripe_customer_id: customerId });
    }

    // Re-check the provider before creating another subscription checkout.
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (subscriptions.data.some(sub => ['active','trialing','past_due','unpaid','incomplete','paused'].includes(sub.status))) {
      return json({ error: 'You already have a subscription. Use Manage billing to change it.', code: 'subscription_exists' }, { status: 409 });
    }
    if (betaTrial) {
      const price = await stripe.prices.retrieve(priceId);
      if (price.currency !== 'usd' || price.unit_amount !== (period === 'yearly' ? 7700 : 777) || price.recurring?.interval !== (period === 'yearly' ? 'year' : 'month')) {
        throw new Error('Beta trial renewal price does not match the advertised founding rate');
      }
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
      for (const open of sessions.data.filter(session => session.metadata?.beta_campaign === BETA_TRIAL_CAMPAIGN)) {
        if (open.metadata?.period === period && open.expires_at * 1000 > Date.now()) return json({ url: open.url });
        await stripe.checkout.sessions.expire(open.id);
      }
    }

    // Event-sourced signups (pop-up booth QR tag or event promo code):
    // validate the event + gift SKU, then stamp the payload onto the session
    // metadata so the webhook can create the EventOrder once payment lands.
    let eventMeta = {};
    if (eventSignup?.event_id) {
      const { event, sku } = await resolveEventSignup(base44, eventSignup);
      eventMeta = buildEventMetadata(eventSignup, event, sku);
    }

    const trialOptions = betaTrial ? betaTrialCheckoutOptions(offer.endsAt, period) : {};
    const trialMeta = betaTrial ? { beta_campaign: BETA_TRIAL_CAMPAIGN, beta_trial_ends_at: offer.endsAt } : {};
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: betaTrial ? 'https://astrosetta.com/profile?tab=plan&success=true&tier=calendar&trial=beta' : successUrl,
      cancel_url: betaTrial ? 'https://astrosetta.com/subscribe' : cancelUrl,
      allow_promotion_codes: true,
      ...trialOptions,
      subscription_data: {
        ...trialOptions.subscription_data,
        metadata: { base44_user_id: user.id, tier, period, founding: foundingRate ? 'true' : 'false', ...trialMeta },
      },
      metadata: { base44_user_id: user.id, tier, period, ...eventMeta, ...trialMeta },
    }, betaTrial ? { idempotencyKey: `beta-checkout-v2-${user.id}-${period}-${Math.floor(Date.now() / 1800000)}` } : undefined);

    return json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }
});
