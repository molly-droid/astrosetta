import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useTabUrl } from '@/hooks/useTabUrl';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, Sparkles, ArrowRight, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import PageHeader from '@/components/layout/PageHeader';
import LazyChartWheel from '@/components/chart/LazyChartWheel';
import ManageChartViewLink from '@/components/chart/ManageChartViewLink';
import { clearInterpretationCache, useInterpretation } from '@/components/chart/InterpretationDrawer';
import { ELEMENT_COLORS, PLANET_GLYPHS, SIGN_ELEMENTS } from '@/lib/chartUtils';
import { getHouseName } from '@/lib/houseUtils';
import { analyzeChartDynamics } from '@/lib/chartDynamics';
import SignName from '@/components/ui/SignName';
import ReactMarkdown from 'react-markdown';
import { highlightGlyphs, highlightAllLabels } from '@/lib/transitUtils';
import ScrollableTabs from '@/components/ui/ScrollableTabs';
const ChartDynamicsCard = React.lazy(() => import('@/components/planner/ChartDynamicsCard'));
import SolarReturnCard from '@/components/shared/SolarReturnCard';
import SavedChartManager from '@/components/chart/SavedChartManager';
import SynastryView from '@/components/chart/SynastryView';
import CompositeView from '@/components/chart/CompositeView';
import SynastryTour from '@/components/shared/SynastryTour';
import ChartPerspectiveSwitcher from '@/components/chart/ChartPerspectiveSwitcher';
import SynastryPartnerSwitcher from '@/components/chart/SynastryPartnerSwitcher';
import RelationshipBadge from '@/components/planner/RelationshipBadge';
import { buildCompositeChartObject } from '@/lib/compositeSynthesis';
import { bondVerbiage } from '@/lib/relationshipVerbiage';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';
import { getEffectiveTier } from '@/lib/permissions';
import PaywallModal from '@/components/paywall/PaywallModal';
import GatedFeature from '@/components/paywall/GatedFeature';
import { Lock } from 'lucide-react';

// Placements free users can deep-dive without a subscription (the Big Three).
const BIG_THREE = new Set(['Sun', 'Moon']);

const ASPECT_SYMBOLS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹', quincunx: '⚻', semisextile: '⚺', semisquare: '∠', sesquisquare: '⚼' };
const ASPECT_COLORS = { conjunction: '#C9A961', opposition: '#c0392b', trine: '#2980b9', square: '#c0392b', sextile: '#27ae60', quincunx: '#8e44ad', semisextile: '#27ae60', semisquare: '#c0392b', sesquisquare: '#c0392b' };
const ASTEROIDS = new Set(['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Hygiea', 'Eris', 'Tyche']);
// Premium-gated chart points: all asteroids + Black Moon Lilith.
// Lots & Lunar Nodes are free (Chart Display toggle only).
const PREMIUM_POINTS = new Set([...ASTEROIDS, 'Black Moon Lilith']);

const TABS = [
  { key: 'planets',  label: 'Placements' },
  { key: 'houses',   label: 'Houses' },
  { key: 'aspects',  label: 'Aspects' },
  { key: 'dynamics', label: 'Dynamics' },
];

// ── Inline expandable interpretation card ──────────────────────────────────
// The LLM call is deferred until the card is opened — avoids firing 10+ calls
// at once when the Placements tab mounts, which was causing failures/hangs.

// Recursively highlights astrological terms (planets, signs, aspects, transit
// patterns) inside React markdown children, rendering them in gold so they
// stand out against the white interpretation body copy.
function highlightAstro(node, cls = 'text-gold-accent') {
  return React.Children.map(node, (child) => {
    if (typeof child === 'string') {
      if (!child.trim()) return child; // preserve whitespace-only text nodes
      // Use highlightGlyphs + highlightAllLabels directly — NOT highlightSynthesisText,
      // whose stripApplyingSeparating trims each fragment and collapses the spaces
      // around bolded terms (e.g. "Your **Sun**" → "Your☉ Sun").
      const glyphed = highlightGlyphs(child, cls);
      if (typeof glyphed === 'string') return highlightAllLabels(glyphed, null, cls);
      return glyphed.flatMap((part) => typeof part === 'string' ? highlightAllLabels(part, null, cls) : part);
    }
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {}, highlightAstro(child.props.children, cls));
    }
    return child;
  });
}

