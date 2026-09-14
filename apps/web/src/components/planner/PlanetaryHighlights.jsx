import React, { useState, Suspense, lazy } from 'react';
import { ECLIPSE_META } from '@/lib/eclipseUtils';
import { Orbit, Loader2 } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';

// Heavy planner banners are only needed on the Transits tab — load them on
// demand so they stay out of the initial Home bundle.
const StationBanner = lazy(() => import('@/components/planner/StationBanner'));
const IngressBanner = lazy(() => import('@/components/planner/IngressBanner'));
const LunarHighlight = lazy(() => import('@/components/planner/LunarHighlight'));

const BannerSuspense = ({ children }) => (
  <Suspense fallback={<div className="flex items-center justify-center py-6"><Loader2 className="animate-spin text-gold-primary" size={16} /></div>}>
    {children}
  </Suspense>
);

function eventSortKey(item) {
  if (item.exact) return 0;
  if (item.recent) return 1;
  if (item.approaching) return 2 + (item.days_until || 99);
  return 200;
}

export default function PlanetaryHighlights({ stations, ingresses, lunation, chart, date, lunarAutoExpand, expanded, onExpandedChange, focusTab, ingressAutoExpand, stationAutoExpand }) {
  const hasStations = stations?.length > 0;
  const hasIngresses = ingresses?.length > 0;
  const hasLunation = !!lunation;

  // Support controlled (linked from transits highlight) + uncontrolled (own toggle) modes
  const isControlled = expanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expandedVal = isControlled ? expanded : internalExpanded;
  const setExpanded = (v) => {
    if (isControlled) onExpandedChange?.(v);
    else setInternalExpanded(v);
  };

  if (!hasStations && !hasIngresses && !hasLunation) return null;

  // Build a compact summary for the collapsed header
  const allEvents = [
    ...(hasStations ? stations.map(s => ({ ...s, _kind: 'station' })) : []),
    ...(hasIngresses ? ingresses.map(i => ({ ...i, _kind: 'ingress' })) : []),
  ].sort((a, b) => eventSortKey(a) - eventSortKey(b));

  const nextEvent = allEvents[0];
  const summaryParts = [];
  if (hasLunation) summaryParts.push(lunation.isEclipse ? (ECLIPSE_META[lunation.eclipseType]?.label || 'Eclipse') : lunation.phase);
  if (hasStations) summaryParts.push(`${stations.length} station${stations.length === 1 ? '' : 's'}`);
  if (hasIngresses) summaryParts.push(`${ingresses.length} ingress${ingresses.length === 1 ? '' : 'es'}`);
  const summary = summaryParts.join(' · ');

  const nextLabel = nextEvent
    ? nextEvent._kind === 'station'
      ? `${nextEvent.planet} ${nextEvent.approaching ? '→ ' + nextEvent.type : nextEvent.type}`
      : `${nextEvent.planet} → ${nextEvent.to_sign || nextEvent.sign}`
    : '';

  const headerSubtitle = expandedVal
    ? summary
    : (
        <>
          {summary}
          {nextLabel && <> · next: <span className="text-gold-accent">{nextLabel}</span></>}
        </>
      );

  return (
    <div className="celestial-card overflow-hidden">
      <CollapsibleCardHeader
        icon={<Orbit size={14} />}
        title="Planetary Highlights"
        subtitle={headerSubtitle}
        expanded={expandedVal}
        onToggle={() => setExpanded(!expandedVal)}
      />

      {expandedVal && (
        <div className="px-4 pb-4 border-t border-gold-primary/15">
          {hasLunation && (
            <div className="mt-3">
              <BannerSuspense>
                <LunarHighlight lunation={lunation} chart={chart} date={date} autoExpand={lunarAutoExpand} />
              </BannerSuspense>
            </div>
          )}
          {hasStations && (
            <div className="mt-3">
              <p className="font-body text-[9px] uppercase tracking-widest text-gold-accent/70 mb-1.5">Stations</p>
              <BannerSuspense>
                <StationBanner stations={stations} chart={chart} stationAutoExpand={stationAutoExpand} />
              </BannerSuspense>
            </div>
          )}
          {hasIngresses && (
            <div className="mt-3">
              <p className="font-body text-[9px] uppercase tracking-widest text-gold-accent/70 mb-1.5">Ingresses</p>
              <BannerSuspense>
                <IngressBanner ingresses={ingresses} chart={chart} ingressAutoExpand={ingressAutoExpand} />
              </BannerSuspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}