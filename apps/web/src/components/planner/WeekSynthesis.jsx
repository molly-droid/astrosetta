import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, Sparkles, ChevronDown, ChevronRight, RefreshCw, Lightbulb, Share2 } from 'lucide-react';
import { formatTransitLabelProse as formatTransitLabel, highlightSynthesisText } from '@/lib/transitUtils';
import { getMoonPhaseName } from '@/lib/moonPhase';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { fetchExplanation } from '@/lib/explainIt';
import ShareSheet from '@/components/share/ShareSheet';
import { buildRisingSignCardData, formatCollectiveContext } from '@/lib/shareCard';
import SynthesisCategoryCard from '@/components/planner/SynthesisCategoryCard';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import GatedFeature from '@/components/paywall/GatedFeature';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CACHE_VERSION = 'v11';

// Approximate sun/moon longitudes for moon phase detection
function dateToJD(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + d + 1721013.5;
}
function sunLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T;
  const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
  return ((L0 + (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M)) % 360 + 360) % 360;
}
function moonLon(jd) {
  const T = (jd - 2451545) / 36525;
  const L = 218.3164477 + 481267.88123421 * T;
  const Mp = (134.9633964 + 477198.8675055 * T) * Math.PI / 180;
  const F = (93.2720950 + 483202.0175233 * T) * Math.PI / 180;
  return (((L + 6.289 * Math.sin(Mp) - 1.274 * Math.sin(2 * F - Mp) + 0.658 * Math.sin(2 * F) - 0.214 * Math.sin(2 * Mp)) % 360) + 360) % 360;
}
function getMoonPhaseEmoji(date) {
  const jd = dateToJD(date);
  const diff = ((moonLon(jd) - sunLon(jd)) + 360) % 360;
  if (diff < 6 || diff >= 354) return '🌑'; // New Moon (exact, ~12hr window)
  if (diff >= 174 && diff < 186) return '🌕'; // Full Moon (exact, ~12hr window)
  return null;
}

// Module-level cache: `${chartId}_${weekKey}` → result
const weekSynthesisCache = {};

