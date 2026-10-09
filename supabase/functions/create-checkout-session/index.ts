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
    const { data: profile, error: profileError } = await db.from('users').select('is_founding_member').eq('id', user.id).single();
    if (profileError) throw profileError;
    user.is_founding_member = profile.is_founding_member;

    const { tier, period = 'monthly', successUrl, cancelUrl, eventSignup } = await req.json();

    if (!['interpret', 'calendar'].includes(tier)) {
      return json({ error: 'Invalid tier' }, { status: 400 });
    }

    const priceId = checkoutPrice(tier, period, user.is_founding_member === true, key => Deno.env.get(key));

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    // Upsert Stripe customer — if stored ID doesn't exist in this mode, create a new one
    let customerId = user.stripe_customer_id;
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        customerId = null; // stale ID (e.g. live ID in test mode), recreate
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
        metadata: { base44_user_id: user.id },
      });
      customerId = customer.id;
      await base44.auth.updateMe({ stripe_customer_id: customerId });
    }

    // Event-sourced signups (pop-up booth QR tag or event promo code):
    // validate the event + gift SKU, then stamp the payload onto the session
    // metadata so the webhook can create the EventOrder once payment lands.
    let eventMeta = {};
    if (eventSignup?.event_id) {
      const { event, sku } = await resolveEventSignup(base44, eventSignup);
      eventMeta = buildEventMetadata(eventSignup, event, sku);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { base44_user_id: user.id, tier, period, founding: user.is_founding_member ? 'true' : 'false' },
      },
      metadata: { base44_user_id: user.id, tier, period, ...eventMeta },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }
});
