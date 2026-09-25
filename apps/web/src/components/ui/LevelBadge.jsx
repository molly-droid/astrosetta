import React from 'react';
import { getLevelFromXP } from '@/lib/xpUtils';

const LEVEL_STYLES = {
  apprentice: 'bg-paper border-brass/40 text-brass',
  adept: 'bg-paper border-gold-primary text-gold-accent',
  practitioner: 'bg-paper border-celestial-purple text-[#8B6BAE]',
  sage: 'bg-paper border-gold-accent text-gold-accent shadow-[0_0_8px_rgba(212,175,133,0.4)]',
};

const LEVEL_GLYPHS = {
  apprentice: '◌',
  adept: '◈',
  practitioner: '✦',
  sage: '⊛',
};

export default function LevelBadge({ xp, size = 'md' }) {
  const level = getLevelFromXP(xp);
  const style = LEVEL_STYLES[level.name] || LEVEL_STYLES.apprentice;
  const glyph = LEVEL_GLYPHS[level.name];

  const sizeClass = size === 'sm'
    ? 'text-[10px] px-2 py-0.5'
    : size === 'lg'
    ? 'text-sm px-4 py-1.5'
    : 'text-xs px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full font-display font-bold tracking-widest uppercase ${style} ${sizeClass}`}>
      <span>{glyph}</span>
      {level.label}
    </span>
  );
}