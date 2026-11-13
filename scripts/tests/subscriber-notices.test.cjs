const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const billing = loadEdge('supabase/functions/_shared/billing.ts');
const notices = loadEdge('supabase/functions/_shared/subscriberNotices.ts');
const chart = { sun_sign: 'Taurus', moon_sign: 'Cancer', ascendant_sign: 'Libra' };
const user = { id: 'qa', full_name: '<Alex & Co>', email: 'alex@example.invalid', subscription_tier: 'free' };

test('billing cadence comes from renewal metadata, never the length of a trial', () => {
  const base = { status: 'trialing', trial_end: Date.parse('2099-02-01') / 1000,
    items: { data: [{ price: { id: 'premium', recurring: { interval: 'year', interval_count: 1 } } }] } };
  assert.equal(billing.stripeEntitlements([base], { premium: 'calendar' })[0].billing_period, 'yearly');
  base.items.data[0].price.recurring = { interval: 'month', interval_count: 1 };
  assert.equal(billing.stripeEntitlements([base], { premium: 'calendar' })[0].billing_period, 'monthly');
  base.items.data[0].price.recurring.interval_count = 12;
  assert.equal(billing.stripeEntitlements([base], { premium: 'calendar' })[0].billing_period, 'yearly');
  base.items.data[0].price.recurring.interval_count = 3;
  assert.equal(billing.stripeEntitlements([base], { premium: 'calendar' })[0].billing_period, undefined);
  assert.equal(billing.productBillingPeriod('com.astrosetta.calendar.yearly'), 'yearly');
  assert.equal(billing.productBillingPeriod('premium', 'p1m'), 'monthly');
  assert.equal(billing.productBillingPeriod('premium:p1y'), 'yearly');
  assert.equal(billing.productBillingPeriod('unknown'), undefined);
  const payload = { subscriber: {
    entitlements: { calendar: { product_identifier: 'premium', expires_date: '2099-01-01' } },
    subscriptions: { premium: { store: 'play_store', product_plan_identifier: 'p1y' } },
  } };
  assert.equal(billing.revenueCatEntitlements(payload)[0].billing_period, 'yearly');
});

test('admin notices disclose only the chart details requested for each plan', () => {
  const free = notices.subscriberNoticeMessage(user, chart);
  assert.equal(free.to, 'hello@astrosetta.com');
  assert.match(free.html, /&lt;Alex &amp; Co&gt;/);
  assert.doesNotMatch(free.html, /<Alex|Taurus|Cancer|Libra/);
  assert.match(free.html, /Not applicable \(Free\)/);
  const core = notices.subscriberNoticeMessage({ ...user, subscription_tier: 'interpret', subscription_billing_period: 'monthly' }, chart);
  assert.match(core.html, /Core|Monthly|Taurus/);
  assert.doesNotMatch(core.html, /Cancer|Libra/);
  const premium = notices.subscriberNoticeMessage({ ...user, subscription_tier: 'calendar', subscription_billing_period: 'yearly', subscription_is_trial: true }, chart);
  for (const text of ['Premium', 'Yearly', 'Taurus', 'Cancer', 'Libra', 'Trial active']) assert(premium.html.includes(text));
  const unknown = notices.subscriberNoticeMessage({ ...user, subscription_tier: 'calendar' }, { ...chart, raw_data: { unknown_time: true } });
  assert.match(unknown.html, /birth time unknown/);
  assert.doesNotMatch(unknown.html, /Libra/);
  const signs = loadEdge('apps/web/src/lib/chartSigns.js').chartSigns({ ...chart, raw_data: { unknown_time: true } });
  assert.equal(signs.rising, null);
});

function workerHarness({ enabled = true, kind = 'subscription', tier = 'calendar', fail = false } = {}) {
  const notice = { id: 'notice-1', user_id: 'qa', kind, status: 'queued' };
  let sends = 0;
  const db = {
    rpc: async () => {
      if (notice.status !== 'queued') return { data: [], error: null };
      notice.status = 'processing';
      return { data: [notice], error: null };
    },
    from(table) {
      let action, update;
      const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
        single() { return q; }, maybeSingle() { return q; }, update(value) { action = 'update'; update = value; return q; },
        then(resolve, reject) {
          if (action === 'update') Object.assign(notice, update);
          const data = table === 'subscriber_notice_configuration' ? { enabled }
            : table === 'users' ? { ...user, subscription_tier: tier, subscription_billing_period: 'yearly' }
              : table === 'chart' ? chart : null;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        } };
      return q;
    },
  };
  const send = async message => {
    sends++;
    assert.equal(message.to, 'hello@astrosetta.com');
    if (fail) throw Error('Provider timeout, acceptance uncertain');
    return { id: 'provider-1' };
  };
  return { run: () => notices.deliverNextSubscriberNotice(db, send), notice, get sends() { return sends; } };
}

test('notice claims send once, skip superseded Free messages, and never retry timeouts', async () => {
  const good = workerHarness();
  assert.equal((await good.run()).sent, 1);
  assert.equal((await good.run()).sent, 0);
  assert.equal(good.sends, 1);
  const disabled = workerHarness({ enabled: false });
  await disabled.run(); assert.equal(disabled.sends, 0); assert.equal(disabled.notice.status, 'queued');
  const superseded = workerHarness({ kind: 'signup', tier: 'calendar' });
  await superseded.run(); assert.equal(superseded.sends, 0); assert.equal(superseded.notice.status, 'skipped');
  const failed = workerHarness({ fail: true });
  await assert.rejects(failed.run(), /timeout/);
  assert.equal(failed.notice.status, 'failed');
  await failed.run(); assert.equal(failed.sends, 1);
});

test('the admin notice endpoint rejects browser callers before accessing data or email', async () => {
  const { handler } = loadEdge('supabase/functions/notify-admin-subscriber/index.ts', {
    mocks: {
      '../_shared/edge.ts': { handleOptions: () => null, isServiceRole: () => false,
        json: (body, init) => Response.json(body, init), serviceClient: () => { throw Error('Unexpected data access'); } },
      '../_shared/subscriberNotices.ts': { deliverNextSubscriberNotice: () => { throw Error('Unexpected delivery'); } },
      '../_shared/resendEmail.ts': { sendDigestEmail: () => { throw Error('Unexpected send'); } },
    },
  });
  const response = await handler(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify({ to: 'attacker@example.invalid' }) }));
  assert.equal(response.status, 401);
});
