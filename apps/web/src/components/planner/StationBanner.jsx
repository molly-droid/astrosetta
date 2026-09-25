import React, { useState, useEffect, useRef } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { highlightSynthesisText, getChartRuler } from '@/lib/transitUtils';
import SignName from '@/components/ui/SignName';
import { Share2 } from 'lucide-react';
import { getCachedSynthesis, saveCachedSynthesis } from '@/lib/synthesisCache';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import ShareSheet from '@/components/share/ShareSheet';
import { buildStationCardData } from '@/lib/shareCard';

const PLANET_DURATIONS = {
  Mercury: 'about 3 weeks', Venus: 'about 6 weeks',
  Mars: 'about 2–2.5 months', Jupiter: 'about 4 months',
  Saturn: 'about 4–5 months', Uranus: 'about 5 months',
  Neptune: 'about 5–6 months', Pluto: 'about 5–6 months', Chiron: 'about 4–5 months',
};

const moduleCache = {};

export default function StationBanner({ stations, chart, stationAutoExpand }) {
  if (!stations?.length) return null;

  // Prioritize: exact stations first, then approaching by days_until
  const sorted = [...stations].sort((a, b) => {
    if (!a.approaching && b.approaching) return -1;
    if (a.approaching && !b.approaching) return 1;
    if (a.approaching && b.approaching) return (a.days_until || 99) - (b.days_until || 99);
    return 0;
  });

  return (
    <div className="space-y-2">
      {sorted.map((s, i) => (
        <StationCard key={`stn_${i}`} station={s} chart={chart} autoExpandKey={stationAutoExpand} />
      ))}
    </div>
  );
}

