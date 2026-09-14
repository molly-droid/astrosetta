import React from 'react';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { KNOWLEDGE_LEVELS, KNOWLEDGE_LABELS, KNOWLEDGE_DESCRIPTIONS } from '@/lib/knowledgeDensity';
import { Sparkles } from 'lucide-react';

/**
 * KnowledgeDensitySlider — three-position toggle that controls the depth of
 * interpretations, curriculum content, and email synthesis across the app.
 * Persists to UserProgress.knowledge_depth in real time via UserPrefsProvider.
 */
export default function KnowledgeDensitySlider({ compact = false }) {
  const { knowledgeDepth, updateDepth } = useUserPrefs();
  const activeIdx = KNOWLEDGE_LEVELS.indexOf(knowledgeDepth);

  return (
    <div className="celestial-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-gold-accent" />
        <div className="flex-1">
          <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Knowledge Density</p>
          <p className="font-body text-[0.625rem] text-brass/40">Scale interpretation & curriculum depth to match your mood</p>
        </div>
        <span className="font-display text-xs font-bold text-gold-accent">{KNOWLEDGE_LABELS[knowledgeDepth]}</span>
      </div>

      <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-0.5">
        {KNOWLEDGE_LEVELS.map((level, i) => {
          const active = knowledgeDepth === level;
          return (
            <button
              key={level}
              onClick={() => updateDepth(level)}
              className={`flex-1 px-2 py-1.5 rounded-full font-body text-[0.6875rem] transition-all ${
                active ? 'bg-gold-primary/20 text-white font-semibold' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {KNOWLEDGE_LABELS[level]}
            </button>
          );
        })}
      </div>

      {!compact && (
        <p className="font-body text-[0.625rem] text-brass/50 italic leading-relaxed">
          {KNOWLEDGE_DESCRIPTIONS[knowledgeDepth]}
        </p>
      )}
    </div>
  );
}