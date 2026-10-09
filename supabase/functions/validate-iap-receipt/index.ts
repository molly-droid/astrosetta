import { json, handleOptions, getAuthUser, serviceClient } from '../_shared/edge.ts';
import { syncRevenueCatUser } from '../_shared/billing.ts';

// Legacy compatibility route. Native purchases/restores now use RevenueCat.
// Never accept a client-selected tier or receipt as authority over billing.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
    const db = serviceClient();
    await syncRevenueCatUser(db, user.id);
    const { data, error } = await db.from('users')
      .select('subscription_tier, subscription_expires').eq('id', user.id).single();
    if (error) throw error;
    return json({ success: data.subscription_tier !== 'free', tier: data.subscription_tier,
      expiresAt: data.subscription_expires, transactionId: null });
  } catch (error) {
    console.error('IAP reconciliation failed:', error);
    return json({ error: 'Unable to verify purchases' }, { status: 500 });
  }
});
