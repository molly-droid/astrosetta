import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Loader2, Lightbulb } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import GatedFeature from '@/components/paywall/GatedFeature';

export default function StreakBonusCard({ userProgress }) {
  const { user } = useAuth();
  const { tier, canViewPeriodSynthesis } = usePermissions(user);
  const isCore = canViewPeriodSynthesis; // Core-or-above
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(isCore);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isCore) fetchBonus();
    else setLoading(false);
  }, [isCore]);

  // Free users get a Core upgrade CTA in place of the Practitioner's Lens.
  if (!isCore) {
    return (
      <GatedFeature
        variant="interpret"
        fromTier={tier === 'free' ? 'free' : 'interpret'}
        context="the Practitioner's Lens"
        title="Practitioner's Lens"
        description="The daily cheat-code transit insight is a Core feature. Unlock it with Core — $5.55/mo."
        ctaLabel="Unlock Core"
      />
    );
  }

  const fetchBonus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getDailyStreakBonus', {
        timezone: userProgress?.timezone || 'UTC'
      });
      if (res.data?.content) {
        setContent(res.data.content);
      } else {
        setError('Could not load today\'s insight.');
      }
    } catch {
      setError('Could not load today\'s insight.');
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="celestial-card p-5 space-y-3 bg-gradient-to-br from-gold-primary/10 to-paper"
    >
      <div className="flex items-center gap-2">
        <Lightbulb size={18} className="text-gold-accent shrink-0" />
        <div>
          <p className="font-display text-sm font-bold text-white">Practitioner's Lens</p>
          <p className="font-body text-[10px] text-brass italic">Cheat-code for today's sky</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-gold-primary" />
        </div>
      ) : error ? (
        <div className="text-center space-y-2">
          <p className="font-body text-xs text-brass italic">{error}</p>
          <button onClick={fetchBonus} className="font-body text-[10px] text-gold-accent underline">Try again</button>
        </div>
      ) : (
        <>
          {content?.transit_subject && (
            <p className="text-[10px] font-body text-brass uppercase tracking-widest">{content.transit_subject}</p>
          )}
          <p className="font-display text-base font-bold text-white leading-snug">{content?.headline}</p>
          {content?.scenario && (
            <p className="font-body text-xs text-white/60 leading-relaxed italic border-l-2 border-gold-primary/40 pl-2.5">
              {content.scenario}
            </p>
          )}
          <div className="space-y-1.5">
            <p className="font-body text-[10px] text-gold-accent uppercase tracking-widest">✦ The cheat-code</p>
            <p className="font-body text-sm text-white/80 leading-relaxed">{content?.content}</p>
          </div>
          {content?.transit_context && (
            <p className="font-body text-[10px] text-white/40 leading-relaxed pt-1 border-t border-white/[0.06]">
              <span className="text-white/30">Today's sky:</span> {content.transit_context}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}