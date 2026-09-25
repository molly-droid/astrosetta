import React from 'react';
import { REQUIREMENTS } from './TierProgressCard';

const TIER_LABELS = { apprentice: 'Apprentice', adept: 'Adept', maestro: 'Maestro' };

const CRITERION_NOUN = {
  quiz_days: 'quizzes',
  accuracy: 'accuracy',
  modules: 'modules',
};

/**
 * Compact learning-tier progress gauge for the Home header.
 *
 * Shows how close the user is to advancing from their current curriculum
 * tier (apprentice/adept/maestro) to the next one. Because advancement
 * requires EVERY criterion to be met, progress is driven by the
 * least-complete (bottleneck) criterion — the truest single measure of
 * "how close to the next tier."
 */
export default function LearningTierGauge({ userProgress }) {
  const tier = userProgress?.current_tier || 'apprentice';
  const req = REQUIREMENTS[tier];

  // Maestro — highest curriculum tier, nothing to advance to
  if (!req) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-body text-gold-accent uppercase tracking-widest">Maestro</span>
          <span className="text-[11px] font-body text-brass/50 uppercase tracking-widest">Top tier reached</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, #C9A961, #D4AF85)' }} />
        </div>
      </div>
    );
  }

  const criteria = req.criteria.map(c => {
    const current = c.getValue(userProgress || {});
    const pct = Math.min(100, Math.round((current / c.target) * 100));
    return { ...c, current, pct };
  });

  // Bottleneck = least-complete criterion (you advance only when ALL are met)
  const bottleneck = criteria.reduce((min, c) => (c.pct < min.pct ? c : min), criteria[0]);
  const nextLabel = TIER_LABELS[req.nextTier] || req.nextTier;

  const noun = CRITERION_NOUN[bottleneck.key] || bottleneck.label;
  const valueText = bottleneck.key === 'accuracy'
    ? `${bottleneck.current}% ${noun}`
    : `${bottleneck.current}/${bottleneck.target} ${noun}`;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-body text-brass uppercase tracking-widest">{TIER_LABELS[tier] || tier}</span>
        <span className="text-[11px] font-body text-brass/60 uppercase tracking-widest">→ {nextLabel}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${bottleneck.pct}%`, background: 'linear-gradient(90deg, #C9A961, #D4AF85)' }}
        />
      </div>
      <div className="text-[11px] font-body text-brass/80 text-right">
        {bottleneck.pct >= 100 ? `Ready to advance to ${nextLabel}` : `${valueText} to ${nextLabel}`}
      </div>
    </div>
  );
}