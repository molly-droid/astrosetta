import React, { useState } from 'react';
import { CalendarRange, Route } from 'lucide-react';
import MarketingCalendar from './MarketingCalendar';
import RoadmapTab from './RoadmapTab';

const VIEWS = [
  { key: 'marketing', label: 'Marketing Calendar', icon: CalendarRange },
  { key: 'roadmap', label: 'Product Roadmap', icon: Route },
];

/**
 * Combined planning tab — the marketing calendar and the product roadmap in
 * one place, switched with pills instead of two separate admin tabs.
 */
export default function RoadmapMarketingTab() {
  const [view, setView] = useState('marketing');

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2 px-5 pt-1 pb-3 border-b border-white/[0.06]">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex items-center gap-1.5 font-body text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
              view === key
                ? 'border-gold-accent bg-gold-primary/20 text-white'
                : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
      {view === 'marketing' ? <MarketingCalendar /> : <div className="px-5"><RoadmapTab /></div>}
    </div>
  );
}