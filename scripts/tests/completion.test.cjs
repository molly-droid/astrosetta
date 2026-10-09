const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const edge = { json: (v, init) => Response.json(v, init), handleOptions: () => null };
const plain = value => JSON.parse(JSON.stringify(value));

// In-memory service boundary for handler tests; real RLS/constraints are tested
// separately with PostgreSQL. Never calls a hosted project or paid provider.
function fakeDb(seed = {}) {
  const tables = structuredClone(seed);
  return { tables, rpc: async () => ({ error: null }), from(name) {
    tables[name] ||= [];
    let action = 'select', payload, options, filters = [], single = false;
    const q = {
      select() { return q; }, eq(k, v) { filters.push(row => row[k] === v); return q; },
      gt(k, v) { filters.push(row => row[k] > v); return q; },
      insert(p) { action = 'insert'; payload = p; return q; },
      upsert(p, o) { action = 'upsert'; payload = p; options = o; return q; },
      update(p) { action = 'update'; payload = p; return q; }, delete() { action = 'delete'; return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      then(resolve, reject) {
        try {
          let rows = tables[name].filter(row => filters.every(f => f(row)));
          if (action === 'delete') tables[name] = tables[name].filter(row => !rows.includes(row));
          if (action === 'update') rows.forEach(row => Object.assign(row, payload));
          if (action === 'insert' || action === 'upsert') {
            const existing = tables[name].find(row => row.user_id && row.user_id === payload.user_id);
            if (action === 'upsert' && existing) {
              if (!options?.ignoreDuplicates) Object.assign(existing, payload);
              rows = [existing];
            } else {
              const row = { ...(name === 'calendar_feed_keys' ? { token: 'a'.repeat(64) } : {}), ...payload };
              tables[name].push(row); rows = [row];
            }
          }
          return Promise.resolve({ data: single ? rows[0] || null : rows, error: null }).then(resolve, reject);
        } catch (e) { return Promise.reject(e).then(resolve, reject); }
      },
    };
    return q;
  } };
}

test('monthly cohort prices are separate; annual 55/77 IDs are shared, never coupon-discounted', () => {
  const { checkoutPrice } = loadEdge('supabase/functions/_shared/pricing.ts');
  const values = { STRIPE_INTERPRET_PRICE_ID: 'core_555', STRIPE_INTERPRET_STANDARD_PRICE_ID: 'core_8',
    STRIPE_INTERPRET_YEARLY_PRICE_ID: 'core_55', STRIPE_CALENDAR_PRICE_ID: 'premium_777',
    STRIPE_CALENDAR_STANDARD_PRICE_ID: 'premium_10', STRIPE_CALENDAR_YEARLY_PRICE_ID: 'premium_77' };
  const env = k => values[k];
  assert.equal(checkoutPrice('interpret', 'monthly', true, env), 'core_555');
  assert.equal(checkoutPrice('interpret', 'monthly', false, env), 'core_8');
  assert.equal(checkoutPrice('calendar', 'monthly', false, env), 'premium_10');
  for (const founding of [true, false]) {
    assert.equal(checkoutPrice('interpret', 'yearly', founding, env), 'core_55');
    assert.equal(checkoutPrice('calendar', 'yearly', founding, env), 'premium_77');
  }
  assert.throws(() => checkoutPrice('interpret', 'weekly', true, env), /Invalid/);
  assert.throws(() => checkoutPrice('interpret', 'monthly', false, () => undefined), /not configured/);
});

test('mobile browsers stay web; installed Capacitor apps use native billing', () => {
  const browser = loadEdge('apps/web/src/lib/platform.js', { globals: { window: {}, navigator: { userAgent: 'iPhone', standalone: true } } });
  assert.equal(browser.getPlatform(), 'web');
  for (const platform of ['ios', 'android']) {
    const native = loadEdge('apps/web/src/lib/platform.js', { globals: { window: { Capacitor: { getPlatform: () => platform } } } });
    assert.equal(native.isNativePlatform(), true);
  }
});

test('native email/portal links use the public app; billing management follows purchase source', () => {
  const urls = loadEdge('apps/web/src/lib/appUrls.js', {
    mocks: { './platform': { isNativePlatform: () => true } },
    transform: s => s.replaceAll('import.meta.env', '({})'),
  });
  assert.equal(urls.publicAppOrigin(), 'https://astrosetta.com');
  assert.match(urls.subscriptionManagementUrl('apple'), /apps.apple.com/);
  assert.match(urls.subscriptionManagementUrl('google'), /play.google.com/);
  assert.equal(urls.subscriptionManagementUrl('stripe'), null);
});

function purchasesHarness() {
  let user = A, founding = true, sdkUser, configureCount = 0, loginCount = 0, purchaseCount = 0;
  const calls = [];
  const sdk = {
    configure: async ({ appUserID }) => { configureCount++; sdkUser = appUserID; },
    logIn: async ({ appUserID }) => { loginCount++; sdkUser = appUserID; },
    isAnonymous: async () => ({ isAnonymous: !sdkUser }), logOut: async () => { sdkUser = null; },
    getOfferings: async () => ({ all: Object.fromEntries(['core', 'core_standard', 'premium'].map(id => [id, { availablePackages: [
      { identifier: '$rc_monthly', product: { priceString: id === 'core_standard' ? '$8' : '$5.59' } },
      { identifier: '$rc_annual', product: { priceString: '$55' } },
    ] }])) }),
    purchasePackage: async () => { purchaseCount++; calls.push(sdkUser); return { customerInfo: { entitlements: { active: { interpret: {} } } } }; },
    restorePurchases: async () => { calls.push(sdkUser); return { customerInfo: { entitlements: { active: { interpret: {} } } } }; },
  };
  const module = loadEdge('apps/web/src/lib/purchases.js', {
    mocks: {
      '@/lib/platform': { getPlatform: () => 'ios', isNativePlatform: () => true },
      '@/api/shim/supabase.js': { supabase: {
        auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null } }) },
        functions: { invoke: async () => ({ data: {} }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_founding_member: founding } }) }) }) }),
      } },
      '@revenuecat/purchases-capacitor': { Purchases: sdk },
    },
    transform: s => s.replaceAll('import.meta.env', '({VITE_REVENUECAT_IOS_KEY:"test"})'),
  });
  return { module, calls, user: value => { user = value; }, founding: value => { founding = value; }, counts: () => ({ configureCount, loginCount, purchaseCount }) };
}

