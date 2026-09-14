import React from 'react';
import { X } from 'lucide-react';
import DaySynthesis from './DaySynthesis';

/**
 * Full-screen modal that surfaces the complete daily synthesis for a tapped day.
 * Shared by the Week day-by-day list and the Month calendar.
 */
export default function DaySynthesisPopover({ date, chart, onClose }) {
  return (
    <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full sm:max-w-lg h-[92vh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" style={{ background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.2)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold-primary/20 flex-shrink-0">
          <p className="font-body text-xs text-brass uppercase tracking-widest">
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <button onClick={onClose} className="text-brass/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 pb-10">
          <DaySynthesis date={date} chart={chart} transits={null} autoExpand={true} />
        </div>
      </div>
    </div>
  );
}