import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

const TOOLTIPS = [
  {
    id: 'today',
    tab: 'weather',
    target: 'tour-tab-weather',
    title: 'Today\'s Reading',
    desc: 'Your daily horoscope and synthesis based on today\'s planetary weather against your natal chart.',
  },
  {
    id: 'transits',
    tab: 'transits',
    target: 'tour-tab-transits',
    title: 'Transits',
    desc: 'See every active planetary aspect and ingress — both personal (hits your natal chart) and collective.',
  },
  {
    id: 'learn',
    tab: 'learn',
    target: 'tour-tab-learn',
    title: 'Learn',
    desc: 'Your daily quiz and the full curriculum — modules on planets, signs, houses, and aspects.',
  },
  {
    id: 'chart',
    target: 'tour-chart-wheel',
    title: 'Your Chart',
    desc: 'Tap any planet or house to get an interpretation of that placement in your chart.',
  },
];

const STORAGE_KEY = 'astrosetta_first_visit_done';

export default function FirstVisitTooltips({ activeTab, onTabChange }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState(null);
  const rafRef = useRef(null);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setVisible(true);
    } catch (e) {
      // localStorage might be unavailable
    }
  }, []);

  // Measure target element position whenever step or visibility changes
  useLayoutEffect(() => {
    if (!visible) return;

    const measure = () => {
      const tip = TOOLTIPS[step];
      const el = document.querySelector(`[data-tour="${tip.target}"]`);
      if (!el) {
        setCoords(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    // Small delay so any tab change / scroll settles before measuring
    rafRef.current = setTimeout(measure, 150);

    // Re-measure on resize
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(rafRef.current);
      window.removeEventListener('resize', measure);
    };
  }, [visible, step]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    setVisible(false);
  };

  const next = () => {
    if (step < TOOLTIPS.length - 1) {
      const nextStep = step + 1;
      const tip = TOOLTIPS[nextStep];
      if (tip.tab && onTabChange) onTabChange(tip.tab);
      setStep(nextStep);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const tip = TOOLTIPS[step];
  const isLast = step === TOOLTIPS.length - 1;

  // Compute card position from measured coordinates
  let cardStyle = {};
  if (coords) {
    const cardWidth = Math.min(380, window.innerWidth - 32);
    let left = coords.left + coords.width / 2 - cardWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - cardWidth - 16));

    const below = coords.top + coords.height + 12;
    const above = coords.top - 12;
    // Prefer below; if not enough room, position above
    const placeBelow = below + 200 < window.innerHeight;
    const cardTop = placeBelow ? below : Math.max(16, above - 180);

    cardStyle = {
      position: 'fixed',
      top: `${cardTop}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 50,
    };
  } else {
    // Fallback: centered below header
    cardStyle = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      top: '120px',
      width: 'calc(100% - 2rem)',
      maxWidth: '380px',
      zIndex: 50,
    };
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(7, 16, 30, 0.55)' }}
      />

      {/* Highlight ring around target */}
      {coords && (
        <div
          className="fixed z-40 rounded-lg pointer-events-none transition-all duration-300"
          style={{
            // Clamp to the viewport so the ring's border stays visible on
            // full-bleed targets (e.g. the edge-to-edge home tab buttons).
            top: `${coords.top - 4}px`,
            left: `${Math.max(4, coords.left - 4)}px`,
            width: `${Math.min(window.innerWidth - 4, coords.left + coords.width + 4) - Math.max(4, coords.left - 4)}px`,
            height: `${coords.height + 8}px`,
            boxShadow: '0 0 0 2px rgba(201, 169, 97, 0.6), 0 0 20px rgba(201, 169, 97, 0.25)',
            background: 'rgba(201, 169, 97, 0.04)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={cardStyle}>
        <div className="celestial-card border border-gold-primary/30 p-4 shadow-2xl animate-fade-up">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-gold-accent font-display text-base">✦</span>
              <span className="font-display text-sm font-bold text-white">{tip.title}</span>
            </div>
            <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>

          <p className="font-body text-xs text-brass/80 leading-relaxed mb-4">{tip.desc}</p>

          {/* Progress dots + action */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TOOLTIPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-4 bg-gold-accent' : 'w-1.5 bg-white/20'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="font-body text-xs font-semibold text-gold-accent hover:text-gold-primary transition-colors px-3 py-1.5 rounded-lg border border-gold-accent/30 hover:border-gold-accent/60"
            >
              {isLast ? 'Got it' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}