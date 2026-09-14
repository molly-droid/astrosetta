import React, { useRef, useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * ScrollableTabs — a horizontally scrollable tab bar with a glowing
 * right-edge indicator that appears when more tabs are hidden off-screen.
 *
 * Props:
 *   tabs:      [{ key, label }]
 *   activeTab: string
 *   onChange:  (key) => void
 *   className: string (optional, applied to the outer wrapper)
 */
export default function ScrollableTabs({ tabs, activeTab, onChange, className = '', renderTab, fullWidth = false }) {
  const scrollRef = useRef(null);
  const [showIndicator, setShowIndicator] = useState(false);

  const checkOverflow = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasMore = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setShowIndicator(hasMore);
  };

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkOverflow);
      ro.disconnect();
    };
  }, [tabs]);

  return (
    <div className={`relative border-t border-white/[0.08] ${className}`}>
      {/* Scrollable tab row */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`${fullWidth ? 'flex-1' : 'flex-none'} flex items-center justify-center gap-1.5 py-3 ${fullWidth ? 'px-2' : 'px-5'} font-body text-xs tracking-widest uppercase transition-colors border-b-2 whitespace-nowrap ${
              activeTab === t.key
                ? 'border-gold-accent text-white font-semibold'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {renderTab ? renderTab(t) : t.label}
          </button>
        ))}
      </div>

      {/* Glowing overflow indicator */}
      {showIndicator && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 flex items-center justify-end pr-1"
          style={{
            width: 56,
            background: 'linear-gradient(to right, transparent, rgba(10,18,34,0.92) 60%)',
          }}
        >
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full"
            style={{
              background: 'rgba(201, 169, 97, 0.15)',
              boxShadow: '0 0 8px 2px rgba(201, 169, 97, 0.35)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <ChevronRight size={13} className="text-gold-accent" />
          </div>
        </div>
      )}
    </div>
  );
}