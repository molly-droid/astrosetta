import React from 'react';

/**
 * Gift option pills with live stock counts — the visible urgency mechanic.
 * Sold-out options are disabled and struck through.
 */
export default function GiftOptionPills({ label, hint, options, value, onChange }) {
  return (
    <div>
      <p className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">{label}</p>
      {hint && <p className="font-body text-[10px] text-brass/40 mb-1.5">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {options.map((o) => {
          const soldOut = o.stock <= 0;
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={soldOut}
              onClick={() => onChange(o.value)}
              className={`px-3 py-1.5 rounded-full font-body text-xs transition-all ${
                active
                  ? 'bg-gold-primary/20 text-cream border border-gold-primary/60'
                  : 'bg-white/[0.04] text-white/60 border border-white/10 hover:border-white/25'
              } ${soldOut ? 'opacity-40' : ''}`}
            >
              <span className={soldOut ? 'line-through' : ''}>{o.label}</span>
              <span className={`ml-1.5 text-[9px] ${soldOut ? 'text-red-300' : 'text-gold-accent'}`}>
                {soldOut ? 'sold out' : `${o.stock} left`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}