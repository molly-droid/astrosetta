import React from 'react';
import { Share2 } from 'lucide-react';

/**
 * Small share icon for banner rows. Calls onClick and stops propagation so it
 * doesn't trigger the parent banner's expand/link handler.
 */
export default function ShareIconButton({ onClick, title = 'Share card', size = 14, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg text-brass/40 hover:text-gold-accent hover:bg-gold-primary/10 transition-all ${className}`}
    >
      <Share2 size={size} />
    </button>
  );
}