test('RevenueCat configures once under concurrent initialization and switches accounts before purchase', async () => {
  const h = purchasesHarness();
  assert.deepEqual(await Promise.all([h.module.initPurchases(A), h.module.initPurchases(A)]), [true, true]);
  h.user(B);
  assert.equal((await h.module.purchaseTier('interpret')).success, true);
  assert.deepEqual(h.calls, [B]);
  assert.deepEqual(h.counts(), { configureCount: 1, loginCount: 1, purchaseCount: 1 });
  h.user(null); await h.module.resetPurchases();
  assert.equal((await h.module.purchaseTier('interpret')).success, false);
  h.user(A); assert.equal((await h.module.restoreNative()).success, true);
  assert.deepEqual(h.calls, [B, A]);
});

test('native standard monthly offering is distinct; annual rate and founding offering are retained', async () => {
  const h = purchasesHarness();
  assert.equal(await h.module.getNativePriceString('interpret'), '$5.59');
  h.founding(false);
  assert.equal(await h.module.getNativePriceString('interpret'), '$8');
  assert.equal(await h.module.getNativePriceString('interpret', 'yearly'), '$55');
  assert.equal(await h.module.getTierPackage('calendar'), null, 'missing standard offering fails closed');
});

function calendarHarness({ authenticated = true, tokenFails = false } = {}) {
  const db = fakeDb({ users: [{ id: A, role: 'learner', subscription_tier: 'interpret' }] });
  let handler, exchanges = 0;
  const env = { SUPABASE_URL: 'https://project.invalid', APP_URL: 'https://astrosetta.com', GOOGLE_CALENDAR_CLIENT_ID: 'client', GOOGLE_CALENDAR_CLIENT_SECRET: 'secret' };
  loadEdge('supabase/functions/calendar-connection/index.ts', {
    mocks: { '../_shared/edge.ts': { ...edge, getAuthUser: async () => authenticated ? { id: A } : null, serviceClient: () => db } },
    globals: { Deno: { env: { get: k => env[k] }, serve: fn => { handler = fn; } },
      fetch: async (url, options) => {
        assert.equal(url, 'https://oauth2.googleapis.com/token');
        assert.ok(options.body.get('code_verifier'));
        exchanges++;
        return tokenFails ? Response.json({ error: 'invalid_grant' }, { status: 400 }) : Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/calendar.events' });
      },
    },
  });
  return { db, handler, exchanges: () => exchanges,
    post: body => handler(new Request('https://project.invalid/functions/v1/calendar-connection', { method: 'POST', body: JSON.stringify(body) })) };
}

