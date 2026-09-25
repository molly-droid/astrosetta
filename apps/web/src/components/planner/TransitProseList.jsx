import React from 'react';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { Sparkles, Globe } from 'lucide-react';

/**
 * Renders the LLM-generated transit breakdown (personal_reading + collective_reading)
 * as auto-expanded prose bullets — white body text with gold clickable transit terms.
 * This is the "previous format" the user preferred: visible without clicking each row,
 * with gold-highlighted clickable transit information.
 */
export default function TransitProseList({ synthesis, onHighlightTransit }) {
  if (!synthesis) return null;
  const personal = synthesis.personal_reading || [];
  const collective = synthesis.collective_reading || [];
  if (!personal.length && !collective.length) return null;

  return (
    <div className="space-y-4">
      {personal.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-gold-accent" />
            <p className="font-body text-xs text-brass uppercase tracking-widest font-semibold">Personal Transits</p>
          </div>
          <ul className="space-y-1.5">
            {personal.map((item, i) => (
              <li key={i} className="font-body text-xs text-white/90 leading-snug">
                {highlightSynthesisText(item, onHighlightTransit, 'text-gold-primary')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {collective.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Globe size={12} className="text-gold-accent" />
            <p className="font-body text-xs text-brass uppercase tracking-widest font-semibold">Sky Transits</p>
          </div>
          <ul className="space-y-1.5">
            {collective.map((item, i) => (
              <li key={i} className="font-body text-xs text-white/90 leading-snug">
                {highlightSynthesisText(item, onHighlightTransit, 'text-gold-primary')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}