function StationCard({ station, chart, autoExpandKey }) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const hasGenerated = useRef(false);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Linked from a Today banner — auto-expand the matching station card
  useEffect(() => {
    if (autoExpandKey && autoExpandKey.split('#')[0] === station.planet) setExpanded(true);
  }, [autoExpandKey]);
  const dateKey = new Date().toLocaleDateString('en-CA');

  const cacheKey = chart?.id ? `${chart.id}_${dateKey}_${station.planet}_${station.type}_${station.approaching ? 'app' : 'exact'}_v1` : null;

  useEffect(() => {
    if (!dateKey || !station?.planet) return;
    setCacheChecked(false);
    const dbKey = `station-${dateKey}-${station.planet}-${station.type}-${station.approaching ? 'app' : 'exact'}`;

    if (cacheKey && moduleCache[cacheKey]) {
      setReading(moduleCache[cacheKey]);
      hasGenerated.current = true;
      setCacheChecked(true);
      return;
    }

    if (chart?.user_id) {
      getCachedSynthesis('ingress', dbKey, chart.user_id).then(cached => {
        if (cached) {
          if (cacheKey) moduleCache[cacheKey] = cached;
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
  }, [cacheKey, chart?.user_id]);

  useEffect(() => {
    if (!cacheChecked) return;
    if (!chart || hasGenerated.current || loading) return;
    if (!expanded) return;
    hasGenerated.current = true;
    generate();
  }, [chart, cacheKey, expanded, cacheChecked]);

  const generate = async () => {
    setLoading(true);
    const raw = chart?.raw_data || {};
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const natalPlanets = (raw.planets || [])
      .map(p => `${p.name} in ${p.sign} (House ${p.house}${p.retrograde ? ', Rx' : ''})`)
      .join('; ');

    const duration = PLANET_DURATIONS[station.planet] || 'several weeks';

    const natalMatches = (raw.planets || []).filter(p => p.sign === station.sign);
    const conjunctionNote = natalMatches.length
      ? `Natal planets in ${station.sign}: ${natalMatches.map(p => `${p.name} (House ${p.house})`).join(', ')} — the stationing planet will conjoin these.`
      : '';

    const ruler = getChartRuler(raw.ascendant_sign);
    const isChartRuler = !!(ruler && station.planet === ruler.planet);

    try {
      const result = await invokeLLMTask('station-reading', {
        dateStr,
        planet: station.planet,
        sign: station.sign,
        degree: station.degree,
        stationType: station.type,
        approaching: !!station.approaching,
        daysUntil: station.days_until,
        expectedDate: station.expected_date,
        sunSign: raw.sun_sign,
        natalMoonSign: raw.moon_sign,
        ascSign: raw.ascendant_sign,
        natalPlanets,
        conjunctionNote,
        duration,
        isChartRuler,
      });
      if (cacheKey) moduleCache[cacheKey] = result;
      setReading(result);
      if (chart?.user_id) {
        saveCachedSynthesis('ingress', `station-${dateKey}-${station.planet}-${station.type}-${station.approaching ? 'app' : 'exact'}`, chart.user_id, result, {
          date_start: dateKey,
          date_end: dateKey,
          summary: `${station.planet} stations ${station.type}`,
        });
      }
    } catch {
      // fallback
    }
    setLoading(false);
  };

  const glyph = PLANET_GLYPHS[station.planet] || '✦';
  const isRx = station.type === 'retrograde';
  const stationLabel = station.approaching
    ? `Approaching ${isRx ? 'Rx' : 'Direct'} Station`
    : `★ ${isRx ? 'Retrograde' : 'Direct'} Station`;

  const expectedDateLabel = (station.approaching && station.expected_date)
    ? new Date(station.expected_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const ruler = getChartRuler(chart?.raw_data?.ascendant_sign);
  const isChartRuler = ruler && station.planet === ruler.planet;

  const accentColor = isRx ? '#C9A961' : '#A8C8A8';
  const bgColor = isRx ? 'rgba(107,68,35,0.12)' : 'rgba(168,200,168,0.10)';
  const borderColor = isRx ? 'rgba(107,68,35,0.40)' : 'rgba(168,200,168,0.35)';

  return (
    <div className="celestial-card overflow-hidden" style={{ borderColor }}>
      <CollapsibleCardHeader
        icon={<span className="text-lg" style={{ color: accentColor, fontVariantEmoji: 'text' }}>{glyph}</span>}
        title={`${station.planet} stations ${isRx ? 'retrograde ℞' : 'direct ↗'}`}
        subtitle={<>{stationLabel} · {station.degree?.toFixed(1)}° <SignName sign={station.sign} />{station.approaching && expectedDateLabel && <> · est. {expectedDateLabel}</>}{!station.approaching && <> · today</>}</>}
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(!expanded)}
        rightExtra={isChartRuler ? (
          <span className="px-1.5 py-0.5 rounded-full bg-gold-primary/20 border border-gold-accent/40 text-gold-accent font-semibold text-[9px] whitespace-nowrap">⭐ Chart Ruler</span>
        ) : null}
      />

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t" style={{ borderColor }}>
          {loading && (
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              <span className="text-lg animate-pulse" style={{ color: accentColor }}>{glyph}</span>
              <p className="font-body text-xs text-brass italic">Reading the station...</p>
            </div>
          )}

          {reading && (
            <>
              {reading.headline && (
                <p className="font-display text-sm font-bold" style={{ color: accentColor }}>{reading.headline}</p>
              )}
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1">Collective</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.collective)}</p>
              </div>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1">Personal · Your Chart</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.personal)}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1">✦ Work With This</p>
                <p className="font-body text-xs text-gold-primary leading-relaxed">{highlightSynthesisText(reading.ritual)}</p>
              </div>
              <button
                onClick={() => setShareCard(buildStationCardData(station, dateStr))}
                className="flex items-center gap-1.5 self-start font-body text-[10px] text-brass/60 hover:text-gold-accent transition-colors pt-1"
              >
                <Share2 size={11} /> Share this station
              </button>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename={`astrosetta-${station.planet}-station`} textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}