const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const billing = loadEdge('supabase/functions/_shared/billing.ts');
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const future = '2099-01-01T00:00:00.000Z';
const prices = billing.stripePriceTiers(k => ({
  STRIPE_INTERPRET_PRICE_ID: 'core_month', STRIPE_INTERPRET_YEARLY_PRICE_ID: 'core_year',
  STRIPE_CALENDAR_PRICE_ID: 'premium_month', STRIPE_CALENDAR_YEARLY_PRICE_ID: 'premium_year',
})[k]);
const normalize = value => JSON.parse(JSON.stringify(value));
const edge = { json: (v, init) => Response.json(v, init), handleOptions: () => null };
const stripeSub = (id, status = 'active') => ({
  id: `sub_${id}`, status, metadata: { tier: 'interpret' },
  current_period_end: Date.parse(future) / 1000, items: { data: [{ price: { id } }] },
});
function rcPayload({ tier = 'interpret', expires = future, store = 'app_store', grace } = {}) {
  return { subscriber: {
    entitlements: { [tier]: { product_identifier: 'product', expires_date: expires } },
    subscriptions: { product: { store, grace_period_expires_date: grace } },
  } };
}

test('Stripe annual renewals preserve correct tier and period', () => {
  for (const id of Object.keys(prices)) {
    const result = billing.stripeEntitlements([stripeSub(id)], prices);
    assert.deepEqual(normalize(result), [{ tier: prices[id], expires_at: future, source: 'stripe' }]);
  }
  assert.equal(billing.stripeEntitlements([stripeSub('core_year', 'canceled')], prices).length, 0);
  assert.equal(billing.stripeEntitlements([stripeSub('core_year', 'incomplete')], prices).length, 0);
  assert.throws(() => billing.stripeEntitlements([stripeSub('unknown')], prices), /Unmapped/);
});

test('RevenueCat handles active, expired, grace-period and lifetime entitlements', () => {
  assert.equal(billing.revenueCatEntitlements(rcPayload())[0].tier, 'interpret');
  assert.equal(billing.revenueCatEntitlements(rcPayload({ tier: 'calendar', store: 'play_store' }))[0].source, 'google');
  assert.equal(billing.revenueCatEntitlements(rcPayload({ expires: '2000-01-01' })).length, 0);
  assert.equal(billing.revenueCatEntitlements(rcPayload({ expires: '2000-01-01', grace: future })).length, 1);
  assert.equal(billing.revenueCatEntitlements(rcPayload({ expires: null }))[0].expires_at, null);
  assert.equal(billing.revenueCatEntitlements(rcPayload({ store: 'stripe' })).length, 0);
  assert.throws(() => billing.revenueCatEntitlements({}), /Invalid/);
  assert.throws(() => billing.revenueCatEntitlements(rcPayload({ expires: 'garbage' })), /Invalid/);
});

test('RevenueCat transfer reconciles both accounts and resolves UUID aliases', () => {
  assert.deepEqual(normalize(billing.revenueCatUserIds({ type: 'TRANSFER', transferred_from: [A], transferred_to: [B] })), [A, B]);
  assert.deepEqual(normalize(billing.revenueCatUserIds({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:x', aliases: [A, A], original_app_user_id: B })), [B, A]);
});

test('Provider lookup failures never apply an empty billing snapshot', async () => {
  let writes = 0;
  const globals = {
    Deno: { env: { get: () => 'test-key' } },
    fetch: async () => new Response('unavailable', { status: 503 }),
  };
  const module = loadEdge('supabase/functions/_shared/billing.ts', { globals });
  await assert.rejects(module.syncRevenueCatUser({ rpc: async () => { writes++; return {}; } }, A), /503/);
  assert.equal(writes, 0);
});

test('RevenueCat webhook uses both transfer sides and retries reconciliation failures', async () => {
  let handler, synced = [], fail = false;
  const db = { from: () => ({ select: () => ({ in: async (_k, ids) => ({ data: ids.map(id => ({ id })), error: null }) }) }) };
  loadEdge('supabase/functions/revenuecat-webhook/index.ts', {
    mocks: {
      '../_shared/edge.ts': { ...edge, serviceClient: () => db },
      '../_shared/billing.ts': { ...billing, syncRevenueCatUser: async (_db, id) => { if (fail) throw Error('offline'); synced.push(id); } },
    },
    globals: { Deno: { env: { get: () => 'secret' }, serve: fn => { handler = fn; } } },
  });
  const request = () => new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer secret' }, body: JSON.stringify({ event: { type: 'TRANSFER', transferred_from: [A], transferred_to: [B] } }) });
  assert.equal((await handler(request())).status, 200);
  assert.deepEqual(synced.sort(), [A, B]);
  fail = true;
  assert.equal((await handler(request())).status, 500);
  assert.equal((await handler(new Request('https://test.invalid', { method: 'POST', body: '{}' }))).status, 401);
});

test('Stripe handler refreshes current subscriptions for renewal/deletion and paginates', async () => {
  let handler, snapshot, listings = 0;
  class Stripe {
    webhooks = { constructEventAsync: async body => JSON.parse(body) };
    subscriptions = { list: () => (async function* () {
      listings++;
      yield stripeSub('premium_month', 'canceled');
      yield stripeSub('core_year');
    })() };
  }
  const db = {
    rpc: async (_name, args) => { snapshot = args; return { error: null }; },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: A, stripe_customer_id: 'cus_a' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  loadEdge('supabase/functions/stripe-webhook/index.ts', {
    mocks: {
      '../_shared/edge.ts': { ...edge, serviceClient: () => db },
      '../_shared/base44Compat.ts': { compatClient: () => ({}) },
      '../_shared/eventOrders.ts': { createEventOrder: async () => {} },
      'npm:stripe@14': { default: Stripe },
    },
    globals: { Deno: { env: { get: k => ({ STRIPE_INTERPRET_YEARLY_PRICE_ID: 'core_year', STRIPE_CALENDAR_PRICE_ID: 'premium_month' })[k] }, serve: fn => { handler = fn; } } },
  });
  for (const type of ['invoice.paid', 'customer.subscription.deleted']) {
    const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ type, data: { object: { customer: 'cus_a' } } }) }));
    assert.equal(response.status, 200);
    assert.equal(snapshot.p_provider, 'stripe');
    assert.equal(snapshot.p_entitlements[0].tier, 'interpret');
  }
  assert.equal(listings, 2);
});

