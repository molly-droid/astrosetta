import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Flame, Mountain, Wind, Droplet, Loader2, Sparkles } from 'lucide-react';
import { analyzeChartDynamics, SIGN_RULERS_MODERN, SIGN_ELEMENTS, SIGN_MODALITIES } from '@/lib/chartDynamics';
import { PLANET_GLYPHS, SIGN_GLYPHS, highlightSynthesisText } from '@/lib/transitUtils';
import { getHouseShort, ordinal, HOUSE_NAMES } from '@/lib/houseUtils';
import { useDynamicsInterpretation } from './useDynamicsInterpretation';
import SpotlightCallout from '@/components/shared/SpotlightCallout';

const ELEMENT_ICONS = { Fire: Flame, Earth: Mountain, Air: Wind, Water: Droplet };
const ELEMENT_COLORS = { Fire: 'text-orange-400', Earth: 'text-green-400', Air: 'text-blue-400', Water: 'text-cyan-400' };
const ELEMENT_BAR = { Fire: '#E8572A', Earth: '#5BAD6F', Air: '#4A9FD4', Water: '#5B7FD4' };

const HOUSE_THEMES_LIST = [
  '', 'identity and first impressions', 'money and values', 'communication and learning',
  'home and family', 'creativity and romance', 'health and daily routines',
  'partnerships', 'shared resources and intimacy', 'philosophy, travel, and higher learning',
  'career and public standing', 'friendships and groups', 'solitude and spirituality',
];

const ELEMENT_DESCRIPTIONS = {
  Fire: { keywords: 'Passion, drive, inspiration', description: 'Fire energy is creative, enthusiastic, and forward-moving. It brings boldness, confidence, and a natural spark that draws others in. At its best, it fuels action and vision — watch for impulsiveness or burnout when it burns too hot.' },
  Earth: { keywords: 'Stability, practicality, patience', description: 'Earth energy is grounded, reliable, and body-aware. It brings patience, material competence, and a gift for making things real and lasting. The shadow side can be rigidity or over-attachment to security.' },
  Air: { keywords: 'Ideas, connection, objectivity', description: 'Air energy is mental, social, and concept-driven. It brings intellectual agility, curiosity, and ease with communication. The challenge is staying connected to feeling and follow-through when ideas come faster than roots.' },
  Water: { keywords: 'Intuition, depth, empathy', description: 'Water energy is feeling-oriented, intuitive, and deeply relational. It brings emotional intelligence, empathy, and access to the unconscious. The shadow is absorbing others\' energy or retreating from direct action.' },
};

const MODALITY_DESCRIPTIONS = {
  Cardinal: { keywords: 'Initiative, action, leadership', description: 'Cardinal signs launch things — they are the initiators, energized by beginnings and driven to start new cycles. A strong cardinal emphasis means you tend to take charge and push things forward, though follow-through may need attention.' },
  Fixed: { keywords: 'Persistence, depth, willpower', description: 'Fixed signs build and sustain — they dig in, commit, and see things through. A strong fixed emphasis brings determination and loyalty, but also the risk of stubbornness. You resist change until you are ready for it.' },
  Mutable: { keywords: 'Adaptability, transition, flexibility', description: 'Mutable signs adapt and distribute — they are the bridge between seasons, versatile and comfortable with change. A strong mutable emphasis makes you highly adaptable and open-minded, though decision-making can sometimes feel elusive.' },
};

function SectionLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-2">
      <div className="text-lg text-gold-accent animate-pulse">✦</div>
      <p className="font-body text-xs text-brass italic">Interpreting...</p>
    </div>
  );
}

function InterpretBlock({ reading, loading }) {
  if (loading && !reading) return <SectionLoader />;
  if (!reading) return null;
  const entries = Object.entries(reading);
  return (
    <>
      {entries.map(([key, val]) => (
        <div key={key} className="space-y-1">
          {typeof val === 'string' ? (
            <p className="font-body text-xs text-white/90 leading-snug">{highlightSynthesisText(val, null, 'text-gold-accent')}</p>
            ) : Array.isArray(val) ? (
             <ul className="space-y-1">
               {val.map((item, i) => (
                 <li key={i} className="font-body text-xs text-white/90 leading-snug">{highlightSynthesisText(typeof item === 'string' ? item : item.text || JSON.stringify(item), null, 'text-gold-accent')}</li>
               ))}
             </ul>
            ) : null}
        </div>
      ))}
    </>
  );
}

