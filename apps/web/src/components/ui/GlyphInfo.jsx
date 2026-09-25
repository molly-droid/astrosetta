import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Maps astrological glyphs to their names and brief explanations.
 * Shared across the app for click-to-learn functionality.
 */
export const GLYPH_DEFINITIONS = {
  // Planets
  '☉': { name: 'Sun', type: 'planet', desc: 'Core identity, ego, vitality, conscious self' },
  '☽': { name: 'Moon', type: 'planet', desc: 'Emotions, instincts, habits, inner world' },
  '☿': { name: 'Mercury', type: 'planet', desc: 'Communication, intellect, learning, travel' },
  '♀': { name: 'Venus', type: 'planet', desc: 'Love, beauty, values, pleasure, harmony' },
  '♂': { name: 'Mars', type: 'planet', desc: 'Action, drive, desire, aggression, will' },
  '♃': { name: 'Jupiter', type: 'planet', desc: 'Expansion, faith, luck, wisdom, abundance' },
  '♄': { name: 'Saturn', type: 'planet', desc: 'Discipline, structure, limits, maturity, time' },
  '♅': { name: 'Uranus', type: 'planet', desc: 'Innovation, rebellion, breakthroughs, freedom' },
  '♆': { name: 'Neptune', type: 'planet', desc: 'Dreams, intuition, illusion, spirituality, art' },
  '♇': { name: 'Pluto', type: 'planet', desc: 'Transformation, power, death/rebirth, depth' },
  '☊': { name: 'North Node', type: 'planet', desc: 'Life direction, growth edge, soul purpose' },
  '☋': { name: 'South Node', type: 'planet', desc: 'Past patterns, comfort zone, innate gifts' },
  '⚷': { name: 'Chiron', type: 'planet', desc: 'Wounded healer, deepest pain turned to wisdom' },
  '⚸': { name: 'Lilith', type: 'planet', desc: 'Wild feminine, repressed desire, shadow power' },

  // Signs
  '♈': { name: 'Aries', type: 'sign', desc: 'Cardinal Fire — bold, initiatory, impulsive, courageous' },
  '♉': { name: 'Taurus', type: 'sign', desc: 'Fixed Earth — steady, sensual, patient, stubborn' },
  '♊': { name: 'Gemini', type: 'sign', desc: 'Mutable Air — curious, witty, adaptable, scattered' },
  '♋': { name: 'Cancer', type: 'sign', desc: 'Cardinal Water — nurturing, protective, intuitive, moody' },
  '♌': { name: 'Leo', type: 'sign', desc: 'Fixed Fire — creative, generous, proud, dramatic' },
  '♍': { name: 'Virgo', type: 'sign', desc: 'Mutable Earth — analytical, precise, helpful, critical' },
  '♎': { name: 'Libra', type: 'sign', desc: 'Cardinal Air — diplomatic, fair, charming, indecisive' },
  '♏': { name: 'Scorpio', type: 'sign', desc: 'Fixed Water — intense, deep, magnetic, secretive' },
  '♐': { name: 'Sagittarius', type: 'sign', desc: 'Mutable Fire — adventurous, optimistic, blunt, restless' },
  '♑': { name: 'Capricorn', type: 'sign', desc: 'Cardinal Earth — ambitious, disciplined, reserved, authoritative' },
  '♒': { name: 'Aquarius', type: 'sign', desc: 'Fixed Air — innovative, humanitarian, detached, rebellious' },
  '♓': { name: 'Pisces', type: 'sign', desc: 'Mutable Water — compassionate, dreamy, escapist, mystical' },

  // Aspects — verb forms for active, contextual reading
  '☌': { name: 'Conjunction', type: 'aspect', desc: '0° — Two forces merging into one. Energy is amplified, focused, sometimes overwhelming. A fusion point.' },
  '☍': { name: 'Opposition', type: 'aspect', desc: '180° — Two forces pulling in opposite directions. Awareness through tension, balance, and projection onto others.' },
  '□': { name: 'Square', type: 'aspect', desc: '90° — Friction demanding action. A productive crisis that builds strength through resistance.' },
  '△': { name: 'Trine', type: 'aspect', desc: '120° — Effortless flow and harmony. Natural gifts that can become invisible through ease.' },
  '⚹': { name: 'Sextile', type: 'aspect', desc: '60° — Gentle opportunity knocking. Requires conscious effort to open the door.' },
  '⚻': { name: 'Quincunx', type: 'aspect', desc: '150° — Awkward misalignment requiring constant adjustment. Restless, hard to integrate.' },
};

const TYPE_COLORS = {
  planet: 'border-celestial-blue/50 bg-celestial-blue/15',
  sign: 'border-gold-primary/50 bg-gold-primary/15',
  aspect: 'border-purple-300/50 bg-purple-300/15',
};

const POPOVER_W = 224; // w-56 = 14rem = 224px
const POPOVER_H = 90;  // approximate height
const MARGIN = 8;      // min distance from viewport edge

/**
 * A clickable glyph that shows its astrological meaning in a popover.
 * Popover is rendered via a portal at a fixed position so it never clips.
 */
export default function GlyphInfo({ glyph, children, className = '', style }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const def = GLYPH_DEFINITIONS[glyph.replace(/\uFE0E/g, '')];

  useEffect(() => {
    if (!open) return;
    // Close on scroll so popover doesn't drift
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  if (!def) return <span className={className}>{children}</span>;

  const handleClick = (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }

    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer above; fall back to below if not enough room
    let top;
    const spaceAbove = rect.top - MARGIN;
    if (spaceAbove >= POPOVER_H) {
      top = rect.top - POPOVER_H - 6;
    } else {
      top = rect.bottom + 6;
    }

    // Center horizontally on the glyph, then clamp within viewport
    let left = rect.left + rect.width / 2 - POPOVER_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - POPOVER_W - MARGIN));

    // Clamp vertical too
    top = Math.max(MARGIN, Math.min(top, vh - POPOVER_H - MARGIN));

    setPos({ top, left });
    setOpen(true);
  };

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleClick}
        style={style}
        className={`inline cursor-pointer transition-all hover:scale-105 hover:text-gold-accent active:scale-110 ${className}`}
        title={`${def.name}: ${def.desc}`}
        aria-label={`${def.name} — ${def.desc}`}
      >
        {children}
      </button>

      {open && createPortal(
        <>
          {/* Full-screen backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          {/* Popover at computed fixed position */}
          <div
            className={`fixed z-[9999] rounded-xl border shadow-xl p-3 text-left ${TYPE_COLORS[def.type]}`}
            style={{
              top: pos.top,
              left: pos.left,
              width: POPOVER_W,
              background: 'rgba(15, 26, 46, 0.97)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg" style={{ fontVariantEmoji: 'text' }}>{glyph}</span>
              <span className="font-display text-sm font-semibold text-white capitalize">{def.name}</span>
              <span className="font-body text-[9px] uppercase tracking-widest text-white/40 ml-auto">{def.type}</span>
            </div>
            <p className="font-body text-xs leading-relaxed text-white/80">{def.desc}</p>
          </div>
        </>,
        document.body
      )}
    </span>
  );
}