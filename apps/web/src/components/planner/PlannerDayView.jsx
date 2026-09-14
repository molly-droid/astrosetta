import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Zap } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import { useTransits } from './useTransits';
import TransitList from './TransitList';
import DaySynthesis from './DaySynthesis';
import PlannerJournal from './PlannerJournal';
import JournalMemory from './JournalMemory';
import LunarEventBanner from './LunarEventBanner';
import PlanetaryHighlights from './PlanetaryHighlights';
import TodayHighlightBanners from '@/components/home/TodayHighlightBanners';
import MundaneRitualBanner from './MundaneRitualBanner';
import TransitNatalFormationsBanner from './TransitNatalFormationsBanner';
import IngressBanner from './IngressBanner';
import NavigatorPrompts from './NavigatorPrompts';
import { usePermissions } from '@/lib/permissions';

export default function PlannerDayView({ date, chart, user, spotlightDynamics = false, onSpotlightDismiss, onHighlightPattern, onHighlightTransit, onTransitData }) {
  const { data, loading } = useTransits(date, chart);
  const { canViewTransitInterpretations } = usePermissions(user);
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const lunation = (data?.isExactNewMoon || data?.isExactFullMoon) ? {
    phase: data.isExactFullMoon ? 'Full Moon' : 'New Moon',
    // Use the eclipse-moment sign (derived from the Sun) when this is an
    // eclipse — the noon Moon can lag the sign of the actual eclipse.
    moonSign: data?.isEclipse ? (data.eclipseMoonSign || data?.moonSign) : data?.moonSign,
    isEclipse: !!data?.isEclipse,
    eclipseType: data?.eclipseType,
    lunarAspects: data?.lunarAspects || [],
  } : null;
  const [transitsOpen, setTransitsOpen] = useState(false);
  const [dayTab, setDayTab] = useState('today');
  const [synthesis, setSynthesis] = useState(null);
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);
  const [highlightsFocusTab, setHighlightsFocusTab] = useState('ingresses');
  const [lunarAutoExpand, setLunarAutoExpand] = useState(false);
  const [highlightIngressKey, setHighlightIngressKey] = useState(null);
  const [highlightStationKey, setHighlightStationKey] = useState(null);
  const highlightsRef = useRef(null);

  // Today-tab highlight banners link here — jump to the Transits tab and
  // expand the matching highlight inside the Planetary Highlights card.
  const scrollToHighlights = (focus, key) => {
    const nonce = Date.now();
    if (focus === 'lunation') {
      setLunarAutoExpand(true);
    } else if (focus === 'ingresses') {
      setHighlightsFocusTab('ingresses');
      setHighlightIngressKey(key ? `${key}#${nonce}` : null);
    } else if (focus === 'stations') {
      setHighlightsFocusTab('stations');
      setHighlightStationKey(key ? `${key}#${nonce}` : null);
    }
    setDayTab('transits');
    setHighlightsExpanded(true);
    requestAnimationFrame(() => {
      setTimeout(() => highlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });
  };

  // Lift transit data up to Planner so ChartWheel uses the same data as the transit list
  useEffect(() => { if (data && onTransitData) onTransitData(data); }, [data, onTransitData]);

  return (
    <div className="space-y-4">
      {/* Today / Transits tabs — mirrors Home */}
      <div className="flex border-b border-white/[0.08]">
        {[
          { key: 'today', label: 'Today' },
          { key: 'transits', label: 'Transits' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setDayTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-4 font-body text-xs tracking-widest uppercase transition-colors border-b-2 ${
              dayTab === t.key
                ? 'border-gold-accent text-white font-semibold'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {dayTab === 'today' && (
        <div className="space-y-3">
          {data && (
            <DaySynthesis date={date} chart={chart} transits={data} user={user} onSynthesis={setSynthesis} userId={user?.id} onHighlightTransit={onHighlightTransit} />
          )}
          <TodayHighlightBanners transits={data} chart={chart} onLinkToHighlights={scrollToHighlights} />
          <PlannerJournal dateKey={dateKey} userId={user?.id} synthesis={synthesis} />
          <JournalMemory dateKey={dateKey} userId={user?.id} />
          <NavigatorPrompts date={date} />
        </div>
      )}

      {dayTab === 'transits' && (
        <div className="space-y-4">
          {/* Eclipse / lunation banner — same compact banner shown on Today */}
          {lunation && (
            <LunarEventBanner transits={data} onLinkToHighlights={() => scrollToHighlights('lunation')} />
          )}
          {/* Highlight banners — above the cards, time/context gated */}
          {data?.ingresses?.length > 0 && (
            <IngressBanner ingresses={data.ingresses} chart={chart} compact onLinkToHighlights={scrollToHighlights} />
          )}
          <MundaneRitualBanner transits={data} onHighlight={onHighlightPattern} />
          <TransitNatalFormationsBanner transits={data} chart={chart} dateKey={dateKey} />

          {/* Planetary highlights */}
          {(data?.stations?.length > 0 || data?.ingresses?.length > 0 || lunation) && (
            <div ref={highlightsRef}>
              <PlanetaryHighlights stations={data.stations} ingresses={data.ingresses} lunation={lunation} chart={chart} date={date} lunarAutoExpand={lunarAutoExpand} expanded={highlightsExpanded} onExpandedChange={setHighlightsExpanded} focusTab={highlightsFocusTab} ingressAutoExpand={highlightIngressKey} stationAutoExpand={highlightStationKey} />
            </div>
          )}

          {/* Collapsible transits card */}
          <div className="celestial-card overflow-hidden">
            <CollapsibleCardHeader
              icon={<Zap size={14} />}
              title="Transits"
              subtitle={data ? `${(data.natalAspects?.length || 0) + (data.lunarAspects?.length || 0)} personal · ${data.mundaneAspects?.length || 0} collective` : 'Calculating transits…'}
              expanded={transitsOpen}
              onToggle={() => setTransitsOpen(o => !o)}
            />

            {transitsOpen && (
              <div className="px-4 pb-4 border-t border-gold-primary/20">
                {loading && !data ? (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={18} className="animate-spin text-gold-primary" />
                    <p className="font-body text-xs text-brass italic">Calculating transits...</p>
                  </div>
                ) : (
                  <div className="pt-3">
                    <TransitList data={data} chart={chart} date={date} canViewInterpretations={canViewTransitInterpretations} onHighlightTransit={onHighlightTransit} synthesis={synthesis} />
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}