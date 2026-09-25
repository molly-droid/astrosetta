import React, { useState, useRef, useEffect } from 'react';
import { useTransits } from './useTransits';
import { Loader2, X, Sparkles, RefreshCw, Download, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import DaySynthesis from './DaySynthesis';
import PlanetTracker from './PlanetTracker';
import PeriodTransitChart from './PeriodTransitChart';
import PeriodHighlights from './PeriodHighlights';
import NavigatorPrompts from './NavigatorPrompts';
import PlannerJournal from './PlannerJournal';
import DaySynthesisPopover from './DaySynthesisPopover';
import { PLANET_GLYPHS, ASPECT_GLYPHS, isApplying, highlightSynthesisText, formatTransitLabel } from '@/lib/transitUtils';
import { base44 } from '@/api/base44Client';
import { invokeLLMTask } from '@/api/llmTasks';
import { getMoonPhaseIcon } from '@/lib/moonPhase';
import { ECLIPSE_META } from '@/lib/eclipseUtils';
import { isSolarReturn } from '@/lib/solarReturn';
import { downloadWeekSynthesisICS } from '@/lib/synthesisICS';
import SynthesisCategoryCard from './SynthesisCategoryCard';
import { TOPICS } from '@/lib/plannerTopics';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TOPIC_BY_KEY = Object.fromEntries(TOPICS.map(t => [t.key, t]));

// White body text with gold glossary/highlighted terms
const highlightOnWhite = (text) => highlightSynthesisText(text, null, 'text-gold-primary');

// Map natal planets being aspected to life-theme tags
const NATAL_PLANET_THEMES = {
  Sun: 'Vitality',
  Moon: 'Emotions',
  Mercury: 'Mind',
  Venus: 'Love',
  Mars: 'Drive',
  Jupiter: 'Expansion',
  Saturn: 'Structure',
  Uranus: 'Freedom',
  Neptune: 'Dreams',
  Pluto: 'Power',
  Chiron: 'Healing',
  'North Node': 'Direction',
};

const weekSynthesisCache = {};

// Single transit glyph row
function TransitRow({ a, transitPlanets, natalPlanets }) {
  const tP = transitPlanets?.find(p => p.name === a.transit_planet);
  const nP = natalPlanets?.find(p => p.name === a.natal_planet);
  const applying = isApplying(tP?.longitude ?? null, nP?.longitude ?? null, a.aspect, tP?.retrograde ?? false);
  return (
    <span
      title={applying ? 'Applying — energy building' : 'Separating — energy fading'}
      className="font-body text-[11px] text-celestial-blue/90 tracking-wider leading-snug whitespace-nowrap flex items-center gap-0.5"
    >
      {PLANET_GLYPHS[a.transit_planet] || ''}{ASPECT_GLYPHS[a.aspect] || ''}{PLANET_GLYPHS[a.natal_planet] || ''}
      <span
        className="inline-block w-1 h-1 rounded-full ml-0.5 shrink-0"
        style={{ background: applying ? 'rgba(201,169,97,0.8)' : 'rgba(255,255,255,0.2)' }}
      />
    </span>
  );
}

// Compact day card for the week day-by-day grid. DOW pill + date number on
// the left, body text to their right. Moon phase + sign shown once in the
// corner; the day's stations and ingresses are listed in gold. Per-theme
// colored tags. Whole card opens the daily reading.
function WeekDayCard({ date, chart, daySentence, dayTopics = [], synthLoading, onOpenDay }) {
  const { data, loading } = useTransits(date, chart);
  const isToday = date.toDateString() === new Date().toDateString();
  const isBirthday = isSolarReturn(date, chart);
  const moonEmoji = getMoonPhaseIcon(date);
  const isNewMoon = moonEmoji === '🌑';
  const displayMoonSign = data?.isEclipse ? (data.eclipseMoonSign || data?.moonSign) : data?.moonSign;

  const topics = (dayTopics || [])
    .filter(k => TOPIC_BY_KEY[k])
    .map(k => TOPIC_BY_KEY[k]);

  // Major transit events for the day — stations and ingresses, listed in gold
  const majorEvents = [
    ...(data?.stations || []).map(s => ({
      key: `st-${s.planet}-${s.type}`,
      label: `${PLANET_GLYPHS[s.planet] || '✦'} ${s.planet} ${s.type === 'retrograde' ? '℞' : '↗'} ${s.sign}`,
    })),
    ...(data?.ingresses || []).map(ing => ({
      key: `in-${ing.planet}-${ing.to_sign}`,
      label: `${PLANET_GLYPHS[ing.planet] || '✦'} ${ing.planet} → ${ing.to_sign}`,
    })),
  ];

  return (
    <button
      onClick={() => onOpenDay?.(date)}
      className={`flex flex-col h-full p-2.5 rounded-lg border text-left transition-colors ${
        isToday ? 'bg-gold-accent/10 border-gold-accent/40' : 'border-gold-primary/15 hover:bg-gold-primary/5'
      } ${isBirthday ? 'ring-1 ring-gold-primary/40' : ''}`}
    >
      {/* Moon phase + sign — the single moon representation, top right */}
      <div className="flex items-center justify-end gap-1 w-full">
        {data?.isEclipse && <span className="font-body text-[7px] text-gold-accent font-bold uppercase leading-none tracking-wide">ecl</span>}
        {isBirthday && <span className="emoji-glyph font-body text-[10px] text-gold-primary leading-none">☀️</span>}
        {moonEmoji && (
          <span
            className="text-sm leading-none"
            style={(isNewMoon || data?.isEclipse) ? { filter: 'drop-shadow(0 0 5px rgba(212,175,133,0.9))' } : {}}
            title={data?.isEclipse ? ECLIPSE_META[data.eclipseType]?.label : ''}
          >
            {moonEmoji}
          </span>
        )}
        {displayMoonSign && (
          <span className="font-body text-[9px] text-brass/60 leading-none">{displayMoonSign}</span>
        )}
      </div>

      {/* DOW pill + date number on the left, body text to their right */}
      <div className="flex gap-2.5 mt-1 items-start flex-1 w-full">
        <div className="flex flex-col items-start gap-1 shrink-0">
          <span className={`font-body text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
            isToday ? 'bg-gold-accent/20 text-gold-accent font-semibold' : 'bg-gold-primary/10 text-brass'
          }`}>
            {DOW_SHORT[date.getDay()]}
          </span>
          <p className={`font-display text-2xl font-bold leading-none ${isBirthday ? 'text-gold-primary' : isToday ? 'text-gold-accent' : 'text-white/90'}`}>
            {date.getDate()}
          </p>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-body text-[13px] text-white/90 leading-snug">
            {synthLoading && !daySentence ? 'Reading the week...' : daySentence ? highlightOnWhite(daySentence) : 'quiet day'}
          </p>
          {majorEvents.length > 0 && (
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
              {majorEvents.map(ev => (
                <span key={ev.key} className="font-body text-[10px] text-gold-accent whitespace-nowrap">
                  {ev.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Theme tags — colored per theme, matching the month view pills */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {topics.map(t => (
            <span key={t.key} className={`font-body text-[9px] px-1.5 py-0.5 rounded-full border ${t.bg} ${t.color} ${t.border}`}>
              <span style={{ fontVariantEmoji: 'emoji' }}>{t.glyph}</span> {t.label}
            </span>
          ))}
        </div>
      )}

      <span className="font-body text-[9px] text-gold-accent mt-2 flex items-center gap-0.5">
        Daily reading <ChevronRight size={10} />
      </span>
    </button>
  );
}

export default function PlannerWeekView({ date, chart, user, relationshipSelector }) {
  const [dayTab, setDayTab] = useState('today');
  const [dayListOpen, setDayListOpen] = useState(false);
  const [popoverDate, setPopoverDate] = useState(null);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const [planetsOpen, setPlanetsOpen] = useState(false);


  // Week synthesis
  const [synthesis, setSynthesis] = useState(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthExpanded, setSynthExpanded] = useState(false);
  const [synthTab, setSynthTab] = useState('personal');
  const hasGenerated = useRef(false);
  const weekKey = days[0]?.toISOString?.()?.split('T')[0];
  const cacheKey = chart?.id && weekKey ? `v6_${chart.id}_${weekKey}` : null;

  useEffect(() => {
    if (cacheKey && weekSynthesisCache[cacheKey]) {
      setSynthesis(weekSynthesisCache[cacheKey]);
      hasGenerated.current = true;
      return;
    }
    hasGenerated.current = false;
    setSynthesis(null);
  }, [weekKey]);

  useEffect(() => {
    if (!chart || !days?.length || hasGenerated.current || synthLoading) return;
    if (!synthExpanded && !dayListOpen) return; // Generate when either the Glance or Day-by-Day card is expanded
    hasGenerated.current = true;
    generateWeekSynthesis();
  }, [chart, weekKey, synthExpanded, dayListOpen]);

  const generateWeekSynthesis = async () => {
    if (!chart || !days?.length) return;
    setSynthLoading(true);
    const raw = chart.raw_data || {};
    const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);

    const results = await Promise.all(
      days.map(d =>
        base44.functions.invoke('chartCalculator', {
          chart_type: 'transit',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time,
          birth_location: raw.birth_location,
          transit_date: d.toISOString().split('T')[0],
          transit_time: '12:00:00',
        }).then(r => r.data).catch(() => null)
      )
    );

    const dayContexts = days.map((d, i) => {
      const res = results[i];
      if (!res) return `${DOW_SHORT[d.getDay()]}: no data`;
      const moon = res.transit_planets?.find(p => p.name === 'Moon');
      const natalPls = raw.planets || [];
      const tPls = res.transit_planets || [];
      const fmtAspects = (res.transit_aspects || [])
        .filter(a => SLOW.has(a.transit_planet) && a.orb <= 2.5)
        .map(a => formatTransitLabel(a, tPls, natalPls, false));
      const moonInfo = moon ? `Moon in ${moon.sign} at ${moon.degree?.toFixed(1)}°` : '';
      const fmtStations = (res.stations || []).map(s =>
        `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`);
      const fmtIngresses = (res.ingresses || []).map(ing =>
        `${ing.planet} enters ${ing.to_sign} (leaving ${ing.from_sign})`);
      return `${DOW_SHORT[d.getDay()]} ${d.getDate()}: ${moonInfo}. ${fmtAspects.join(', ') || 'no major aspects'}${fmtStations.length ? '. STATION: ' + fmtStations.join(', ') : ''}${fmtIngresses.length ? '. INGRESS: ' + fmtIngresses.join(', ') : ''}`;
    });

    const weekRange = `${days[0].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}`;

    const result = await invokeLLMTask('planner-week-synthesis', {
      weekRange,
      sunSign: raw.sun_sign,
      natalMoonSign: raw.moon_sign,
      ascSign: raw.ascendant_sign,
      dailyTransits: dayContexts.join('\n'),
    });

    if (cacheKey) weekSynthesisCache[cacheKey] = result;
    setSynthesis(result);
    setSynthLoading(false);
  };

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const weekJournalKey = new Date(start.getFullYear(), start.getMonth(), start.getDate()).toLocaleDateString('en-CA');

  return (
    <div className="space-y-3">
      <PeriodTransitChart startDate={days[0]} endDate={days[6]} chart={chart} periodLabel="this week" />

      {relationshipSelector && (
        <div className="flex justify-center">{relationshipSelector}</div>
      )}

      <div className="flex border-b border-white/[0.08]">
        {[
          { key: 'today', label: 'This Week' },
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
      {/* Week overview card — collapsible, with Personal/Collective tabs */}
      <div className="celestial-card overflow-hidden">
        <button
          onClick={() => setSynthExpanded(o => !o)}
          className="w-full text-left px-4 pt-3 pb-2 hover:bg-gold-primary/5 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-gold-accent flex-shrink-0" />
              <span className="font-display text-sm font-semibold text-white">Week at a Glance</span>
              <span className="font-body text-[10px] text-brass/40">{weekLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {synthLoading && <Loader2 size={13} className="animate-spin text-gold-primary/60" />}
              {synthesis && <ChevronDown size={13} className={`text-brass/50 transition-transform ${synthExpanded ? 'rotate-180' : ''}`} />}
            </div>
          </div>
          {synthesis && (() => {
            const tags = synthTab === 'personal'
              ? (synthesis.best_areas || [])
              : (synthesis.collective_tags || []);
            return tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                {tags.map((a, i) => (
                  <span key={i} className="font-body text-[10px] px-1.5 py-0.5 rounded-full bg-gold-primary/15 text-brass">{a}</span>
                ))}
              </div>
            ) : null;
          })()}
        </button>
        {synthExpanded && synthesis && (
          <div className="border-t border-gold-primary/20">
            {/* Personal / Collective tabs */}
            <div className="flex border-b border-white/[0.06]">
              {[
                { key: 'personal', label: 'Personal' },
                { key: 'collective', label: 'Collective' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setSynthTab(t.key)}
                  className={`flex-1 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                    synthTab === t.key
                      ? 'border-gold-accent text-white font-semibold'
                      : 'border-transparent text-white/35 hover:text-white/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-4 pb-4 pt-3 space-y-3">
              {synthTab === 'personal' && (
                <>
                  <p className="font-body text-sm text-white/90 leading-relaxed">{highlightOnWhite(synthesis.overview)}</p>
                  {synthesis.personal_focus && (
                    <p className="font-body text-xs text-white/80 leading-relaxed border-l-2 border-celestial-blue/50 pl-3 italic">
                      {highlightOnWhite(synthesis.personal_focus)}
                    </p>
                  )}
                  {synthesis.best_areas?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {synthesis.best_areas.map((a, i) => (
                        <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full bg-gold-primary/15 border border-gold-primary/30 text-brass">{a}</span>
                      ))}
                    </div>
                  )}
                  {['maximize', 'focus', 'watch'].map(cat => (
                    <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
                  ))}
                </>
              )}
              {synthTab === 'collective' && (
                <>
                  {synthesis.collective_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {synthesis.collective_tags.map((tag, i) => (
                        <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full bg-celestial-blue/15 border border-celestial-blue/30 text-celestial-blue">{tag}</span>
                      ))}
                    </div>
                  )}
                  {synthesis.collective_theme && (
                    <p className="font-body text-sm text-white/85 leading-relaxed">
                      {highlightOnWhite(synthesis.collective_theme)}
                    </p>
                  )}
                </>
              )}

              <div className="flex items-center gap-3 pt-1 border-t border-gold-primary/15">
                <button
                  onClick={() => { if (cacheKey) delete weekSynthesisCache[cacheKey]; hasGenerated.current = false; generateWeekSynthesis(); }}
                  className="flex items-center gap-1 font-body text-[10px] text-brass/40 hover:text-brass transition-colors"
                >
                  <RefreshCw size={10} /> Regenerate
                </button>
                <button onClick={() => downloadWeekSynthesisICS(days, synthesis)}
                  className="flex items-center gap-1 font-body text-[10px] text-brass/40 hover:text-gold-accent transition-colors">
                  <Download size={10} /> Add to Calendar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day-by-day — single collapsible card, each day a clickable section */}
      <div className="celestial-card overflow-hidden">
        <button
          onClick={() => setDayListOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-gold-accent" />
            <span className="font-display text-sm font-semibold text-white">This Week Day-by-Day</span>
            <span className="font-body text-[10px] text-brass/40">{weekLabel}</span>
          </div>
          <ChevronDown size={14} className={`text-brass/50 transition-transform ${dayListOpen ? 'rotate-180' : ''}`} />
        </button>
        {dayListOpen && (
          <div className="border-t border-gold-primary/20 p-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-1.5">
              {days.map((d, i) => (
                <WeekDayCard
                  key={i}
                  date={d}
                  chart={chart}
                  daySentence={synthesis?.day_sentences?.[String(i)]}
                  dayTopics={synthesis?.day_topics?.[String(i)]}
                  synthLoading={synthLoading}
                  onOpenDay={setPopoverDate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

          <PlannerJournal dateKey={weekJournalKey} userId={user?.id} synthesis={synthesis} periodLabel="This week" />
          <NavigatorPrompts period="week" date={date} />
        </div>
      )}

      {dayTab === 'transits' && (
        <div className="space-y-3">
          <PeriodHighlights dates={days} chart={chart} />

          {/* Planet Tracker — collapsible */}
          <div className="celestial-card overflow-hidden">
            <button
              onClick={() => setPlanetsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-body text-[14px] text-gold-accent" style={{ fontVariantEmoji: 'text' }}>☿</span>
                <span className="font-display text-sm font-semibold text-white">Planet Positions</span>
                <span className="font-body text-[10px] text-brass/40">{weekLabel}</span>
              </div>
              <ChevronDown size={13} className={`text-brass/50 transition-transform ${planetsOpen ? 'rotate-180' : ''}`} />
            </button>
            {planetsOpen && (
              <div className="border-t border-gold-primary/20 pb-3">
                <PlanetTracker dates={days} chart={chart} />
              </div>
            )}
          </div>
        </div>
      )}

      {popoverDate && (
        <DaySynthesisPopover date={popoverDate} chart={chart} onClose={() => setPopoverDate(null)} />
      )}
    </div>
  );
}