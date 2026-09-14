import React from 'react';

// Shared visual format for the Maximize / Focus On / Watch Out For cards used
// across the Day and Month synthesis views. Renders a single string as one
// paragraph (Day style) or an array as a bulleted list (Month style), with
// identical card chrome, label sizing, and color coding in both cases.

export const SYNTHESIS_CATEGORY_COLORS = {
  maximize: 'border-green-soft/40 bg-green-soft/10',
  focus: 'border-celestial-blue/40 bg-celestial-blue/10',
  watch: 'border-gold-accent/40 bg-gold-accent/10',
};

export const SYNTHESIS_CATEGORY_LABELS = {
  maximize: { icon: '✦', label: 'Maximize' },
  focus: { icon: '◎', label: 'Focus On' },
  watch: { icon: '⚠', label: 'Watch Out For' },
};

const SYNTHESIS_LABEL_COLORS = {
  maximize: 'text-green-400',
  focus: 'text-celestial-blue',
  watch: 'text-red-400',
};

export default function SynthesisCategoryCard({ category, value, highlightFn }) {
  if (!value) return null;
  const items = Array.isArray(value) ? value : [value];
  if (!items.length) return null;
  const meta = SYNTHESIS_CATEGORY_LABELS[category];
  if (!meta) return null;
  const hl = highlightFn || ((t) => t);
  return (
    <div className={`rounded-lg border p-3 ${SYNTHESIS_CATEGORY_COLORS[category]}`}>
      <p className={`font-body text-[10px] uppercase tracking-widest font-semibold mb-1.5 ${SYNTHESIS_LABEL_COLORS[category]}`}>
        {meta.icon} {meta.label}
      </p>
      {items.length === 1 ? (
        <p className="font-body text-xs leading-snug text-white">{hl(items[0])}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="font-body text-xs leading-snug text-white">• {hl(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}