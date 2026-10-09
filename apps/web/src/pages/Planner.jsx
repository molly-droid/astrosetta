import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, X, Sparkles } from 'lucide-react';
import LazyChartWheel from '@/components/chart/LazyChartWheel';
import ManageChartViewLink from '@/components/chart/ManageChartViewLink';
import PageHeader from '@/components/layout/PageHeader';
import { getMoonPhaseIcon } from '@/lib/moonPhase';
import PlannerDayView from '@/components/planner/PlannerDayView';
import PlannerWeekView from '@/components/planner/PlannerWeekView';
import PlannerMonthView from '@/components/planner/PlannerMonthView';
import GoogleCalendarConnect from '@/components/profile/GoogleCalendarConnect';
import { usePermissions, getEffectiveTier } from '@/lib/permissions';
import { track, EVENTS } from '@/lib/analytics';
import { useTabUrl } from '@/hooks/useTabUrl';
import RelationshipSelector from '@/components/planner/RelationshipSelector';
import RelationshipBadge from '@/components/planner/RelationshipBadge';
import RelationshipDayView from '@/components/planner/RelationshipDayView';
import RelationshipWeekSynthesis from '@/components/planner/RelationshipWeekSynthesis';
import RelationshipMonthSynthesis from '@/components/planner/RelationshipMonthSynthesis';
import CompositeDaySynthesis from '@/components/planner/CompositeDaySynthesis';
import CompositePeriodStub from '@/components/planner/CompositePeriodStub';
import { useTransits } from '@/components/planner/useTransits';
import { useCompositeTransits } from '@/components/planner/useCompositeTransits';
import { buildSynastryOverlay } from '@/lib/synastryOverlay';
import { buildCompositeChartObject } from '@/lib/compositeSynthesis';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';
import SavedChartManager from '@/components/chart/SavedChartManager';
import PlannerPerspectivePicker from '@/components/planner/PlannerPerspectivePicker';
import { bondVerbiage } from '@/lib/relationshipVerbiage';

const TABS = [
  { key: 'Day',   label: 'Day' },
  { key: 'Week',  label: 'Week' },
  { key: 'Month', label: 'Month' },
];

