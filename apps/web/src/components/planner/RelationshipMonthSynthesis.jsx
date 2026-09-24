import React, { useState, useEffect, useRef } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, Sparkles, ChevronDown, ChevronRight, RefreshCw, Globe, Heart } from 'lucide-react';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';
import SynthesisCategoryCard from '@/components/planner/SynthesisCategoryCard';
import {
  fetchTransitsForChart,
  fetchNatalCrossAspects,
  buildMonthParams,
} from '@/lib/relationshipSynthesis';

const CACHE_VERSION = 'rel-v1';
const monthSynthesisCache = {};

const highlightOnGold = (t) => highlightSynthesisText(t, null, 'text-white');
const highlightOnWhite = (t) => highlightSynthesisText(t, null, 'text-gold-primary');

export default function RelationshipMonthSynthesis({ date, userChart, partnerChart, userId }) {
  const partnerName = partnerChart?.name || 'your partner';
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthKey = `${year}-${month}`;
  const periodKey = `month-${CACHE_VERSION}-${year}-${String(month + 1).padStart(2, '0')}-${partnerChart?.id}`;
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const hasGenerated = useRef(false);

  useEffect(() => {
    if (!partnerChart?.id) return;
    if (monthSynthesisCache[periodKey]) {
      setSynthesis(monthSynthesisCache[periodKey]);
      hasGenerated.current = true;
      return;
    }
    if (userId) {
      getCachedSynthesis('month', periodKey, userId, partnerChart.id).then((cached) => {
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
    }
  }, [monthKey, partnerChart?.id, userId]);

  useEffect(() => {
    if (partnerChart && !hasGenerated.current && !loading && expanded) {
      hasGenerated.current = true;
      generate();
    }
  }, [expanded, monthKey, partnerChart?.id]);

  const generate = async () => {
    if (!partnerChart) return;
    setLoading(true);
    try {
      // Sample the 1st and 15th for both charts + the static natal cross-aspects
      const firstDay = new Date(year, month, 1, 12, 0, 0);
      const midDay = new Date(year, month, 15, 12, 0, 0);
      const [userT1, userT15, partnerT1, partnerT15, crossAspects] = await Promise.all([
        fetchTransitsForChart(firstDay, userChart),
        fetchTransitsForChart(midDay, userChart),
        fetchTransitsForChart(firstDay, partnerChart),
        fetchTransitsForChart(midDay, partnerChart),
        fetchNatalCrossAspects(userChart, partnerChart),
      ]);
      // Use the 1st as the representative transit snapshot for the prompt
      const params = buildMonthParams({ date, userChart, partnerChart, userTransits: userT1, partnerTransits: partnerT1, crossAspects });
      const result = await invokeLLMTask('relationship-month-synthesis', params);
      monthSynthesisCache[periodKey] = result;
      setSynthesis(result);
      if (userId) {
        saveCachedSynthesis('month', periodKey, userId, result, {
          target_chart_id: partnerChart.id,
          date_start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
          date_end: `${year}-${String(month + 2).padStart(2, '0')}-01`,
          summary: `Month at a Glance · with ${partnerName}`,
        });
      }
    } catch { /* non-critical */ }
    setLoading(false);
  };

  const headerTags = synthesis ? (activeTab === 'personal' ? synthesis.best_areas : (synthesis.collective_tags || [])) : [];

  return (
    <div className="celestial-card overflow-hidden">
      <button onClick={() => setExpanded((o) => !o)} className="w-full text-left px-4 py-3 hover:bg-gold-primary/5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Heart size={14} className="text-celestial-pink flex-shrink-0" />
            <span className="font-display text-sm font-semibold text-white">Month at a Glance · with {partnerName}</span>
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
          {loading && !synthesis && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">✦</div>
              <p className="font-body text-xs text-brass italic">Reading the relationship month...</p>
            </div>
          )}
          {synthesis && (
            <>
              <div className="flex border-b border-white/[0.06]">
                <button onClick={() => setActiveTab('personal')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${activeTab === 'personal' ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/35 hover:text-white/60'}`}>
                  <Sparkles size={11} /> The Bond
                </button>
                <button onClick={() => setActiveTab('collective')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${activeTab === 'collective' ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/35 hover:text-white/60'}`}>
                  <Globe size={11} /> Collective
                </button>
              </div>

              <div className="px-4 pb-4 pt-3 space-y-3">
                {activeTab === 'personal' && (
                  <>
                    <p className="font-body text-sm text-white/90 leading-relaxed">{highlightOnWhite(synthesis.overview)}</p>
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
                      <p className="font-body text-sm text-white/85 leading-relaxed">{highlightOnWhite(synthesis.collective_theme)}</p>
                    )}
                  </>
                )}
                <div className="flex items-center justify-end gap-3 pt-1 border-t border-gold-primary/15">
                  <button onClick={() => { clearMemCache('month', periodKey, userId); hasGenerated.current = false; generate(); }}
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