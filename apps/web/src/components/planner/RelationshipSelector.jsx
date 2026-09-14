import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Plus, Heart, Lock } from 'lucide-react';
import PaywallModal from '@/components/paywall/PaywallModal';

/**
 * RelationshipSelector — the Planner's relationship-mode entry point.
 *
 * Reuses the SynastryPartnerSwitcher pill + modal pattern from the Chart page.
 * In swap mode: selecting a partner replaces the user's personal read with a
 * relationship read for that person; a "With: [name] ✕" chip is shown while
 * active, and tapping ✕ returns to the user's own reads.
 *
 * Gated at the Core tier: free users tapping the selector hit the paywall.
 * Saved charts of chart_type 'event' are excluded (no relational pairing).
 *
 * Props:
 *  - selectedChart: SavedChart | null
 *  - savedCharts: SavedChart[] (person-type only — caller pre-filters)
 *  - canUse: boolean (Core tier or above)
 *  - onSelect(id): enter relationship mode for a partner
 *  - onClear(): leave relationship mode, return to personal reads
 *  - onAddChart(): open the SavedChartManager
 */
export default function RelationshipSelector({ selectedChart, savedCharts, canUse, onSelect, onClear, onAddChart }) {
  const [open, setOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handlePillClick = () => {
    if (!canUse) { setShowPaywall(true); return; }
    setOpen((o) => !o);
  };

  const handleSelect = (id) => {
    onSelect?.(id);
    setOpen(false);
  };

  const handleAddChart = () => {
    onAddChart?.();
    setOpen(false);
  };

  return (
    <>
      <button onClick={handlePillClick} className="relative px-4 py-1.5 rounded-full font-body text-[11px] tracking-wide transition-all flex items-center gap-1 text-white/30 hover:text-white/60">
        {!canUse && <Lock size={11} className="shrink-0 text-brass/50" />}
        <span>Relationship</span>
        <ChevronDown size={10} className={`transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <PartnerPicker
          selectedChart={selectedChart}
          savedCharts={savedCharts}
          onSelect={handleSelect}
          onAddChart={handleAddChart}
          onClose={() => setOpen(false)}
        />
      )}

      {showPaywall && (
        <PaywallModal variant="interpret" fromTier="free" context="Relationship Planner" onClose={() => setShowPaywall(false)} />
      )}
    </>
  );
}

function PartnerPicker({ selectedChart, savedCharts, onSelect, onAddChart, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4 pb-[72px] sm:pb-0" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-paper rounded-t-2xl sm:rounded-2xl border border-gold-primary/30 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p className="font-body text-[10px] text-celestial-pink/80 uppercase tracking-widest">Relationship Mode</p>
            <h2 className="font-display text-sm font-bold text-cream">Read the Sky With Someone</h2>
          </div>
          <button onClick={onClose} className="text-brass/50 hover:text-brass transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-2 space-y-1">
          {savedCharts.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="text-3xl text-gold-accent/30 mb-2" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>♥</div>
              <p className="font-body text-sm text-brass/60 italic">No saved charts yet — add a person to read the sky through your bond.</p>
            </div>
          )}

          {savedCharts.map((c) => (
            <PartnerRow key={c.id} active={selectedChart?.id === c.id} onClick={() => onSelect(c.id)} chart={c} />
          ))}

          <button onClick={onAddChart} className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg border border-dashed border-gold-primary/30 hover:border-gold-accent hover:bg-gold-primary/5 transition-all">
            <Plus size={14} className="text-gold-accent shrink-0" />
            <span className="font-body text-xs text-gold-accent">Add a Chart</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PartnerRow({ active, onClick, chart }) {
  const sublabel = chart.relationship ? `Your ${chart.relationship}` : '';
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-left border ${active ? 'bg-celestial-pink/15 border-celestial-pink/40' : 'border-transparent hover:bg-white/[0.04]'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Heart size={11} className="text-celestial-pink shrink-0" />
          <span className={`font-body text-sm truncate ${active ? 'text-cream font-semibold' : 'text-white/90'}`}>{chart.name}</span>
          {sublabel && <span className="font-body text-[10px] text-brass/50 italic truncate">{sublabel}</span>}
        </div>
        {chart.sun_sign && (
          <p className="font-body text-[10px] text-brass/50 truncate mt-0.5">
            ☉ {chart.sun_sign} · ☽ {chart.moon_sign} · AC {chart.ascendant_sign}
          </p>
        )}
      </div>
      {active && <Check size={14} className="text-celestial-pink shrink-0" />}
    </button>
  );
}