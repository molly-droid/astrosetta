import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { returnUrl } = await req.json();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const customerId = user.stripe_customer_id;
    if (!customerId) {
      return Response.json({ error: 'No billing account found' }, { status: 404 });
    }

    // Verify the customer still exists in Stripe (a stale ID from mode-switch recreates on next checkout)
    try {
      await stripe.customers.retrieve(customerId);
    } catch {
      return Response.json({ error: 'Billing account not found' }, { status: 404 });
    }

    let return_url;
    try {
      return_url = returnUrl || `${new URL(returnUrl).origin}/profile`;
    } catch {
      return_url = returnUrl || 'https://astrosetta.base44.app/profile';
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCustomerPortalSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});