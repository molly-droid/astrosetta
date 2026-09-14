import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import PaywallModal from '@/components/paywall/PaywallModal';

/**
 * GatedFeature — compact locked-state card shown in place of a premium
 * feature when the user's tier doesn't grant access. The CTA opens the
 * PaywallModal with the right variant (Core vs Premium).
 *
 * Props:
 *  - variant: 'interpret' | 'calendar'  (which tier to sell)
 *  - fromTier: user's current effective tier ('free' | 'interpret')
 *  - context: short feature label used in paywall copy
 *  - title / description / ctaLabel: lock card text
 */
export default function GatedFeature({
  variant = 'interpret',
  fromTier = 'free',
  context = '',
  title = 'Unlock this feature',
  description = 'Upgrade to access this.',
  ctaLabel = 'Unlock',
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="rounded-xl border border-gold-primary/20 bg-white/[0.025] px-4 py-5 text-center space-y-2.5">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gold-primary/10 border border-gold-primary/30">
          <Lock size={15} className="text-gold-accent" />
        </div>
        <p className="font-display text-sm font-semibold text-cream">{title}</p>
        <p className="font-body text-xs text-white/70 leading-relaxed max-w-xs mx-auto">{description}</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-xs font-semibold px-4 py-2 rounded-full transition-colors"
        >
          {ctaLabel}
        </button>
      </div>
      {open && (
        <PaywallModal variant={variant} fromTier={fromTier} context={context} onClose={() => setOpen(false)} />
      )}
    </>
  );
}