export default function Planner() {
  const { user } = useAuth();
  const perms = usePermissions(user);
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useTabUrl('view', 'Day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [dayTransitData, setDayTransitData] = useState(null);
  const [spotlightDynamics, setSpotlightDynamics] = useState(false);
  // 'natal' | 'overlay'
  const [chartMode, setChartMode] = useState('overlay');
  const [highlightPattern, setHighlightPattern] = useState(null);
  const [highlightKey, setHighlightKey] = useState(null);
  // Relationship mode — swap the whole Planner to a relationship read for a
  // selected saved chart (partner, friend, etc.). Persists across view
  // switches via the `with` URL param.
  const [savedCharts, setSavedCharts] = useState([]);
  const [partnerChartId, setPartnerChartId] = useState('');
  // Perspective (base) chart — defaults to the user's own chart (''), or any
  // saved chart the user picks, mirroring the Chart page. The base chart is
  // what transits land on and one half of any relationship read.
  const [perspectiveChartId, setPerspectiveChartId] = useState('');
  const [showManager, setShowManager] = useState(false);
  // Relationship Day view: toggle the wheel overlay between the partner's
  // chart (synastry) and today's live transits (natal + now). 'synastry' is
  // the default so the relationship chart shows first; 'now' overlays the
  // live sky onto your natal so you can see how the day is landing on you.
  const [relOverlay, setRelOverlay] = useState('synastry');
  // Relationship read lens: 'synastry' (two individual charts woven together)
  // or 'composite' (the relationship as one midpoint entity). Composite Day
  // swaps the wheel to the composite chart + transits-to-composite; Week/Month
  // composite stub to a cross-link until those syntheses are built.
  const [relMode, setRelMode] = useState('synastry');

  const effectiveTier = getEffectiveTier(user);
  const isPremium = effectiveTier === 'calendar';
  const canUseRelationship = effectiveTier !== 'free';
  const partnerChart = savedCharts.find((c) => c.id === partnerChartId) || null;
  const perspectiveChart = savedCharts.find((c) => c.id === perspectiveChartId) || null;
  const baseChart = perspectiveChart || chart;
  const personSavedCharts = savedCharts.filter((c) => c.chart_type !== 'event' && c.id !== perspectiveChartId);
  const hiddenPoints = getHiddenChartPoints(user);
  const baseLabel = perspectiveChart ? `${perspectiveChart.name}'s` : 'Your';
  const bond = bondVerbiage(perspectiveChart, partnerChart, 'Reading the sky through your bond with');
  // Synastry overlay (partner planets + cross-aspects) built client-side from
  // the two stored charts — no network call. Honors hidden chart points.
  const synastryOverlay = React.useMemo(
    () => (partnerChart && baseChart ? buildSynastryOverlay(baseChart.raw_data, partnerChart.raw_data, hiddenPoints) : null),
    [baseChart, partnerChart, hiddenPoints],
  );
  // Live transits for the current date — reused by the relationship 'Natal +
  // Now' overlay. The hook's internal cache means no duplicate fetch when the
  // personal Day view fetches the same date.
  const { data: relTransitData, loading: relTransitLoading } = useTransits(currentDate, baseChart);
  // Composite chart (relationship as one entity) + transits to it, for the
  // composite Day wheel overlay. Built client-side (midpoint math) — no extra
  // network call beyond the transit fetch the hook manages.
  const compositeObj = React.useMemo(
    () => (partnerChart && baseChart ? buildCompositeChartObject(baseChart, partnerChart, hiddenPoints) : null),
    [baseChart, partnerChart, hiddenPoints],
  );
  const { transits: compositeTransits, loading: compositeTransitsLoading } = useCompositeTransits(currentDate, baseChart, partnerChart, user);
  // Precompute the Day wheel's props so the synastry/composite/personal
  // branches stay readable inline.
  const compWheelMode = !!partnerChart && relMode === 'composite';
  const wheelChartData = compWheelMode ? (compositeObj?.raw_data || baseChart?.raw_data) : baseChart?.raw_data;
  const wheelTransitData = !partnerChart
    ? (chartMode === 'overlay' && dayTransitData ? { planets: dayTransitData.transitPlanets, transit_aspects: [...(dayTransitData.natalAspects || []), ...(dayTransitData.lunarAspects || [])] } : null)
    : compWheelMode
      ? (compositeTransits ? { planets: compositeTransits.transitPlanets, transit_aspects: [...(compositeTransits.natalAspects || []), ...(compositeTransits.lunarAspects || [])] } : null)
      : (relOverlay === 'now' && relTransitData ? { planets: relTransitData.transitPlanets, transit_aspects: [...(relTransitData.natalAspects || []), ...(relTransitData.lunarAspects || [])] } : null);
  const wheelPartnerData = compWheelMode ? undefined : (partnerChart && synastryOverlay ? { planets: synastryOverlay.planets, aspects: synastryOverlay.transit_aspects } : undefined);
  const wheelPartnerHouses = compWheelMode ? undefined : (partnerChart ? synastryOverlay?.partnerHouses : undefined);
  const wheelMode = compWheelMode ? 'transit' : (partnerChart ? 'synastry' : 'transit');

  useEffect(() => {
    track(EVENTS.PLANNER_VIEWED);
    const params = new URLSearchParams(window.location.search);
    const d = params.get('date');
    if (d) {
      const parsed = new Date(d + 'T12:00:00');
      if (!isNaN(parsed.getTime())) setCurrentDate(parsed);
    }
    const withParam = params.get('with');
    if (withParam) setPartnerChartId(withParam);
    const perspParam = params.get('perspective');
    if (perspParam) setPerspectiveChartId(perspParam);
    if (params.get('spotlight') === 'dynamics') {
      setSpotlightDynamics(true);
      // Clean URL so refresh doesn't re-trigger
      params.delete('spotlight');
      const cleanUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadChart();
      loadSavedCharts();
    }
  }, [user]);

  const loadSavedCharts = async () => {
    try {
      const charts = await base44.entities.SavedChart.filter({ created_by_id: user.id }, '-created_date', 50);
      setSavedCharts(charts);
    } catch { /* non-critical */ }
  };

  // Enter/leave relationship mode — keeps the `with` URL param in sync so the
  // selection survives view switches and page refreshes.
  const selectPartner = (id) => {
    setPartnerChartId(id || '');
    const params = new URLSearchParams(window.location.search);
    if (id) params.set('with', id); else params.delete('with');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  // Switch the base (perspective) chart. Keeps the `perspective` URL param in
  // sync and clears the partner if it was the same chart (a chart can't pair
  // with itself).
  const selectPerspective = (id) => {
    setPerspectiveChartId(id || '');
    if (id && id === partnerChartId) setPartnerChartId('');
    const params = new URLSearchParams(window.location.search);
    if (id) params.set('perspective', id); else params.delete('perspective');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  };

  // Auto-sync to Google Calendar if connected (silent, idempotent)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const check = await base44.functions.invoke('syncAstroToCalendar', { check_only: true });
        if (check.data?.connected && !cancelled) {
          await base44.functions.invoke('syncAstroToCalendar', { days_ahead: 7, filters: { journal: true } });
        }
      } catch {
        // not connected — silently skip
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const loadChart = async () => {
    const charts = await base44.entities.Chart.filter({ user_id: user.id });
    const c = charts[0] || null;
    setChart(c);
    setLoading(false);
  };

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === 'Day') d.setDate(d.getDate() + dir);
    else if (view === 'Week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  // Week starting Sunday — used by the relationship week view (mirrors PlannerWeekView)
  const weekDays = React.useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const formatHeader = () => {
    if (view === 'Day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'Week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gold-primary" size={28} /></div>;
  }

  if (!chart) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="text-5xl text-gold-accent">☽</div>
        <h2 className="font-display text-xl text-cream">No Chart Yet</h2>
        <p className="font-body text-sm text-brass">Complete onboarding to use the Astro Planner.</p>
      </div>
    );
  }

  // Moon phase + sign for the Day view header — same indicator the day cards show
  const dayMoon = view === 'Day' && dayTransitData?.moonSign ? {
    icon: getMoonPhaseIcon(currentDate),
    sign: dayTransitData.isEclipse ? (dayTransitData.eclipseMoonSign || dayTransitData.moonSign) : dayTransitData.moonSign,
  } : null;

  return (
    <div className="min-h-screen pb-24">
      <PageHeader>
        {/* Title row */}
        <div className="px-4 pt-10 pb-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-body text-[10px] text-brass uppercase tracking-widest">Astro Planner</p>
            <h1 className="font-display text-xl font-bold text-cream truncate">
              {partnerChart
                ? `Cosmic Calendar · ${perspectiveChart ? `${perspectiveChart.name} & ${partnerChart.name}` : partnerChart.name}`
                : perspectiveChart
                  ? `Cosmic Calendar · ${perspectiveChart.name}`
                  : 'Cosmic Calendar'}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSyncModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gold-primary/30 hover:border-gold-accent hover:bg-gold-primary/10 transition-all"
              title="Sync to Calendar"
            >
              <CalendarDays size={14} className="text-gold-accent" />
              <span className="font-body text-[10px] text-brass">Sync</span>
            </button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between px-4 pb-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gold-primary/10 rounded-full transition-colors">
            <ChevronLeft size={18} className="text-brass" />
          </button>
          <div className="text-center space-y-0.5">
            <p className="font-body text-sm font-semibold text-cream">{formatHeader()}</p>
            {dayMoon && (
              <p className="font-body text-[10px] text-brass flex items-center justify-center gap-1 leading-tight">
                <span className="text-[11px] leading-none">{dayMoon.icon}</span>
                <span>Moon in {dayMoon.sign}</span>
              </p>
            )}
            <button
              onClick={() => setCurrentDate(new Date())}
              className="font-body text-[10px] text-gold-accent hover:text-gold-primary transition-colors underline underline-offset-2"
            >
              Today
            </button>
          </div>
          <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gold-primary/10 rounded-full transition-colors">
            <ChevronRight size={18} className="text-brass" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 px-4 pb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-celestial-blue"></div>
            <span className="font-body text-[10px] text-brass">Natal transit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-deep-blue/70"></div>
            <span className="font-body text-[10px] text-brass">Sky</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-bronze/50"></div>
            <span className="font-body text-[10px] text-brass">Lunar</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/[0.08]">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-4 font-body text-xs tracking-widest uppercase transition-colors border-b-2 whitespace-nowrap ${
                view === t.key
                  ? 'border-gold-accent text-white font-semibold'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="max-w-5xl mx-auto px-4 pt-4">
        {/* Chart wheel — Day view. Personal shows the natal chart (Natal /
            Natal + Now toggle); relationship shows the synastry wheel
            (Synastry / Natal + Now toggle). The relationship badge or selector
            pill sits directly below the chart in both modes — where the
            "Relationship" dropdown originally lived. */}
        {view === 'Day' && (
          <div className="max-w-sm mx-auto mb-4">
            <div className="flex items-center justify-center gap-1 mb-6">
              {!partnerChart ? (
                [
                  { key: 'natal',   label: 'Natal',      activeColor: '#D4AF85', activeBg: 'rgba(212,175,133,0.18)', activeBorder: 'rgba(212,175,133,0.4)' },
                  { key: 'overlay', label: 'Natal + Now', activeColor: '#7dd49a', activeBg: 'rgba(125,212,154,0.15)', activeBorder: 'rgba(125,212,154,0.4)' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setChartMode(m.key)}
                    className="font-body text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full transition-all"
                    style={{
                      background: chartMode === m.key ? m.activeBg : 'rgba(255,255,255,0.04)',
                      color: chartMode === m.key ? m.activeColor : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${chartMode === m.key ? m.activeBorder : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {m.label}
                  </button>
                ))
              ) : relMode === 'composite' ? (
                <span className="font-body text-[10px] uppercase tracking-widest text-celestial-pink/80 px-2.5 py-1">Composite · Today's transits</span>
              ) : (
                [
                  { key: 'synastry', label: 'Synastry', activeColor: '#B8A5C8', activeBg: 'rgba(184,165,200,0.18)', activeBorder: 'rgba(184,165,200,0.4)' },
                  { key: 'now',      label: 'Synastry + Now', activeColor: '#7dd49a', activeBg: 'rgba(125,212,154,0.15)', activeBorder: 'rgba(125,212,154,0.4)' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setRelOverlay(m.key)}
                    className="font-body text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full transition-all"
                    style={{
                      background: relOverlay === m.key ? m.activeBg : 'rgba(255,255,255,0.04)',
                      color: relOverlay === m.key ? m.activeColor : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${relOverlay === m.key ? m.activeBorder : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {m.label}
                  </button>
                ))
              )}
            </div>
            <LazyChartWheel
              chartData={wheelChartData}
              transitData={wheelTransitData}
              partnerData={wheelPartnerData}
              partnerHouses={wheelPartnerHouses}
              mode={wheelMode}
              overlayName={partnerChart?.name || ''}
              relationship={partnerChart?.relationship || ''}
              deceased={partnerChart?.deceased || false}
              dateOfDeath={partnerChart?.date_of_death || ''}
              partnerPronouns={partnerChart?.pronouns || ''}
              highlightPattern={!partnerChart ? highlightPattern : undefined}
              highlightKey={!partnerChart ? highlightKey : undefined}
            />
            {partnerChart && relMode === 'composite' && compositeTransitsLoading && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Loader2 size={12} className="animate-spin text-gold-accent" />
                <span className="font-body text-[10px] text-brass">Loading composite transits…</span>
              </div>
            )}
            {partnerChart && relMode === 'synastry' && relOverlay === 'now' && relTransitLoading && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Loader2 size={12} className="animate-spin text-gold-accent" />
                <span className="font-body text-[10px] text-brass">Loading transits…</span>
              </div>
            )}
            <div className="flex justify-center pt-1 pb-2">
              <ManageChartViewLink />
            </div>
          </div>
        )}

        {/* Relationship badge / selector — sits directly below the Day chart.
            Personal: the dropdown to pick a partner. Relationship: one combined
            badge naming the bond, with an exit that returns to your own reads. */}
        {view === 'Day' && (
          <div className="flex justify-center items-center gap-2 mb-4 flex-wrap">
            <div className="flex bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
              <PlannerPerspectivePicker
                perspectiveChartId={perspectiveChartId}
                perspectiveChart={perspectiveChart}
                chart={chart}
                savedCharts={savedCharts}
                user={user}
                isPremium={isPremium}
                effectiveTier={effectiveTier}
                onSelect={selectPerspective}
                onAddChart={() => setShowManager(true)}
              />
              {!partnerChart && (
                <RelationshipSelector
                  selectedChart={partnerChart}
                  savedCharts={personSavedCharts}
                  canUse={canUseRelationship}
                  onSelect={selectPartner}
                  onClear={() => selectPartner('')}
                  onAddChart={() => setShowManager(true)}
                />
              )}
            </div>
            {partnerChart && (
              <RelationshipBadge name={bond.name} phrase={bond.phrase} onClear={() => selectPartner('')} />
            )}
          </div>
        )}

        {partnerChart ? (
          // ── Relationship mode ─────────────────────────────────────────────
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Week/Month have no planner-level chart, so the bond badge sits
                at the top of the relationship read. On Day it renders below the
                synastry wheel at the Planner level instead. */}
            {view !== 'Day' && (
              <div className="flex justify-center items-center gap-2 flex-wrap">
                <div className="flex bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
                  <PlannerPerspectivePicker
                    perspectiveChartId={perspectiveChartId}
                    perspectiveChart={perspectiveChart}
                    chart={chart}
                    savedCharts={savedCharts}
                    user={user}
                    isPremium={isPremium}
                    effectiveTier={effectiveTier}
                    onSelect={selectPerspective}
                    onAddChart={() => setShowManager(true)}
                  />
                </div>
                <RelationshipBadge name={bond.name} phrase={bond.phrase} onClear={() => selectPartner('')} />
              </div>
            )}

            {view === 'Day' && (
              <p className="font-body text-[11px] text-brass/70 text-center max-w-xs mx-auto leading-snug px-2">
                {relMode === 'composite'
                  ? <>The composite chart ({perspectiveChart ? `${perspectiveChart.name} & ${partnerChart.name}` : 'your bond'} as one entity) with today's transits on the outer ring — how the moment activates the relationship itself.</>
                  : relOverlay === 'synastry'
                    ? <>{baseLabel} planets sit within the wider house ring (gold); {partnerChart.name}'s nest inside their own ring (blue) — synastry aspects replace the natal ones.</>
                    : <>{baseLabel} synastry with {partnerChart.name} (blue) plus today's live transits (green) on the outer ring — how the moment lands on the bond.</>}
              </p>
            )}

            {/* Synastry / Composite lens toggle */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-white/[0.08] overflow-hidden">
                {[
                  { key: 'synastry', label: 'Synastry' },
                  { key: 'composite', label: 'Composite' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setRelMode(m.key)}
                    className={`px-3 py-1 font-body text-[10px] uppercase tracking-widest transition-colors ${relMode === m.key ? 'bg-gold-primary/20 text-gold-accent' : 'text-white/40 hover:text-white/70'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {view === 'Day' ? (
              relMode === 'composite'
                ? <CompositeDaySynthesis date={currentDate} userChart={baseChart} partnerChart={partnerChart} userId={user?.id} />
                : <RelationshipDayView date={currentDate} userChart={baseChart} partnerChart={partnerChart} userId={user?.id} userTransits={relTransitData} loading={relTransitLoading} />
            ) : view === 'Week' ? (
              relMode === 'composite'
                ? <CompositePeriodStub periodLabel="week" partnerChart={partnerChart} />
                : <RelationshipWeekSynthesis days={weekDays} userChart={baseChart} partnerChart={partnerChart} userId={user?.id} />
            ) : (
              relMode === 'composite'
                ? <CompositePeriodStub periodLabel="month" partnerChart={partnerChart} />
                : <RelationshipMonthSynthesis date={currentDate} userChart={baseChart} partnerChart={partnerChart} userId={user?.id} />
            )}

            {/* Cross-link to the chart page's relationship comparison — the
                natal synastry + composite reads (the bond's longer-term themes). */}
            <div className="flex justify-center pt-1">
              <Link to={`/chart?view=synastry&with=${partnerChart.id}${perspectiveChartId ? `&perspective=${perspectiveChartId}` : ''}`} className="inline-flex items-center gap-1.5 font-body text-[11px] text-gold-accent hover:text-gold-primary transition-colors text-center max-w-xs">
                <Sparkles size={11} className="shrink-0" />
                Want the longer-term themes of your synastry or composite chart?
              </Link>
            </div>
          </div>
        ) : (
          // ── Personal mode ─────────────────────────────────────────────────
          <>
            {view === 'Day'    && <PlannerDayView    date={currentDate} chart={baseChart} user={user} spotlightDynamics={spotlightDynamics} onSpotlightDismiss={() => setSpotlightDynamics(false)} onHighlightPattern={setHighlightPattern} onHighlightTransit={setHighlightKey} onTransitData={setDayTransitData} />}
            {view === 'Week'   && <PlannerWeekView   date={currentDate} chart={baseChart} user={user} onSelectDay={(d) => { setCurrentDate(d); setView('Day'); }} relationshipSelector={
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <PlannerPerspectivePicker
                  perspectiveChartId={perspectiveChartId}
                  perspectiveChart={perspectiveChart}
                  chart={chart}
                  savedCharts={savedCharts}
                  user={user}
                  isPremium={isPremium}
                  effectiveTier={effectiveTier}
                  onSelect={selectPerspective}
                  onAddChart={() => setShowManager(true)}
                />
                <RelationshipSelector
                  selectedChart={partnerChart}
                  savedCharts={personSavedCharts}
                  canUse={canUseRelationship}
                  onSelect={selectPartner}
                  onClear={() => selectPartner('')}
                  onAddChart={() => setShowManager(true)}
                />
              </div>
            } />}
            {view === 'Month'  && <PlannerMonthView  date={currentDate} chart={baseChart} user={user} onSelectDay={(d) => { setCurrentDate(d); setView('Day'); }} relationshipSelector={
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <PlannerPerspectivePicker
                  perspectiveChartId={perspectiveChartId}
                  perspectiveChart={perspectiveChart}
                  chart={chart}
                  savedCharts={savedCharts}
                  user={user}
                  isPremium={isPremium}
                  effectiveTier={effectiveTier}
                  onSelect={selectPerspective}
                  onAddChart={() => setShowManager(true)}
                />
                <RelationshipSelector
                  selectedChart={partnerChart}
                  savedCharts={personSavedCharts}
                  canUse={canUseRelationship}
                  onSelect={selectPartner}
                  onClear={() => selectPartner('')}
                  onAddChart={() => setShowManager(true)}
                />
              </div>
            } />}
          </>
        )}

      </div>

      {showSyncModal && (
        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowSyncModal(false)}>
          <div
            className="w-full sm:max-w-sm bg-paper rounded-t-2xl sm:rounded-2xl border border-gold-primary/30 shadow-xl overflow-y-auto max-h-[85vh] p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-bold text-white">Calendar Sync</h2>
              <button onClick={() => setShowSyncModal(false)} className="p-1 hover:bg-muted rounded-full transition-colors">
                <X size={16} className="text-brass/60" />
              </button>
            </div>
            <GoogleCalendarConnect />
          </div>
        </div>
      )}

      {showManager && (
        <SavedChartManager
          user={user}
          charts={savedCharts}
          onRefresh={loadSavedCharts}
          onClose={() => setShowManager(false)}
        />
      )}

    </div>
  );
}