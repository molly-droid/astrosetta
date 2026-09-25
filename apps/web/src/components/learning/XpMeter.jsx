import React from 'react';
import { getLevelFromXP, getNextLevel, getLevelProgress } from '@/lib/xpUtils';

/**
 * XP meter — shows level progression from the XP ledger (XPEvent records).
 * Styled to pair with LearningTierGauge: the tier gauge tracks curriculum
 * advancement (quizzes, accuracy, modules), this one tracks total XP earned
 * from every source — modules, quizzes, mastery challenges, and more.
 */
export default function XpMeter({ xpTotal = 0 }) {
  const level = getLevelFromXP(xpTotal);
  const next = getNextLevel(xpTotal);
  const pct = getLevelProgress(xpTotal);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-body text-brass uppercase tracking-widest">
          {level.label} · {xpTotal} XP
        </span>
        <span className="text-[11px] font-body text-brass/60 uppercase tracking-widest">
          {next ? `→ ${next.label}` : 'Max level'}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #9DB4C8, #A8D4D9)' }}
        />
      </div>
      {next && (
        <div className="text-[11px] font-body text-brass/80 text-right">
          {Math.max(0, next.min - xpTotal)} XP to {next.label}
        </div>
      )}
    </div>
  );
}