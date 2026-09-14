import { useState, useEffect, useRef } from 'react';
import { buildCompositeChartObject, fetchCompositeTransits } from '@/lib/compositeSynthesis';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';

/**
 * Fetches transits TO the composite chart (relationship as one entity) for a
 * given date, so the Planner can overlay them on the composite chart wheel —
 * mirroring how the personal Day view overlays `dayTransitData` on the natal
 * wheel. Reuses fetchCompositeTransits (user chart as the date shell, composite
 * planets as the natal override) so aspects hit the relationship, not either
 * person. Honors user-level hidden chart points.
 */
export function useCompositeTransits(date, userChart, partnerChart, user) {
  const [transits, setTransits] = useState(null);
  const [loading, setLoading] = useState(false);
  const hidden = getHiddenChartPoints(user);
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const lastKey = useRef('');

  useEffect(() => {
    if (!userChart || !partnerChart) return;
    if (!userChart?.raw_data?.birth_date || !partnerChart?.raw_data?.planets?.length) return;
    const key = `${dateKey}_${partnerChart.id}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Build composite raw so planets match the wheel exactly (hidden-filtered).
      const compositeObj = buildCompositeChartObject(userChart, partnerChart, hidden);
      if (!compositeObj?.raw_data) { if (!cancelled) { setTransits(null); setLoading(false); } return; }
      try {
        const t = await fetchCompositeTransits(date, compositeObj.raw_data, userChart, hidden);
        if (!cancelled) setTransits(t);
      } catch {
        if (!cancelled) setTransits(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, partnerChart?.id, userChart?.id]);

  return { transits, loading };
}