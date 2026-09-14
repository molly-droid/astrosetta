import React from 'react';
import { Heart, X } from 'lucide-react';

/**
 * RelationshipBadge — the single combined badge shown in the Planner while a
 * relationship read is active. Folds the old "With: [name]" chip and the
 * "Reading the sky through your bond with [name]" banner into one pill that
 * names the bond; the ✕ exits relationship mode and returns to the user's
 * own reads.
 */
export default function RelationshipBadge({ name, onClear, phrase = 'Reading the sky through your bond with' }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-[11px] tracking-wide bg-[#2d344b] text-white border border-gold-accent/60 max-w-full">
      <Heart size={11} className="shrink-0 text-gold-accent" />
      <span className="leading-snug whitespace-nowrap">
        {phrase}{' '}
        <span className="font-semibold max-w-[180px] truncate inline-block align-bottom">{name}</span>
      </span>
      <button onClick={onClear} title="Back to my reads" className="ml-0.5 -mr-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors shrink-0">
        <X size={11} />
      </button>
    </span>
  );
}