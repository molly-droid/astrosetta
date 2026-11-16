import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import ShareSheet from './ShareSheet';
import { buildReadingSharePages } from '@/lib/readingShare';

export default function ShareReadingButton({ title, text, getText, glyph, kicker, audienceLabel, dateStr, label = 'Share', filename = 'astrosetta-reading', className = '' }) {
  const [pages, setPages] = useState(null);
  if (!text && !getText) return null;
  const openShare = event => {
    event.stopPropagation();
    const built = buildReadingSharePages({ title, text: getText ? getText() : text, glyph, kicker, audienceLabel, dateStr });
    if (built.length) setPages(built);
  };
  return (
    <>
      <button type="button" onClick={openShare} aria-label={label === 'Share' ? `Share ${title}` : label}
        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 font-body text-xs text-brass hover:bg-gold-primary/10 hover:text-gold-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-accent ${className}`}>
        <Share2 size={13} aria-hidden="true" /> {label}
      </button>
      <ShareSheet open={!!pages} onOpenChange={open => { if (!open) setPages(null); }} pages={pages} filename={filename} />
    </>
  );
}
