import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, Sparkles, ChevronDown, ChevronRight, RefreshCw, Globe, Lightbulb, Share2 } from 'lucide-react';
import { highlightSynthesisText } from '@/lib/transitUtils';
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

// Match the Day view's text styling: gold body → white highlights, white body → gold highlights
const highlightOnGold = (text) => highlightSynthesisText(text, null, 'text-white');
const highlightOnWhite = (text) => highlightSynthesisText(text, null, 'text-gold-primary');

export default function MonthSynthesis({ date, chart }) {
  const { knowledgeDepth } = useUserPrefs();
  const { user } = useAuth();
  const { canViewPeriodSynthesis, tier } = usePermissions(user);
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const hasGenerated = useRef(false);
  const shareContextRef = useRef('');
  const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
  const periodKey = `month-v11-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    // Check memory cache first — handled by DB check below
    // Check DB cache async
    if (chart?.user_id) {
      getCachedSynthesis('month', periodKey, chart.user_id).then(cached => {
        if (cached) {
          setSynthesis(cached);
          hasGenerated.current = true;
        } else {
          hasGenerated.current = false;
          setSynthesis(null);
          setExpanded(false);
          setActiveTab('personal');
        }
      });
      return;
    }
    hasGenerated.current = false;
    setSynthesis(null);
    setExpanded(false);
    setActiveTab('personal');
  }, [monthKey, chart?.user_id]);

  useEffect(() => {
    if (chart && !hasGenerated.current && !loading && expanded) {
      hasGenerated.current = true;
      generate();
    }
  }, [chart, monthKey, expanded]);

  // Reset "Explain it" panel when the month changes
  useEffect(() => {
    setExplainOpen(false);
    setExplainText(null);
    setExplainLoading(false);
  }, [monthKey]);

  if (!canViewPeriodSynthesis) {
    return (
      <GatedFeature
        variant="interpret"
        fromTier={tier}
        context="monthly synthesis"
        title="Unlock your month-ahead synthesis"
        description="Get a month-at-a-glance forecast with best areas, key themes, and maximize, focus, and watch guidance for the whole month."
        ctaLabel="Unlock Core — $5.55/mo"
      />
    );
  }

  const generate = async () => {
    if (!chart) return;
    setLoading(true);

    const raw = chart.raw_data || {};
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Sample the 1st and 15th of the month to capture slow planets + any lunations
    let planetContext = '';
    let lunarEvents = [];
    let freshNatal = null;
    try {
      const [res1, res15] = await Promise.all([
        base44.functions.invoke('chartCalculator', {
          chart_type: 'transit',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time,
          birth_location: raw.birth_location,
          transit_date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          transit_time: '12:00:00',
          house_system: raw.house_system || 'whole_sign',
        }),
        base44.functions.invoke('chartCalculator', {
          chart_type: 'transit',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time,
          birth_location: raw.birth_location,
          transit_date: `${year}-${String(month + 1).padStart(2, '0')}-15`,
          transit_time: '12:00:00',
          house_system: raw.house_system || 'whole_sign',
        }),
      ]);

      const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);
      const planets1 = res1.data?.transit_planets || [];
      const planets15 = res15.data?.transit_planets || [];
      // Capture freshly calculated natal planets (correct houses for current house system)
      freshNatal = res1.data?.natal?.planets || res15.data?.natal?.planets || null;

      const slowPositions = planets1
        .filter(p => SLOW.has(p.name))
        .map(p => `${p.name} in ${p.sign}${p.retrograde ? ' Rx' : ''}`)
        .join(', ');

      // Authoritative transit positions — the LLM must use THESE signs, never its own knowledge
      const transitPositions = planets1
        .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
        .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°${p.retrograde ? ' Rx' : ''}`)
        .join(', ');

      // Personal aspects active at start and mid-month
      const aspects1 = (res1.data?.transit_aspects || [])
        .filter(a => SLOW.has(a.transit_planet))
        .map(a => `${a.transit_planet} ${a.aspect} ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
      const aspects15 = (res15.data?.transit_aspects || [])
        .filter(a => SLOW.has(a.transit_planet))
        .map(a => `${a.transit_planet} ${a.aspect} ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
      const allAspects = [...new Set([...aspects1, ...aspects15])];

      // Detect lunations in both samples
      const getMoonPhase = (planets) => {
        const moon = planets.find(p => p.name === 'Moon');
        const sun = planets.find(p => p.name === 'Sun');
        if (!moon || !sun) return null;
        const phase = getMoonPhaseName(moon.longitude, sun.longitude);
        if (phase === 'New Moon') return `New Moon in ${moon.sign}`;
        if (phase === 'Full Moon') return `Full Moon in ${moon.sign}`;
        return null;
      };
      const lun1 = getMoonPhase(planets1);
      const lun15 = getMoonPhase(planets15);
      lunarEvents = [lun1, lun15].filter(Boolean);

      planetContext = `Slow planet positions this month: ${slowPositions}\nActive personal transits: ${allAspects.join('; ') || 'none exact'}\nLunations: ${lunarEvents.join(', ') || 'none at sample dates'}`;
      planetContext += `\nAUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are): ${transitPositions || 'Data unavailable.'}`;

      // Collective context for the shareable rising-sign card
      shareContextRef.current = formatCollectiveContext({
        ingresses: res1.data?.ingresses || [],
        stations: res1.data?.stations || [],
        mundaneAspects: [],
        moonSign: planets1.find(p => p.name === 'Moon')?.sign,
        isExactFullMoon: lunarEvents.some(e => e.startsWith('Full Moon')),
        isExactNewMoon: lunarEvents.some(e => e.startsWith('New Moon')),
      });
    } catch (_) {
      planetContext = 'Planetary data unavailable.';
    }

    // Use freshly calculated natal planets from the chartCalculator response (correct houses)
    const natalPlanets = (freshNatal || raw.planets || [])
      .map(p => `${p.name} in ${p.sign} (House ${p.house})`)
      .join('; ');

    const result = await invokeLLMTask('month-synthesis', {
      monthName,
      sunSign: raw.sun_sign,
      natalMoonSign: raw.moon_sign,
      ascSign: raw.ascendant_sign,
      natalPlanets,
      planetContext,
    });
    setSynthesis(result);
    setLoading(false);
    // Persist to DB for instant future loads
    if (chart?.user_id) {
      saveCachedSynthesis('month', periodKey, chart.user_id, result, {
        date_start: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
        date_end: `${date.getFullYear()}-${String(date.getMonth() + 2).padStart(2, '0')}-01`,
        summary: `Month at a Glance · ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      });
    }
  };

  // Tags shown in header depend on active tab
  const headerTags = synthesis
    ? (activeTab === 'personal' ? synthesis.best_areas : (synthesis.collective_tags || []))
    : [];

  const explainContext = synthesis ? [
    synthesis.overview,
    synthesis.personal_focus,
    synthesis.collective_theme,
    ...(synthesis.maximize || []),
    synthesis.focus,
    ...(synthesis.watch || []),
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
      const monthDateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const res = await base44.functions.invoke('generateRisingSignCard', {
        sign: ascSign,
        dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        dateStr: monthDateStr,
        collectiveContext: shareContextRef.current || '',
      });
      setShareCard(buildRisingSignCardData(ascSign, res.data, monthDateStr));
    } catch { /* non-critical */ }
    setShareLoading(false);
  };

  return (
    <div className="celestial-card overflow-hidden">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles size={14} className="text-gold-accent flex-shrink-0" />
            <span className="font-display text-sm font-semibold text-white">Month at a Glance</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {loading && <Loader2 size={14} className="animate-spin text-gold-primary" />}
            {synthesis && (expanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />)}
          </div>
        </div>
        {headerTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
            {headerTags.map((tag, i) => (
              <span key={i} className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-gold-primary/15 text-brass">{tag}</span>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gold-primary/20">
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">✦</div>
              <p className="font-body text-xs text-brass italic">Reading the month ahead...</p>
            </div>
          )}

          {synthesis && (
            <>
              {/* Personal / Collective tabs */}
              <div className="flex border-b border-white/[0.06]">
                <button
                  onClick={() => setActiveTab('personal')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                    activeTab === 'personal'
                      ? 'border-gold-accent text-white font-semibold'
                      : 'border-transparent text-white/35 hover:text-white/60'
                  }`}
                >
                  <Sparkles size={11} /> Personal
                </button>
                <button
                  onClick={() => setActiveTab('collective')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                    activeTab === 'collective'
                      ? 'border-gold-accent text-white font-semibold'
                      : 'border-transparent text-white/35 hover:text-white/60'
                  }`}
                >
                  <Globe size={11} /> Collective
                </button>
              </div>

              <div className="px-4 pb-4 pt-3 space-y-3">
                {activeTab === 'personal' && (
                  <>
                    <p className="font-body text-sm text-white/90 leading-relaxed">{highlightOnWhite(synthesis.overview)}</p>
                    {synthesis.personal_focus && (
                      <p className="font-body text-xs text-white/80 leading-relaxed border-l-2 border-celestial-blue/50 pl-3 italic">
                        {highlightOnWhite(synthesis.personal_focus)}
                      </p>
                    )}
                    {synthesis.best_areas?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {synthesis.best_areas.map((a, i) => (
                          <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full bg-gold-primary/15 border border-gold-primary/30 text-brass">{a}</span>
                        ))}
                      </div>
                    )}
                    {['maximize', 'focus', 'watch'].map(cat => (
                      <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
                    ))}
                  </>
                )}

                {activeTab === 'collective' && (
                  <>
                    {synthesis.collective_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {synthesis.collective_tags.map((tag, i) => (
                          <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full bg-celestial-blue/15 border border-celestial-blue/30 text-celestial-blue">{tag}</span>
                        ))}
                      </div>
                    )}
                    {synthesis.collective_theme && (
                      <p className="font-body text-sm text-white/85 leading-relaxed">
                        {highlightOnWhite(synthesis.collective_theme)}
                      </p>
                    )}
                  </>
                )}

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
                    onClick={() => { clearMemCache('month', periodKey, chart?.user_id); hasGenerated.current = false; generate(); }}
                    className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-brass transition-colors"
                  >
                    <RefreshCw size={10} /> Regenerate
                  </button>
                  <button onClick={handleShare}
                    className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-gold-accent transition-colors">
                    {shareLoading ? <Loader2 size={10} className="animate-spin" /> : <Share2 size={10} />} Share
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename="astrosetta-month" textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}