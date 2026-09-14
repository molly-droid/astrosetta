import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';

// Module-level memory cache: `${chartId}_${sectionKey}` → LLM result
const dynamicsCache = {};

/**
 * Hook for on-demand LLM interpretation of a chart dynamics section.
 * Mirrors the pattern used by DaySynthesis / IngressBanner:
 *   - memory cache → DB cache → LLM generation
 *   - Only generates when the user expands the section
 *   - Persists to CalendarSynthesis (period_type: "topic") for instant future loads
 *
 * @param {object} chart      - The chart entity (needs .id and .user_id)
 * @param {string} sectionKey - Unique key for this section, e.g. "stellium_Scorpio"
 * @param {string} prompt     - The full LLM prompt
 * @param {object} schema     - response_json_schema for the LLM call
 * @param {boolean} expanded  - Whether the parent section is expanded
 */
export function useDynamicsInterpretation(chart, sectionKey, prompt, schema, expanded) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const hasGenerated = useRef(false);

  const memKey = chart?.id ? `${chart.id}_${sectionKey}_v1` : null;
  const dbKey = `dynamics-${sectionKey}`;

  useEffect(() => {
    if (!sectionKey) return;
    setCacheChecked(false);

    // Memory cache — instant
    if (memKey && dynamicsCache[memKey]) {
      setReading(dynamicsCache[memKey]);
      hasGenerated.current = true;
      setCacheChecked(true);
      return;
    }

    // DB cache async
    if (chart?.user_id) {
      getCachedSynthesis('topic', dbKey, chart.user_id).then(cached => {
        if (cached) {
          if (memKey) dynamicsCache[memKey] = cached;
          setReading(cached);
          hasGenerated.current = true;
        } else {
          hasGenerated.current = false;
          setReading(null);
        }
        setCacheChecked(true);
      });
      return;
    }

    hasGenerated.current = false;
    setReading(null);
    setCacheChecked(true);
  }, [memKey, chart?.user_id, sectionKey]);

  const generate = useCallback(async () => {
    if (!prompt || !schema) return;
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
      });
      if (memKey) dynamicsCache[memKey] = result;
      setReading(result);
      if (chart?.user_id) {
        saveCachedSynthesis('topic', dbKey, chart.user_id, result, {
          summary: `Chart Dynamics: ${sectionKey}`,
        });
      }
    } catch (err) {
      console.error('Dynamics LLM error:', err);
    } finally {
      setLoading(false);
    }
  }, [prompt, schema, memKey, chart?.user_id, dbKey, sectionKey]);

  // Auto-generate when expanded and not yet generated
  useEffect(() => {
    if (!cacheChecked) return;
    if (!expanded) return;
    if (hasGenerated.current || loading) return;
    hasGenerated.current = true;
    generate();
  }, [cacheChecked, expanded, loading, generate]);

  const regenerate = useCallback(() => {
    if (memKey) delete dynamicsCache[memKey];
    clearMemCache('topic', dbKey, chart?.user_id);
    hasGenerated.current = false;
    setReading(null);
    generate();
  }, [memKey, dbKey, chart?.user_id, generate]);

  return { reading, loading, regenerate };
}