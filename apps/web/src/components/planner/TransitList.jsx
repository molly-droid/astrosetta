import React, { useState } from 'react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import SignName from '@/components/ui/SignName';
import { PERSONA, formatTransitLabel, HOUSE_THEMES, ASPECT_ANGLES, highlightSynthesisText, estimateTransitTime, formatTime } from '@/lib/transitUtils';
import { useAuth } from '@/lib/AuthContext';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { densityPromptSuffix } from '@/lib/knowledgeDensity';
import Eli5Button from '@/components/ui/Eli5Button';
import { base44 } from '@/api/base44Client';
import { Loader2, ChevronDown, ChevronRight, SlidersHorizontal, Lock, ArrowUpDown } from 'lucide-react';
import PaywallModal from '@/components/paywall/PaywallModal';
import { usePermissions } from '@/lib/permissions';

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E', semisextile: '\u26BA\uFE0E', semisquare: '\u2220\uFE0E', sesquisquare: '\u26BC\uFE0E',
};

const ASPECT_ORDER = ['conjunction', 'opposition', 'trine', 'square', 'sextile'];
const ASPECT_LABELS = { conjunction: 'Conjunctions', opposition: 'Oppositions', trine: 'Trines', square: 'Squares', sextile: 'Sextiles' };

function groupByAspect(aspects) {
  if (!aspects?.length) return {};
  const grouped = {};
  for (const a of aspects) {
    const key = a.aspect in ASPECT_LABELS ? a.aspect : 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }
  return grouped;
}

const SIGN_OF = {
  Aries: 'Aries', Taurus: 'Taurus', Gemini: 'Gemini', Cancer: 'Cancer',
  Leo: 'Leo', Virgo: 'Virgo', Libra: 'Libra', Scorpio: 'Scorpio',
  Sagittarius: 'Sagittarius', Capricorn: 'Capricorn', Aquarius: 'Aquarius', Pisces: 'Pisces',
};

const FILTER_OPTIONS = [
  { key: 'natal',    label: 'Natal' },
  { key: 'mundane',  label: 'Sky' },
  { key: 'lunar',    label: 'Moon' },
  { key: 'rx',       label: 'Rx' },
];

const STATION_PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

const SORT_OPTIONS = [
  { key: 'aspect',  label: 'Aspect' },
  { key: 'planet',  label: 'Planet' },
  { key: 'time',    label: 'Closest' },
  { key: 'priority', label: 'Priority' },
];

// Planet importance weights for priority scoring (higher = more impactful transit)
const PLANET_WEIGHTS = {
  Pluto: 10, Neptune: 9, Uranus: 8, Saturn: 7, Jupiter: 6,
  Mars: 5, Venus: 4, Mercury: 3, Sun: 2, Moon: 1,
  Ascendant: 9, Midheaven: 8, Chiron: 3,
  'North Node': 4, 'South Node': 3,
};

// Aspect importance weights
const ASPECT_WEIGHTS = {
  conjunction: 10, opposition: 9, square: 7, trine: 5, sextile: 3,
  quincunx: 2,
};

// Match LLM-generated synthesis bullets to raw transit aspects for pre-expanded display.
// personal_reading is order-locked to the PERSONAL transit list, so we match by index.
// collective_reading has no order lock, so we match by planet name pairs.
function buildPreloadedTexts(synthesis, aspects, type) {
  const map = new Map();
  if (!synthesis || !aspects) return map;
  if (type === 'personal') {
    const bullets = synthesis.personal_reading || [];
    aspects.forEach((a, i) => { if (bullets[i]) map.set(a, bullets[i]); });
  } else if (type === 'collective') {
    const bullets = synthesis.collective_reading || [];
    aspects.forEach(a => {
      const bullet = bullets.find(b => {
        const lower = b.toLowerCase();
        return lower.includes(a.transit_planet.toLowerCase()) &&
               lower.includes(a.natal_planet.toLowerCase());
      });
      if (bullet) map.set(a, bullet);
    });
  }
  return map;
}

