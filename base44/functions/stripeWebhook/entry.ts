import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';
import { createEventOrder } from '../../shared/eventOrders.ts';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  // Build price->tier map inside handler so env vars are resolved at runtime
  const TIER_BY_PRICE = {
    [Deno.env.get('STRIPE_INTERPRET_PRICE_ID')]: 'interpret',
    [Deno.env.get('STRIPE_CALENDAR_PRICE_ID')]: 'calendar',
  };

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.base44_user_id;
      const tier = session.metadata?.tier;
      const subscriptionId = session.subscription;

      if (!userId || !tier) {
        console.error('Missing metadata on session:', session.id);
        return Response.json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      await base44.asServiceRole.entities.User.update(userId, {
        subscription_tier: tier,
        subscription_expires: expiresAt,
        subscription_source: 'stripe',
        stripe_subscription_id: subscriptionId,
      });
      console.log(`checkout.session.completed: updated user ${userId} to tier=${tier}, expires=${expiresAt}`);

      // Event-sourced signup (pop-up booth / promo code): create the incentive
      // order, decrement stock race-safely, and notify the booth team.
      if (session.metadata?.event_id) {
        try {
          await createEventOrder(base44, session);
        } catch (eventOrderError) {
          console.error('Event order creation failed:', eventOrderError.message);
        }
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      if (!subscriptionId) return Response.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.base44_user_id;
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = TIER_BY_PRICE[priceId];
      const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      if (userId && tier) {
        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: tier,
          subscription_expires: expiresAt,
          subscription_source: 'stripe',
        });
        console.log(`invoice.paid: renewed user ${userId} tier=${tier}, expires=${expiresAt}`);
      } else {
        console.warn(`invoice.paid: missing userId=${userId} or tier=${tier} for priceId=${priceId}`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.base44_user_id;

      if (userId) {
        await base44.asServiceRole.entities.User.update(userId, {
          subscription_tier: 'free',
          subscription_expires: null,
          subscription_source: null,
          stripe_subscription_id: null,
        });
        console.log(`customer.subscription.deleted: downgraded user ${userId} to free`);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});