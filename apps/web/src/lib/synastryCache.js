/**
 * Synastry result cache (PF-02).
 *
 * Opening a partner's synastry view called `chartCalculator` every single
 * time — a full two-chart calculation plus cross-aspects, refired on every
 * mount and every partner switch, even though both charts' positions were
 * already stored when the person was saved. That round trip is the "chart
 * comparisons take a while to load" wait.
 *
 * The result is now cached per (user, partner) pair in CalendarSynthesis
 * under period_type "synastry", using the same param-hash key the
 * interpretation store uses: the cache key IS a hash of the birth inputs, so
 * editing either chart's birth data changes the hash, misses, and
 * recalculates. No explicit invalidation.
 *
 * A partner's synastry is also warmed in the background the moment they're
 * saved, so the first open is instant too — that is the half of PF-02 Molly
 * asked for by name.
 */
import { base44 } from '@/api/base44Client';
import { getCachedSynthesis, saveCachedSynthesis } from './synthesisCache';

/**
 * Stable JSON: keys sorted at EVERY depth, not just the top level.
 *
 * `birth_location` is an object, and Postgres `jsonb` does not preserve key
 * order — so the same location hashes differently in memory (the calculator's
 * key order) than after a database round trip (jsonb's normalized order).
 * Sorting only the top level let a chart warmed on save miss its own cache
 * entry when the view read it back, writing a second row for one partner.
 */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** djb2 over the stable serialization. */
function hashParams(params) {
  const str = stableStringify(params);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The four fields chartCalculator actually consumes, in a stable shape. */
function birthInputs(raw) {
  return {
    birth_date: raw?.birth_date || '',
    birth_time: raw?.birth_time || '12:00:00',
    birth_location: raw?.birth_location || '',
    utc_offset: raw?.utc_offset ?? 0,
  };
}

export function synastryKey(natalRaw, savedRaw, houseSystem) {
  return `synastry-v1-${hashParams({
    a: birthInputs(natalRaw),
    b: birthInputs(savedRaw),
    hs: houseSystem || 'whole_sign',
  })}`;
}

function callCalculator(natalRaw, savedRaw, houseSystem) {
  return base44.functions
    .invoke('chartCalculator', {
      chart_type: 'synastry',
      chart1: birthInputs(natalRaw),
      chart2: birthInputs(savedRaw),
      house_system: houseSystem || 'whole_sign',
    })
    .then((res) => res.data);
}

// In-flight de-duplication: a remount while the first call is still running
// joins it instead of starting a second identical calculation.
const inFlight = {};

/**
 * Cached synastry calculation. Returns the same payload shape
 * `chartCalculator` returns, so callers are unchanged apart from the call.
 */
export async function getSynastry({ userId, natalRaw, savedChart, houseSystem }) {
  const savedRaw = savedChart?.raw_data || {};
  if (!natalRaw?.birth_date || !savedRaw?.birth_date) {
    throw new Error('Missing birth data for one or both charts.');
  }
  const key = synastryKey(natalRaw, savedRaw, houseSystem);

  if (userId) {
    const cached = await getCachedSynthesis('synastry', key, userId, savedChart.id);
    if (cached) return cached;
  }

  if (!inFlight[key]) {
    inFlight[key] = callCalculator(natalRaw, savedRaw, houseSystem).finally(() => {
      delete inFlight[key];
    });
  }
  const data = await inFlight[key];

  if (userId && data) {
    // Fire-and-forget: a failed write just means the next open recalculates.
    // `description` is left empty on purpose — it would otherwise hold a
    // second copy of this payload as a JSON string.
    saveCachedSynthesis('synastry', key, userId, data, {
      target_chart_id: savedChart.id,
      topic_key: 'synastry',
      description: '',
    }).catch(() => {});
  }
  return data;
}

/**
 * Warm a partner's synastry in the background (PF-02). Safe to call on save:
 * errors are swallowed, and a cache hit costs one indexed lookup.
 */
export function warmSynastry({ userId, natalRaw, savedChart, houseSystem }) {
  if (!userId || !natalRaw?.birth_date || !savedChart?.raw_data?.birth_date) return;
  getSynastry({ userId, natalRaw, savedChart, houseSystem }).catch(() => {});
}

/**
 * Persistence for the LLM-written relationship reading (PF-02, "investigate
 * other caching").
 *
 * SynastrySynthesis had a variable called `cacheKey` that was only ever a
 * useEffect dependency — nothing was stored, so every mount regenerated the
 * whole reading. The key here is a hash of the exact params sent to the LLM,
 * so it self-invalidates when the charts, the aspects or the relationship
 * change, and hits on every other open.
 */
export function synthesisKeyFor(params) {
  return `synastry-synth-v1-${hashParams(params)}`;
}

export async function loadSynastrySynthesis(userId, params) {
  if (!userId) return null;
  return getCachedSynthesis('synastry_synthesis', synthesisKeyFor(params), userId);
}

export function saveSynastrySynthesis(userId, params, data) {
  if (!userId || !data) return;
  saveCachedSynthesis('synastry_synthesis', synthesisKeyFor(params), userId, data, {
    topic_key: 'synastry-synthesis',
    description: '',
  }).catch(() => {});
}
