import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Bookmark, ChevronRight, Loader2 } from 'lucide-react';
import ToneBadge from '@/components/ui/ToneBadge';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { base44 } from '@/api/base44Client';
import { awardXP } from '@/lib/xpUtils';
import { getPlacementType, PLANET_GLYPHS } from '@/lib/chartUtils';
import { motion } from 'framer-motion';

const PLACEMENT_TYPE_LABELS = {
  planet_sign: 'Planet in Sign',
  planet_house: 'Planet in House',
  aspect: 'Aspect',
  node: 'Node',
  point: 'Point',
};

// Module-level cache: key → Promise<interpretations[]>
const interpretationCache = {};

export function preloadPlacementCard(placementKey) {
  if (!placementKey || interpretationCache[placementKey]) return;
  interpretationCache[placementKey] = base44.functions.invoke('getInterpretations', { key: placementKey })
    .then(res => (res.data?.interpretations || res.data || []).slice(0, 3))
    .catch(() => base44.entities.Interpretation.filter({ placement_key: placementKey, status: 'active' })
      .then(local => local.slice(0, 3)));
}

export default function PlacementCard({ placementKey, user, progress, onComplete, onNext }) {
  const [interpretations, setInterpretations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(progress?.rating_given || null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(progress?.status === 'completed');

  const displayName = placementKey
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/(\d+) H$/, 'in House $1')
    .replace(/ H$/, '');

  const placementType = getPlacementType(placementKey);

  useEffect(() => {
    fetchInterpretations();
  }, [placementKey]);

  const fetchInterpretations = async () => {
    setLoading(true);
    preloadPlacementCard(placementKey);
    try {
      const data = await interpretationCache[placementKey];
      setInterpretations(data || []);
    } catch {
      // Clear bad cache entry so it can retry next time
      delete interpretationCache[placementKey];
      setInterpretations([]);
    }
    setLoading(false);
  };

  const handleRate = async (ratingValue) => {
    if (rating) return;
    setRating(ratingValue);
    try {
      if (progress?.id) {
        await base44.entities.UserPlacementProgress.update(progress.id, { rating_given: ratingValue });
      }
    } catch (e) {}
  };

  const handleComplete = async () => {
    if (completed || completing) return;
    setCompleting(true);

    try {
      const now = new Date().toISOString();
      if (progress?.id) {
        await base44.entities.UserPlacementProgress.update(progress.id, {
          status: 'completed',
          completed_at: now,
          xp_earned: 10,
        });
      } else {
        await base44.entities.UserPlacementProgress.create({
          user_id: user.id,
          placement_key: placementKey,
          status: 'completed',
          completed_at: now,
          xp_earned: 10,
          rating_given: rating,
        });
      }

      await awardXP(user.id, 'card_completed', 10, placementKey);

      // Streak logic
      const lastActive = user.last_active ? new Date(user.last_active) : null;
      const today = new Date();
      const todayStr = today.toDateString();
      let newStreak = user.streak_days || 0;

      if (!lastActive || lastActive.toDateString() !== todayStr) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastActive && lastActive.toDateString() === yesterday.toDateString()) {
          newStreak += 1;
        } else if (!lastActive) {
          newStreak = 1;
        } else {
          newStreak = 1;
        }
        await base44.auth.updateMe({ streak_days: newStreak, last_active: now });
      }

      setCompleted(true);
      onComplete && onComplete(placementKey);
    } catch (e) {
      console.error(e);
    }
    setCompleting(false);
  };

  const firstWord = placementKey.split('_')[0];
  const glyph = PLANET_GLYPHS[firstWord.charAt(0).toUpperCase() + firstWord.slice(1)] || '✦';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="celestial-card p-5 space-y-5 mx-1"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-3xl text-gold-accent">{glyph}</div>
        <h2 className="font-display text-2xl font-bold text-deep-blue">{displayName}</h2>
        <span className="inline-block text-[10px] font-body uppercase tracking-widest border border-gold-primary/50 text-brass px-3 py-0.5 rounded-full">
          {PLACEMENT_TYPE_LABELS[placementType] || placementType}
        </span>
      </div>

      <OrnamentDivider />

      {/* Interpretations */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-gold-primary" size={24} />
        </div>
      ) : interpretations.length > 0 ? (
        <div className="space-y-4">
          {interpretations.map((interp, i) => (
            <div key={interp.id || i} className="space-y-2">
              <div className="flex items-center justify-between">
                <ToneBadge tone={interp.tone} />
                {interp.rating_score > 0 && (
                  <span className="text-[10px] font-body text-brass">★ {interp.rating_score?.toFixed(1)}</span>
                )}
              </div>
              <p className="font-body text-sm text-deep-blue leading-relaxed">{interp.text}</p>
              {i < interpretations.length - 1 && <OrnamentDivider className="opacity-40" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="font-body text-sm text-brass italic">No interpretations yet for this placement.</p>
          <p className="font-body text-xs text-brass/60 mt-1">Be the first to contribute one!</p>
        </div>
      )}

      <OrnamentDivider />

      {/* Rating */}
      {!completed && (
        <div className="space-y-2">
          <p className="text-[11px] font-body text-brass uppercase tracking-widest text-center">Did this resonate?</p>
          <div className="flex justify-center gap-3">
            {[
              { value: 'helpful', icon: ThumbsUp, label: 'Helpful' },
              { value: 'not_for_me', icon: ThumbsDown, label: 'Not for me' },
              { value: 'saved', icon: Bookmark, label: 'Save' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => handleRate(value)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                  rating === value
                    ? 'border-gold-accent bg-gold-primary/10 text-gold-accent'
                    : 'border-gold-primary/30 text-brass hover:border-gold-primary hover:text-gold-primary'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span className="text-[10px] font-body">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!completed ? (
          <Button
            onClick={handleComplete}
            disabled={completing}
            className="flex-1 bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold rounded-xl h-11"
          >
            {completing ? <Loader2 className="animate-spin" size={16} /> : 'Mark Complete'}
          </Button>
        ) : (
          <div className="flex-1 text-center py-2.5 bg-green-soft/20 border border-celestial-green rounded-xl">
            <span className="text-xs font-body text-[#5A8A5A] font-semibold">✓ Completed · +10 XP</span>
          </div>
        )}
        <Button
          onClick={onNext}
          variant="outline"
          className="border-gold-primary/50 text-brass hover:border-gold-accent hover:text-gold-accent rounded-xl h-11 px-4"
        >
          <ChevronRight size={18} />
        </Button>
      </div>
    </motion.div>
  );
}