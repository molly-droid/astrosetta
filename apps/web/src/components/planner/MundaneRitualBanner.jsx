import React, { useState, useEffect } from 'react';
import { getSignificantMundanePatterns } from '@/lib/mundanePatterns';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { ChevronDown, ChevronRight, Flame } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';

const CATEGORY_STYLES = {
  cradle:       { color: '#B8A5C8', bg: 'rgba(184,165,200,0.12)', border: 'rgba(184,165,200,0.35)', icon: '⌒\uFE0E' },
  conjunction: { color: '#D4AF85', bg: 'rgba(212,175,133,0.12)', border: 'rgba(212,175,133,0.35)', icon: '☌\uFE0E' },
  pattern:     { color: '#9DB4C8', bg: 'rgba(157,180,200,0.12)', border: 'rgba(157,180,200,0.35)', icon: '△\uFE0E' },
  stellium:    { color: '#C9A961', bg: 'rgba(201,169,97,0.12)',  border: 'rgba(201,169,97,0.35)',  icon: '✦\uFE0E' },
};

/**
 * Planner-only banner showing mundane formations that are personally activated
 * — i.e. at least one formation planet is making a transit to the user's natal chart.
 * Consolidated into a single expandable card with per-formation sub-items.
 */
export default function MundaneRitualBanner({ transits, onHighlight }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(-1);
  const patterns = getSignificantMundanePatterns(
    transits?.transitPlanets,
    transits?.natalAspects,
  );

  useEffect(() => {
    return () => { if (onHighlight) onHighlight(null); };
  }, [onHighlight]);

  if (patterns.length === 0) return null;

  const handleCardToggle = () => {
    const newOpen = !cardOpen;
    setCardOpen(newOpen);
    if (!newOpen) {
      setExpandedIdx(-1);
      if (onHighlight) onHighlight(null);
    }
  };

  const handleItemToggle = (i) => {
    const newIdx = expandedIdx === i ? -1 : i;
    setExpandedIdx(newIdx);
    if (onHighlight) {
      onHighlight(newIdx >= 0 ? patterns[newIdx] : null);
    }
  };

  return (
    <div className="celestial-card overflow-hidden">
      {/* Card header — collapsed by default */}
      <CollapsibleCardHeader
        icon={<Flame size={14} />}
        title="Ritually Active Formations"
        subtitle={`${patterns.length} collective pattern${patterns.length !== 1 ? 's' : ''} activated by your transits`}
        expanded={cardOpen}
        onToggle={handleCardToggle}
      />

      {/* Expanded list of formations */}
      {cardOpen && (
        <div className="border-t border-gold-primary/15 px-4 py-3 space-y-2">
          {patterns.map((p, i) => {
            const style = CATEGORY_STYLES[p.category] || CATEGORY_STYLES.pattern;
            const isExpanded = expandedIdx === i;
            return (
              <div
                key={i}
                className="rounded-lg overflow-hidden border"
                style={{ borderColor: style.border, background: style.bg }}
              >
                <button
                  onClick={() => handleItemToggle(i)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ fontVariantEmoji: 'text', fontVariant: 'normal', color: style.color }}>{style.icon}</span>
                    <div className="text-left">
                      <p className="font-body text-xs font-semibold text-white">{p.type}</p>
                      <p className="font-body text-[10px] text-brass/60">
                        Activated · {p.planets.join(' · ')}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={12} className="text-brass/40" /> : <ChevronRight size={12} className="text-brass/40" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5">
                    <p className="font-body text-xs text-white/85 leading-relaxed">
                      {p.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.planets.map((name, j) => (
                        <span
                          key={j}
                          className="font-body text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ background: style.bg, borderColor: style.border, color: style.color }}
                        >
                          <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>
                            {PLANET_GLYPHS[name] || '✦'}
                          </span>{' '}{name}
                        </span>
                      ))}
                    </div>
                    {(p.sign || p.element || p.apex) && (
                      <div className="flex flex-wrap gap-3 text-[10px] font-body text-brass/50">
                        {p.sign && <span>📍 {p.sign}</span>}
                        {p.element && <span>{p.element}</span>}
                        {p.apex && <span>Apex: {p.apex}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}