export default function WeekSynthesis({ days, chart }) {
  const { knowledgeDepth } = useUserPrefs();
  const { user } = useAuth();
  const { canViewPeriodSynthesis, tier } = usePermissions(user);
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const hasGenerated = useRef(false);
  const shareContextRef = useRef('');
  const weekKey = days?.[0]?.toISOString?.()?.split('T')[0];
  const cacheKey = chart?.id && weekKey ? `${CACHE_VERSION}_${chart.id}_${weekKey}` : null;
  const dbKey = weekKey ? `week-${CACHE_VERSION}-${weekKey}` : null;
  const weekRange = days && days.length
    ? `${days[0].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} – ${days[days.length - 1].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}`
    : '';
  const highlightOnWhite = (text) => highlightSynthesisText(text, null, 'text-gold-primary');

  useEffect(() => {
    if (!weekKey) return;

    // Check memory cache first
    if (cacheKey && weekSynthesisCache[cacheKey]) {
      setSynthesis(weekSynthesisCache[cacheKey]);
      hasGenerated.current = true;
      return;
    }

    // Check DB cache async
    if (chart?.user_id) {
      getCachedSynthesis('week', dbKey, chart.user_id).then(cached => {
        if (cached) {
          if (cacheKey) weekSynthesisCache[cacheKey] = cached;
          setSynthesis(cached);
          hasGenerated.current = true;
        } else {
          hasGenerated.current = false;
          setSynthesis(null);
          setExpanded(false);
        }
      });
      return;
    }

    hasGenerated.current = false;
    setSynthesis(null);
    setExpanded(false);
  }, [weekKey, chart?.user_id]);

  useEffect(() => {
    if (!canViewPeriodSynthesis || !chart || !days?.length || hasGenerated.current || loading) return;
    hasGenerated.current = true;
    generate();
  }, [chart, weekKey, canViewPeriodSynthesis]);

  // Reset "Explain it" panel when the week changes
  useEffect(() => {
    setExplainOpen(false);
    setExplainText(null);
    setExplainLoading(false);
  }, [weekKey]);

  if (!canViewPeriodSynthesis) {
    return (
      <GatedFeature
        variant="interpret"
        fromTier={tier}
        context="weekly synthesis"
        title="Unlock your week-ahead synthesis"
        description="Get a day-by-day forecast with best days, key themes, and maximize, focus, and watch guidance for the week."
        ctaLabel="Unlock Core — $5.55/mo"
      />
    );
  }

  const generate = async () => {
    if (!chart || !days?.length) return;
    setLoading(true);

    const raw = chart.raw_data || {};
    const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);

    // Fetch transits for each day of the week in parallel
    const results = await Promise.all(
      days.map(d =>
        base44.functions.invoke('chartCalculator', {
          chart_type: 'transit',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time,
          birth_location: raw.birth_location,
          transit_date: d.toISOString().split('T')[0],
          transit_time: '12:00:00',
          house_system: raw.house_system || 'whole_sign',
        }).then(r => r.data).catch(() => null)
      )
    );

    // Build per-day context
    const dayContexts = days.map((d, i) => {
      const res = results[i];
      if (!res) return `${DOW_SHORT[d.getDay()]}: no data`;

      const moon = res.transit_planets?.find(p => p.name === 'Moon');
      const sun = res.transit_planets?.find(p => p.name === 'Sun');
      let moonPhase = '';
      if (moon && sun) {
        moonPhase = getMoonPhaseName(moon.longitude, sun.longitude);
        if (moonPhase !== 'New Moon' && moonPhase !== 'Full Moon') moonPhase = '';
      }

      const personalAspects = (res.transit_aspects || [])
        .filter(a => SLOW.has(a.transit_planet) && a.orb <= 2.5)
        .map(a => `${a.transit_planet} ${a.aspect} ${a.natal_planet}`);

      const moonInfo = moon ? `Moon in ${moon.sign}${moonPhase ? ` (${moonPhase})` : ''}` : '';
      // Use freshly calculated natal planets from the response (correct houses)
      const natalPls = res.natal?.planets || raw.planets || [];
      const tPls = res.transit_planets || [];
      const fmtAspects = (res.transit_aspects || [])
        .filter(a => SLOW.has(a.transit_planet) && a.orb <= 2.5)
        .map(a => formatTransitLabel(a, tPls, natalPls, false));
      const aspectInfo = fmtAspects.length ? fmtAspects.join(', ') : 'no major personal aspects';

      return `${DOW_SHORT[d.getDay()]} ${d.getDate()}: ${moonInfo}. ${aspectInfo}`;
    });

    const firstDayPlanets = results[0]?.transit_planets || [];
    const transitPositions = firstDayPlanets
      .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
      .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
      .join(', ');

    // Collective context for the shareable rising-sign card
    shareContextRef.current = formatCollectiveContext({
      ingresses: results[0]?.ingresses || [],
      stations: results[0]?.stations || [],
      mundaneAspects: [],
      moonSign: firstDayPlanets.find(p => p.name === 'Moon')?.sign,
      isExactFullMoon: false,
      isExactNewMoon: false,
    });

    const result = await invokeLLMTask('week-synthesis', {
      weekRange,
      sunSign: raw.sun_sign,
      natalMoonSign: raw.moon_sign,
      ascSign: raw.ascendant_sign,
      transitPositions,
      dailyTransits: dayContexts.join('\n'),
    });

    if (cacheKey) weekSynthesisCache[cacheKey] = result;
    setSynthesis(result);
    setLoading(false);
    // Persist to DB for instant future loads
    if (chart?.user_id && dbKey) {
      saveCachedSynthesis('week', dbKey, chart.user_id, result, {
        date_start: weekKey,
        date_end: days?.[6]?.toISOString?.()?.split('T')[0] || weekKey,
        summary: `Week at a Glance · ${days?.[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days?.[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      });
    }
  };

  const explainContext = synthesis ? [
    synthesis.overview,
    ...(Object.values(synthesis.day_sentences || {})),
    synthesis.maximize && `Maximize: ${synthesis.maximize}`,
    synthesis.focus && `Focus: ${synthesis.focus}`,
    synthesis.watch && `Watch: ${synthesis.watch}`,
  ].filter(Boolean).join('\n') : '';

  const handleExplain = async () => {
    if (explainOpen) { setExplainOpen(false); return; }
    setExplainOpen(true);
    if (explainText) return;
    setExplainLoading(true);
    try {
      const res = await fetchExplanation(explainContext, knowledgeDepth);
      setExplainText(res);
    } catch { /* non-critical */ }
    setExplainLoading(false);
  };

  const handleShare = async () => {
    const ascSign = chart?.raw_data?.ascendant_sign || chart?.ascendant_sign;
    if (!ascSign || shareLoading) return;
    setShareLoading(true);
    try {
      const res = await base44.functions.invoke('generateRisingSignCard', {
        sign: ascSign,
        dateKey: weekKey,
        dateStr: weekRange,
        collectiveContext: shareContextRef.current || '',
      });
      setShareCard(buildRisingSignCardData(ascSign, res.data, weekRange));
    } catch { /* non-critical */ }
    setShareLoading(false);
  };

  return (
    <div className="celestial-card overflow-hidden">
      <button
        onClick={() => synthesis && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <Sparkles size={14} className="text-gold-accent flex-shrink-0" />
          <span className="font-display text-sm font-semibold text-white">Week at a Glance</span>
          {synthesis?.best_areas?.map((area, i) => (
            <span key={i} className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-gold-primary/15 text-brass">{area}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {loading && <Loader2 size={14} className="animate-spin text-gold-primary" />}
          {synthesis && (expanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />)}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gold-primary/20">
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">✦</div>
              <p className="font-body text-xs text-brass italic">Reading the week ahead...</p>
            </div>
          )}

          {synthesis && (
            <>
              <p className="font-body text-sm text-white/90 leading-relaxed pt-2">{highlightSynthesisText(synthesis.overview)}</p>

              {synthesis.best_days?.length > 0 && (
                <p className="font-body text-xs text-brass/60">
                  ✦ Best days: <span className="text-gold-accent font-semibold">{synthesis.best_days.join(' & ')}</span>
                </p>
              )}

              {/* Day-by-day sentences */}
              <div className="space-y-1.5">
                {days.map((d, i) => {
                  const sentence = synthesis.day_sentences?.[String(i)];
                  const isToday = d.toDateString() === new Date().toDateString();
                  const moonEmoji = getMoonPhaseEmoji(d);
                  const isNewMoon = moonEmoji === '🌑';
                  return (
                    <div key={i} className={`flex gap-2 items-center rounded-lg px-2 py-1.5 ${isToday ? 'bg-gold-primary/10' : ''}`}>
                      <div className="flex flex-col items-center shrink-0 w-7">
                        <span className={`font-body text-[10px] uppercase tracking-widest ${isToday ? 'text-gold-accent font-bold' : 'text-brass/50'}`}>
                          {DOW_SHORT[d.getDay()]}
                        </span>
                        {moonEmoji && (
                          <span
                            className="text-sm leading-none"
                            style={isNewMoon ? { filter: 'drop-shadow(0 0 5px rgba(212,175,133,0.8)) drop-shadow(0 0 2px rgba(255,255,255,0.6))' } : {}}
                          >
                            {moonEmoji}
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs text-white/80 leading-relaxed flex-1">{highlightSynthesisText(sentence || '—')}</p>
                    </div>
                  );
                })}
              </div>

              {['maximize', 'focus', 'watch'].map(cat => (
                <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
              ))}

              {explainOpen && (explainLoading || explainText) && (
                <div className="rounded-lg border border-gold-primary/20 bg-gold-primary/5 p-3">
                  {explainLoading ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 size={11} className="animate-spin text-gold-primary" />
                      <span className="font-body text-[10px] text-brass italic">Simplifying...</span>
                    </div>
                  ) : (
                    <p className="font-body text-xs text-white/85 leading-snug">{highlightOnWhite(explainText)}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-gold-primary/15">
                <button onClick={handleExplain}
                  className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-gold-accent transition-colors">
                  {explainLoading ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />} Explain it
                </button>
                <button
                  onClick={() => { if (cacheKey) delete weekSynthesisCache[cacheKey]; clearMemCache('week', dbKey, chart?.user_id); hasGenerated.current = false; generate(); }}
                  className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-brass transition-colors"
                >
                  <RefreshCw size={10} /> Regenerate
                </button>
                <button onClick={handleShare}
                  className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-gold-accent transition-colors">
                  {shareLoading ? <Loader2 size={10} className="animate-spin" /> : <Share2 size={10} />} Share
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename="astrosetta-week" textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}