test('Google OAuth uses offline consent + PKCE and consumes state once before token exchange', async () => {
  const h = calendarHarness();
  const start = await h.post({ action: 'authorize', native: true });
  const auth = new URL((await start.json()).url);
  assert.equal(auth.searchParams.get('access_type'), 'offline');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(h.db.tables.google_calendar_states[0].code_verifier.length, 64);
  assert.ok(!auth.toString().includes('secret'));
  const callback = `https://project.invalid/functions/v1/calendar-connection?code=code&state=${auth.searchParams.get('state')}`;
  const response = await h.handler(new Request(callback));
  assert.equal(response.headers.get('location'), 'astrosetta://profile?google_calendar=connected');
  assert.equal(h.db.tables.google_calendar_connections[0].user_id, A);
  assert.equal((await h.handler(new Request(callback))).status, 400);
  assert.equal(h.exchanges(), 1);
});

test('expired state, failed consent, and unauthenticated calendar calls cannot connect accounts', async () => {
  assert.equal((await calendarHarness({ authenticated: false }).post({ action: 'authorize' })).status, 401);
  const h = calendarHarness();
  const auth = new URL((await (await h.post({ action: 'authorize' })).json()).url);
  h.db.tables.google_calendar_states[0].expires_at = '2000-01-01';
  const callback = `https://project.invalid/functions/v1/calendar-connection?code=code&state=${auth.searchParams.get('state')}`;
  assert.equal((await h.handler(new Request(callback))).status, 400);
  assert.equal(h.exchanges(), 0);
  const failed = calendarHarness({ tokenFails: true });
  const auth2 = new URL((await (await failed.post({ action: 'authorize' })).json()).url);
  const result = await failed.handler(new Request(`https://project.invalid/?code=bad&state=${auth2.searchParams.get('state')}`));
  assert.equal(result.headers.get('location'), 'https://astrosetta.com/profile?google_calendar=failed');
  assert.equal(failed.db.tables.google_calendar_connections, undefined);
});

test('calendar feed link is private, stable, backend-hosted and owned by authenticated user', async () => {
  const h = calendarHarness();
  const first = await (await h.post({ action: 'feed', user_id: B })).json();
  const second = await (await h.post({ action: 'feed' })).json();
  assert.equal(first.url, second.url);
  assert.match(first.url, /^https:\/\/project.invalid\/functions\/v1\/calendar-icsfeed\?token=[a-f0-9]{64}$/);
  assert.equal(h.db.tables.calendar_feed_keys[0].user_id, A);
  let handler;
  loadEdge('supabase/functions/calendar-icsfeed/index.ts', {
    mocks: { '../_shared/edge.ts': { ...edge, serviceClient: () => h.db },
      '../_shared/base44Compat.ts': { compatClient: () => ({ asServiceRole: { entities: {
        Chart: { filter: async q => { assert.equal(q.user_id, A); return [{ raw_data: { planets: [] } }]; } },
        UserProgress: { filter: async () => [{ timezone: 'UTC' }] },
        PlannerJournalEntry: { filter: async () => [] }, CalendarSynthesis: { filter: async () => [] },
      } } }) } },
    globals: { Deno: { env: { get() {} }, serve: fn => { handler = fn; } } },
  });
  assert.equal((await handler(new Request(`https://project.invalid?uid=${A}`))).status, 401);
  const feed = await handler(new Request(first.url));
  assert.equal(feed.status, 200);
  assert.match(feed.headers.get('content-type'), /text\/calendar/);
  assert.equal(feed.headers.get('cache-control'), 'private, no-store');
  assert.match(await feed.text(), /BEGIN:VCALENDAR/);
});

