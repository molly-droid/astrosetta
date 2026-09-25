import { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { getHouseName, findNatalHouseForLongitude } from '@/lib/houseUtils';
import { forceTextGlyph } from '@/lib/chartUtils';

// Assembles the astrological facts for the 'interpretation-deep-dive'
// server task — the sectioned templates and FORMAT rules live in
// supabase/functions/_shared/llm_tasks/tasks_chart.ts.
function buildTaskParams(item, chartContext) {
  const raw = chartContext?.raw_data || chartContext || {};
  const sun = raw?.sun_sign || '';
  const moon = raw?.moon_sign || '';
  const asc = raw?.ascendant_sign || '';
  const ctx = `Sun in ${sun}, Moon in ${moon}, Rising ${asc}`;

  if (item.type === 'planet') {
    const houseName = getHouseName(item.house || item.number);
    return { kind: 'planet', ctx, name: item.name, sign: item.sign, houseName, retrograde: !!item.retrograde };
  }

  if (item.type === 'house') {
    return { kind: 'house', ctx, houseName: getHouseName(item.number), sign: item.sign };
  }

  if (item.type === 'sign') {
    const planetsInSign = (raw?.planets || []).filter(p => p.sign === item.sign).map(p => p.name).join(', ');
    const pContext = planetsInSign ? `They have ${planetsInSign} in ${item.sign}.` : `They have no planets in ${item.sign}.`;
    return { kind: 'sign', ctx, sign: item.sign, pContext };
  }

  if (item.type === 'aspect') {
    const planets = raw?.planets || [];
    const p1Data = planets.find(p => p.name === item.planet1);
    const p2Data = planets.find(p => p.name === item.planet2);
    const p1Detail = p1Data ? `${item.planet1} in ${p1Data.sign} (${getHouseName(p1Data.house)}${p1Data.retrograde ? ', retrograde' : ''})` : item.planet1;
    const p2Detail = p2Data ? `${item.planet2} in ${p2Data.sign} (${getHouseName(p2Data.house)}${p2Data.retrograde ? ', retrograde' : ''})` : item.planet2;
    return { kind: 'aspect', ctx, aspect: item.aspect, orb: item.orb, p1Detail, p2Detail };
  }

  if (item.type === 'node') {
    const name = item.nodeType === 'north' ? 'North Node' : 'South Node';
    const opp = item.nodeType === 'north' ? 'South Node' : 'North Node';
    const oppSign = item.oppositeSign || 'the opposite sign';
    // Use the node's actual house from the chart calculator (correct for both
    // Placidus and whole sign). For old cached charts that predate the house
    // field on nodes, compute it from the node's longitude and the chart's
    // cusps — never use sign-matching, which is whole-sign logic.
    const houses = raw?.houses || [];
    const houseSystem = raw?.house_system || 'whole_sign';
    const ascendantSign = raw?.ascendant_sign || null;
    const houseNum = item.house
      || (item.longitude != null ? findNatalHouseForLongitude(item.longitude, houses, houseSystem, ascendantSign) : null);
    const houseDetail = houseNum ? ` in the ${getHouseName(houseNum)}` : '';
    return { kind: 'node', ctx, name, opp, oppSign, sign: item.sign, houseDetail };
  }

  return { kind: 'other', ctx, itemJson: JSON.stringify(item) };
}

// ── Module-level cache ─────────────────────────────────────────────────────
const interpretationCache = {};

export function clearInterpretationCache() {
  Object.keys(interpretationCache).forEach(k => delete interpretationCache[k]);
}

function makeCacheKey(item, chartContext) {
  const base = chartContext?.id ? `${chartContext.id}_${item?.key}` : item?.key;
  const houseTag = item?.house != null ? `_h${item.house}` : '';
  return `${base}${houseTag}`;
}

export function preloadInterpretation(item, chartContext) {
  const cacheKey = makeCacheKey(item, chartContext);
  if (!item?.key || interpretationCache[cacheKey]) return;
  const params = buildTaskParams(item, chartContext);
  interpretationCache[cacheKey] = invokeLLMTask('interpretation-deep-dive', params).then(res => forceTextGlyph(res));
}

// ── Hook: used by InterpretCard in MyChart ─────────────────────────────────
export function useInterpretation(item, chartContext) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!item?.key) return;
    const cacheKey = makeCacheKey(item, chartContext);
    let cancelled = false;

    // Resolved string in cache → show instantly
    if (typeof interpretationCache[cacheKey] === 'string') {
      setText(interpretationCache[cacheKey]);
      setError(null);
      setLoading(false);
      return;
    }

    // Fire (or reuse an in-flight) LLM call. We do NOT permanently cache a
    // rejected promise — on error we delete it so a retry can fire fresh.
    if (!interpretationCache[cacheKey]) {
      const params = buildTaskParams(item, chartContext);
      interpretationCache[cacheKey] = invokeLLMTask('interpretation-deep-dive', params);
    }
    const cached = interpretationCache[cacheKey];

    setLoading(true);
    setError(null);

    Promise.resolve(cached)
      .then(res => {
        if (cancelled) return;
        const cleaned = forceTextGlyph(res);
        interpretationCache[cacheKey] = cleaned;
        setText(cleaned);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        delete interpretationCache[cacheKey]; // clear poisoned promise so retry works
        setError(err?.message || 'Unable to generate this reading');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [item?.key, retryCount]);

  const retry = () => setRetryCount(c => c + 1);
  return { text, loading, error, retry };
}

// Legacy default export kept for any remaining usages
export default function InterpretationDrawer() { return null; }