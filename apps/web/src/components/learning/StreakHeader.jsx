import React from 'react';
import { Flame } from 'lucide-react';
import LearningTierGauge from '@/components/quiz/LearningTierGauge';

export default function StreakHeader({ user, userProgress }) {
  const streak = userProgress?.consecutive_streak_count || user?.streak_days || 0;

  return (
    <div
      className="border-b border-white/[0.08] px-4 pt-10 pb-4 space-y-3"
      style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-center justify-between gap-3">
         <div className="flex items-baseline gap-2 min-w-0">
           <h1 className="font-display text-2xl font-bold text-cream whitespace-nowrap">Astrosetta</h1>
           <p className="font-body text-xs text-white/40 italic truncate">Your celestial curriculum</p>
         </div>
        <div className="flex items-center gap-1.5 bg-gold-primary/10 border border-gold-primary/40 rounded-full px-2.5 py-1 shrink-0" title={`${streak}-day streak`}>
          <Flame size={13} className={streak > 0 ? 'text-gold-accent' : 'text-white/20'} fill={streak > 0 ? '#C9A961' : 'transparent'} />
          <span className="font-display font-bold text-sm text-cream">{streak}</span>
          <span className="font-body text-[9px] text-brass/60 uppercase tracking-wide ml-0.5 hidden sm:inline">streak</span>
        </div>
      </div>
      <LearningTierGauge userProgress={userProgress} />
    </div>
  );
}