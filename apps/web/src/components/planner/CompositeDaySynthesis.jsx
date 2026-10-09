import React, { useState, useEffect, useRef } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { Sparkles, Globe, RefreshCw, Heart } from 'lucide-react';
import { highlightSynthesisText, PLANET_GLYPHS } from '@/lib/transitUtils';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import SynthesisCategoryCard from '@/components/planner/SynthesisCategoryCard';
import {
  buildCompositeChartObject,
  fetchCompositeTransits,
  buildCompositeDayParams,
} from '@/lib/compositeSynthesis';
import { useAuth } from '@/lib/AuthContext';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';

const CACHE_VERSION = 'comp-v1';
const synthesisCache = {};

/**
 * Composite Day synthesis — reads the day through the relationship as a single
 * entity (the composite chart). Distinct from RelationshipDaySynthesis, which
 * weaves two individual charts (synastry). Same output shape / rendering, so
 * the card chrome and tabs stay consistent across the two relationship modes.
 */
export default function CompositeDaySynthesis({ date, userChart, partnerChart, userId, onSynthesis }) {
  const { user } = useAuth();
  const hidden = getHiddenChartPoints(user);
  const partnerName = partnerChart?.name || 'your partner';
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const cacheKey = partnerChart?.id && dateKey ? `${CACHE_VERSION}_${partnerChart.id}_${dateKey}` : null;
  const dbKey = dateKey ? `day-${CACHE_VERSION}-${dateKey}-${partnerChart?.id}` : null;
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [cacheChecked, setCacheChecked] = useState(false);
  const hasGenerated = useRef(false);
  const highlightOnGold = (t) => highlightSynthesisText(t, null, 'text-white');
  const highlightOnWhite = (t) => highlightSynthesisText(t, null, 'text-gold-primary');

  // Load from memory / DB cache
  useEffect(() => {
    if (!dateKey || !partnerChart?.id) return;
    setCacheChecked(false);
    if (cacheKey && synthesisCache[cacheKey]) {
      setSynthesis(synthesisCache[cacheKey]);
      onSynthesis?.(synthesisCache[cacheKey]);
      hasGenerated.current = true;
      setCacheChecked(true);
      return;
    }
    if (userId) {
      getCachedSynthesis('day', dbKey, userId, partnerChart.id).then((cached) => {
        if (cached) {
          if (cacheKey) synthesisCache[cacheKey] = cached;
          setSynthesis(cached);
          onSynthesis?.(cached);
          hasGenerated.current = true;
        } else {
          hasGenerated.current = false;
          setSynthesis(null);
        }
        setCacheChecked(true);
      });
    } else {
      setCacheChecked(true);
    }
  }, [dateKey, partnerChart?.id, userId]);

  useEffect(() => {
    if (!cacheChecked) return;
    if (hasGenerated.current || loading) return;
    if (!expanded) return;
    hasGenerated.current = true;
    generate();
  }, [cacheChecked, expanded, dateKey, partnerChart?.id]);

  const generate = async () => {
    const compositeChartObj = buildCompositeChartObject(userChart, partnerChart, hidden);
    if (!compositeChartObj?.raw_data) return;
    setLoading(true);
    try {
      const compositeTransits = await fetchCompositeTransits(date, compositeChartObj.raw_data, userChart, hidden);
      const params = buildCompositeDayParams({
        date,
        partnerChart,
        compositeRaw: compositeChartObj.raw_data,
        compositeTransits,
      });
      const result = await invokeLLMTask('composite-day-synthesis', params);
      if (cacheKey) synthesisCache[cacheKey] = result;
      setSynthesis(result);
      onSynthesis?.(result);
      if (userId && dbKey) {
        saveCachedSynthesis('day', dbKey, userId, result, {
          target_chart_id: partnerChart.id,
          date_start: dateKey,
          date_end: dateKey,
          summary: `Composite Reading · with ${partnerName}`,
        });
      }
    } catch { /* non-critical */ }
    setLoading(false);
  };

  return (
    <div className="celestial-card overflow-hidden">
      <CollapsibleCardHeader
        icon={<Heart size={14} />}
        title={`Composite Reading · with ${partnerName}`}
        subtitle={synthesis?.relationship_focus?.slice(0, 60) || (loading ? 'Reading the composite chart…' : 'Tap to read the relationship as one entity')}
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(!expanded)}
      />
      {expanded && (
        <div className="border-t border-gold-primary/20">
          {loading && !synthesis && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">∞</div>
              <p className="font-body text-xs text-brass italic">Reading the composite chart...</p>
            </div>
          )}
          {synthesis && (
            <>
              <div className="flex border-b border-white/[0.08]">
                <button onClick={() => setActiveTab('personal')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${activeTab === 'personal' ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                  <Sparkles size={11} /> The Relationship
                </button>
                <button onClick={() => setActiveTab('collective')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${activeTab === 'collective' ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                  <Globe size={11} /> Collective
                </button>
              </div>

              <div className="px-4 pt-3 space-y-2">
                {synthesis.key_themes?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {synthesis.power_planet && (
                      <span className="font-body text-[9px] font-semibold px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-accent border border-gold-primary/30 flex items-center gap-1">
                        <span className="opacity-70">{PLANET_GLYPHS[synthesis.power_planet] || '✦'}</span>{synthesis.power_planet}
                      </span>
                    )}
                    {synthesis.key_themes.map((theme, i) => (
                      <span key={i} className="font-body text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-brass border border-gold-primary/15">{theme}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 pt-2 space-y-3">
                {activeTab === 'personal' && (
                  <div className="space-y-3">
                    {synthesis.overview && (
                      <p className="font-body text-sm text-gold-primary/90 leading-relaxed italic border-l-2 border-gold-primary/50 pl-3">
                        {highlightOnGold(synthesis.overview)}
                      </p>
                    )}
                    {synthesis.relationship_focus && (
                      <div className="rounded-lg border border-celestial-pink/30 bg-celestial-pink/10 p-3">
                        <p className="font-body text-[10px] uppercase tracking-widest font-semibold mb-1.5 text-celestial-pink">
                          <Heart size={11} className="inline mr-1" /> Relationship Focus
                        </p>
                        <p className="font-body text-xs leading-snug text-white">{highlightOnWhite(synthesis.relationship_focus)}</p>
                      </div>
                    )}
                    {synthesis.personal_reading?.length > 0 && (
                      <ul className="space-y-1.5">
                        {synthesis.personal_reading.map((b, i) => (
                          <li key={i} className="font-body text-xs text-white/85 leading-relaxed flex gap-2">
                            <span className="text-gold-accent shrink-0">•</span>
                            <span>{highlightOnWhite(b)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {['maximize', 'focus', 'watch'].map((cat) => (
                      <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
                    ))}
                  </div>
                )}
                {activeTab === 'collective' && (
                  <div className="space-y-3">
                    {synthesis.collective_highlight && (
                      <p className="font-body text-sm text-gold-primary/90 italic border-l-2 border-gold-primary/50 pl-3 leading-snug">
                        {highlightOnGold(synthesis.collective_highlight)}
                      </p>
                    )}
                    {synthesis.collective_reading?.length > 0 && (
                      <ul className="space-y-1.5">
                        {synthesis.collective_reading.map((b, i) => (
                          <li key={i} className="font-body text-xs text-white/80 leading-relaxed flex gap-2">
                            <span className="text-celestial-blue shrink-0">•</span>
                            <span>{highlightOnWhite(b)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-gold-primary/15">
                  <button onClick={() => { if (cacheKey) delete synthesisCache[cacheKey]; clearMemCache('day', dbKey, userId); hasGenerated.current = false; generate(); }}
                    className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-brass transition-colors">
                    <RefreshCw size={10} /> Regenerate
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}