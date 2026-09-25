import React, { useState } from 'react';
import { X, Loader2, CreditCard } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const REASONS = [
  { key: 'too_expensive', label: "It's too expensive for me right now" },
  { key: 'other_apps', label: 'I prefer other astrology apps' },
  { key: 'not_using', label: "I'm not using it enough" },
  { key: 'not_resonating', label: "The interpretations don't resonate with me" },
  { key: 'curriculum_done', label: 'I finished the curriculum and feel I can interpret on my own' },
  { key: 'other', label: 'Something else' },
];
const PAYMENT_UPDATE = 'payment_update';

/**
 * Quick exit survey shown before opening the Stripe billing portal — the only
 * surface where a subscriber can downgrade or cancel. A chosen reason (plus an
 * optional note) is saved as a 'cancellation' Feedback record, which lands in
 * the admin Feedback inbox. "Just updating my payment details" and "Skip"
 * continue straight to the portal without saving anything.
 *
 * Props: { planLabel, onClose, onContinue }
 */
export default function DowngradeSurveyModal({ planLabel, onClose, onContinue }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!reason || saving) { onContinue(); return; }
    const picked = REASONS.find(r => r.key === reason);
    if (picked) {
      setSaving(true);
      try {
        await base44.entities.Feedback.create({
          type: 'cancellation',
          subject: picked.label,
          description: [note.trim(), `Plan at time of survey: ${planLabel}`].filter(Boolean).join('\n'),
        });
      } catch { /* non-critical — always let the user through to the portal */ }
    }
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/80 px-0 sm:px-4 py-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto bg-paper rounded-2xl border border-gold-primary/30 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-deep-blue/90 to-deep-blue/70 px-5 pt-5 pb-4 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-cream/50 hover:text-cream transition-colors">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <CreditCard size={15} className="text-gold-accent" />
            </div>
            <div>
              <p className="font-body text-[10px] text-gold-primary/70 uppercase tracking-widest">Manage billing</p>
              <h2 className="font-display text-base font-bold text-cream leading-tight">Making a change today?</h2>
            </div>
          </div>
          <p className="font-body text-xs text-gold-primary/80 leading-relaxed mt-2">
            Before you head to the billing portal — if you're thinking of downgrading or cancelling, would you tell us why? It genuinely helps us make Astrosetta better.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Reasons */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setReason(PAYMENT_UPDATE)}
              className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                reason === PAYMENT_UPDATE
                  ? 'border-gold-primary/60 bg-gold-primary/10 text-white'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-gold-primary/30'
              }`}
            >
              <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${reason === PAYMENT_UPDATE ? 'border-gold-accent bg-gold-accent' : 'border-brass/40'}`} />
              <span className="font-body text-xs">Just updating my payment details</span>
            </button>

            <div className="pt-1 pb-0.5 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="font-body text-[9px] uppercase tracking-widest text-brass/40">Considering leaving?</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            {REASONS.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReason(r.key)}
                className={`w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  reason === r.key
                    ? 'border-gold-primary/60 bg-gold-primary/10 text-white'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-gold-primary/30'
                }`}
              >
                <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${reason === r.key ? 'border-gold-accent bg-gold-accent' : 'border-brass/40'}`} />
                <span className="font-body text-xs">{r.label}</span>
              </button>
            ))}
          </div>

          {/* Optional note */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything you'd like us to know? (optional)"
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-body text-xs text-white placeholder:text-brass/40 focus:outline-none focus:border-gold-primary/40 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2.5">
          <button
            onClick={onContinue}
            disabled={saving}
            className="flex-1 font-body text-xs text-brass/60 hover:text-brass transition-colors py-2.5"
          >
            Skip
          </button>
          <button
            onClick={handleContinue}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-xs font-semibold px-4 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            {saving ? <><Loader2 size={13} className="animate-spin" /> One moment…</> : 'Continue to billing portal'}
          </button>
        </div>
      </div>
    </div>
  );
}