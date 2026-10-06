import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { useTabUrl } from '@/hooks/useTabUrl';
import { base44 } from '@/api/base44Client';
import { Loader2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useTransits } from '@/components/planner/useTransits';
import DaySynthesis from '@/components/planner/DaySynthesis';
import DailyQuizCard from '@/components/quiz/DailyQuizCard';
import LazyChartWheel from '@/components/chart/LazyChartWheel';
import ManageChartViewLink from '@/components/chart/ManageChartViewLink';
import TransitList from '@/components/planner/TransitList';

import LearningTierGauge from '@/components/quiz/LearningTierGauge';
import XpMeter from '@/components/learning/XpMeter';
import SignName from '@/components/ui/SignName';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import FirstVisitTooltips from '@/components/home/FirstVisitTooltips';
import BirthdayConfetti from '@/components/home/BirthdayConfetti';
import MundaneFormationsCard from '@/components/home/MundaneFormationsCard';
import LunarEventBanner from '@/components/planner/LunarEventBanner';
import PlanetaryHighlights from '@/components/planner/PlanetaryHighlights';
import TodayHighlightBanners from '@/components/home/TodayHighlightBanners';
import FeatureHighlightBanner from '@/components/home/FeatureHighlightBanner';

const IngressBanner = React.lazy(() => import('@/components/planner/IngressBanner'));

const MOON_PHASE_GLYPHS = {
  'New Moon': '🌑', 'Crescent': '🌒', 'First Quarter': '🌓', 'Gibbous': '🌔',
  'Full Moon': '🌕', 'Disseminating': '🌖', 'Last Quarter': '🌗', 'Balsamic': '🌘',
};

const TABS = [
  { key: 'weather',  glyph: '✦', label: 'Today' },
  { key: 'transits', glyph: '☽', label: 'Transits' },
  { key: 'learn',    glyph: '◎', label: 'Learn' },
];

const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
};

