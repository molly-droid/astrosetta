import React, { useEffect, useMemo, useState } from 'react';
import { useTransits, processTransits } from './useTransits';
import PlanetTracker from './PlanetTracker';
import PeriodTransitChart from './PeriodTransitChart';
import PeriodHighlights from './PeriodHighlights';
import NavigatorPrompts from './NavigatorPrompts';
import PlannerJournal from './PlannerJournal';
import DaySynthesis from './DaySynthesis';
import { TOPICS } from '@/lib/plannerTopics';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { getMonthLunations, getLunationForDate } from '@/lib/lunationTimes';
import { isSolarReturn } from '@/lib/solarReturn';
import { getMoonPhaseIcon } from '@/lib/moonPhase';
import { ECLIPSE_META } from '@/lib/eclipseUtils';
import { PLANET_GLYPHS, SIGN_GLYPHS } from '@/lib/transitUtils';
import { base44 } from '@/api/base44Client';
import { X, ChevronDown, Loader2, CalendarDays } from 'lucide-react';

const MonthSynthesis = React.lazy(() => import('./MonthSynthesis'));

const PEAK_THRESHOLD = 3;
const ASPECT_SYMBOLS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };

// The shared SIGN_GLYPHS / PLANET_GLYPHS ship with U+FE0E (VS-15, text
// presentation) appended, which forces the glyph to render as a monochrome
// text character — appending VS-16 after it does nothing because the first
// variation selector wins. For the calendar we want the emoji (color)
// presentation, so we strip VS-15 and append VS-16, and swap a couple of
// planets for their well-known emoji equivalents for visibility.
const emojiGlyph = (g) => (g || '').replace(/\uFE0E/g, '') + '\uFE0F';
const CALENDAR_PLANET_EMOJI = { Sun: '☀️', Moon: '🌙' };
const calendarPlanet = (name) => CALENDAR_PLANET_EMOJI[name] || emojiGlyph(PLANET_GLYPHS[name] || '');
const calendarSign = (name) => emojiGlyph(SIGN_GLYPHS[name] || '');

// Match the Day view's text styling: gold body → white highlights, white body → gold highlights
const highlightOnGold = (text) => highlightSynthesisText(text, null, 'text-white');
const highlightOnWhite = (text) => highlightSynthesisText(text, null, 'text-gold-primary');

