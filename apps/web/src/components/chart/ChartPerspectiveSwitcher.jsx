import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Lock, Check, Plus, Calendar } from 'lucide-react';
import PaywallModal from '@/components/paywall/PaywallModal';

/**
 * ChartPerspectiveSwitcher
 *
 * Replaces the static "My Chart" pill in the Natal/Synastry toggle with a
 * tappable dropdown. Premium users can switch the entire Chart page to view
 * any of their saved charts as the primary chart. Free/Core users see saved
 * charts dimmed with a lock icon; tapping one opens a PaywallModal.
 *
 * Props:
 *  - activePerspectiveId: '' (personal chart) | SavedChart.id
 *  - activeLabel: pill text ('My Chart' or the saved chart's name)
 *  - isActive: whether natal view is currently selected (for pill highlight)
 *  - savedCharts: SavedChart[] belonging to the user
 *  - personalChart: the user's Chart entity (for the "My Chart" row big-3)
 *  - user, isPremium, fromTier
 *  - onSelect(perspectiveId): choose a chart as primary
 *  - onActivate(): switch the page into natal view
 *  - onAddChart(): open the SavedChartManager
 */
export default function ChartPerspectiveSwitcher({
  activePerspectiveId,
  activeLabel,
  isActive,
  savedCharts,
  personalChart,
  user,
  isPremium,
  fromTier = 'free',
  onSelect,
  onActivate,
  onAddChart,
}) {
  const [open, setOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handlePillClick = () => {
    onActivate?.();
    setOpen((o) => !o);
  };

  const handleSelect = (id) => {
    onSelect?.(id);
    setOpen(false);
  };

  const handleLockedTap = () => {
    setOpen(false);
    setShowPaywall(true);
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
        <PerspectivePicker
          activePerspectiveId={activePerspectiveId}
          savedCharts={savedCharts}
          personalChart={personalChart}
          user={user}
          isPremium={isPremium}
          onSelect={handleSelect}
          onLockedTap={handleLockedTap}
          onAddChart={handleAddChart}
          onClose={() => setOpen(false)}
        />
      )}

      {showPaywall && (
        <PaywallModal
          variant="calendar"
          fromTier={fromTier}
          context="Multi-Chart Perspectives"
          onClose={() => setShowPaywall(false)}
        />
      )}
    </>
  );
}

function PerspectivePicker({
  activePerspectiveId,
  savedCharts,
  personalChart,
  user,
  isPremium,
  onSelect,
  onLockedTap,
  onAddChart,
  onClose,
}) {
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
            <p className="font-body text-[10px] text-gold-primary/70 uppercase tracking-widest">Perspective</p>
            <h2 className="font-display text-sm font-bold text-cream">Choose a Chart</h2>
          </div>
          <button onClick={onClose} className="text-brass/50 hover:text-brass transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto p-2 space-y-1">
          {/* My Chart — personal natal chart, always at top */}
          <PerspectiveRow
            active={!activePerspectiveId}
            onClick={() => onSelect('')}
            label="My Chart"
            sublabel={user?.display_name || user?.full_name}
            big3={personalChart}
          />

          {/* Saved charts */}
          {savedCharts.length > 0 && (
            <div className="pt-2 pb-1 px-2">
              <p className="font-body text-[9px] uppercase tracking-widest text-brass/40">Saved Charts</p>
            </div>
          )}
          {savedCharts.map((c) => (
            <PerspectiveRow
              key={c.id}
              active={activePerspectiveId === c.id}
              onClick={() => (isPremium ? onSelect(c.id) : onLockedTap())}
              locked={!isPremium}
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

function PerspectiveRow({ active, onClick, label, sublabel, big3, locked, isEvent }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-left border ${
        active
          ? 'bg-gold-primary/15 border-gold-primary/40'
          : 'border-transparent hover:bg-white/[0.04]'
      } ${locked ? 'opacity-50' : ''}`}
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
      {locked ? (
        <Lock size={13} className="text-brass/40 shrink-0" />
      ) : active ? (
        <Check size={14} className="text-gold-accent shrink-0" />
      ) : null}
    </button>
  );
}