function aiHarness({ user = { role: 'learner', subscription_tier: 'interpret' }, allowed = true, quotaError = null, preview = false } = {}) {
  const calls = [];
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: user, error: null }) }) }) }),
    rpc: async (name, params) => { calls.push({ name, params }); return { data: { allowed }, error: name === 'increment_llm_usage' ? quotaError : null }; },
  };
  const module = loadEdge('supabase/functions/_shared/aiAccess.ts', {
    mocks: { './edge.ts': edge },
    transform: source => preview ? source : source.replace('const GATING_ADMIN_ONLY = true;', 'const GATING_ADMIN_ONLY = false;'),
  });
  return { db, calls, reserve: () => module.reserveAiUsage(db, A, 'core', 'navigator-chat') };
}

test('AI boundary denies Free/expired users after launch and preserves beta preview', async () => {
  for (const user of [null, { role: 'learner', subscription_tier: 'free' }, { role: 'learner', subscription_tier: 'calendar', subscription_expires: '2000-01-01' }]) {
    const h = aiHarness({ user });
    assert.equal((await h.reserve()).status, 403);
    assert.equal(h.calls.filter(c => c.name === 'increment_llm_usage').length, 0);
  }
  assert.equal(await aiHarness({ user: { role: 'learner', subscription_tier: 'free' }, preview: true }).reserve(), null);
});

test('AI boundary reserves quota, rejects exhausted/error states, and logs unlimited admins', async () => {
  const h = aiHarness();
  assert.equal(await h.reserve(), null);
  assert.equal(h.calls[1].params.p_limit, 300);
  assert.equal((await aiHarness({ allowed: false }).reserve()).status, 429);
  await assert.rejects(aiHarness({ quotaError: { message: 'offline' } }).reserve(), /usage log failed/);
  const admin = aiHarness({ user: { role: 'admin', subscription_tier: 'interpret' } });
  assert.equal(await admin.reserve(), null);
  assert.equal(admin.calls[1].params.p_limit, -1);
});

test('Navigator gate runs before provider calls or conversation mutation', async () => {
  let handler, writes = 0, providerCalls = 0;
  const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'chat', created_by_id: A, messages: [] } }) }) }), update: () => { writes++; throw Error('Unexpected write'); } }) };
  loadEdge('supabase/functions/navigator-chat/index.ts', {
    mocks: {
      'npm:@anthropic-ai/sdk': { default: class {} },
      '../_shared/edge.ts': { ...edge, getAuthUser: async () => ({ id: A }), serviceClient: () => db },
      '../_shared/aiAccess.ts': { reserveAiUsage: async () => Response.json({ code: 'limit_reached' }, { status: 429 }) },
      '../_shared/aiTelemetry.ts': { withAiTelemetry: async (_ctx, operation) => operation(() => {}) },
    },
    globals: { Deno: { env: { get: k => k === 'NAVIGATOR_PROVIDER' ? 'astrology-api' : 'mock' }, serve: fn => { handler = fn; } }, fetch: async () => { providerCalls++; throw Error('Unexpected provider'); } },
  });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ conversation_id: 'chat', message: { content: 'hello' } }) }));
  assert.equal(response.status, 429);
  assert.equal(writes, 0);
  assert.equal(providerCalls, 0);
});

test('Legacy receipt route ignores client tier and only refreshes the caller', async () => {
  let handler, refreshed;
  const db = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { subscription_tier: 'interpret', subscription_expires: future } }) }) }) }) };
  loadEdge('supabase/functions/validate-iap-receipt/index.ts', {
    mocks: {
      '../_shared/edge.ts': { ...edge, getAuthUser: async () => ({ id: A }), serviceClient: () => db },
      '../_shared/billing.ts': { syncRevenueCatUser: async (_db, id) => { refreshed = id; } },
    },
    globals: { Deno: { serve: fn => { handler = fn; } } },
  });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ tier: 'calendar', userId: B, receipt: 'fake' }) }));
  assert.equal(refreshed, A);
  assert.equal((await response.json()).tier, 'interpret');
});
