import React from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import useExplanation from '@/hooks/useExplanation';
import { highlightSynthesisText } from '@/lib/transitUtils';

/**
 * "Explain it" — an optional, even-simpler breakdown of an interpretation,
 * shown at every Knowledge Density. The simplification dumbs the content down
 * two levels below the user's current density (technical → layperson,
 * insightful → 10-year-old, essential → absolute beginner).
 *
 * @param {string} context - Plain-English description of the configuration
 *   to explain, e.g. "Saturn in Pisces squaring natal Sun in the 3rd house".
 */
export default function Eli5Button({ context }) {
  const { knowledgeDepth } = useUserPrefs();
  const { open, text, loading, toggle: handleExplain } = useExplanation(context, knowledgeDepth);
  if (!context) return null;

  return (
    <div className="mt-2">
      <button
        onClick={handleExplain}
        className="inline-flex items-center gap-1 font-body text-[0.625rem] text-gold-accent hover:text-gold-primary border border-gold-primary/30 hover:border-gold-primary/50 bg-gold-primary/5 hover:bg-gold-primary/10 rounded-full px-2.5 py-1 transition-colors"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={11} />}
        Explain it
      </button>
      {open && (loading || text) && (
        <div className="mt-2 rounded-lg border border-gold-primary/20 bg-gold-primary/5 p-2.5">
          {loading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin text-gold-primary" />
              <span className="font-body text-[0.625rem] text-brass italic">Simplifying...</span>
            </div>
          ) : (
            <p className="font-body text-[0.6875rem] text-white/85 leading-snug">{highlightSynthesisText(text)}</p>
          )}
        </div>
      )}
    </div>
  );
}