export default function Home() {
  const { user, reloadUser } = useAuth();
  const { progressRecord } = useUserPrefs();
  const navigate = useNavigate();
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState(null);
  const [activeTab, setActiveTab] = useTabUrl('tab', 'weather');
  const [xpTotal, setXpTotal] = useState(0);
  // 'natal' | 'overlay' | 'sky'
  const [chartMode, setChartMode] = useState('sky');
  const [highlightPattern, setHighlightPattern] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [transitsOpen, setTransitsOpen] = useState(false);
  const highlightsRef = useRef(null);
  const collectiveRef = useRef(null);
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);
  const [highlightsFocusTab, setHighlightsFocusTab] = useState('ingresses');
  const [lunarAutoExpand, setLunarAutoExpand] = useState(false);
  const [highlightIngressKey, setHighlightIngressKey] = useState(null);
  const [highlightStationKey, setHighlightStationKey] = useState(null);

  const scrollToHighlights = useCallback((focus, key) => {
    setActiveTab('transits');
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
    setHighlightsExpanded(true);
    requestAnimationFrame(() => {
      setTimeout(() => highlightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });
  }, [setActiveTab]);

  const today = new Date();
  const { data: todayTransits } = useTransits(chart ? today : null, chart);

  const lunation = (todayTransits?.isExactNewMoon || todayTransits?.isExactFullMoon) ? {
    phase: todayTransits.isExactFullMoon ? 'Full Moon' : 'New Moon',
    // Use the eclipse-moment sign (derived from the Sun) when this is an
    // eclipse — the noon Moon can lag the sign of the actual eclipse.
    moonSign: todayTransits?.isEclipse ? (todayTransits.eclipseMoonSign || todayTransits?.moonSign) : todayTransits?.moonSign,
    isEclipse: !!todayTransits?.isEclipse,
    eclipseType: todayTransits?.eclipseType,
    lunarAspects: todayTransits?.lunarAspects || [],
  } : null;

  // userProgress is fetched once in AuthProvider (in parallel with auth.me())
  // and surfaced via UserPrefsContext — no duplicate DB call on every Home mount.
  useEffect(() => {
    setUserProgress(progressRecord);
  }, [progressRecord]);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    const uid = user?.id;
    if (!uid) return;

    // Chart + XPEvent fire together; userProgress comes from context and the
    // user record is already loaded by AuthProvider on boot (no reloadUser here).
    const [charts, events] = await Promise.all([
      base44.entities.Chart.filter({ user_id: uid }),
      base44.entities.XPEvent.filter({ user_id: uid }),
    ]);
    if (!charts.length) {
      navigate('/onboarding');
      return;
    }
    setChart(charts[0]);
    // Compute XP directly from events — bypasses any me() cache
    const total = events.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
    setXpTotal(total);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-gold-primary" size={32} />
      </div>
    );
  }

  // Use today's transit Sun position (not natal)
  const transitSun = todayTransits?.transitPlanets?.find(p => p.name === 'Sun');
  const sunSign = transitSun?.sign || null;
  const moonSign = todayTransits?.moonSign;
  const moonPhase = todayTransits?.moonPhase;
  const tz = user?.current_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateLabel = today.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen pb-24">
      <BirthdayConfetti chart={chart} />
      <FirstVisitTooltips activeTab={activeTab} onTabChange={setActiveTab} />
      <PageHeader>
        {/* Centered brand header */}
        <div className="px-4 pt-5 pb-2 text-center space-y-2 relative">
          <p className="font-body text-[10px] text-white/40 uppercase tracking-widest">Your celestial curriculum</p>
          <img
            src="/media/8a82dfec1_Asset24x.png"
            alt="Astrosetta"
            className="h-14 w-auto object-contain mx-auto"
          />
          <p className="font-body text-xs text-gold-primary/70">{dateLabel}</p>

          {/* Mobile: transit sky context — plain gold text, no pill */}
          <div className="flex md:hidden justify-center gap-4 pt-1 flex-wrap">
            {sunSign && (
              <span className="font-body text-xs text-gold-primary/70">
                <span style={{ fontVariantEmoji: 'text' }}>☉</span> Sun in <span className="text-gold-primary font-semibold"><SignName sign={sunSign} /></span>
              </span>
            )}
            {moonSign && (
              <span className="font-body text-xs text-gold-primary/70">
                <span>{MOON_PHASE_GLYPHS[moonPhase] || '☽'}</span> Moon in <span className="text-gold-primary font-semibold"><SignName sign={moonSign} /></span>
              </span>
            )}
          </div>
        </div>

        {/* Chart wheel with transit info — side-by-side on desktop */}
        {chart && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-center md:gap-6 px-3">

            {/* Desktop: transit context left of chart */}
            {todayTransits && (
              <div className="hidden md:flex flex-col gap-2 text-right min-w-[120px] max-w-[140px]">
                {sunSign && (
                  <div className="font-body text-xs text-gold-primary/70 leading-snug">
                    <span style={{ fontVariantEmoji: 'text' }}>☉</span> Sun in <span className="text-gold-primary font-semibold"><SignName sign={sunSign} /></span>
                  </div>
                )}
                {moonSign && (
                  <div className="font-body text-xs text-gold-primary/70 leading-snug">
                    <span>{MOON_PHASE_GLYPHS[moonPhase] || '☽'}</span> Moon in <span className="text-gold-primary font-semibold"><SignName sign={moonSign} /></span>
                  </div>
                )}
              </div>
            )}

            {/* Chart — always centered hero */}
            <div data-tour="tour-chart-wheel" className="w-full max-w-[17rem] mx-auto md:max-w-xs md:mx-0 md:flex-shrink-0">
              {/* Mode selector */}
              <div className="flex items-center justify-center gap-1 mb-3">
                {[
                  { key: 'natal',   label: 'Natal',      activeColor: '#D4AF85', activeBg: 'rgba(212,175,133,0.18)', activeBorder: 'rgba(212,175,133,0.4)' },
                  { key: 'overlay', label: 'Natal + Now', activeColor: '#7dd49a', activeBg: 'rgba(125,212,154,0.15)', activeBorder: 'rgba(125,212,154,0.4)' },
                  { key: 'sky',     label: 'Live Sky',    activeColor: '#9DB4C8', activeBg: 'rgba(157,180,200,0.15)', activeBorder: 'rgba(157,180,200,0.4)' },
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
                ))}
              </div>

              <LazyChartWheel
                chartData={chartMode === 'sky' && todayTransits
                  ? { ...chart.raw_data, planets: todayTransits.transitPlanets, nodes: {} }
                  : chart.raw_data}
                transitData={chartMode === 'overlay' && todayTransits
                  ? { planets: todayTransits.transitPlanets, transit_aspects: [...(todayTransits.natalAspects || []), ...(todayTransits.lunarAspects || [])] }
                  : null}
                skyMode={chartMode === 'sky'}
                highlightPattern={highlightPattern}
              />
              <div className="flex justify-center pt-2">
                <ManageChartViewLink />
              </div>
            </div>

            {/* Desktop: spacer / future right panel */}
            {todayTransits && <div className="hidden md:block min-w-[120px] max-w-[140px]" />}
          </div>
        )}

        {/* Curriculum tier + XP meters below wheel */}
        <div className="px-4 pb-2 space-y-2">
          <LearningTierGauge userProgress={userProgress} />
          <XpMeter xpTotal={xpTotal} />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/[0.08] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              data-tour={`tour-tab-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-4 font-body text-xs tracking-widest uppercase transition-colors border-b-2 whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-gold-accent text-white font-semibold'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <span style={{ fontVariantEmoji: 'text' }}>{t.glyph}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-4 py-5 space-y-5">

        {/* Today tab — daily reading + lunar */}
        {activeTab === 'weather' && (
          <div className="space-y-3">
            <FeatureHighlightBanner />
            {chart && todayTransits && (
              <DaySynthesis date={today} chart={chart} transits={todayTransits} user={user} defaultTab="personal" onSynthesis={setSynthesis} />
            )}
            <TodayHighlightBanners transits={todayTransits} chart={chart} onLinkToHighlights={scrollToHighlights} />
          </div>
        )}

        {/* Transits tab — ingress alerts above, collapsible transit card, highlights beneath */}
        {activeTab === 'transits' && (
          <div className="space-y-4">
            {/* Eclipse / lunation banner — same compact banner shown on Today */}
            {lunation && (
              <LunarEventBanner transits={todayTransits} onLinkToHighlights={() => scrollToHighlights('lunation')} />
            )}
            {/* Sign ingresses — above the cards, only when within relevant time orb */}
            {todayTransits?.ingresses?.length > 0 && (
              <React.Suspense fallback={null}>
                <IngressBanner ingresses={todayTransits.ingresses} chart={chart} compact onLinkToHighlights={scrollToHighlights} />
              </React.Suspense>
            )}

            {/* Planetary highlights */}
            <div ref={highlightsRef}>
              <PlanetaryHighlights
                stations={todayTransits?.stations || []}
                ingresses={todayTransits?.ingresses || []}
                lunation={lunation}
                chart={chart}
                date={today}
                lunarAutoExpand={lunarAutoExpand}
                expanded={highlightsExpanded}
                onExpandedChange={setHighlightsExpanded}
                focusTab={highlightsFocusTab}
                ingressAutoExpand={highlightIngressKey}
                stationAutoExpand={highlightStationKey}
              />
            </div>

            {/* Collapsible transits card */}
            <div className="celestial-card overflow-hidden">
              <button
                onClick={() => setTransitsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg text-gold-accent" style={{ fontVariantEmoji: 'text' }}>✦</span>
                  <div className="text-left">
                    <p className="font-display text-sm font-semibold text-white">Transits</p>
                    <p className="font-body text-[10px] text-brass/70">Personal & collective transits today</p>
                  </div>
                </div>
                {transitsOpen ? <ChevronDown size={14} className="text-brass/50 shrink-0" /> : <ChevronRight size={14} className="text-brass/50 shrink-0" />}
              </button>
              {transitsOpen && (
                <div className="px-4 pb-4 border-t border-gold-primary/15">
                  {!todayTransits ? (
                    <div className="flex items-center justify-center py-6 gap-2">
                      <Loader2 size={16} className="animate-spin text-gold-primary" />
                      <p className="font-body text-xs text-brass italic">Calculating transits...</p>
                    </div>
                  ) : (
                    <TransitList data={todayTransits} chart={chart} date={today} synthesis={synthesis} />
                  )}
                </div>
              )}
            </div>

            {/* Beneath transits — cosmic formations */}
            <div ref={collectiveRef}>
              <MundaneFormationsCard transits={todayTransits} onHighlight={setHighlightPattern} />
            </div>
          </div>
        )}

        {/* Learn tab */}
        {activeTab === 'learn' && (
          <div className="space-y-5">
            <DailyQuizCard
              userProgress={userProgress}
              onProgressUpdate={async (updater) => {
                setUserProgress(updater);
                // Refresh XP from events after quiz completes
                const freshUser = await reloadUser();
                const uid = freshUser?.id || user?.id;
                if (uid) {
                  const events = await base44.entities.XPEvent.filter({ user_id: uid });
                  const total = events.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
                  setXpTotal(total);
                }
              }}
              transits={todayTransits}
            />
            <div className="celestial-card p-5 text-center space-y-3">
              <p className="font-display text-base font-bold text-white">Continue your learning journey</p>
              <p className="font-body text-xs text-brass italic">
                Deepen your understanding of your natal chart placements
              </p>
              <Button
                onClick={() => navigate('/learn')}
                className="bg-gold-primary hover:bg-gold-accent text-paper font-body text-sm w-full"
              >
                <BookOpen size={15} className="mr-2" /> Explore the Curriculum
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}