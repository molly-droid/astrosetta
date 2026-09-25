import React, { useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { fetchExplanation } from '@/lib/explainIt';
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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!context) return null;

  const handleExplain = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (text) return;
    setLoading(true);
    try {
      const res = await fetchExplanation(context, knowledgeDepth);
      setText(res);
    } catch { /* non-critical */ }
    setLoading(false);
  };

  return (
    <div className="mt-2">
      <button
        onClick={handleExplain}
        className="inline-flex items-center gap-1 font-body text-[10px] text-gold-accent hover:text-gold-primary border border-gold-primary/30 hover:border-gold-primary/50 bg-gold-primary/5 hover:bg-gold-primary/10 rounded-full px-2.5 py-1 transition-colors"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={11} />}
        Explain it
      </button>
      {open && (loading || text) && (
        <div className="mt-2 rounded-lg border border-gold-primary/20 bg-gold-primary/5 p-2.5">
          {loading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin text-gold-primary" />
              <span className="font-body text-[10px] text-brass italic">Simplifying...</span>
            </div>
          ) : (
            <p className="font-body text-[11px] text-white/85 leading-snug">{highlightSynthesisText(text)}</p>
          )}
        </div>
      )}
    </div>
  );
}