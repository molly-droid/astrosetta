import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Plus, Calendar } from 'lucide-react';

/**
 * SynastryPartnerSwitcher
 *
 * The right-hand pill in the Natal/Synastry toggle. Mirrors the
 * ChartPerspectiveSwitcher interaction exactly: tapping the pill activates
 * synastry view and opens a portal dropdown listing saved charts to compare
 * against the current primary. No premium gating — every saved chart is
 * selectable (synastry remains free, as before).
 *
 * Props:
 *  - selectedChart: SavedChart | null  (currently chosen partner)
 *  - savedCharts: SavedChart[]         (already filtered to exclude the active primary)
 *  - isActive: whether synastry view is currently selected (pill highlight)
 *  - onSelect(id): choose a partner chart
 *  - onActivate(): switch the page into synastry view
 *  - onAddChart(): open the SavedChartManager
 */
export default function SynastryPartnerSwitcher({
  selectedChart,
  savedCharts,
  isActive,
  onSelect,
  onActivate,
  onAddChart,
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = selectedChart?.name || 'Relationship';

  const handlePillClick = () => {
    onActivate?.();
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
      <button
        onClick={handlePillClick}
        className={`relative px-4 py-1.5 rounded-full font-body text-[11px] tracking-wide transition-all flex items-center gap-1 ${
          isActive ? 'bg-gold-primary/20 text-white' : 'text-white/30 hover:text-white/60'
        }`}
      >
        <span className="max-w-[120px] truncate">{activeLabel}</span>
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
    </>
  );
}

function PartnerPicker({ selectedChart, savedCharts, onSelect, onAddChart, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4 pb-[72px] sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-paper rounded-t-2xl sm:rounded-2xl border border-gold-primary/30 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p className="font-body text-[10px] text-gold-primary/70 uppercase tracking-widest">Relationship</p>
            <h2 className="font-display text-sm font-bold text-cream">Choose a Chart to Compare</h2>
          </div>
          <button onClick={onClose} className="text-brass/50 hover:text-brass transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-2 space-y-1">
          {savedCharts.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="text-3xl text-gold-accent/30 mb-2" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>∞</div>
              <p className="font-body text-sm text-brass/60 italic">No saved charts yet — add one to compare.</p>
            </div>
          )}

          {savedCharts.map((c) => (
            <PartnerRow
              key={c.id}
              active={selectedChart?.id === c.id}
              onClick={() => onSelect(c.id)}
              label={c.name}
              sublabel={c.chart_type === 'event' ? c.relationship : (c.relationship ? `Your ${c.relationship}` : '')}
              big3={c}
              isEvent={c.chart_type === 'event'}
            />
          ))}

          {/* Add chart */}
          <button
            onClick={onAddChart}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg border border-dashed border-gold-primary/30 hover:border-gold-accent hover:bg-gold-primary/5 transition-all"
          >
            <Plus size={14} className="text-gold-accent shrink-0" />
            <span className="font-body text-xs text-gold-accent">Add/Edit Charts</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PartnerRow({ active, onClick, label, sublabel, big3, isEvent }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-left border ${
        active
          ? 'bg-gold-primary/15 border-gold-primary/40'
          : 'border-transparent hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isEvent && <Calendar size={11} className="text-celestial-purple shrink-0" />}
          <span className={`font-body text-sm truncate ${active ? 'text-cream font-semibold' : 'text-white/90'}`}>
            {label}
          </span>
          {sublabel && (
            <span className="font-body text-[10px] text-brass/50 italic truncate">{sublabel}</span>
          )}
        </div>
        {big3?.sun_sign && (
          <p className="font-body text-[10px] text-brass/50 truncate mt-0.5">
            ☉ {big3.sun_sign} · ☽ {big3.moon_sign} · AC {big3.ascendant_sign}
          </p>
        )}
      </div>
      {active && <Check size={14} className="text-gold-accent shrink-0" />}
    </button>
  );
}