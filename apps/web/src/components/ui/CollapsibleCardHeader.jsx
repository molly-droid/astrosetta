import React from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

/**
 * Standardized header for collapsible celestial cards.
 * The icon sits in a fixed 20×20 box and the title uses a matching 20px
 * line-height, so every card's icon and title align horizontally and
 * vertically — regardless of whether the icon is a lucide glyph or a
 * unicode symbol, and regardless of whether a subtitle is present.
 */
export default function CollapsibleCardHeader({
  icon,
  title,
  subtitle,
  expanded,
  loading = false,
  onToggle,
  rightExtra,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors text-left"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-gold-accent">
          {icon}
        </span>
        <div className="text-left min-w-0">
          <p className="font-display text-sm font-semibold text-white leading-5 truncate">{title}</p>
          {subtitle != null && subtitle !== '' && (
            <p className="font-body text-[10px] text-brass/70 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {rightExtra}
        {loading && <Loader2 size={13} className="animate-spin text-gold-primary" />}
        {expanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />}
      </div>
    </button>
  );
}