// ── Chart Ruler Section ──────────────────────────────────────────────────────
function ChartRulerSection({ chart, dynamics, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const { chartRuler } = dynamics;

  const rulerPlanet = chartRuler ? (chart?.raw_data?.planets || []).find(p => p.name === chartRuler.planet) : null;
  const facts = `Ascendant: ${chartRuler?.sign || 'unknown'} ${chartRuler ? SIGN_GLYPHS[chartRuler.sign] : ''}
Chart ruler: ${chartRuler ? `${PLANET_GLYPHS[chartRuler.planet]} ${chartRuler.planet}` : 'unknown'}
Ruler placement: ${chartRuler?.placement || 'unknown'}
${rulerPlanet ? `Ruler's house: ${rulerPlanet.house}H (${HOUSE_THEMES_LIST[rulerPlanet.house] || ''})` : ''}
${rulerPlanet ? `Ruler's sign: ${rulerPlanet.sign} (${SIGN_ELEMENTS[rulerPlanet.sign]} / ${SIGN_MODALITIES[rulerPlanet.sign]})` : ''}`;

  const sectionKey = chartRuler ? `ruler_${chartRuler.planet}_${chartRuler.sign}` : 'ruler_none';
  const { reading, loading } = useDynamicsInterpretation(
    chart, sectionKey, 'dynamics-chart-ruler', { facts }, expanded
  );

  if (!chartRuler) return null;
  return (
    <div>
      <button onClick={() => { const willOpen = !expanded; setExpanded(willOpen); onHighlight?.(willOpen && chartRuler ? { key: `planet_${chartRuler.planet}` } : null); }} className="w-full flex items-center justify-between mb-1.5">
        <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Chart Ruler</p>
        {expanded ? <ChevronDown size={12} className="text-brass/50" /> : <ChevronRight size={12} className="text-brass/50" />}
      </button>
      <p className="font-body text-xs text-white/90 leading-snug">
        <span className="text-white font-medium">{PLANET_GLYPHS[chartRuler.planet]} {chartRuler.planet}</span>
        {' '}rules your {chartRuler.sign} {SIGN_GLYPHS[chartRuler.sign]} Ascendant
        {chartRuler.placement ? ` — placed in ${chartRuler.placement}` : ''}.
      </p>
      {expanded && (
        <div className="mt-2 pl-2 border-l border-gold-primary/20 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Stellium Section ─────────────────────────────────────────────────────────
function StelliumSection({ chart, stellium, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const key = stellium.type === 'sign'
    ? `stellium_sign_${stellium.sign}${stellium.house ? `_${stellium.house}` : ''}`
    : `stellium_house_${stellium.house}`;
  const label = stellium.type === 'sign'
    ? `${SIGN_GLYPHS[stellium.sign]} ${stellium.sign} Stellium${stellium.house ? ` · ${ordinal(stellium.house)} House` : ''}`
    : `${ordinal(stellium.house)} House Stellium (${getHouseShort(stellium.house)})`;

  const facts = `Type: ${stellium.type === 'sign' ? `Sign stellium in ${stellium.sign}${stellium.house ? ` (${ordinal(stellium.house)} house)` : ''}` : `House stellium in the ${ordinal(stellium.house)} house`}
Planets involved: ${stellium.planets.join(', ')}
${stellium.type === 'sign' ? `Element: ${SIGN_ELEMENTS[stellium.sign]}, Modality: ${SIGN_MODALITIES[stellium.sign]}${stellium.house ? `, House theme: ${HOUSE_THEMES_LIST[stellium.house] || ''}` : ''}` : `House theme: ${HOUSE_THEMES_LIST[stellium.house] || ''}`}`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, key, 'dynamics-stellium', { facts }, expanded
  );

  return (
    <div className="rounded-lg border border-gold-primary/20 bg-gold-primary/5 p-2.5">
      <button onClick={() => { const willOpen = !expanded; setExpanded(willOpen); onHighlight?.(willOpen ? { planets: stellium.planets, category: 'stellium', color: '#C9A961' } : null); }} className="w-full flex items-center justify-between">
        <p className="font-body text-xs text-white font-medium">{label}</p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={11} className="animate-spin text-gold-primary" />}
          {expanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {stellium.planets.map(p => (
          <span key={p} className="font-body text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/80">
            {PLANET_GLYPHS[p]} {p}
          </span>
        ))}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gold-primary/15 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Empty Houses Section ────────────────────────────────────────────────────
function EmptyHouseRow({ house, chart, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const key = `empty_house_${house.house}`;
  const theme = HOUSE_THEMES_LIST[house.house] || '';

  const facts = `${ordinal(house.house)} House — theme: ${theme}
Cusp sign: ${house.cuspSign} ${SIGN_GLYPHS[house.cuspSign]}
Modern ruler: ${house.ruler} ${house.rulerPlacement.includes('unknown') ? '(placement unknown)' : `— placed ${house.rulerPlacement}`}
${house.tradRuler ? `Traditional ruler: ${house.tradRuler}` : ''}`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, key, 'dynamics-empty-house', { facts }, expanded
  );

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <button onClick={() => { const willOpen = !expanded; setExpanded(willOpen); onHighlight?.(willOpen ? { key: `planet_${house.ruler}` } : null); }} className="w-full flex items-start gap-2 px-2.5 py-2 hover:bg-white/[0.03] transition-colors text-left">
        <span className="font-body text-[11px] text-gold-accent/80 w-14 flex-shrink-0 mt-0.5">{ordinal(house.house)} H</span>
        <div className="flex-1 min-w-0">
          <p className="font-body text-xs text-white/90 leading-snug">
            <span className="text-brass/60">{SIGN_GLYPHS[house.cuspSign]}</span>{' '}
            <span className="text-white font-medium">{PLANET_GLYPHS[house.ruler]} {house.ruler}</span>
            {!house.rulerPlacement.includes('unknown') && (
              <span className="text-white/60"> → {house.rulerPlacement.replace(/^[^ ]+ in /, '')}</span>
            )}
          </p>
          <p className="font-body text-[10px] text-brass/50 mt-0.5">{theme}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {loading && <Loader2 size={10} className="animate-spin text-gold-primary" />}
          {expanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 pt-0 border-t border-white/[0.04] space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

function EmptyHousesSection({ chart, emptyHouses, onHighlight }) {
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  const houses = emptyHouses || [];
  const facts = `Empty houses (${houses.length} total):
${houses.map(h => `- ${ordinal(h.house)} House: cusp in ${h.cuspSign} ${SIGN_GLYPHS[h.cuspSign]}, ruled by ${h.ruler}${h.rulerPlacement.includes('unknown') ? '' : ` (${h.rulerPlacement})`}${h.tradRuler ? `, trad ruler: ${h.tradRuler}` : ''}`).join('\n') || 'None'}`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, `empty_houses_overview`, 'dynamics-empty-houses-overview', { facts }, overviewExpanded
  );

  if (!emptyHouses.length) return null;
  return (
    <div>
      <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1.5">
        Empty Houses <span className="text-brass/50 normal-case tracking-normal">({emptyHouses.length})</span>
      </p>
      <p className="font-body text-[11px] text-brass/70 mb-2 leading-snug italic">
        Empty houses aren't inactive — they're ruled by the planet that governs their cusp sign. Tap any house to see how it shows up for you.
      </p>
      <div className="space-y-1.5">
        {emptyHouses.map(h => (
          <EmptyHouseRow key={h.house} house={h} chart={chart} onHighlight={onHighlight} />
        ))}
      </div>
      {/* Overview interpretation */}
      <button onClick={() => setOverviewExpanded(!overviewExpanded)} className="w-full flex items-center justify-between mt-2 pt-2 border-t border-gold-primary/15">
        <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Overall Pattern</p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={11} className="animate-spin text-gold-primary" />}
          {overviewExpanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      {overviewExpanded && (
        <div className="mt-2 pt-2 border-t border-gold-primary/15 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Element Balance Section ─────────────────────────────────────────────────
function ElementBalanceSection({ chart, elementBalance, modalityBalance, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const [activeEl, setActiveEl] = useState(null);
  const [activeMod, setActiveMod] = useState(null);
  const planetsOfElement = (el) => (chart?.raw_data?.planets || []).filter(p => p.sign && SIGN_ELEMENTS[p.sign] === el).map(p => p.name);
  const planetsOfModality = (mod) => (chart?.raw_data?.planets || []).filter(p => p.sign && SIGN_MODALITIES[p.sign] === mod).map(p => p.name);
  const dominant = elementBalance[0];
  const weakest = elementBalance[elementBalance.length - 1];

  const facts = `Element distribution (out of ${elementBalance.reduce((s, e) => s + e.count, 0)} planets):
${elementBalance.map(e => `- ${e.element}: ${e.count} (${e.percentage}%)`).join('\n')}

Modality distribution:
${modalityBalance.map(m => `- ${m.modality}: ${m.count} (${m.percentage}%)`).join('\n')}

Dominant element: ${dominant.element}
Weakest element: ${weakest.element}`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, `element_balance`, 'dynamics-element-balance', { facts }, expanded
  );

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between mb-1.5">
        <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70">Element Balance</p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={11} className="animate-spin text-gold-primary" />}
          {expanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      <div className="space-y-1.5">
        {elementBalance.map(el => {
          const Icon = ELEMENT_ICONS[el.element];
          const desc = ELEMENT_DESCRIPTIONS[el.element];
          return (
            <div key={el.element} className="rounded-lg border border-white/[0.06] overflow-hidden">
              <div
                onClick={() => {
                  const planets = planetsOfElement(el.element);
                  if (!planets.length) return;
                  const willActive = activeEl !== el.element;
                  setActiveEl(willActive ? el.element : null);
                  setActiveMod(null);
                  onHighlight?.(willActive ? { planets, category: 'pattern', color: ELEMENT_BAR[el.element] } : null);
                }}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors ${activeEl === el.element ? 'bg-white/[0.05]' : ''}`}
              >
                {Icon && <Icon size={12} className={ELEMENT_COLORS[el.element]} />}
                <span className="font-body text-xs text-white/80 w-12">{el.element}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${el.percentage}%`, background: ELEMENT_BAR[el.element] }} />
                </div>
                <span className="font-body text-[10px] text-brass/60 w-6 text-right">{el.count}</span>
              </div>
              {el.count > 0 && desc && (
                <div className="px-2.5 pb-2 pt-0.5">
                  <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-0.5">{desc.keywords}</p>
                  <p className="font-body text-[10px] text-white/60 leading-snug">{desc.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 mt-2">
        {modalityBalance.map(mod => {
          const desc = MODALITY_DESCRIPTIONS[mod.modality];
          return (
            <div key={mod.modality} className="rounded-lg border border-white/[0.06] overflow-hidden">
              <div
                onClick={() => {
                  const planets = planetsOfModality(mod.modality);
                  if (!planets.length) return;
                  const willActive = activeMod !== mod.modality;
                  setActiveMod(willActive ? mod.modality : null);
                  setActiveEl(null);
                  onHighlight?.(willActive ? { planets, category: 'pattern', color: '#9DB4C8' } : null);
                }}
                className={`flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors ${activeMod === mod.modality ? 'bg-white/[0.05]' : ''}`}
              >
                <span className="font-body text-[10px] text-white/70">{mod.modality}</span>
                <span className="font-display text-sm text-white font-semibold">{mod.count}</span>
              </div>
              {mod.count > 0 && desc && (
                <div className="px-2.5 pb-2 pt-0.5">
                  <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-0.5">{desc.keywords}</p>
                  <p className="font-body text-[10px] text-white/60 leading-snug">{desc.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gold-primary/15 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Aspect Pattern Section ──────────────────────────────────────────────────
// (Pattern-specific interpretation guidance lives with the
// 'dynamics-aspect-pattern' task server-side.)
function AspectPatternSection({ chart, pattern, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const key = `pattern_${pattern.type}_${pattern.planets.join('_')}`;

  const facts = `Pattern type: ${pattern.type}
Planets involved: ${pattern.planets.join(', ')}
${pattern.apex ? `Apex planet (where tension concentrates): ${pattern.apex}` : ''}
${pattern.element ? `Elemental theme: ${pattern.element}` : ''}`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, key, 'dynamics-aspect-pattern', { facts, patternType: pattern.type }, expanded
  );

  return (
    <div className="rounded-lg border border-celestial-purple/30 bg-celestial-purple/10 p-2.5">
      <button onClick={() => { const willOpen = !expanded; setExpanded(willOpen); onHighlight?.(willOpen ? { planets: pattern.planets, category: 'pattern', color: '#B8A5C8' } : null); }} className="w-full flex items-center justify-between">
        <p className="font-body text-xs text-white font-medium">{pattern.type}</p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={11} className="animate-spin text-gold-primary" />}
          {expanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {pattern.planets.map(pl => (
          <span key={pl} className="font-body text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/80">
            {PLANET_GLYPHS[pl]} {pl}
          </span>
        ))}
      </div>
      {pattern.apex && <p className="font-body text-[11px] text-brass/70 mt-1">Apex: {pattern.apex}</p>}
      {pattern.element && <p className="font-body text-[11px] text-brass/70 mt-1">Element: {pattern.element}</p>}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-celestial-purple/15 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Stellium Opposition Section ─────────────────────────────────────────────
function StelliumOppositionSection({ chart, opposition, onHighlight }) {
  const [expanded, setExpanded] = useState(false);
  const key = `stellium_opp_${opposition.sign1}_${opposition.sign2}`;

  const facts = `${opposition.sign1} stellium (planets: ${opposition.planets1.join(', ')}) opposes ${opposition.sign2} stellium (planets: ${opposition.planets2.join(', ')}).`;

  const { reading, loading } = useDynamicsInterpretation(
    chart, key, 'dynamics-stellium-opposition', { facts }, expanded
  );

  return (
    <div className="rounded-lg border border-celestial-pink/30 bg-celestial-pink/10 p-2.5">
      <button onClick={() => { const willOpen = !expanded; setExpanded(willOpen); onHighlight?.(willOpen ? { planets: [...opposition.planets1, ...opposition.planets2], category: 'pattern', color: '#D8B4C2' } : null); }} className="w-full flex items-center justify-between">
        <p className="font-body text-xs text-white font-medium">
          {SIGN_GLYPHS[opposition.sign1]} {opposition.sign1} ↔ {SIGN_GLYPHS[opposition.sign2]} {opposition.sign2}
        </p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={11} className="animate-spin text-gold-primary" />}
          {expanded ? <ChevronDown size={11} className="text-brass/50" /> : <ChevronRight size={11} className="text-brass/50" />}
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
        {opposition.planets1.map(p => (
          <span key={p} className="font-body text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/80">{PLANET_GLYPHS[p]} {p}</span>
        ))}
        <span className="font-body text-[10px] text-brass/50 px-1">↔</span>
        {opposition.planets2.map(p => (
          <span key={p} className="font-body text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/80">{PLANET_GLYPHS[p]} {p}</span>
        ))}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-celestial-pink/15 space-y-1.5">
          {loading && !reading ? <SectionLoader /> : reading && <InterpretBlock reading={reading} loading={loading} />}
        </div>
      )}
    </div>
  );
}

// ── Main Card ────────────────────────────────────────────────────────────────
export default function ChartDynamicsCard({ chart, autoExpand = false, spotlightMode = false, onSpotlightEnd, onHighlight }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [activeCallouts, setActiveCallouts] = useState(
    spotlightMode ? new Set(['ruler', 'stelliums', 'empty', 'elements', 'patterns']) : new Set()
  );

  const dismissCallout = (key) => setActiveCallouts(prev => {
    const next = new Set(prev);
    next.delete(key);
    return next;
  });

  const endTour = () => {
    setActiveCallouts(new Set());
    onSpotlightEnd?.();
  };

  const dynamics = useMemo(() => analyzeChartDynamics(chart?.raw_data), [chart?.id]);
  if (!dynamics) return null;

  const { stelliums, stelliumOppositions, emptyHouses, chartRuler, elementBalance, modalityBalance, aspectPatterns } = dynamics;

  const tags = [];
  if (stelliums.length) tags.push(`${stelliums.length} Stellium${stelliums.length > 1 ? 's' : ''}`);
  if (emptyHouses.length) tags.push(`${emptyHouses.length} Empty House${emptyHouses.length > 1 ? 's' : ''}`);
  if (aspectPatterns.length) tags.push(`${aspectPatterns.length} Pattern${aspectPatterns.length > 1 ? 's' : ''}`);
  if (chartRuler?.placement) tags.push(`Ruler: ${chartRuler.planet}`);
  if (elementBalance[0]?.count >= 4) tags.push(`${elementBalance[0].element} dominant`);

  return (
    <div className="celestial-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers size={14} className="text-gold-accent flex-shrink-0" />
            <span className="font-display text-sm font-semibold text-white">Chart Dynamics</span>
          </div>
          {expanded ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
            {tags.map((tag, i) => (
              <span key={i} className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-gold-primary/15 text-brass">{tag}</span>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gold-primary/20 px-4 pb-4 pt-3 space-y-4">
          {spotlightMode && activeCallouts.size > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-gold-accent/30 bg-gold-primary/10 px-3 py-2">
              <p className="font-body text-[10px] text-gold-accent font-semibold uppercase tracking-widest">✦ Spotlight Tour</p>
              <button onClick={endTour} className="font-body text-[10px] text-brass hover:text-gold-accent underline underline-offset-2">
                End tour
              </button>
            </div>
          )}

          {chartRuler && (
            <>
              {spotlightMode && activeCallouts.has('ruler') && (
                <SpotlightCallout
                  text="Your chart ruler governs your identity and life direction. Tap to expand for a deep interpretation of what it means for you."
                  onDismiss={() => dismissCallout('ruler')}
                />
              )}
              <ChartRulerSection chart={chart} dynamics={dynamics} onHighlight={onHighlight} />
            </>
            )
          }

          {stelliums.length > 0 && (
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1.5">Stelliums</p>
              {spotlightMode && activeCallouts.has('stelliums') && (
                <SpotlightCallout
                  text="Stelliums are clusters of 3+ planets in one sign or house — they amplify and concentrate that area of life. Expand each to see how they interact."
                  onDismiss={() => dismissCallout('stelliums')}
                />
              )}
              <div className="space-y-2">
                {stelliums.map((s, i) => <StelliumSection key={i} chart={chart} stellium={s} onHighlight={onHighlight} />)}
              </div>
            </div>
          )}

          {stelliumOppositions.length > 0 && (
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1.5">Stellium Oppositions</p>
              <div className="space-y-2">
                {stelliumOppositions.map((opp, i) => <StelliumOppositionSection key={i} chart={chart} opposition={opp} onHighlight={onHighlight} />)}
              </div>
            </div>
          )}

          {spotlightMode && activeCallouts.has('empty') && (
            <SpotlightCallout
              text="Empty houses aren't inactive — they're ruled by the planet governing their cusp sign. Expand to see which planets rule your empty houses."
              onDismiss={() => dismissCallout('empty')}
            />
          )}
          <EmptyHousesSection chart={chart} emptyHouses={emptyHouses} onHighlight={onHighlight} />

          {spotlightMode && activeCallouts.has('elements') && (
            <SpotlightCallout
              text="Your element and modality balance reveals your temperament — how you process energy, take action, and adapt to change."
              onDismiss={() => dismissCallout('elements')}
            />
          )}
          <ElementBalanceSection chart={chart} elementBalance={elementBalance} modalityBalance={modalityBalance} onHighlight={onHighlight} />

          {aspectPatterns.length > 0 && (
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent/70 mb-1.5">Aspect Patterns</p>
              {spotlightMode && activeCallouts.has('patterns') && (
                <SpotlightCallout
                  text="Aspect patterns are multi-planet geometric shapes (Grand Trines, T-Squares) that reveal natural talents and core tensions in your chart."
                  onDismiss={() => dismissCallout('patterns')}
                />
              )}
              <div className="space-y-2">
                {aspectPatterns.map((p, i) => <AspectPatternSection key={i} chart={chart} pattern={p} onHighlight={onHighlight} />)}
              </div>
            </div>
          )}

          {stelliums.length === 0 && emptyHouses.length === 0 && aspectPatterns.length === 0 && (
            <p className="font-body text-xs text-brass italic text-center py-2">No major structural patterns detected — your chart energy is evenly distributed.</p>
          )}
        </div>
      )}
    </div>
  );
}