const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEdge } = require('./load-edge.cjs');

function harness() {
  let handler;
  loadEdge('supabase/functions/chart-calculator/index.ts', {
    mocks: {
      '../_shared/edge.ts': { json: (value, init) => Response.json(value, init), handleOptions: () => null, getAuthUser: async () => ({ id: 'qa' }), isServiceRole: () => false },
      '../_shared/astrologyApiEngine.ts': { remoteEngineEnabled: () => false, fetchRemoteMoment: () => { throw Error('Unexpected provider call'); }, toUtcParts: () => {} },
    },
    globals: { Deno: { env: { get() {} }, serve(fn) { handler = fn; } } },
  });
  const calls = [], writes = [], rows = [];
  const base44 = {
    functions: { invoke: async (name, payload) => {
      calls.push(payload);
      const response = await handler(new Request('https://example.invalid', { method: 'POST', body: JSON.stringify(payload) }));
      const data = await response.json();
      assert.equal(response.status, 200, JSON.stringify(data));
      return { data };
    } },
    entities: { SavedChart: {
      filter: async () => rows,
      update: async (id, patch) => { writes.push({ id, patch }); return patch; },
    } },
  };
  const helpers = loadEdge('apps/web/src/lib/savedChartSettings.js', { mocks: {
    '@/api/base44Client': { base44 }, './traditions': loadEdge('apps/web/src/lib/traditions.js'),
  } });
  return { ...helpers, base44, calls, writes, rows };
}

const birth = { birth_date: '1990-06-15', birth_time: '12:00:00', utc_offset: -4,
  birth_location: { latitude: 43.65, longitude: -79.38, timezone: 'America/Toronto' } };
const whole = { house_system: 'whole_sign', tradition: 'hellenistic' };
const placidus = { house_system: 'placidus', tradition: 'modern' };

test('explicit account houses win over tradition defaults and old natal metadata', () => {
  const h = harness();
  assert.equal(h.resolveChartSettings({ house_system: 'whole_sign', active_tradition: 'modern' }, { raw_data: placidus }).house_system, 'whole_sign');
  assert.equal(h.resolveChartSettings(null, { raw_data: whole }).house_system, 'whole_sign');
  assert.equal(h.resolveChartSettings({ active_tradition: 'vedic' }, null).house_system, 'whole_sign');
  assert.equal(h.resolveChartSettings(null, null).house_system, 'placidus');
});

test('existing person and event charts get real Whole Sign cusps and house placements, once', async () => {
  const h = harness();
  const old = (await h.base44.functions.invoke('chartCalculator', { ...birth, ...placidus })).data;
  h.calls.length = 0;
  for (const chart_type of ['person', 'event']) {
    const saved = { id: chart_type, name: chart_type, chart_type, ...birth, raw_data: old };
    const [updated, duplicate] = await Promise.all([h.ensureSavedChartSettings(saved, whole), h.ensureSavedChartSettings(saved, whole)]);
    assert.equal(updated, duplicate, 'simultaneous loads share one repair');
    assert.equal(updated.name, saved.name);
    assert.equal(updated.chart_type, chart_type);
    assert.equal(updated.raw_data.house_system, 'whole_sign');
    assert.equal(updated.raw_data.houses.length, 12);
    for (const house of updated.raw_data.houses) assert.equal(house.degree, 0);
    const asc = Math.floor(updated.raw_data.angles.ascendant.longitude / 30);
    for (const planet of updated.raw_data.planets) assert.equal(planet.house, (Math.floor(planet.longitude / 30) - asc + 12) % 12 + 1);
    assert.equal(updated.raw_data.unknown_time, false, 'a known noon birth remains known');
    const count = h.calls.length;
    assert.equal(await h.ensureSavedChartSettings(updated, whole), updated);
    assert.equal(h.calls.length, count, 'matching charts are not recalculated');
  }
  assert.equal(h.calls.length, 2);
  assert.equal(h.writes.length, 2);
});

test('switching back to Placidus restores calculated cusps and retains the saved birth data', async () => {
  const h = harness();
  const updated = await h.ensureSavedChartSettings({ id: 'person', ...birth, raw_data: whole }, placidus);
  assert.equal(h.calls[0].house_system, 'placidus');
  assert.equal(h.calls[0].utc_offset, -4);
  assert.equal(h.calls[0].birth_time, '12:00:00');
  assert.equal(updated.raw_data.house_system, 'placidus');
  assert.ok(updated.raw_data.houses.some(house => house.degree !== 0));
});

test('unknown-time repairs never expose estimated houses, angles or Rising', async () => {
  const h = harness();
  const updated = await h.ensureSavedChartSettings({ id: 'unknown', ...birth, raw_data: { ...placidus, unknown_time: true } }, whole);
  assert.equal(h.calls[0].unknown_time, true);
  assert.equal(updated.ascendant_sign, '');
  assert.equal(updated.raw_data.houses.length, 0);
  assert.equal(Object.keys(updated.raw_data.angles).length, 0);
  assert.ok(updated.raw_data.planets.every(p => p.house === null));
});

test('missing or failed calculations cannot overwrite an existing saved chart', async () => {
  const h = harness();
  await assert.rejects(h.ensureSavedChartSettings({ id: 'broken', raw_data: {} }, whole), /Missing birth data/);
  h.base44.functions.invoke = async () => ({ data: { error: 'Unavailable' } });
  await assert.rejects(h.ensureSavedChartSettings({ id: 'person', ...birth }, whole), /Unavailable/);
  assert.equal(h.writes.length, 0);
});
