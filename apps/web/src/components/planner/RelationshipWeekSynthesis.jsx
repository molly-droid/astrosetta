import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, ChevronDown, ChevronRight, RefreshCw, Heart, CalendarDays } from 'lucide-react';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { getMoonPhaseEmoji } from '@/lib/moonPhase';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';
import SynthesisCategoryCard from '@/components/planner/SynthesisCategoryCard';
import {
  fetchTransitsForChart,
  fetchNatalCrossAspects,
  buildWeekPrompt,
  WEEK_SCHEMA,
} from '@/lib/relationshipSynthesis';
import { useAuth } from '@/lib/AuthContext';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';

const CACHE_VERSION = 'rel-v1';
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekSynthesisCache = {};

const highlightOnGold = (t) => highlightSynthesisText(t, null, 'text-white');
const highlightOnWhite = (t) => highlightSynthesisText(t, null, 'text-gold-primary');

export default function RelationshipWeekSynthesis({ days, userChart, partnerChart, userId }) {
  const partnerName = partnerChart?.name || 'your partner';
  const weekKey = days?.[0]?.toISOString?.()?.split('T')[0];
  const cacheKey = partnerChart?.id && weekKey ? `${CACHE_VERSION}_${partnerChart.id}_${weekKey}` : null;
  const dbKey = weekKey ? `week-${CACHE_VERSION}-${weekKey}-${partnerChart?.id}` : null;
  const weekLabel = days && days.length
    ? `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [synthTab, setSynthTab] = useState('personal');
  const hasGenerated = useRef(false);

  useEffect(() => {
    if (!weekKey || !partnerChart?.id) return;
    if (cacheKey && weekSynthesisCache[cacheKey]) {
      setSynthesis(weekSynthesisCache[cacheKey]);
      hasGenerated.current = true;
      return;
    }
    if (userId) {
      getCachedSynthesis('week', dbKey, userId, partnerChart.id).then((cached) => {
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
    }
  }, [weekKey, partnerChart?.id, userId]);

  useEffect(() => {
    if (!partnerChart || !days?.length || hasGenerated.current || loading) return;
    if (!expanded) return;
    hasGenerated.current = true;
    generate();
  }, [expanded, weekKey, partnerChart?.id]);

  const generate = async () => {
    if (!partnerChart || !days?.length) return;
    setLoading(true);
    try {
      // Transits to each chart for each day + the static natal cross-aspects (once)
      const userDayTransits = await Promise.all(days.map((d) => fetchTransitsForChart(d, userChart)));
      const partnerDayTransits = await Promise.all(days.map((d) => fetchTransitsForChart(d, partnerChart)));
      const crossAspects = await fetchNatalCrossAspects(userChart, partnerChart);
      const prompt = buildWeekPrompt({ days, userChart, partnerChart, userDayTransits, partnerDayTransits, crossAspects });
      const result = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: WEEK_SCHEMA });
      if (cacheKey) weekSynthesisCache[cacheKey] = result;
      setSynthesis(result);
      if (userId && dbKey) {
        saveCachedSynthesis('week', dbKey, userId, result, {
          target_chart_id: partnerChart.id,
          date_start: weekKey,
          date_end: days[6]?.toISOString?.()?.split('T')[0] || weekKey,
          summary: `Week at a Glance · with ${partnerName}`,
        });
      }
    } catch { /* non-critical */ }
    setLoading(false);
  };

  return (
    <div className="celestial-card overflow-hidden">
      <button onClick={() => setExpanded((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Heart size={14} className="text-celestial-pink flex-shrink-0" />
          <span className="font-display text-sm font-semibold text-white">Week at a Glance · with {partnerName}</span>
          <span className="font-body text-[10px] text-brass/40">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {loading && <Loader2 size={14} className="animate-spin text-gold-primary" />}
          {synthesis && (expanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />)}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gold-primary/20">
          {loading && !synthesis && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">✦</div>
              <p className="font-body text-xs text-brass italic">Reading the relationship week...</p>
            </div>
          )}
          {synthesis && (
            <>
              <div className="flex border-b border-white/[0.06]">
                {[
                  { key: 'personal', label: 'The Bond' },
                  { key: 'collective', label: 'Collective' },
                ].map((t) => (
                  <button key={t.key} onClick={() => setSynthTab(t.key)} className={`flex-1 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${synthTab === t.key ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/35 hover:text-white/60'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {synthTab === 'personal' && (
                <>
                  <p className="font-body text-sm text-white/90 leading-relaxed pt-2">{highlightOnWhite(synthesis.overview)}</p>
                  {synthesis.relationship_focus && (
                    <div className="rounded-lg border border-celestial-pink/30 bg-celestial-pink/10 p-3">
                      <p className="font-body text-[10px] uppercase tracking-widest font-semibold mb-1.5 text-celestial-pink">
                        <Heart size={11} className="inline mr-1" /> Relationship Focus
                      </p>
                      <p className="font-body text-xs leading-snug text-white">{highlightOnWhite(synthesis.relationship_focus)}</p>
                    </div>
                  )}
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
                  {['maximize', 'focus', 'watch'].map((cat) => (
                    <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
                  ))}
                </>
              )}
              {synthTab === 'collective' && (
                <>
                  {synthesis.collective_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {synthesis.collective_tags.map((tag, i) => (
                        <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full bg-celestial-blue/15 border border-celestial-blue/30 text-celestial-blue">{tag}</span>
                      ))}
                    </div>
                  )}
                  {synthesis.collective_theme && (
                    <p className="font-body text-sm text-white/85 leading-relaxed">{highlightOnWhite(synthesis.collective_theme)}</p>
                  )}
                </>
              )}

              {/* Day-by-day sentences */}
              <div className="space-y-1.5 pt-1">
                {days.map((d, i) => {
                  const sentence = synthesis.day_sentences?.[String(i)];
                  const isToday = d.toDateString() === new Date().toDateString();
                  const moonEmoji = getMoonPhaseEmoji(d);
                  return (
                    <div key={i} className={`flex gap-2 items-center rounded-lg px-2 py-1.5 ${isToday ? 'bg-gold-primary/10' : ''}`}>
                      <div className="flex flex-col items-center shrink-0 w-7">
                        <span className={`font-body text-[10px] uppercase tracking-widest ${isToday ? 'text-gold-accent font-bold' : 'text-brass/50'}`}>{DOW_SHORT[d.getDay()]}</span>
                        {moonEmoji && <span className="text-sm leading-none">{moonEmoji}</span>}
                      </div>
                      <p className="font-body text-xs text-white/80 leading-relaxed flex-1">{highlightOnWhite(sentence || '—')}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-gold-primary/15">
                <button onClick={() => { if (cacheKey) delete weekSynthesisCache[cacheKey]; clearMemCache('week', dbKey, userId); hasGenerated.current = false; generate(); }}
                  className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-brass transition-colors">
                  <RefreshCw size={10} /> Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}