// Synthesis popover for a tapped day
function DaySynthesisPopover({ date, chart, onClose }) {
  // Lunation badge for the popover header — the EXACT instant in the user's
  // browser timezone (so it matches the calendar dot), with the sign the
  // lunation occurs in.
  const lunation = getLunationForDate(date);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(7,16,30,0.85)', backdropFilter: 'blur(6px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-[88vh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.2)' }}
      >
        {/* Sticky header — always reachable close + the date the user is reading */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold-primary/20 flex-shrink-0 sticky top-0 z-10" style={{ background: '#0f1a2e' }}>
          <div className="flex items-center gap-2">
            <p className="font-body text-xs text-brass uppercase tracking-widest">
              {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            {lunation && (
              <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-accent border border-gold-primary/30 flex items-center gap-1">
                <span style={{ fontVariantEmoji: 'text' }}>{lunation.emoji}</span> {lunation.type === 'new' ? 'New' : 'Full'} Moon {lunation.sign && <span className="emoji-glyph">{calendarSign(lunation.sign)}</span>}
              </span>
            )}
          </div>
          <button onClick={onClose} className="flex items-center gap-1 text-brass/60 hover:text-white transition-colors">
            <span className="font-body text-[10px] uppercase tracking-widest">Close</span>
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

function MonthDayDot({ date, chart, onSelect, sparkleColors = [], tintColor = null, lunation }) {
  const { data } = useTransits(date, chart);
  const isToday = date.toDateString() === new Date().toDateString();
  const isBirthday = isSolarReturn(date, chart);
  // Moon phase + sign — shown top-right on every day except exact lunations,
  // which already display the moon at the bottom of the cell
  const moonIcon = getMoonPhaseIcon(date);
  const moonSign = data?.isEclipse ? (data.eclipseMoonSign || data?.moonSign) : data?.moonSign;
  const natalCount = data?.natalAspects?.length || 0;
  const lunarCount = data?.lunarAspects?.length || 0;
  const isPeak = natalCount >= PEAK_THRESHOLD;
  // Lunations are pinned to the exact instant in the user's timezone, not the
  // noon/midnight snapshot, so an evening new moon lands on the correct date.
  const isNewMoon = lunation?.type === 'new';
  const isFullMoon = lunation?.type === 'full';
  const dotCount = natalCount === 0 ? 0 : natalCount === 1 ? 1 : natalCount === 2 ? 2 : 3;

  const highlightStyle = tintColor && !isToday ? {
    background: `${tintColor}1a`,
    boxShadow: `0 0 0 1px ${tintColor}66`,
  } : {};

  const birthdayStyle = isBirthday ? {
    background: 'rgba(212,175,133,0.15)',
    boxShadow: '0 0 0 1px rgba(212,175,133,0.6)',
  } : {};

  return (
    <button
      onClick={() => onSelect(date)}
      className={`flex flex-col h-16 sm:h-20 w-full px-1 py-0.5 rounded-lg hover:bg-gold-primary/10 transition-colors justify-between overflow-hidden
        ${isToday ? 'bg-gold-primary/10 border border-gold-accent/40' : ''}
        ${isPeak && !isToday && !isBirthday ? 'ring-1 ring-gold-accent/40 bg-gold-primary/5' : ''}
      `}
      style={{ ...highlightStyle, ...birthdayStyle }}
    >
      {/* Top — date number on its own row, sparkles beneath it */}
      <div className="flex flex-col items-start gap-0.5 self-start">
        <div className="flex items-center gap-0.5">
          <span
            className={`font-body text-xs leading-none ${isBirthday ? 'text-gold-primary font-bold' : isToday ? 'text-gold-accent font-bold' : 'text-white/80'}`}
          >
            {date.getDate()}
          </span>
          {isBirthday && <span className="emoji-glyph font-body text-[9px] sm:text-base text-gold-primary leading-none">☀️</span>}
        </div>
        {sparkleColors.length > 0 && (
          <div className="flex flex-wrap items-center gap-0.5 max-w-full">
            {sparkleColors.map((color, i) => (
              <span
                key={i}
                className="font-body text-[9px] sm:text-sm leading-none"
                style={{ color, textShadow: `0 0 5px ${color}` }}
              >✦</span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom — events; ingress/lunation pinned to the bottom of the card */}
      <div className="flex flex-col items-center gap-0 w-full">
        {!isNewMoon && !isFullMoon && moonSign && (
          <span className="flex items-center gap-0.5 leading-none" title={`Moon in ${moonSign}`}>
            <span className="text-[10px] sm:text-base leading-none">{moonIcon}</span>
            <span className="emoji-glyph font-body text-[8px] sm:text-base leading-none text-brass/60">{calendarSign(moonSign)}</span>
          </span>
        )}
        {data?.stations?.length > 0 && (
          <div className="flex flex-wrap gap-x-0.5 gap-y-0.5 justify-center max-w-full">
            {data.stations.map((s, i) => (
              <span
                key={i}
                title={`${s.planet}${s.sign ? ` in ${s.sign}` : ''} stations ${s.type}`}
                className={`flex items-center gap-0 leading-none ${s.type === 'retrograde' ? 'text-gold-accent' : 'text-green-soft'}`}
              >
                <span className="emoji-glyph font-body text-[10px] sm:text-base">{calendarPlanet(s.planet)}</span>
                {s.sign && <span className="emoji-glyph font-body text-[8px] sm:text-base opacity-70">{calendarSign(s.sign)}</span>}
                <span className="font-body text-[10px] sm:text-sm">{s.type === 'retrograde' ? '℞' : '↗'}</span>
              </span>
            ))}
          </div>
        )}
        {!isPeak && dotCount > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: dotCount }).map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-celestial-blue/80" />
            ))}
          </div>
        )}
        {natalCount === 0 && lunarCount > 0 && !isNewMoon && !isFullMoon && (
          <div className="w-1 h-1 rounded-full bg-bronze/60" />
        )}
        {(isNewMoon || isFullMoon) && (
          <span
            className="flex items-center gap-0.5 leading-none"
            title={data?.isEclipse ? ECLIPSE_META[data.eclipseType]?.label : `${isNewMoon ? 'New' : 'Full'} Moon${lunation?.sign ? ` in ${lunation.sign}` : ''}`}
          >
            {data?.isEclipse && <span className="font-body text-[7px] sm:text-[10px] text-gold-accent font-bold uppercase leading-none tracking-wide">ecl</span>}
            <span className="text-[10px] sm:text-xl leading-none" style={data?.isEclipse ? { filter: `drop-shadow(0 0 4px ${isNewMoon ? 'rgba(212,175,133,0.9)' : 'rgba(251,191,36,0.9)'})` } : {}}>{isNewMoon ? '🌑' : '🌕'}</span>
            {lunation?.sign && <span className="emoji-glyph font-body text-[8px] sm:text-base leading-none text-brass/70">{calendarSign(lunation.sign)}</span>}
          </span>
        )}
        {(data?.ingresses || []).some(ing => ing.exact) && (
          <div className="w-full flex flex-col gap-0.5">
            {data.ingresses.filter(ing => ing.exact).map((ing, i) => (
              <span
                key={i}
                title={`${ing.planet} enters ${ing.to_sign}${ing.from_sign ? ` (from ${ing.from_sign})` : ''}`}
                className="font-body text-[8px] sm:text-base leading-none text-celestial-purple flex items-center justify-between w-full px-0.5"
              >
                <span className="emoji-glyph">{calendarPlanet(ing.planet)}</span>
                <span className="opacity-60">→</span>
                <span className="emoji-glyph">{calendarSign(ing.to_sign)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// Topic-specific insight card with inline calendar highlighting
// Cache: chartId-month-topic (per-theme detail) and chartId-month-bulk (highlights map)
const topicCache = {};
const topicBulkCache = {};

// Build the dated transit-event context for a month (sampled every 3 days via
// the ephemeris). Shared by the bulk theme-highlight loader so the ephemeris
// runs once per month, not once per theme.
async function buildMonthTransitContext(date, chart, daysInMonth) {
  const raw = chart.raw_data || {};
  const natalPlanets = (raw.planets || [])
    .map(p => `${p.name} in ${p.sign} (house ${p.house || '?'})`)
    .join(', ');
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthShort = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const month = date.getMonth();

  const sampleDays = [];
  for (let d = 1; d <= daysInMonth; d += 3) sampleDays.push(d);
  if (sampleDays[sampleDays.length - 1] !== daysInMonth) sampleDays.push(daysInMonth);

  let transitContext = 'Transit data unavailable.';
  try {
    const transitResults = await Promise.all(
      sampleDays.map(day =>
        base44.functions.invoke('chartCalculator', {
          chart_type: 'transit',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time,
          birth_location: raw.birth_location,
          transit_date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          transit_time: '12:00:00',
          natal_planets_override: raw.planets || [],
        })
      )
    );
    const natalMap = new Map();
    const mundaneMap = new Map();
    const lunations = [];
    sampleDays.forEach((day, i) => {
      const processed = processTransits(transitResults[i].data, raw);
      if (!processed) return;
      processed.natalAspects.forEach(a => {
        const key = `${a.transit_planet}|${a.aspect}|${a.natal_planet}`;
        if (!natalMap.has(key) || a.orb < natalMap.get(key).orb) natalMap.set(key, { day, orb: a.orb, ...a });
      });
      processed.mundaneAspects.forEach(a => {
        const key = `${a.transit_planet}|${a.aspect}|${a.natal_planet}`;
        if (!mundaneMap.has(key) || a.orb < mundaneMap.get(key).orb) mundaneMap.set(key, { day, orb: a.orb, ...a });
      });
      if (processed.isExactNewMoon) lunations.push(`${processed.isEclipse ? 'Solar Eclipse' : 'New Moon'} in ${processed.moonSign} ~${monthShort} ${day}`);
      if (processed.isExactFullMoon) lunations.push(`${processed.isEclipse ? 'Lunar Eclipse' : 'Full Moon'} in ${processed.moonSign} ~${monthShort} ${day}`);
    });
    const natalEvents = Array.from(natalMap.values()).map(e => ({ description: `${e.transit_planet} ${ASPECT_SYMBOLS[e.aspect] || e.aspect} natal ${e.natal_planet}`, date: `${monthShort} ${e.day}`, type: 'natal' }));
    const mundaneEvents = Array.from(mundaneMap.values()).map(e => ({ description: `${e.transit_planet} ${ASPECT_SYMBOLS[e.aspect] || e.aspect} ${e.natal_planet}`, date: `${monthShort} ${e.day}`, type: 'mundane' }));
    const lunationEvents = lunations.map(l => ({ description: l.split(' ~')[0], date: l.split('~')[1]?.trim() || '', type: 'mundane' }));
    const allTransitEvents = [...natalEvents, ...mundaneEvents, ...lunationEvents];
    const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);
    const planets1 = transitResults[0]?.data?.transit_planets || [];
    const slowPositions = planets1.filter(p => SLOW.has(p.name)).map(p => `${p.name} in ${p.sign}${p.retrograde ? ' Rx' : ''}`).join(', ');
    transitContext = `ACTUAL DATED TRANSIT EVENTS (computed via ephemeris, sampled every 3 days — dates approximate within ±2 days):

Slow planet positions (month start): ${slowPositions}

ALL TRANSIT EVENTS (already classified — copy the "type" field verbatim, do NOT reclassify):
${JSON.stringify(allTransitEvents, null, 2)}`;
  } catch (_) { /* fallback — LLM will note data is unavailable */ }
  return { transitContext, monthName, natalPlanets };
}

function CalendarAndThemes({ date, chart }) {
  const [open, setOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState(null);
  const [topicResult, setTopicResult] = useState(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [allTopicHighlights, setAllTopicHighlights] = useState(null);
  const [popoverDate, setPopoverDate] = useState(null);

  const year = date.getFullYear();
  const month = date.getMonth();
  // Exact new/full-moon times for the month, attributed to the user's browser
  // timezone (Meeus) — fixes lunations landing on the wrong calendar date.
  const lunationByDate = useMemo(() => getMonthLunations(year, month), [year, month]);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weeks = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month, firstDay, daysInMonth]);

  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Reset theme highlights when the month changes so we re-fetch for the new month.
  useEffect(() => {
    setAllTopicHighlights(null);
    setActiveTopic(null);
    setTopicResult(null);
  }, [year, month]);

  // Pre-load ALL themes' key dates in a single LLM pass so every relevant date
  // shows its theme-colored sparkles before the user picks a theme.
  useEffect(() => {
    if (!open || !chart || allTopicHighlights) return;
    const monthKey = `${year}-${month}`;
    const bulkKey = `${chart.id}-${monthKey}-bulk`;
    let cancelled = false;
    (async () => {
      if (topicBulkCache[bulkKey]) {
        setAllTopicHighlights(topicBulkCache[bulkKey]);
        return;
      }
      setTopicLoading(true);
      try {
        const { transitContext, monthName, natalPlanets } = await buildMonthTransitContext(date, chart, daysInMonth);
        const raw = chart.raw_data || {};
        const topicList = TOPICS.map(t => `${t.key} = ${t.fullLabel}`).join('\n');
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a professional astrologer. For ${monthName}, generate a focused monthly outlook for EACH of these life themes:\n${topicList}\n\nNATAL CHART:\nSun: ${raw.sun_sign}, Moon: ${raw.moon_sign}, Rising: ${raw.ascendant_sign}\nPlanets: ${natalPlanets || 'not provided'}\n\n${transitContext}\n\nIMPORTANT: Use ONLY the actual transit positions and dates above. Do not hallucinate planet signs. Use precise aspect terms (trine, square, sextile, conjunction, opposition); never use "alignment" as a synonym for conjunction.\n\nReturn JSON with a "topics" array — one entry per theme in the list above. Each entry must include: topic_key, overview (2-3 sentences referencing specific transit dates), best_windows (short note on 2-3 date ranges), key_transits (2-3 most relevant transits copied VERBATIM from the ALL TRANSIT EVENTS list with description/date/type fields), and highlight_days (4-8 day numbers 1-${daysInMonth} that are especially powerful for this theme based on the dated transit events and lunations).`,
          response_json_schema: {
            type: 'object',
            properties: {
              topics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic_key: { type: 'string', enum: TOPICS.map(t => t.key) },
                    overview: { type: 'string' },
                    best_windows: { type: 'string' },
                    key_transits: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          description: { type: 'string' },
                          date: { type: 'string' },
                          type: { type: 'string', enum: ['natal', 'mundane'] },
                        },
                        required: ['description', 'date', 'type'],
                      },
                    },
                    highlight_days: { type: 'array', items: { type: 'integer' } },
                  },
                  required: ['topic_key', 'overview', 'best_windows', 'key_transits', 'highlight_days'],
                },
              },
            },
            required: ['topics'],
          },
        });
        if (cancelled) return;
        const highlights = {};
        (res.topics || []).forEach(t => {
          highlights[t.topic_key] = new Set(t.highlight_days || []);
          topicCache[`${chart.id}-${monthKey}-${t.topic_key}`] = t;
        });
        topicBulkCache[bulkKey] = highlights;
        setAllTopicHighlights(highlights);
      } catch (_) { /* non-critical */ }
      finally { if (!cancelled) setTopicLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, chart, year, month, allTopicHighlights, daysInMonth, date]);

  // Populate the detail card once the bulk load lands if a theme is already selected.
  useEffect(() => {
    if (allTopicHighlights && activeTopic && chart) {
      const cacheKey = `${chart.id}-${year}-${month}-${activeTopic}`;
      if (topicCache[cacheKey]) setTopicResult(topicCache[cacheKey]);
    }
  }, [allTopicHighlights, activeTopic, chart, year, month]);

  const selectTopic = (topicKey) => {
    if (activeTopic === topicKey) {
      setActiveTopic(null);
      setTopicResult(null);
      return;
    }
    setActiveTopic(topicKey);
    const cacheKey = `${chart?.id}-${year}-${month}-${topicKey}`;
    setTopicResult(topicCache[cacheKey] || null);
  };

  const topic = TOPICS.find(t => t.key === activeTopic);

  return (
    <div className="celestial-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-gold-accent flex-shrink-0" />
          <span className="font-display text-sm font-semibold text-white">Calendar & Themes</span>
        </div>
        <ChevronDown size={13} className={`text-brass/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gold-primary/20 px-3 pb-4 pt-3 space-y-4">
          {/* Topic pills */}
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map(t => (
              <button
                key={t.key}
                onClick={() => selectTopic(t.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-body text-xs transition-all border ${
                  activeTopic === t.key
                    ? `${t.bg} ${t.color} ${t.border} font-semibold`
                    : `bg-transparent ${t.color} ${t.border}`
                }`}
              >
                <span style={{ fontVariantEmoji: 'emoji' }}>{t.glyph}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Topic explanation */}
          {(topicLoading || topicResult) && topic && (
            <div className={`rounded-xl border p-3 space-y-2 ${topic.bg} ${topic.border}`}>
              {topicLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={13} className="animate-spin text-gold-primary" />
                  <p className="font-body text-xs text-white/50 italic">Reading the stars…</p>
                </div>
              ) : topicResult && (
                <>
                  <p className={`font-body text-[10px] uppercase tracking-widest font-semibold ${topic.color}`}>
                    <span style={{ fontVariantEmoji: 'emoji' }}>{topic.glyph}</span> {topic.fullLabel}
                  </p>
                  <p className="font-body text-xs text-white/90 leading-relaxed">{highlightOnWhite(topicResult.overview)}</p>
                  {topicResult.key_transits?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {topicResult.key_transits.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`font-body text-[9px] px-1.5 py-0.5 rounded-full ${t.type === 'natal' ? 'bg-celestial-blue/15 text-celestial-blue' : 'bg-celestial-purple/15 text-celestial-purple'}`}>
                            {t.type}
                          </span>
                          <span className="font-body text-[11px] text-white/70">{highlightOnWhite(t.description)}</span>
                          <span className="font-body text-[10px] text-brass/60 ml-auto">~{t.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {topicResult.best_windows && (
                    <p className={`font-body text-[11px] ${topic.color} italic`}>⟡ {topicResult.best_windows}</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calendar */}
          <div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DOW.map(d => (
                <div key={d} className="text-center font-body text-[10px] text-brass/50 uppercase py-1">{d}</div>
              ))}
            </div>
            <div className="space-y-0">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
                  {week.map((d, i) =>
                    d ? (
                      (() => {
                        const dayNum = d.getDate();
                        const relevant = allTopicHighlights
                          ? TOPICS.filter(t => allTopicHighlights[t.key]?.has(dayNum))
                          : [];
                        const filtered = activeTopic ? relevant.filter(t => t.key === activeTopic) : relevant;
                        const tint = activeTopic && topic?.hex && allTopicHighlights?.[activeTopic]?.has(dayNum)
                          ? topic.hex : null;
                        return (
                          <MonthDayDot
                            key={i}
                            date={d}
                            chart={chart}
                            onSelect={setPopoverDate}
                            sparkleColors={filtered.map(t => t.hex)}
                            tintColor={tint}
                            lunation={lunationByDate[d.toLocaleDateString('en-CA')]}
                          />
                        );
                      })()
                    ) : (
                      <div key={i} />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm ring-1 ring-gold-accent/50 bg-gold-primary/10"/><span className="font-body text-[9px] text-brass/50">peak (3+ transits)</span></div>
            <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-celestial-blue/80"/><span className="font-body text-[9px] text-brass/50">natal transits</span></div>
            <div className="flex items-center gap-1"><span className="emoji-glyph text-[10px]" style={{ fontVariantEmoji: 'emoji' }}>🌑♍️</span><span className="font-body text-[9px] text-brass/50">new/full moon + sign</span></div>
            <div className="flex items-center gap-1"><span className="font-body text-[9px] text-gold-accent">℞</span><span className="font-body text-[9px] text-brass/50">station retrograde</span></div>
            <div className="flex items-center gap-1"><span className="font-body text-[9px] text-green-soft">↗</span><span className="font-body text-[9px] text-brass/50">station direct</span></div>
            <div className="flex items-center gap-1"><span className="emoji-glyph font-body text-[9px] text-celestial-purple" style={{ fontVariantEmoji: 'emoji' }}>☿→♋️</span><span className="font-body text-[9px] text-brass/50">planet ingresses</span></div>
            <div className="flex items-center gap-1">
              {activeTopic
                ? <span className="font-body text-[9px]" style={{ color: topic.hex }}>✦</span>
                : <span className="flex items-center gap-0.5">{TOPICS.slice(0, 4).map(t => <span key={t.key} className="font-body text-[9px]" style={{ color: t.hex }}>✦</span>)}</span>}
              <span className="font-body text-[9px] text-brass/50">{activeTopic ? `${topic.label} key date` : 'theme key dates'}</span>
            </div>
          </div>
        </div>
      )}

      {popoverDate && (
        <DaySynthesisPopover
          date={popoverDate}
          chart={chart}
          onClose={() => setPopoverDate(null)}
        />
      )}
    </div>
  );
}

// Collapsible Planet Positions wrapper
function CollapsiblePlanetTracker({ dates, chart }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="celestial-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-body text-[14px] text-gold-accent" style={{ fontVariantEmoji: 'text' }}>☿</span>
          <span className="font-display text-sm font-semibold text-white">Planet Positions</span>
        </div>
        <ChevronDown size={13} className={`text-brass/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-gold-primary/20">
          <PlanetTracker dates={dates} chart={chart} />
        </div>
      )}
    </div>
  );
}

export default function PlannerMonthView({ date, chart, user, relationshipSelector }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [dayTab, setDayTab] = useState('today');

  const monthDays = useMemo(() =>
    Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    [year, month, daysInMonth]
  );

  const monthStart = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];
  const monthJournalKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      <PeriodTransitChart startDate={monthStart} endDate={monthEnd} chart={chart} periodLabel="this month" />

      {relationshipSelector && (
        <div className="flex justify-center">{relationshipSelector}</div>
      )}

      <div className="flex border-b border-white/[0.08]">
        {[
          { key: 'today', label: 'This Month' },
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
          <React.Suspense fallback={<div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-gold-primary" size={20} /></div>}>
            <MonthSynthesis date={date} chart={chart} />
          </React.Suspense>
          <CalendarAndThemes date={date} chart={chart} />
          <PlannerJournal dateKey={monthJournalKey} userId={user?.id} synthesis={null} periodLabel="This month" />
          <NavigatorPrompts period="month" date={date} />
        </div>
      )}

      {dayTab === 'transits' && (
        <div className="space-y-3">
          <PeriodHighlights dates={monthDays} chart={chart} />
          <CollapsiblePlanetTracker dates={monthDays} chart={chart} />
        </div>
      )}
    </div>
  );
}