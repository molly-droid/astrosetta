import React from 'react';
import { Sparkles, X } from 'lucide-react';

export default function SpotlightCallout({ text, onDismiss }) {
  return (
    <div className="rounded-lg border border-gold-accent/40 bg-gold-primary/10 px-2.5 py-2 flex items-start gap-1.5 animate-fade-up">
      <Sparkles size={10} className="text-gold-accent flex-shrink-0 mt-0.5" />
      <p className="font-body text-[10px] text-gold-accent/90 leading-snug flex-1">{text}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-brass/40 hover:text-brass flex-shrink-0 mt-0.5">
          <X size={10} />
        </button>
      )}
    </div>
  );
}