import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const REFERRAL_OPTIONS = [
  { key: 'ember_society',  label: 'Ember Society' },
  { key: 'discord',       label: 'Discord' },
  { key: 'reddit',        label: 'Reddit' },
  { key: 'linkedin',      label: 'LinkedIn' },
  { key: 'instagram',     label: 'Instagram' },
  { key: 'tiktok',        label: 'TikTok' },
  { key: 'word_of_mouth', label: 'Word of mouth / friend' },
  { key: 'other',         label: 'Other' },
];

export default function ReferralSourceStep({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState('');

  const canContinue = selected && (selected !== 'other' || detail.trim().length > 0);

  const handleContinue = () => {
    if (!canContinue) return;
    onComplete({
      referral_source: selected,
      referral_source_detail: selected === 'other' ? detail.trim() : undefined,
    });
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="space-y-1">
        <h2 className="font-display text-xl text-white">How did you find Astrosetta?</h2>
        <p className="font-body text-xs text-brass/80">This helps us understand where our community is growing.</p>
      </div>
      <div className="space-y-2.5">
        {REFERRAL_OPTIONS.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSelected(opt.key)}
              className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'border-gold-accent/60 bg-gold-accent/10'
                  : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
              }`}
            >
              <div className="font-body text-sm font-semibold text-white">{opt.label}</div>
            </button>
          );
        })}
      </div>
      {selected === 'other' && (
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Tell us where..."
          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white font-body text-sm placeholder:text-brass/40 focus:outline-none focus:border-gold-accent/50 transition-colors animate-fade-up"
          autoFocus
        />
      )}
      <Button
        onClick={handleContinue}
        disabled={!canContinue}
        className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all disabled:opacity-40"
      >
        Continue ✦
      </Button>
    </div>
  );
}