const ASTRO_MD_COMPONENTS = {
  p: ({ children }) => <p>{highlightAstro(children)}</p>,
  li: ({ children }) => <li>{highlightAstro(children)}</li>,
  h1: ({ children }) => <h1>{highlightAstro(children)}</h1>,
  h2: ({ children }) => <h2>{highlightAstro(children)}</h2>,
  h3: ({ children }) => <h3>{highlightAstro(children)}</h3>,
  h4: ({ children }) => <h4>{highlightAstro(children)}</h4>,
};

function InterpretBody({ item, chartContext }) {
  const { text, loading, error, retry } = useInterpretation(item, chartContext);
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 size={16} className="animate-spin text-gold-primary" />
        <span className="font-body text-xs text-brass/50 italic">Reading the stars…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-4 text-center space-y-2">
        <p className="font-body text-xs text-gold-accent/70 italic">{error}</p>
        <button onClick={retry} className="inline-flex items-center gap-1.5 font-body text-[11px] text-gold-accent hover:text-gold-primary transition-colors">
          <RefreshCw size={11} /> Try again
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={10} className="text-gold-accent" />
        <span className="font-body text-[10px] uppercase tracking-widest text-brass/50">Interpretation</span>
      </div>
      <div className="font-body text-sm text-white/85 leading-relaxed prose prose-sm prose-invert max-w-none
        prose-headings:font-display prose-headings:text-gold-accent prose-headings:text-sm prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-1.5
        prose-strong:text-white prose-strong:font-semibold
        prose-ul:pl-4 prose-li:text-white/80 prose-li:text-xs prose-li:leading-relaxed
        prose-p:text-white/85 prose-p:text-sm">
        <ReactMarkdown components={ASTRO_MD_COMPONENTS}>{text || ''}</ReactMarkdown>
      </div>
    </div>
  );
}

