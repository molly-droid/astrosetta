import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';
import { resolveEventSignup, buildEventMetadata } from '../../shared/eventOrders.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tier, period = 'monthly', successUrl, cancelUrl, eventSignup } = await req.json();

    if (!['interpret', 'calendar'].includes(tier)) {
      return Response.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const isYearly = period === 'yearly';
    const priceIds = {
      interpret: isYearly ? Deno.env.get('STRIPE_INTERPRET_YEARLY_PRICE_ID') : Deno.env.get('STRIPE_INTERPRET_PRICE_ID'),
      calendar: isYearly ? Deno.env.get('STRIPE_CALENDAR_YEARLY_PRICE_ID') : Deno.env.get('STRIPE_CALENDAR_PRICE_ID'),
    };

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

    // Founding members lock in a recurring founding-rate coupon forever.
    // Coupon IDs are optional during prep — if the secrets aren't set yet,
    // checkout proceeds at the standard price.
    const foundingCouponId = user.is_founding_member
      ? Deno.env.get(tier === 'interpret' ? 'STRIPE_FOUNDING_COUPON_INTERPRET' : 'STRIPE_FOUNDING_COUPON_CALENDAR')
      : null;

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
      line_items: [{ price: priceIds[tier], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { base44_user_id: user.id, tier, period, founding: user.is_founding_member ? 'true' : 'false' },
        ...(foundingCouponId ? { discounts: [{ coupon: foundingCouponId }] } : {}),
      },
      metadata: { base44_user_id: user.id, tier, period, ...eventMeta },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});