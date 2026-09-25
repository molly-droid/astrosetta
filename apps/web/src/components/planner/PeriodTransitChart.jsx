import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import ChartWheel from '@/components/chart/ChartWheel';
import ManageChartViewLink from '@/components/chart/ManageChartViewLink';

// Cache keyed by chart + start/end date
const cache = {};

export default function PeriodTransitChart({ startDate, endDate, chart, periodLabel = 'this period' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const startKey = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).toLocaleDateString('en-CA');
  const endKey = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).toLocaleDateString('en-CA');
  const cacheKey = chart?.id ? `${chart.id}_${startKey}_${endKey}` : null;

  useEffect(() => {
    if (!chart?.raw_data) return;
    if (cacheKey && cache[cacheKey]) { setData(cache[cacheKey]); return; }
    setLoading(true);
    const raw = chart.raw_data;
    const utcOffset = raw.utc_offset ?? 0;
    const fetch = (dk) => base44.functions.invoke('chartCalculator', {
      chart_type: 'transit', birth_date: raw.birth_date, birth_time: raw.birth_time,
      birth_location: raw.birth_location, transit_date: dk, transit_time: '12:00:00',
      utc_offset: utcOffset, natal_planets_override: raw.planets || [], house_system: raw.house_system || 'whole_sign',
    }).then(r => r.data).catch(() => null);

    Promise.all([fetch(startKey), fetch(endKey)]).then(([sRes, eRes]) => {
      const result = {
        start: sRes ? { planets: sRes.transit_planets || [], transit_aspects: sRes.transit_aspects || [] } : null,
        end: eRes ? { planets: eRes.transit_planets || [], transit_aspects: eRes.transit_aspects || [] } : null,
      };
      if (cacheKey) cache[cacheKey] = result;
      setData(result);
      setLoading(false);
    });
  }, [cacheKey]);

  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-8 gap-2">
        <Loader2 size={16} className="animate-spin text-gold-primary/60" />
        <span className="font-body text-xs text-brass/50 italic">Mapping transits…</span>
      </div>
    );
  }

  return (
    <div className="px-2">
      <div className="flex justify-center pt-6 pb-8">
        <div className="w-full max-w-[380px]">
          <ChartWheel chartData={chart.raw_data} transitData={data?.start} transitEndData={data?.end} periodLabel={periodLabel} />
        </div>
      </div>
      <div className="flex justify-center -mt-4 pb-2">
        <ManageChartViewLink />
      </div>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: '#7dd49a' }} />
          <span className="font-body text-[10px] text-brass/70">{startLabel} → {endLabel}</span>
        </div>
      </div>
    </div>
  );
}