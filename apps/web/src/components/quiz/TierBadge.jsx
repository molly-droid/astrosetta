import React from 'react';

const TIER_CONFIG = {
  apprentice: {
    label: 'Apprentice',
    glyph: '✦',
    bg: 'bg-white/10',
    border: 'border-gold-primary/40',
    text: 'text-gold-primary',
  },
  adept: {
    label: 'Adept',
    glyph: '✧',
    bg: 'bg-celestial-blue/20',
    border: 'border-celestial-blue/50',
    text: 'text-celestial-blue',
  },
  maestro: {
    label: 'Maestro',
    glyph: '★',
    bg: 'bg-gold-primary/15',
    border: 'border-gold-accent/60',
    text: 'text-gold-accent',
  }
};

export default function TierBadge({ tier = 'apprentice' }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.apprentice;

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-body ${config.bg} ${config.border} ${config.text}`}>
      <span className="font-display">{config.glyph}</span>
      <span>{config.label}</span>
    </div>
  );
}