test('AI metrics capture success/failure and token-based estimates without prompts or responses', async () => {
  const db = fakeDb();
  const module = loadEdge('supabase/functions/_shared/aiTelemetry.ts', {
    mocks: { './edge.ts': { serviceClient: () => db } },
    globals: { Deno: { env: { get: () => '{"test-model":{"input":2,"output":8}}' } } },
  });
  assert.equal(await module.withAiTelemetry({ userId: A, task: 'test', provider: 'anthropic', model: 'test-model' }, async record => {
    record({ input_tokens: 1000, output_tokens: 100 }); return 'private response';
  }), 'private response');
  await assert.rejects(module.withAiTelemetry({ task: 'failed', provider: 'anthropic', model: 'test-model' }, async () => { throw Error('private failure'); }));
  const rows = plain(db.tables.ai_request_metrics);
  assert.equal(rows[0].outcome, 'success');
  assert.equal(rows[0].estimated_cost_usd, 0.0028);
  assert.equal(rows[1].outcome, 'error');
  assert.equal(rows[1].estimated_cost_usd, null);
  assert.ok(!JSON.stringify(rows).includes('private'));
});

test('interpretations are read only from Supabase, ranked and limited without Base44 network calls', async () => {
  let handler;
  const base44 = { auth: { me: async () => ({ id: A }) }, asServiceRole: { entities: { Interpretation: {
    filter: async query => { assert.equal(query.placement_key, 'Sun_Aries'); return [1,4,2,3].map(rating_score => ({ rating_score })); },
  } } } };
  loadEdge('supabase/functions/get-interpretations/index.ts', {
    mocks: { '../_shared/edge.ts': edge, '../_shared/base44Compat.ts': { compatClient: () => base44 } },
    globals: { Deno: { serve: fn => { handler = fn; } } },
  });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ key: 'Sun_Aries' }) }));
  assert.deepEqual(await response.json(), { interpretations: [{ rating_score:4 }, { rating_score:3 }, { rating_score:2 }], source:'local' });
});

test('Google token refresh preserves the refresh token and saves a new expiry', async () => {
  const db = fakeDb({ google_calendar_connections: [{ user_id:A, access_token:'old', refresh_token:'refresh', expires_at:'2000-01-01' }] });
  let requests = 0;
  const module = loadEdge('supabase/functions/_shared/googleCalendar.ts', {
    globals: { Deno: { env: { get: () => 'configured' } }, fetch: async (_url, options) => {
      requests++;
      assert.equal(options.body.get('grant_type'), 'refresh_token');
      return Response.json({ access_token:'new', expires_in:3600 });
    } },
  });
  assert.equal(await module.googleAccessToken(db,A), 'new');
  assert.equal(await module.googleAccessToken(db,A), 'new');
  assert.equal(requests,1);
  assert.equal(db.tables.google_calendar_connections[0].refresh_token,'refresh');
  assert.equal(await module.googleAccessToken(db,B),null);
});

test('Google sync paginates existing events, never deletes unrelated moon events, and writes valid timed events', async () => {
  let handler, pages = 0;
  const posts = [];
  const today = new Date().toISOString().slice(0,10);
  const base44 = { auth:{ me:async()=>({id:A}) }, asServiceRole:{ entities:{
    Chart:{filter:async()=>[]}, UserProgress:{filter:async()=>[{timezone:'America/Toronto'}]},
    PlannerJournalEntry:{filter:async()=>[{date_key:today, notes:'test journal'}]},
  } } };
  loadEdge('supabase/functions/sync-astro-to-calendar/index.ts', {
    mocks:{ '../_shared/edge.ts':{...edge,serviceClient:()=>({})}, '../_shared/base44Compat.ts':{compatClient:()=>base44},
      '../_shared/googleCalendar.ts':{googleAccessToken:async()=> 'access',calendarAllowed:async()=>true} },
    globals:{ Deno:{serve:fn=>{handler=fn;}}, fetch:async (_url,opts)=>{
      assert.notEqual(opts.method,'DELETE');
      if(opts.method==='POST'){posts.push(JSON.parse(opts.body));return Response.json({id:'event'});}
      pages++;
      return Response.json(pages===1?{items:[{id:'unrelated',summary:'🌑 Personal event',start:{date:today}}],nextPageToken:'next'}:{items:[]});
    } },
  });
  const response = await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({days_ahead:1,filters:{major_transits:false,new_moon:false,full_moon:false,retrogrades:false,journal:true}})}));
  assert.equal(response.status,200);
  assert.equal(pages,2);
  assert.equal(posts.length,1);
  assert.equal(posts[0].start.timeZone,'America/Toronto');
  assert.ok(posts[0].end.dateTime>posts[0].start.dateTime);
});
