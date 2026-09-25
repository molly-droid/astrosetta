import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import Stripe from 'npm:stripe@14';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { returnUrl } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const customerId = user.stripe_customer_id;
    if (!customerId) {
      return json({ error: 'No billing account found' }, { status: 404 });
    }

    // Verify the customer still exists in Stripe (a stale ID from mode-switch recreates on next checkout)
    try {
      await stripe.customers.retrieve(customerId);
    } catch {
      return json({ error: 'Billing account not found' }, { status: 404 });
    }

    let return_url;
    try {
      return_url = returnUrl || `${new URL(returnUrl).origin}/profile`;
    } catch {
      return_url = returnUrl || (Deno.env.get('APP_URL') || 'https://astrosetta.com') + '/profile';
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error('createCustomerPortalSession error:', error.message);
    return json({ error: error.message }, { status: 500 });
  }
});