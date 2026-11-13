const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');
const plain = value => JSON.parse(JSON.stringify(value));

test('sharing falls back to the Sun without using estimated unknown-time houses', () => {
  const { resolveShareSign } = loadEdge('apps/web/src/lib/shareReading.js');
  assert.deepEqual(plain(resolveShareSign({ raw_data: { unknown_time: true, ascendant_sign: 'Aries', sun_sign: 'Taurus' } })), { sign: 'Taurus', basis: 'sun' });
  assert.deepEqual(plain(resolveShareSign({ unknown_time: true, ascendant_sign: 'Aries', sun_sign: 'Taurus' })), { sign: 'Taurus', basis: 'sun' });
  assert.deepEqual(plain(resolveShareSign({ raw_data: { angles: { ascendant: { sign: 'Aries' } }, sun_sign: 'Taurus' } })), { sign: 'Aries', basis: 'rising' });
  assert.deepEqual(plain(resolveShareSign({ raw_data: { planets: [{ name: 'Sun', sign: ' taurus ' }] } })), { sign: 'Taurus', basis: 'sun' });
  assert.equal(resolveShareSign({ raw_data: { unknown_time: true, ascendant_sign: 'Aries' } }), null);
});

function harness(user = { id: 'test-user' }) {
  const rows = [], prompts = [];
  const base = { auth: { me: async () => user }, asServiceRole: {
    entities: { CalendarSynthesis: {
      filter: async query => rows.filter(row => row.period_key === query.period_key),
      create: async row => { rows.push(row); return row; },
    } },
    integrations: { Core: { InvokeLLM: async ({ prompt }) => {
      prompts.push(prompt);
      return { headline: 'An unrelated Rising headline', summary: 'A short standalone reading.', bullets: ['Reflect on the supplied transit.'] };
    } } },
  } };
  const { handler } = loadEdge('supabase/functions/generate-rising-sign-card/index.ts', {
    mocks: { '../_shared/base44Compat.ts': { compatClient: () => base },
      '../_shared/edge.ts': { json: (value, init) => Response.json(value, init), handleOptions: () => null },
      '../_shared/toneDirective.ts': { TONE_DIRECTIVE: 'Use reflective teaching language.' } },
  });
  return { rows, prompts, request: payload => handler(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(payload) })) };
}

test('Sun and Rising daily/weekly readings have separate prompts, labels and caches', async () => {
  const h = harness();
  for (const basis of ['sun', 'rising']) for (const period of ['day', 'week']) {
    const payload = { sign: 'Taurus', basis, period, dateKey: '2026-11-13', dateStr: 'November 13', collectiveContext: 'Venus trine Jupiter' };
    const response = await h.request(payload);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.headline, `What ${period === 'week' ? 'this week' : 'today'} means for Taurus ${basis === 'sun' ? 'Sun' : 'Rising'}`);
    assert.equal(data.basis, basis);
    assert.equal(data.period, period);
    const calls = h.prompts.length;
    assert.equal((await h.request(payload)).status, 200);
    assert.equal(h.prompts.length, calls, 'identical reading is served from cache');
  }
  assert.equal(new Set(h.rows.map(row => row.period_key)).size, 4);
  for (const prompt of h.prompts.slice(0, 2)) {
    assert.match(prompt, /Do not assign houses, infer an Ascendant/);
    assert.doesNotMatch(prompt, /1st whole-sign house/);
  }
  assert.match(h.prompts[2], /1st whole-sign house/);
});

test('legacy requests remain Rising/day, and invalid requests never reach the model', async () => {
  const h = harness();
  const response = await h.request({ sign: 'Aries', dateKey: '2026-11-13' });
  assert.equal((await response.json()).headline, 'What today means for Aries Rising');
  for (const payload of [{ sign: 'not-a-sign', dateKey: '2026-11-13' }, { sign: 'Aries', basis: 'moon', dateKey: '2026-11-13' }, { sign: 'Aries', period: 'year', dateKey: '2026-11-13' }, { sign: 'Aries', dateKey: 'invalid' }]) {
    assert.equal((await h.request(payload)).status, 400);
  }
  assert.equal(h.prompts.length, 1);
  const anonymous = harness(null);
  assert.equal((await anonymous.request({ sign: 'Aries', dateKey: '2026-11-13' })).status, 401);
  assert.equal(anonymous.prompts.length, 0);
});
