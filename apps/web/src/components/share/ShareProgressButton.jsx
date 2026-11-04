import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import ShareSheet from './ShareSheet';
import { buildQuizResultCardData } from '@/lib/shareCard';

/**
 * F-06: share a quiz result or a milestone (level-up, module completed) as a
 * stats card that carries the Astrosetta name and a link, so it doubles as an
 * invite. `card` is the input to buildQuizResultCardData.
 */
export default function ShareProgressButton({ card, label = 'Share', filename = 'astrosetta-progress', className = '' }) {
  const [open, setOpen] = useState(false);
  const built = open ? buildQuizResultCardData(card) : null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center gap-1.5 font-body text-xs text-brass hover:text-gold-accent transition-colors ${className}`}
      >
        <Share2 size={12} /> {label}
      </button>
      <ShareSheet open={open} onOpenChange={setOpen} card={built} filename={filename} textFallback={built?.textFallback || ''} />
    </>
  );
}