// Compute a priority score for a transit (higher = more significant)
function transitPriority(a) {
  const pWeight = PLANET_WEIGHTS[a.transit_planet] || 3;
  const aspWeight = ASPECT_WEIGHTS[a.aspect] || 2;
  // Closer orb = more intense, scale: 0° = 10, 8° = 0
  const orbScore = Math.max(0, 10 - (a.orb || 0) * 1.25);
  // Personal transits (natal/lunar) get a boost
  const typeBonus = a.type === 'natal' ? 3 : a.type === 'lunar' ? 2 : 0;
  return pWeight + aspWeight + orbScore + typeBonus;
}

// Sort a list of transits based on the selected mode
function sortTransits(items, mode, transitPlanets, natalPlanets) {
  if (!items?.length) return items;
  const copy = [...items];
  switch (mode) {
    case 'planet': {
      const order = Object.keys(PLANET_WEIGHTS);
      return copy.sort((a, b) => {
        const ia = order.indexOf(a.transit_planet);
        const ib = order.indexOf(b.transit_planet);
        if (ia === -1 && ib === -1) return a.transit_planet.localeCompare(b.transit_planet);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    case 'time':
      return copy.sort((a, b) => (a.orb || 99) - (b.orb || 99));
    case 'priority':
      return copy.sort((a, b) => transitPriority(b) - transitPriority(a));
    case 'aspect':
    default:
      return copy.sort((a, b) => {
        const order = ASPECT_ORDER.indexOf(a.aspect);
        const orderB = ASPECT_ORDER.indexOf(b.aspect);
        if (order === -1 && orderB === -1) return 0;
        if (order === -1) return 1;
        if (orderB === -1) return -1;
        return order - orderB;
      });
  }
}

// Build a label matching the calendar style: "♃Jupiter in Cancer △ natal ⚷Chiron · 8th House of Cancer"
const NODE_GLYPHS = { 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E' };
function getTransitGlyph(name) {
  return PLANET_GLYPHS[name] || NODE_GLYPHS[name] || '';
}

function buildLabel(a, transitPlanets, natalPlanets) {
  const tP = transitPlanets?.find(p => p.name === a.transit_planet);
  const nP = natalPlanets?.find(p => p.name === a.natal_planet);
  const tSign = tP?.sign || '';
  const nSign = nP?.sign || '';
  const tG = getTransitGlyph(a.transit_planet);
  const nG = getTransitGlyph(a.natal_planet);
  const tDeg = tP?.degree != null ? ` ${tP.degree.toFixed(1)}°` : '';
  const sym = ASPECT_SYMBOLS[a.aspect] || a.aspect;
  const houseStr = nP?.house ? `${ordinal(nP.house)} House` : '';
  const houseSign = nSign ? `of ${nSign}` : '';

  if (a.isMundanePair) {
    const p2 = transitPlanets?.find(p => p.name === a.natal_planet);
    const p2Sign = p2?.sign || '';
    const p2Deg = p2?.degree != null ? ` ${p2.degree.toFixed(1)}°` : '';
    return (
      <span>
        <span className="opacity-70">{tG}</span><strong>{a.transit_planet}</strong> in <SignName sign={tSign} />{tDeg} {sym} <span className="opacity-70">{nG}</span><strong>{a.natal_planet}</strong> in <SignName sign={p2Sign} />{p2Deg}
      </span>
    );
  }

  return (
    <span>
      <span className="opacity-70">{tG}</span> <strong>{a.transit_planet}</strong>{tSign ? <> in <SignName sign={tSign} /></> : ''}{tDeg} {sym} natal <span className="opacity-70">{nG}</span> <strong>{a.natal_planet}</strong>{houseStr ? <> · {houseStr}{nSign ? <> of <SignName sign={nSign} /></> : ''}</> : ''}
    </span>
  );
}

function AspectRow({ a, chart, date, transitPlanets, natalPlanets, canViewInterpretations, timeFormat = '12h', onHighlightTransit, preloadedText }) {
  const [open, setOpen] = useState(!!preloadedText);
  const [text, setText] = useState(preloadedText || null);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { knowledgeDepth } = useUserPrefs();

  const borderColor =
    a.type === 'natal' ? 'border-l-celestial-blue/60' :
    a.type === 'lunar' ? 'border-l-bronze/40' :
    'border-l-white/20';

  const bgHover =
    a.type === 'natal' ? 'hover:bg-celestial-blue/5' :
    a.type === 'lunar' ? 'hover:bg-bronze/5' :
    'hover:bg-white/5';

  const textColor =
    a.type === 'natal' ? 'text-celestial-blue' :
    a.type === 'lunar' ? 'text-brass' :
    'text-white/80';

  const toggle = async () => {
    if (!canViewInterpretations) {
      setShowPaywall(true);
      return;
    }
    if (!open && !text) {
      setOpen(true);
      setLoading(true);
      if (onHighlightTransit) onHighlightTransit(`tasp_${a.transit_planet}_${a.aspect}_${a.natal_planet}`);
      const raw = chart?.raw_data || {};
      const dateStr = date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '';
      const tP = transitPlanets?.find(p => p.name === a.transit_planet);
      const nP = natalPlanets?.find(p => p.name === a.natal_planet);
      const isNatal = a.type === 'natal' || a.type === 'lunar';
      const context = isNatal
        ? `Transiting ${a.transit_planet}${tP?.sign ? ` in ${tP.sign}` : ''} ${a.aspect} natal ${a.natal_planet}${nP?.sign ? ` in ${nP.sign}` : ''}${nP?.house ? `, ${ordinal(nP.house)} house` : ''} (orb ${a.orb?.toFixed(1)}°)`
        : `${a.transit_planet}${tP?.sign ? ` in ${tP.sign}` : ''} ${a.aspect} ${a.natal_planet} (mundane transit, orb ${a.orb?.toFixed(1)}°)`;

      const houseTheme = nP?.house ? HOUSE_THEMES[nP.house] || '' : '';

      const prompt = `${PERSONA}

${densityPromptSuffix(knowledgeDepth)}

${formatTransitLabel(a, transitPlanets, natalPlanets, !isNatal)}
Natal ${a.natal_planet}: ${nP?.sign || ''}${nP?.house ? `, ${ordinal(nP.house)} house` : ''}${houseTheme ? ` (${houseTheme})` : ''}

Write 2 sentences. Sentence 1: explain the astrological mechanic — WHY this transiting planet in its current sign making this aspect to this natal planet in this house creates this effect. Name the sign and house. Sentence 2: one concrete awareness or action. No clichés, no generic horoscope language.`;

      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      setText(result);
      setLoading(false);
    } else {
      const newOpen = !open;
      setOpen(newOpen);
      if (onHighlightTransit) onHighlightTransit(newOpen ? `tasp_${a.transit_planet}_${a.aspect}_${a.natal_planet}` : null);
    }
  };

  const labelContext = `${a.transit_planet} ${a.aspect} your natal ${a.natal_planet}`;

  const _tP = transitPlanets?.find(p => p.name === a.transit_planet);
  const _nP = natalPlanets?.find(p => p.name === a.natal_planet);
  const eli5Context = a.type === 'mundane'
    ? `${a.transit_planet}${_tP?.sign ? ` in ${_tP.sign}` : ''} ${a.aspect} ${a.natal_planet}${_nP?.sign ? ` in ${_nP.sign}` : ''} in the sky right now`
    : `${a.transit_planet}${_tP?.sign ? ` in ${_tP.sign}` : ''} ${a.aspect} your natal ${a.natal_planet}${_nP?.house ? ` in your ${ordinal(_nP.house)} house` : ''}`;

  return (
    <div className={`border-l-2 ${borderColor} rounded-r-lg overflow-hidden`}>
      {showPaywall && <PaywallModal variant="interpret" fromTier="free" context={labelContext} onClose={() => setShowPaywall(false)} />}
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between py-2 px-3 transition-colors text-left ${bgHover}`}
      >
        <span className={`font-body text-xs leading-snug ${textColor}`}>
          {buildLabel(a, transitPlanets, natalPlanets)}
        </span>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          {a.exact && (
            <span className="font-body text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gold-primary/20 text-gold-accent border border-gold-primary/30 leading-none">exact</span>
          )}
          <span className="font-body text-[10px] text-brass">{a.orb?.toFixed(1)}°</span>
          {(() => {
            const tP = transitPlanets?.find(p => p.name === a.transit_planet);
            const nP = natalPlanets?.find(p => p.name === a.natal_planet);
            const est = estimateTransitTime(
              tP?.longitude, nP?.longitude, a.aspect, a.orb,
              tP?.retrograde, a.transit_planet,
            );
            if (!est) return null;
            return (
              <span className={`font-body text-[10px] ml-1.5 ${est.withinDay ? 'text-white/50' : 'text-white/25'}`}>
                {formatTime(est.time, timeFormat)}
              </span>
            );
          })()}
          {!canViewInterpretations
            ? <Lock size={11} className="text-brass/30" />
            : loading ? <Loader2 size={11} className="animate-spin text-gold-primary" />
            : open ? <ChevronDown size={12} className="text-brass/40" /> : <ChevronRight size={12} className="text-brass/30" />
          }
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1">
          {loading ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 size={11} className="animate-spin text-gold-primary" />
              <span className="font-body text-[11px] text-brass italic">Interpreting...</span>
            </div>
          ) : (
            <>
              <p className="font-body text-xs text-white/90 leading-snug">{highlightSynthesisText(text, onHighlightTransit, 'text-gold-primary')}</p>
              <Eli5Button context={eli5Context} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StationPill({ station }) {
  const g = PLANET_GLYPHS[station.planet] || '';
  const isRx = station.type === 'retrograde';
  const isApproaching = !!station.approaching;
  const expectedLabel = (isApproaching && station.expected_date)
    ? new Date(station.expected_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  return (
    <div className={`border-l-2 rounded-r-lg px-3 py-2.5 ${isRx ? 'border-l-gold-accent/80 bg-gold-accent/10' : 'border-l-green-soft/60 bg-green-soft/10'}`}>
      <span className={`font-body text-xs ${isRx ? 'text-gold-accent' : 'text-green-soft'}`}>
        <span className="opacity-60">{g}</span> <strong>{station.planet}</strong> stations {isRx ? 'retrograde ℞' : 'direct ↗'} in <SignName sign={station.sign} />
        {isApproaching && expectedLabel && <span className="ml-1.5 text-[9px] text-brass/60">in {station.days_until}d · est. {expectedLabel}</span>}
        {!isApproaching && <span className="ml-1.5 text-[9px] font-semibold text-gold-accent">today</span>}
      </span>
    </div>
  );
}

function RetrogradePill({ tp, stations }) {
  const g = PLANET_GLYPHS[tp.name] || '';
  const station = stations?.find(s => s.planet === tp.name);
  return (
    <div className="border-l-2 border-l-celestial-purple/60 rounded-r-lg px-3 py-2 bg-celestial-purple/5">
      <span className="font-body text-xs text-celestial-purple">
        <span className="opacity-60">{g}</span> <strong>{tp.name}</strong> ℞ in <SignName sign={tp.sign} />
        {station && <span className="ml-1.5 text-[9px] font-semibold text-gold-accent">stationing {station.type}</span>}
      </span>
    </div>
  );
}

function SectionHeader({ dotClass, label }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}></div>
      <p className="font-body text-xs text-brass uppercase tracking-widest font-semibold">{label}</p>
    </div>
  );
}

// Renders a list of transit aspects, either grouped by aspect type or flat sorted
function TransitSection({ items, sortMode, transitPlanets, natalPlanets, chart, date, canViewInterpretations, timeFormat, onHighlightTransit, preloadedTexts }) {
  if (!items?.length) return null;
  const sorted = sortTransits(items, sortMode, transitPlanets, natalPlanets);

  if (sortMode === 'aspect') {
    const grouped = groupByAspect(sorted);
    return (
      <div className="space-y-3">
        {ASPECT_ORDER.map(asp => {
          const groupItems = grouped[asp];
          if (!groupItems?.length) return null;
          return (
            <div key={asp}>
              <p className="font-body text-[10px] text-white/40 uppercase tracking-wide mb-1">{ASPECT_LABELS[asp]}</p>
              <div className="space-y-1">
                {groupItems.map((a, i) => (
                   <AspectRow key={`${asp}_${i}`} a={a} chart={chart} date={date} transitPlanets={transitPlanets} natalPlanets={natalPlanets} canViewInterpretations={canViewInterpretations} timeFormat={timeFormat} onHighlightTransit={onHighlightTransit} preloadedText={preloadedTexts?.get(a)} />
                 ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((a, i) => (
        <AspectRow key={i} a={a} chart={chart} date={date} transitPlanets={transitPlanets} natalPlanets={natalPlanets} canViewInterpretations={canViewInterpretations} timeFormat={timeFormat} onHighlightTransit={onHighlightTransit} preloadedText={preloadedTexts?.get(a)} />
      ))}
    </div>
  );
}

// Filter + sort bar
function FilterBar({ filters, setFilters, sortMode, setSortMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 font-body text-[10px] text-brass hover:text-white/60 transition-colors"
        >
          <SlidersHorizontal size={11} />
          <span>Filters</span>
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={11} className="text-brass" />
          <span className="font-body text-[10px] text-brass">Sort:</span>
          <div className="flex bg-white/[0.04] rounded-full p-0.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortMode(opt.key)}
                className={`px-2 py-0.5 rounded-full font-body text-[10px] transition-all ${
                  sortMode === opt.key
                    ? 'bg-gold-primary/20 text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFilters(f => ({ ...f, [opt.key]: !f[opt.key] }))}
              className={`px-2.5 py-1 rounded-full border font-body text-[10px] transition-all ${
                filters[opt.key]
                  ? 'border-gold-accent/60 bg-gold-primary/10 text-white'
                  : 'border-gold-primary/20 text-brass/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TransitList({ data, chart, date, canViewInterpretations = true, onHighlightTransit, synthesis }) {
  const { user } = useAuth();
  const timeFormat = user?.time_format || '12h';
  const [filters, setFilters] = useState({ natal: true, mundane: true, lunar: true, rx: true });
  const [sortMode, setSortMode] = useState('aspect');
  const [tab, setTab] = useState('personal'); // personal first

  if (!data) return null;
  const { natalAspects, mundaneAspects, lunarAspects, moonSign, moonHouse, moonPhase, isExactNewMoon, isExactFullMoon, transitPlanets, natalPlanets: freshNatalPlanets, stations, ingresses } = data;
  // Use freshly calculated natal planets from the transit response (correct houses)
  // instead of stored chart data which may have stale house assignments
  const natalPlanets = [...(freshNatalPlanets || chart?.raw_data?.planets || [])];
  const angles = chart?.raw_data?.angles;
  if (angles) {
    if (angles.ascendant) natalPlanets.push({ name: 'Ascendant', sign: angles.ascendant.sign, house: 1, longitude: angles.ascendant.longitude });
    if (angles.midheaven) natalPlanets.push({ name: 'Midheaven', sign: angles.midheaven.sign, house: 10, longitude: angles.midheaven.longitude });
  }

  const rxPlanets = (transitPlanets || []).filter(tp => STATION_PLANETS.includes(tp.name) && tp.retrograde === true);

  const personalPreloaded = buildPreloadedTexts(synthesis, natalAspects, 'personal');
  const collectivePreloaded = buildPreloadedTexts(synthesis, mundaneAspects, 'collective');

  const hasAny = natalAspects?.length || mundaneAspects?.length || lunarAspects?.length || moonSign || rxPlanets.length || stations?.length || ingresses?.length;
  if (!hasAny) {
    return <p className="font-body text-xs text-brass italic text-center py-4">The sky is quiet today — a good day to rest and reflect.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Personal / Collective tabs */}
      <div className="flex border-b border-white/[0.08] mb-1">
        {[
          { key: 'personal', label: 'Personal' },
          { key: 'collective', label: 'Collective' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
              tab === t.key ? 'border-gold-accent text-white font-semibold' : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} sortMode={sortMode} setSortMode={setSortMode} />

      {tab === 'personal' && (
        <div className="space-y-4">
          {/* Natal transits */}
          {filters.natal && natalAspects?.length > 0 && (
            <div>
              <SectionHeader dotClass="bg-celestial-blue" label="Personal Transits" />
              <TransitSection items={natalAspects} sortMode={sortMode} transitPlanets={transitPlanets} natalPlanets={natalPlanets} chart={chart} date={date} canViewInterpretations={canViewInterpretations} timeFormat={timeFormat} onHighlightTransit={onHighlightTransit} preloadedTexts={personalPreloaded} />
            </div>
          )}
          {/* Lunar transits */}
          {filters.lunar && moonSign && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-bronze/50"></div>
                <p className="font-body text-xs text-brass uppercase tracking-widest">Moon Transits</p>
                <span className="font-body text-[10px] text-brass bg-bronze/10 border border-bronze/20 rounded-full px-2 py-0.5 ml-1">
                  ☽ <SignName sign={moonSign} />{moonHouse ? ` · ${ordinal(moonHouse)} House` : ''}
                  {isExactNewMoon ? ' · 🌑 New Moon' : isExactFullMoon ? ' · 🌕 Full Moon' : ''}
                </span>
              </div>
              {lunarAspects?.length > 0 ? (
                <TransitSection items={lunarAspects} sortMode={sortMode} transitPlanets={transitPlanets} natalPlanets={natalPlanets} chart={chart} date={date} canViewInterpretations={canViewInterpretations} timeFormat={timeFormat} onHighlightTransit={onHighlightTransit} />
              ) : (
                <p className="font-body text-[11px] text-brass italic pl-4">No exact lunar aspects today.</p>
              )}
            </div>
          )}
          {!natalAspects?.length && !lunarAspects?.length && (
            <p className="font-body text-xs text-brass italic text-center py-3">No personal transits today — a quiet day for your chart.</p>
          )}
        </div>
      )}

      {tab === 'collective' && (
        <div className="space-y-4">
          {/* Mundane transits */}
          {filters.mundane && mundaneAspects?.length > 0 && (
            <div>
              <SectionHeader dotClass="bg-white/30" label="Sky Transits" />
              <TransitSection items={mundaneAspects} sortMode={sortMode} transitPlanets={transitPlanets} natalPlanets={natalPlanets} chart={chart} date={date} canViewInterpretations={canViewInterpretations} timeFormat={timeFormat} onHighlightTransit={onHighlightTransit} preloadedTexts={collectivePreloaded} />
            </div>
          )}
          {/* Stations — planets changing direction (exact today or approaching) */}
          {filters.rx && stations?.length > 0 && (
            <div>
              <SectionHeader dotClass="bg-gold-accent/70" label={stations.some(s => s.approaching) ? "Upcoming Stations" : "Stations Today"} />
              <div className="space-y-1">
                {stations.map((s, i) => <StationPill key={i} station={s} />)}
              </div>
            </div>
          )}
          {/* Retrogrades */}
          {filters.rx && rxPlanets.length > 0 && (
            <div>
              <SectionHeader dotClass="bg-celestial-purple/70" label="Currently Retrograde" />
              <div className="space-y-1">
                {rxPlanets.map((tp, i) => <RetrogradePill key={i} tp={tp} stations={stations} />)}
              </div>
            </div>
          )}
          {!mundaneAspects?.length && !rxPlanets.length && !stations?.length && (
            <p className="font-body text-xs text-brass italic text-center py-3">No collective transits today — the sky is calm.</p>
          )}
        </div>
      )}
    </div>
  );
}