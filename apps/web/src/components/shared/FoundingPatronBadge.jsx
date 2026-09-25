import React from 'react';

/**
 * FoundingPatronBadge — in-app recognition for founding patrons.
 * Renders nothing unless `isFounding` is true, so it can be dropped
 * anywhere unconditionally.
 */
export default function FoundingPatronBadge({ isFounding, showCaption = true, className = '' }) {
  if (!isFounding) return null;
  return (
    <div className={className}>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-accent/10 border border-gold-accent/30">
        <span className="text-gold-accent text-xs">✦</span>
        <span className="font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-gold-accent">Founding Patron</span>
      </span>
      {showCaption && (
        <p className="font-body text-[11px] text-brass/70 mt-1.5 leading-relaxed">
          One of the first to chart the sky with us — your support helped build Astrosetta. This badge is yours forever.
        </p>
      )}
    </div>
  );
}