import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import TierBadge from './TierBadge';

export const REQUIREMENTS = {
  apprentice: {
    nextTier: 'adept',
    label: 'Path to Adept',
    criteria: [
      { key: 'quiz_days', label: '10 quizzes completed', target: 10, getValue: p => p.apprentice_quiz_days_count || 0 },
      { key: 'accuracy', label: '70% accuracy', target: 70, getValue: p => {
        const t = p.apprentice_questions_total || 0;
        const c = p.apprentice_correct_total || 0;
        return t > 0 ? Math.round((c / t) * 100) : 0;
      }},
      { key: 'modules', label: '10 curriculum modules', target: 10, getValue: p => p.modules_completed || 0 },
    ]
  },
  adept: {
    nextTier: 'maestro',
    label: 'Path to Maestro',
    criteria: [
      { key: 'quiz_days', label: '20 quizzes completed', target: 20, getValue: p => p.adept_quiz_days_count || 0 },
      { key: 'accuracy', label: '75% accuracy', target: 75, getValue: p => {
        const t = p.adept_questions_total || 0;
        const c = p.adept_correct_total || 0;
        return t > 0 ? Math.round((c / t) * 100) : 0;
      }},
      { key: 'modules', label: '15 curriculum modules', target: 15, getValue: p => p.modules_completed || 0 },
    ]
  },
  maestro: null
};

export default function TierProgressCard({ userProgress }) {
  if (!userProgress) return null;

  const tier = userProgress.current_tier || 'apprentice';
  const req = REQUIREMENTS[tier];
  if (!req) return null; // maestro — nothing to show

  const criteria = req.criteria.map(c => {
    const current = c.getValue(userProgress);
    const pct = Math.min(100, Math.round((current / c.target) * 100));
    const done = current >= c.target;
    return { ...c, current, pct, done };
  });

  const allDone = criteria.every(c => c.done);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="celestial-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-white">{req.label}</p>
        <div className="flex items-center gap-1.5">
          <TierBadge tier={tier} showFlame={false} />
          <span className="text-brass text-xs">→</span>
          <TierBadge tier={req.nextTier} showFlame={false} />
        </div>
      </div>

      <div className="space-y-2.5">
        {criteria.map(c => (
          <div key={c.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {c.done
                  ? <CheckCircle2 size={12} className="text-green-500" />
                  : <Circle size={12} className="text-brass/40" />
                }
                <span className="font-body text-xs text-brass">{c.label}</span>
              </div>
              <span className="font-body text-[10px] text-brass">
                {c.key === 'accuracy' ? `${c.current}%` : `${c.current}/${c.target}`}
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${c.pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${c.done ? 'bg-green-400' : 'bg-gold-primary'}`}
              />
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <div className="bg-gold-primary/10 border border-gold-accent/40 rounded-lg px-3 py-2 text-center">
          <p className="font-display text-xs text-gold-accent font-bold">
            ✦ Ready to advance to {req.nextTier.charAt(0).toUpperCase() + req.nextTier.slice(1)}!
          </p>
          <p className="font-body text-[10px] text-brass mt-0.5">Complete tomorrow's quiz to advance</p>
        </div>
      )}
    </motion.div>
  );
}