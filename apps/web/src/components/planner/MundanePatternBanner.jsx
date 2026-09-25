import React, { useState, useEffect } from 'react';
import { getMundanePatterns } from '@/lib/mundanePatterns';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { ChevronDown, ChevronRight } from 'lucide-react';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E',
};

const CATEGORY_STYLES = {
  cradle:       { color: '#B8A5C8', bg: 'rgba(184,165,200,0.12)', border: 'rgba(184,165,200,0.35)', icon: '⌒\uFE0E' },
  conjunction:  { color: '#D4AF85', bg: 'rgba(212,175,133,0.12)', border: 'rgba(212,175,133,0.35)', icon: '☌\uFE0E' },
  pattern:      { color: '#9DB4C8', bg: 'rgba(157,180,200,0.12)', border: 'rgba(157,180,200,0.35)', icon: '△\uFE0E' },
  stellium:     { color: '#C9A961', bg: 'rgba(201,169,97,0.12)',  border: 'rgba(201,169,97,0.35)',  icon: '✦\uFE0E' },
};

/**
 * Live Sky banner surfacing notable mundane (collective) patterns among
 * transit planets. Calls onHighlight(pattern) when a card is expanded so
 * the chart wheel can draw the pattern geometry.
 * Pure computation — no LLM call. Instant.
 */
export default function MundanePatternBanner({ transits, onHighlight }) {
  const [expandedIdx, setExpandedIdx] = useState(-1);
  const patterns = getMundanePatterns(transits?.transitPlanets);

  // Clear chart highlight when banner unmounts (e.g. switching to Week view)
  useEffect(() => {
    return () => { if (onHighlight) onHighlight(null); };
  }, [onHighlight]);

  if (patterns.length === 0) return null;

  const handleToggle = (i) => {
    const newIdx = expandedIdx === i ? -1 : i;
    setExpandedIdx(newIdx);
    if (onHighlight) {
      onHighlight(newIdx >= 0 ? patterns[newIdx] : null);
    }
  };

  return (
    <div className="space-y-2">
      {patterns.map((p, i) => {
        const style = CATEGORY_STYLES[p.category] || CATEGORY_STYLES.pattern;
        const isExpanded = expandedIdx === i;
        return (
          <div
            key={i}
            className="celestial-card overflow-hidden"
          >
            <button
              onClick={() => handleToggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg text-gold-primary" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>{style.icon}</span>
                <div className="text-left">
                  <p className="font-display text-sm font-semibold text-white">{p.type}</p>
                  <p className="font-body text-[10px] text-brass/70">
                    Mundane · {p.planets.join(' · ')}
                    {p.cycle && <span className="text-brass/40"> · {p.cycle}</span>}
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gold-primary/15">
                <p className="font-body text-sm text-white/90 leading-relaxed">
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
  );
}