function InterpretCard({ item, chartContext, label, sublabel, glyph, glyphColor, badge, onToggle, gated, gateContext }) {
  const [open, setOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const handleClick = () => {
    if (gated) { setShowPaywall(true); return; }
    const newOpen = !open;
    setOpen(newOpen);
    if (onToggle) onToggle(newOpen ? (typeof item === 'string' ? item : item?.key) : null);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025]">
      <button
        onClick={handleClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <span className="text-base w-6 text-center leading-none shrink-0" style={{ color: glyphColor || 'var(--gold-accent)' }}>
          {glyph}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-sm font-semibold text-cream">{label}</span>
            {badge && <span className="font-body text-[10px] text-brass/50 italic">{badge}</span>}
          </div>
          {sublabel && <p className="font-body text-xs text-brass/60 mt-0.5 truncate">{sublabel}</p>}
        </div>
        <div className="shrink-0 ml-2">
          {gated
            ? <Lock size={13} className="text-gold-accent/70" />
            : open
              ? <ChevronDown size={14} className="text-brass/50" />
              : <ChevronRight size={14} className="text-brass/50" />}
        </div>
      </button>

      {open && !gated && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
          <InterpretBody item={item} chartContext={chartContext} />
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          variant="interpret"
          fromTier="free"
          context={gateContext || label}
          onClose={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}

export default function MyChart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnToLearn = location.state?.returnToLearn;
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useTabUrl('tab', 'planets');
  const [highlightKey, setHighlightKey] = useState(null);
  const [highlightPattern, setHighlightPattern] = useState(null);
  const [viewMode, setViewMode] = useState('natal');
  const [savedCharts, setSavedCharts] = useState([]);
  const [selectedChartId, setSelectedChartId] = useState('');
  const [showManager, setShowManager] = useState(false);
  const [synastryOverlay, setSynastryOverlay] = useState(null);
  const [relSubMode, setRelSubMode] = useState('synastry');
  const [showTour, setShowTour] = useState(false);
  const [activePerspectiveId, setActivePerspectiveId] = useState('');

  // Clear overlay + highlight when leaving synastry mode or switching charts
  useEffect(() => {
    if (viewMode !== 'synastry') { setSynastryOverlay(null); setHighlightKey(null); setHighlightPattern(null); }
  }, [viewMode]);
  useEffect(() => { setSynastryOverlay(null); setHighlightKey(null); setHighlightPattern(null); setRelSubMode('synastry'); }, [selectedChartId]);
  // Composite sub-mode hides the partner overlay on the top wheel so the natal
  // chart shows clean above the composite view's own wheel.
  useEffect(() => { if (relSubMode === 'composite') setSynastryOverlay(null); }, [relSubMode]);

  // Reset chart highlight whenever the tab changes
  useEffect(() => { setHighlightKey(null); setHighlightPattern(null); }, [activeTab]);

  // If the active primary chart is selected as the synastry partner, clear it
  useEffect(() => {
    if (activePerspectiveId && selectedChartId === activePerspectiveId) setSelectedChartId('');
  }, [activePerspectiveId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === 'synastry') setShowTour(true);
    // Deep-link from the Planner: open relationship comparison with a partner.
    if (params.get('view') === 'synastry') setViewMode('synastry');
    const withId = params.get('with');
    if (withId) setSelectedChartId(withId);
    const perspId = params.get('perspective');
    if (perspId) setActivePerspectiveId(perspId);
  }, []);

  const selectedChart = savedCharts.find(c => c.id === selectedChartId);
  const activeSavedChart = activePerspectiveId ? savedCharts.find(c => c.id === activePerspectiveId) : null;
  const activeChart = activeSavedChart || chart;
  const effectiveTier = getEffectiveTier(user);
  const isPremium = effectiveTier === 'calendar';
  const isCore = effectiveTier === 'interpret' || effectiveTier === 'calendar';
  const activeLabel = activeSavedChart ? activeSavedChart.name : 'My Chart';
  const bond = bondVerbiage(activeSavedChart, selectedChart);

  // Composite chart (midpoint of the active chart + selected partner). Built
  // only when the Composite tab is active so the top wheel renders the
  // relationship chart instead of the natal+partner synastry wheel.
  const composite = useMemo(
    () => (viewMode === 'synastry' && relSubMode === 'composite' && selectedChart && activeChart
      ? buildCompositeChartObject(activeChart, selectedChart, getHiddenChartPoints(user))
      : null),
    [viewMode, relSubMode, selectedChart, activeChart, user],
  );

  // Unified highlight setter: a single planet/sign/house/aspect uses a key
  // (with dimming); a group (element/modality/stellium/pattern) uses a pattern
  // overlay + group dimming.
  const setHighlight = (h) => {
    if (!h) { setHighlightKey(null); setHighlightPattern(null); }
    else if (h.key) { setHighlightPattern(null); setHighlightKey(h.key); }
    else if (h.planets) { setHighlightKey(null); setHighlightPattern(h); }
  };

  const tourSteps = [
    {
      selector: '[data-tour="synastry-toggle"]',
      title: 'The Synastry Toggle',
      body: 'Use this toggle to switch between your natal chart and synastry mode — where you can compare your chart with anyone you know.',
    },
    {
      selector: '[data-tour="synastry-add"]',
      title: "Add Someone's Chart",
      body: 'Select a saved chart from the dropdown, or click "Manage" to add birth data for a partner, family member, or friend.',
      onEnter: () => setViewMode('synastry'),
    },
    {
      selector: '[data-tour="synastry-readings"]',
      title: "What You'll See",
      body: 'Once you select a chart, an AI relationship synthesis appears here — with cross-chart aspects, house overlays, and interpretations for every connection.',
    },
  ];

  const handleTourComplete = () => {
    setShowTour(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('tour');
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState({}, '', newUrl);
  };

  const loadSavedCharts = async () => {
    const charts = await base44.entities.SavedChart.filter({ created_by_id: user.id }, '-created_date', 50);
    setSavedCharts(charts);
  };

  useEffect(() => {
    if (user) {
      loadChart();
      loadSavedCharts();
    }
  }, [user]);

  const loadChart = async (clearCache = false) => {
    if (clearCache) clearInterpretationCache();
    setLoading(true);
    const charts = await base44.entities.Chart.filter({ user_id: user.id }, '-created_date');
    setChart(charts[0] || null);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gold-primary" size={28} /></div>;
  }

  if (!chart) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="text-5xl text-gold-accent">☽</div>
        <h2 className="font-display text-xl text-cream">No Chart Yet</h2>
        <p className="font-body text-sm text-brass">Complete onboarding to generate your natal chart.</p>
        <Button onClick={() => navigate('/onboarding')} className="bg-gold-primary hover:bg-gold-accent text-cream font-display">Begin Onboarding</Button>
      </div>
    );
  }

  const showAsteroids = user?.show_asteroids !== false;
  const showAngles = user?.show_angles !== false;
  const showLots = user?.show_lots !== false;
  const showNodes = user?.show_nodes !== false;
  const showLilith = user?.show_lilith !== false;
  const raw = activeChart?.raw_data || {};
  const allPlanets = raw.planets || [];
  const LOTS = new Set(['Part of Fortune', 'Part of Spirit', 'Part of Eros', 'Part of Necessity']);
  const hiddenPoints = new Set([
    ...(showAsteroids ? [] : [...ASTEROIDS]),
    ...(showLots ? [] : [...LOTS]),
    ...(showLilith ? [] : ['Black Moon Lilith']),
    ...(showNodes ? [] : ['North Node', 'South Node']),
  ]);
  const planets = (isPremium ? allPlanets : allPlanets.filter(p => !PREMIUM_POINTS.has(p.name)))
    .filter(p => !hiddenPoints.has(p.name));
  const aspects = (raw.aspects || []).filter(a => ['exact', 'strong', 'moderate'].includes(a.strength) && (isPremium || (!PREMIUM_POINTS.has(a.planet1) && !PREMIUM_POINTS.has(a.planet2))) && !hiddenPoints.has(a.planet1) && !hiddenPoints.has(a.planet2));
  const nodes = raw.nodes || {};
  const houses = raw.houses || [];
  const angles = raw.angles || {};
  const displayAngles = composite ? (composite.raw_data?.angles || {}) : angles;
  const dynamics = analyzeChartDynamics(raw);

  const loc = raw.birth_location;
  const birthStr = [raw.birth_date, raw.birth_time?.slice(0, 5), loc?.city ? `${loc.city}${loc.country ? ', ' + loc.country : ''}` : null].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen pb-24">
      {returnToLearn && (
        <button
          onClick={() => navigate('/learn', { state: { subjectKey: returnToLearn.subjectKey, section: returnToLearn.section, blockIndex: returnToLearn.blockIndex } })}
          className="fixed top-3 left-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold-primary text-paper text-xs font-body font-semibold shadow-lg hover:bg-gold-accent transition-colors"
        >
          <ChevronLeft size={12} />
          <span className="max-w-[140px] truncate">{returnToLearn.title ? `Back to ${returnToLearn.title}` : 'Back to lesson'}</span>
        </button>
      )}
      <PageHeader>
        <div className="px-4 pt-10 pb-4 relative">
          <div className="text-center space-y-1 mb-4">
            <p className="font-body text-[10px] text-brass uppercase tracking-widest">{composite ? 'Composite Chart' : 'Natal Chart'}</p>
            <h1 className="font-display text-2xl font-bold text-cream">
              {composite ? `${activeLabel} & ${selectedChart?.name || ''}` : (activeSavedChart ? activeSavedChart.name : (user?.display_name || user?.full_name || 'Your Chart'))}
            </h1>
            {composite
              ? <p className="font-body text-xs text-brass/70 italic">The relationship itself — the midpoint of your two charts</p>
              : (birthStr ? <p className="font-body text-xs text-brass/70 italic">{birthStr}</p> : null)}
          </div>
          {/* Big 3 */}
          <div className="flex justify-center gap-8 mb-4">
            {[
              { glyph: '☉', label: 'Sun', value: composite ? composite.raw_data?.sun_sign : activeChart.sun_sign },
              { glyph: '☽', label: 'Moon', value: composite ? composite.raw_data?.moon_sign : activeChart.moon_sign },
              { glyph: 'AC', label: 'Rising', value: composite ? composite.raw_data?.ascendant_sign : activeChart.ascendant_sign },
            ].map(({ glyph, label, value }) => (
              <div key={label} className="text-center">
                <div className="text-xl text-gold-accent font-display">{glyph}</div>
                <div className="text-[10px] font-body uppercase tracking-widest text-brass">{label}</div>
                <div className="text-sm font-display font-bold text-cream flex items-center gap-1 justify-center">
                  <SignName sign={value} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-3 pb-2 max-w-lg mx-auto">
          <LazyChartWheel
            chartData={composite ? composite.raw_data : raw}
            partnerData={!composite && synastryOverlay ? { planets: synastryOverlay.planets, aspects: synastryOverlay.transit_aspects } : null}
            partnerHouses={!composite ? synastryOverlay?.partnerHouses : undefined}
            mode={composite ? 'transit' : (synastryOverlay ? 'synastry' : 'transit')}
            overlayName={selectedChart?.name || ''}
            relationship={selectedChart?.relationship || ''}
            deceased={selectedChart?.deceased || false}
            dateOfDeath={selectedChart?.date_of_death || ''}
            partnerPronouns={selectedChart?.pronouns || ''}
            highlightKey={highlightKey}
            highlightPattern={viewMode === 'natal' ? highlightPattern : null}
            showAsteroids={showAsteroids}
            showLots={showLots}
            showNodes={showNodes}
            showLilith={showLilith}
          />
          {showAngles && (
          <div className="flex justify-around mt-3 border-t border-gold-primary/20 pt-3">
            {[
              { label: 'ASC', data: displayAngles.ascendant },
              { label: 'MC', data: displayAngles.midheaven },
              { label: 'DSC', data: displayAngles.descendant },
              { label: 'IC', data: displayAngles.ic },
            ].map(({ label, data }) => data ? (
              <div key={label} className="text-center">
                <div className="font-body text-[10px] uppercase tracking-widest text-brass/70">{label}</div>
                <div className="font-display text-xs font-bold text-gold-accent">{data.degree?.toFixed(0)}°</div>
                <div className="font-body text-[10px] text-cream"><SignName sign={data.sign} /></div>
              </div>
            ) : null)}
          </div>
          )}
          <div className="flex justify-center pt-2">
            <ManageChartViewLink />
          </div>
        </div>

        <div className="flex justify-center items-center gap-2 py-2 flex-wrap" data-tour="synastry-toggle">
          <div className="flex bg-white/[0.04] rounded-full p-0.5 border border-white/[0.06]">
            <ChartPerspectiveSwitcher
              activePerspectiveId={activePerspectiveId}
              activeLabel={activeLabel}
              isActive={viewMode === 'natal'}
              savedCharts={savedCharts}
              personalChart={chart}
              user={user}
              isPremium={isPremium}
              fromTier={effectiveTier === 'free' ? 'free' : 'interpret'}
              onSelect={setActivePerspectiveId}
              onActivate={() => setViewMode('natal')}
              onAddChart={() => { loadSavedCharts(); setShowManager(true); }}
            />
            {!(viewMode === 'synastry' && selectedChart) && (
              <div data-tour="synastry-add">
                <SynastryPartnerSwitcher
                  selectedChart={selectedChart}
                  savedCharts={savedCharts.filter(c => c.id !== activePerspectiveId)}
                  isActive={viewMode === 'synastry'}
                  onSelect={setSelectedChartId}
                  onActivate={() => setViewMode('synastry')}
                  onAddChart={() => { loadSavedCharts(); setShowManager(true); }}
                />
              </div>
            )}
          </div>
          {viewMode === 'synastry' && selectedChart && (
            <RelationshipBadge
              name={bond.name}
              phrase={bond.phrase}
              onClear={() => { setViewMode('natal'); setSelectedChartId(''); }}
            />
          )}
        </div>
        {activeSavedChart && viewMode === 'natal' && (
          <div className="flex justify-center -mt-1 mb-1">
            <span className="inline-flex items-center gap-1.5 font-body text-[10px] px-2.5 py-1 rounded-full bg-gold-accent/15 border border-gold-accent/40 text-gold-accent">
              <Eye size={10} /> Viewing: {activeSavedChart.name}
            </span>
          </div>
        )}

        {viewMode === 'natal' && (
          <ScrollableTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} fullWidth />
        )}
      </PageHeader>

      {viewMode === 'natal' && (
      <div className="px-4 py-5 space-y-2 max-w-5xl mx-auto">

        {/* Dynamics tip — points to Dynamics tab */}
        {activeTab !== 'dynamics' && (
          <button
            onClick={() => setActiveTab('dynamics')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-gold-primary/15 hover:border-gold-accent/40 transition-colors text-left"
          >
            <Sparkles size={14} className="text-gold-accent shrink-0" />
            <span className="font-body text-xs text-brass/80">Explore your chart dynamics — stelliums, patterns & elemental balance</span>
            <ArrowRight size={12} className="text-brass/40 ml-auto shrink-0" />
          </button>
        )}

        {/* Placements tab — planets + nodes */}
        {activeTab === 'planets' && (
          <div className="space-y-2">
            {planets.map(p => {
              const glyph = PLANET_GLYPHS[p.name] || '✦';
              const element = SIGN_ELEMENTS[(p.sign || '').toLowerCase()];
              const color = element ? ELEMENT_COLORS[element] : 'var(--gold-accent)';
              return (
                <InterpretCard
                  key={p.name}
                  item={{ key: `planet_${p.name}`, type: 'planet', ...p }}
                  chartContext={raw}
                  label={`${p.name} in ${p.sign}`}
                  sublabel={`${p.degree?.toFixed(1)}° · ${getHouseName(p.house)}`}
                  glyph={glyph}
                  glyphColor={color}
                  badge={p.retrograde ? '℞ retrograde' : null}
                  onToggle={setHighlightKey}
                  gated={!isCore && !BIG_THREE.has(p.name)}
                  gateContext={`${p.name} in ${p.sign}`}
                />
              );
            })}
            {/* Nodes */}
            {showNodes && nodes.north_node && (
              <InterpretCard
                key="north_node"
                item={{
                  key: 'planet_North Node',
                  type: 'node',
                  nodeType: 'north',
                  name: 'North Node',
                  sign: nodes.north_node.sign,
                  house: nodes.north_node.house,
                  longitude: nodes.north_node.longitude,
                  degree: nodes.north_node.degree,
                  oppositeSign: nodes.south_node?.sign,
                }}
                chartContext={raw}
                label={`North Node in ${nodes.north_node.sign}`}
                sublabel={`${nodes.north_node.degree?.toFixed(1)}° · ${getHouseName(nodes.north_node.house)}`}
                glyph="☊"
                glyphColor="var(--gold-accent)"
                onToggle={setHighlightKey}
                gated={!isCore}
                gateContext="North Node"
              />
            )}
            {showNodes && nodes.south_node && (
              <InterpretCard
                key="south_node"
                item={{
                  key: 'planet_South Node',
                  type: 'node',
                  nodeType: 'south',
                  name: 'South Node',
                  sign: nodes.south_node.sign,
                  house: nodes.south_node.house,
                  longitude: nodes.south_node.longitude,
                  degree: nodes.south_node.degree,
                  oppositeSign: nodes.north_node?.sign,
                }}
                chartContext={raw}
                label={`South Node in ${nodes.south_node.sign}`}
                sublabel={`${nodes.south_node.degree?.toFixed(1)}° · ${getHouseName(nodes.south_node.house)}`}
                glyph="☋"
                glyphColor="var(--gold-accent)"
                onToggle={setHighlightKey}
                gated={!isCore}
                gateContext="South Node"
              />
            )}
          </div>
        )}

        {/* Houses tab */}
        {activeTab === 'houses' && (
          <div className="space-y-2">
            {isCore ? (
              <SolarReturnCard chart={activeChart} date={new Date()} />
            ) : (
              <GatedFeature
                variant="interpret"
                fromTier="free"
                context="Solar Return reading"
                title="Solar Return reading"
                description="Your yearly Solar Return reading is part of Core. Unlock house readings, solar returns, and full natal interpretations."
                ctaLabel="Unlock Core"
              />
            )}
            {houses.map((h, i) => (
              <InterpretCard
                key={`house_${i + 1}`}
                item={{ key: `house_${i + 1}`, type: 'house', number: i + 1, ...h }}
                chartContext={raw}
                label={getHouseName(i + 1)}
                sublabel={`${h.sign} · ${h.degree?.toFixed(0)}° cusp`}
                glyph={(i + 1).toString()}
                glyphColor="var(--gold-accent)"
                onToggle={setHighlightKey}
                gated={!isCore}
                gateContext={getHouseName(i + 1)}
              />
            ))}
          </div>
        )}

        {/* Aspects tab */}
        {activeTab === 'aspects' && (
          <div className="space-y-2">
            {aspects.map((a, i) => {
              const sym = ASPECT_SYMBOLS[a.aspect] || '◆';
              const color = ASPECT_COLORS[a.aspect] || 'var(--gold-accent)';
              return (
                <InterpretCard
                  key={`aspect_${i}`}
                  item={{ key: `aspect_${a.planet1}_${a.aspect}_${a.planet2}`, type: 'aspect', ...a }}
                  chartContext={raw}
                  label={`${a.planet1} ${sym} ${a.planet2}`}
                  sublabel={`${a.aspect} · ${a.orb?.toFixed(1)}° orb`}
                  glyph={sym}
                  glyphColor={color}
                  onToggle={setHighlightKey}
                  gated={!isCore}
                  gateContext={`${a.planet1} ${sym} ${a.planet2}`}
                />
              );
            })}
          </div>
        )}

        {/* Dynamics tab */}
        {activeTab === 'dynamics' && (
          isCore ? (
            <React.Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-gold-primary" size={20} /></div>}>
              <ChartDynamicsCard chart={activeChart} onHighlight={setHighlight} />
            </React.Suspense>
          ) : (
            <GatedFeature
              variant="interpret"
              fromTier="free"
              context="Chart Dynamics"
              title="Chart Dynamics"
              description="Stelliums, aspect patterns, and elemental balance are part of Core. Unlock the full dynamics of your chart."
              ctaLabel="Unlock Core"
            />
          )
        )}

      </div>
      )}

      {/* Synastry section — appended below the natal tab content */}
      <div className="px-4 pb-24 max-w-5xl mx-auto">
        {viewMode === 'synastry' && (
          <>
            <OrnamentDivider className="my-6" />
            <div className="space-y-4">
              {selectedChart ? (
                <>
                  <div className="flex border-b border-white/[0.08]">
                    {[
                      { key: 'synastry', label: 'Synastry' },
                      { key: 'composite', label: 'Composite' },
                    ].map(t => (
                      <button
                        key={t.key}
                        onClick={() => setRelSubMode(t.key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-4 font-body text-xs tracking-widest uppercase transition-colors border-b-2 ${
                          relSubMode === t.key
                            ? 'border-gold-accent text-white font-semibold'
                            : 'border-transparent text-white/40 hover:text-white/70'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div data-tour="synastry-readings">
                    {relSubMode === 'composite'
                      ? <CompositeView userChart={activeChart} partnerChart={selectedChart} user={user} composite={composite} />
                      : <SynastryView userChart={activeChart} savedChart={selectedChart} user={user} onSynastryData={setSynastryOverlay} onHighlight={setHighlightKey} />
                    }
                  </div>
                </>
              ) : (
                <div className="text-center py-12 space-y-3">
                  <div className="text-4xl text-gold-accent/40" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>∞</div>
                  <p className="font-body text-sm text-brass">Select a saved chart above to compare, or add a new one.</p>
                  <Button onClick={() => setShowManager(true)} className="bg-gold-primary hover:bg-gold-accent text-cream font-display text-sm">Add a Chart</Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showTour && (
        <SynastryTour steps={tourSteps} onComplete={handleTourComplete} />
      )}

      {showManager && (
        <SavedChartManager user={user} charts={savedCharts} onRefresh={loadSavedCharts} onClose={() => setShowManager(false)} />
      )}
    </div>
  );
}