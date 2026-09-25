import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import PlanetaryHighlights from './PlanetaryHighlights';

const cache = {};

// Aggregates stations + ingresses across a date range (sampled for large ranges),
// dedupes by planet/sign/type, and renders PlanetaryHighlights for the period.
export default function PeriodHighlights({ dates, chart }) {
  const [agg, setAgg] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sample to limit API calls for long ranges (e.g. a month)
  const sampled = dates.length <= 8 ? dates : dates.filter((_, i) => i % 5 === 0 || i === dates.length - 1);
  const key = chart?.id + '_' + (sampled[0]?.toLocaleDateString('en-CA')) + '_' + sampled.length;

  useEffect(() => {
    if (!chart?.raw_data) return;
    if (cache[key]) { setAgg(cache[key]); return; }
    setLoading(true);
    const raw = chart.raw_data;
    const utcOffset = raw.utc_offset ?? 0;
    const fetch = (dk) => base44.functions.invoke('chartCalculator', {
      chart_type: 'transit', birth_date: raw.birth_date, birth_time: raw.birth_time,
      birth_location: raw.birth_location, transit_date: dk, transit_time: '12:00:00',
      utc_offset: utcOffset, natal_planets_override: raw.planets || [], house_system: raw.house_system || 'whole_sign',
    }).then(r => r.data).catch(() => null);

    Promise.all(sampled.map(d => {
      const dk = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString('en-CA');
      return fetch(dk);
    })).then(results => {
      const stationMap = new Map();
      const ingressMap = new Map();
      results.forEach(res => {
        if (!res) return;
        (res.stations || []).forEach(s => {
          const k = `${s.planet}_${s.type}_${s.sign}`;
          if (!stationMap.has(k)) stationMap.set(k, s);
        });
        (res.ingresses || []).forEach(ing => {
          const k = `${ing.planet}_${ing.to_sign}_${ing.from_sign}`;
          if (!ingressMap.has(k)) ingressMap.set(k, ing);
        });
      });
      const out = { stations: Array.from(stationMap.values()), ingresses: Array.from(ingressMap.values()) };
      cache[key] = out;
      setAgg(out);
      setLoading(false);
    });
  }, [key]);

  if (loading && !agg) {
    return (
      <div className="flex items-center justify-center py-6 gap-2">
        <Loader2 size={14} className="animate-spin text-gold-primary/60" />
        <span className="font-body text-xs text-brass/50 italic">Gathering highlights…</span>
      </div>
    );
  }

  if (!agg || (agg.stations.length === 0 && agg.ingresses.length === 0)) {
    return (
      <div className="celestial-card p-4 text-center">
        <p className="font-body text-xs text-brass/50 italic">No major planetary highlights in this period.</p>
      </div>
    );
  }

  return <PlanetaryHighlights stations={agg.stations} ingresses={agg.ingresses} chart={chart} />;
}