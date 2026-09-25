import React, { useState } from 'react';
import { getMundanePatterns } from '@/lib/mundanePatterns';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E',
};

const CATEGORY_STYLES = {
  cradle:       { color: '#B8A5C8', bg: 'rgba(184,165,200,0.12)', border: 'rgba(184,165,200,0.35)', icon: '⌒\uFE0E', label: 'Cradle' },
  conjunction:  { color: '#D4AF85', bg: 'rgba(212,175,133,0.12)', border: 'rgba(212,175,133,0.35)', icon: '☌\uFE0E', label: 'Conjunction' },
  pattern:      { color: '#9DB4C8', bg: 'rgba(157,180,200,0.12)', border: 'rgba(157,180,200,0.35)', icon: '△\uFE0E', label: 'Pattern' },
  stellium:     { color: '#C9A961', bg: 'rgba(201,169,97,0.12)',  border: 'rgba(201,169,97,0.35)',  icon: '✦\uFE0E', label: 'Stellium' },
};

/**
 * Consolidated "Cosmic Formations" card for the Home page.
 * Groups all mundane (collective) patterns into a single collapsed card.
 * Each formation has its own expandable detail with full explanation and dynamics.
 */
export default function MundaneFormationsCard({ transits, onHighlight }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(-1);
  const patterns = getMundanePatterns(transits?.transitPlanets);

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
      <button
        onClick={handleCardToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Layers size={14} className="text-gold-accent flex-shrink-0" />
          <div className="text-left">
            <p className="font-display text-sm font-semibold text-white">Cosmic Formations</p>
            <p className="font-body text-[10px] text-brass/70">
              {patterns.length} active collective pattern{patterns.length !== 1 ? 's' : ''} in the sky
            </p>
          </div>
        </div>
        {cardOpen ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />}
      </button>

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
                        {p.planets.join(' · ')}
                        {p.cycle && <span className="text-brass/40"> · {p.cycle}</span>}
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
                    {/* Planet chips with signs & degrees */}
                    {p.planetDetails ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.planetDetails.map((pd, j) => (
                          <span
                            key={j}
                            className="font-body text-[10px] px-2 py-0.5 rounded-full border"
                            style={{ background: style.bg, borderColor: style.border, color: style.color }}
                          >
                            <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>
                              {PLANET_GLYPHS[pd.name] || '✦'}
                            </span>{' '}{pd.name} {pd.sign} {pd.degree?.toFixed(0)}°{pd.retrograde ? ' ℞' : ''}
                          </span>
                        ))}
                      </div>
                    ) : (
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
                    )}
                    {/* Aspect web — the specific geometry of the pattern */}
                    {p.aspects && p.aspects.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-body text-[9px] uppercase tracking-widest text-brass/40">Aspect Web</p>
                        {p.aspects.map((a, j) => (
                          <div key={j} className="font-body text-[10px] text-brass/70 flex items-center gap-1.5">
                            <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{PLANET_GLYPHS[a.planet1] || '✦'}</span>
                            <span className="text-white/60">{a.planet1}</span>
                            <span style={{ fontVariantEmoji: 'text', color: style.color }}>{ASPECT_SYMBOLS[a.aspect] || a.aspect}</span>
                            <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{PLANET_GLYPHS[a.planet2] || '✦'}</span>
                            <span className="text-white/60">{a.planet2}</span>
                            <span className="text-brass/40 text-[9px]">{a.orb?.toFixed(1)}°</span>
                          </div>
                        ))}
                      </div>
                    )}
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