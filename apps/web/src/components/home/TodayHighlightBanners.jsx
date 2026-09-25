import React from 'react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { ChevronRight } from 'lucide-react';
import SignName from '@/components/ui/SignName';
import LunarEventBanner from '@/components/planner/LunarEventBanner';

/**
 * Compact, consistently-styled link banners shown on the Home "Today" tab.
 * Each surfaces a major planetary highlight — lunation, ingresses, or
 * stations — and, on click, jumps to the Transits tab and fully expands the
 * corresponding highlight in the Planetary Highlights card.
 *
 * All banners share an identical shell (celestial-card, px-4 py-3, two-line
 * layout, trailing chevron) so sizing and vertical rhythm stay uniform.
 */
const SHELL = 'celestial-card w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gold-primary/5 transition-colors text-left';

function eventSortKey(item) {
  if (item.exact) return 0;
  if (item.recent) return 1;
  if (item.approaching) return 2 + (item.days_until || 99);
  return 200;
}

export default function TodayHighlightBanners({ transits, chart, onLinkToHighlights }) {
  if (!transits) return null;

  const hasLunation = transits?.isExactFullMoon || transits?.isExactNewMoon;
  const ingresses = transits?.ingresses || [];
  const stations = transits?.stations || [];

  const hasPersonal = hasLunation || ingresses.length > 0 || stations.length > 0;
  if (!hasPersonal) return null;

  return (
    <div className="space-y-3">
      {hasLunation && (
        <LunarEventBanner transits={transits} onLinkToHighlights={() => onLinkToHighlights?.('lunation')} />
      )}
      {ingresses.length > 0 && (
        <IngressLinkBanner ingresses={ingresses} onClick={(key) => onLinkToHighlights?.('ingresses', key)} />
      )}
      {stations.length > 0 && (
        <StationsLinkBanner stations={stations} onClick={(key) => onLinkToHighlights?.('stations', key)} />
      )}
    </div>
  );
}

function IngressLinkBanner({ ingresses, onClick }) {
  const sorted = [...ingresses].sort((a, b) => eventSortKey(a) - eventSortKey(b));
  const ing = sorted[0];
  const more = ingresses.length - 1;
  const glyph = PLANET_GLYPHS[ing.planet] || '✦';
  const isApproaching = !!ing.approaching;
  const titleVerb = isApproaching ? 'approaching' : 'enters';
  const expectedDateLabel = (isApproaching && ing.expected_date)
    ? new Date(ing.expected_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const sub = (isApproaching && expectedDateLabel)
    ? `Approaching · est. ${expectedDateLabel}`
    : ing.recent ? '✦ Just entered' : '★ Major ingress';
  return (
    <button type="button" onClick={() => onClick(`${ing.planet}__${ing.to_sign}`)} className={SHELL}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg leading-none shrink-0 text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{glyph}</span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-white truncate">
            {ing.planet} {titleVerb} <SignName sign={ing.to_sign} />
          </p>
          <p className="font-body text-[10px] text-brass/70 truncate">
            {sub}{more > 0 && ` · ${more} more`}<span className="text-brass/40 ml-1">· tap for reading</span>
          </p>
        </div>
      </div>
      <ChevronRight size={14} className="text-brass/50 shrink-0" />
    </button>
  );
}

function StationsLinkBanner({ stations, onClick }) {
  const sorted = [...stations].sort((a, b) => {
    if (!a.approaching && b.approaching) return -1;
    if (a.approaching && !b.approaching) return 1;
    if (a.approaching && b.approaching) return (a.days_until || 99) - (b.days_until || 99);
    return 0;
  });
  const s = sorted[0];
  const more = stations.length - 1;
  const glyph = PLANET_GLYPHS[s.planet] || '✦';
  const isRx = s.type === 'retrograde';
  const expectedDateLabel = s.expected_date
    ? new Date(s.expected_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const sub = s.approaching
    ? `Approaching${expectedDateLabel ? ` · est. ${expectedDateLabel}` : ''}`
    : '★ Exact station today';
  return (
    <button type="button" onClick={() => onClick(s.planet)} className={SHELL}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg leading-none shrink-0" style={{ color: isRx ? '#C4A882' : '#A8C8A8', fontVariantEmoji: 'text' }}>{glyph}</span>
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-white truncate">
            {s.planet} stations {isRx ? 'retrograde ℞' : 'direct ↗'}
          </p>
          <p className="font-body text-[10px] text-brass/70 truncate">
            {sub}{more > 0 && ` · ${more} more`}<span className="text-brass/40 ml-1">· tap for reading</span>
          </p>
        </div>
      </div>
      <ChevronRight size={14} className="text-brass/50 shrink-0" />
    </button>
  );
}