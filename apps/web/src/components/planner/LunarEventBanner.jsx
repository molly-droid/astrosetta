import React from 'react';
import SignName from '@/components/ui/SignName';
import { ChevronRight } from 'lucide-react';
import { ECLIPSE_META } from '@/lib/eclipseUtils';

/**
 * Compact banner shown on the Today tab when there's an exact New or Full Moon.
 * Tapping it jumps to the Transits tab and expands the PlanetaryHighlights card,
 * where the full lunar/eclipse reading (LunarHighlight) — and its share CTA — live.
 */
export default function LunarEventBanner({ transits, onLinkToHighlights }) {
  // On an eclipse day the eclipse perfects at the exact lunation (which may be
  // hours from noon), so prefer the eclipse-moment sign over the noon Moon sign.
  const moonSign = transits?.isEclipse ? (transits.eclipseMoonSign || transits?.moonSign) : transits?.moonSign;
  const exactPhase = transits?.isExactFullMoon ? 'Full Moon' : transits?.isExactNewMoon ? 'New Moon' : null;
  const eclipseMeta = transits?.isEclipse && transits?.eclipseType ? ECLIPSE_META[transits.eclipseType] : null;
  if (!exactPhase || !moonSign) return null;

  const label = eclipseMeta ? eclipseMeta.label : exactPhase;
  const sub = eclipseMeta ? eclipseMeta.badge : 'Notable celestial event';
  const glyph = eclipseMeta?.glyph || (exactPhase === 'Full Moon' ? '🌕' : '🌑');

  return (
    <button
      onClick={() => onLinkToHighlights?.()}
      className="celestial-card w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gold-primary/5 transition-colors text-left"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xl leading-none shrink-0" style={{ fontVariantEmoji: 'text', filter: eclipseMeta ? `drop-shadow(0 0 5px ${eclipseMeta.glow})` : undefined }}>{glyph}</span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-white truncate">{label} in <SignName sign={moonSign} /></p>
          <p className="font-body text-[10px] text-brass/70">{sub} · tap for reading</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-body text-[10px] text-gold-accent hidden sm:inline">Highlights</span>
        <ChevronRight size={14} className="text-brass/50" />
      </div>
    </button>
  );
}