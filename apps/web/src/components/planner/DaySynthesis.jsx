import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, ChevronDown, ChevronRight, RefreshCw, ThumbsUp, ThumbsDown, Bookmark, Globe, Layers, Lightbulb, Share2 } from 'lucide-react';
import { invokeLLMTask } from '@/api/llmTasks';
import { formatTransitLabelProse as formatTransitLabel, highlightSynthesisText, getChartRuler, PLANET_GLYPHS, mergeNatalPoints } from '@/lib/transitUtils';
import { getMoonPhaseName, getMoonPhaseEmoji } from '@/lib/moonPhase';
import { detectEclipse, ECLIPSE_META } from '@/lib/eclipseUtils';
import { getCachedSynthesis, saveCachedSynthesis, clearMemCache } from '@/lib/synthesisCache';
import { findNatalHouseForSign } from '@/lib/houseUtils';
import { analyzeChartDynamics, getActivatedDynamics } from '@/lib/chartDynamics';
import { analyzeChartDignities, getNotableTransitDignities } from '@/lib/essentialDignities';
import { getMundanePatterns } from '@/lib/mundanePatterns';
import { getEffectiveTier } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { fetchExplanation } from '@/lib/explainIt';
import ShareSheet from '@/components/share/ShareSheet';
import { buildRisingSignCardData, formatCollectiveContext } from '@/lib/shareCard';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import SynthesisCategoryCard from '@/components/planner/SynthesisCategoryCard';
import GatedFeature from '@/components/paywall/GatedFeature';

// Module-level cache: `${chartId}_${dateKey}` → synthesis result
const synthesisCache = {};

export default function DaySynthesis({ date, chart, transits, onSynthesis, userId, user, autoExpand = false, defaultTab = 'personal', onHighlightTransit }) {
  const { user: authUser } = useAuth();
  const tier = getEffectiveTier(user || authUser);
  const isPaid = tier !== 'free';
  const { knowledgeDepth } = useUserPrefs();
  const [synthesis, setSynthesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(autoExpand);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [rating, setRating] = useState(null); // 'thumbs_up' | 'thumbs_down' | null
  const [bookmarked, setBookmarked] = useState(false);
  const [ratingRecord, setRatingRecord] = useState(null);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const hasGenerated = useRef(false);
  const prevDepthRef = useRef(knowledgeDepth);
  const dateKey = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA') : null;
  const cacheKey = chart?.id && dateKey ? `v20_${chart.id}_${dateKey}_${knowledgeDepth}` : null;
  const dbKey = dateKey ? `day-v20-${dateKey}-${knowledgeDepth}` : null;
  // Opposite-color highlighting: gold body copy → white highlights; white body copy → gold highlights
  const highlightOnGold = (text) => highlightSynthesisText(text, onHighlightTransit, 'text-white');
  const highlightOnWhite = (text) => highlightSynthesisText(text, onHighlightTransit, 'text-gold-primary');

  // Load existing rating for this date
  useEffect(() => {
    if (!userId || !dateKey) return;
    base44.entities.SynthesisRating.filter({ user_id: userId, date_key: dateKey }).then(records => {
      if (records[0]) {
        setRatingRecord(records[0]);
        setRating(records[0].rating || null);
        setBookmarked(records[0].bookmarked || false);
      } else {
        setRatingRecord(null);
        setRating(null);
        setBookmarked(false);
      }
    });
  }, [dateKey, userId]);

  // Reset "Explain it" panel when the day or density changes
  useEffect(() => {
    setExplainOpen(false);
    setExplainText(null);
    setExplainLoading(false);
  }, [dateKey, knowledgeDepth]);

  useEffect(() => {
    if (!dateKey) return;
    const depthChanged = prevDepthRef.current !== knowledgeDepth;
    prevDepthRef.current = knowledgeDepth;
    setCacheChecked(false);

    // Check memory cache first — instant
    if (cacheKey && synthesisCache[cacheKey]) {
      const cached = synthesisCache[cacheKey];
      setSynthesis(cached);
      onSynthesis?.(cached);
      hasGenerated.current = true;
      setCacheChecked(true);
      if (autoExpand) setExpanded(true);
      return;
    }

    // No stale-while-revalidate: if there's no fresh cache for today, show a
    // loading state rather than rendering a previous day's reading.
    if (chart?.user_id) {
      (async () => {
        const cached = await getCachedSynthesis('day', dbKey, chart.user_id);
        if (cached) {
          // Fresh cache (same day + depth) — render immediately, no regen
          if (cacheKey) synthesisCache[cacheKey] = cached;
          setSynthesis(cached);
          onSynthesis?.(cached);
          hasGenerated.current = true;
          setCacheChecked(true);
          if (autoExpand) setExpanded(true);
          return;
        }
        // No fresh cache for today — clear stale content so a loading state
        // shows while today's reading generates.
        hasGenerated.current = false;
        setSynthesis(null);
        onSynthesis?.(null);
        if (!autoExpand) setExpanded(false);
        setCacheChecked(true);
      })();
      return;
    }

    // No user_id — reset
    hasGenerated.current = false;
    setSynthesis(null);
    setCacheChecked(true);
    if (!autoExpand) setExpanded(false);
    onSynthesis?.(null);
  }, [dateKey, chart?.user_id, knowledgeDepth]);

  useEffect(() => {
    if (!cacheChecked) return; // Wait for DB cache check to complete before generating
    if (hasGenerated.current || loading) return;
    if (!expanded) return; // Only generate when user expands the card
    if (transits) {
      hasGenerated.current = true;
      generate(transits);
    } else if (chart && date) {
      hasGenerated.current = true;
      fetchTransitsAndGenerate();
    }
  }, [transits, dateKey, expanded, cacheChecked, knowledgeDepth]);

  const fetchTransitsAndGenerate = async () => {
    setLoading(true);
    if (autoExpand) setExpanded(true);
    const raw = chart?.raw_data || {};
    const dateStr = date.toLocaleDateString('en-CA');
    const utcOffset = date ? -date.getTimezoneOffset() / 60 : 0;
    const res = await base44.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time,
      birth_location: raw.birth_location,
      transit_date: dateStr,
      transit_time: '12:00:00',
      utc_offset: utcOffset,
      natal_planets_override: raw.planets || [],
      house_system: raw.house_system || 'whole_sign',
    }).then(r => r.data).catch(() => null);
    if (!res) { setLoading(false); return; }

    // Build a minimal transits-like object from the chartCalculator response
    const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);
    const ANGLE_NODE_POINTS = new Set(['Ascendant', 'Midheaven', 'Descendant', 'IC', 'North Node', 'South Node']);
    const LOT_POINTS = new Set(['Part of Fortune', 'Tyche', 'Juno', 'Pallas', 'Vesta']);
    const moon = res.transit_planets?.find(p => p.name === 'Moon');
    const sun = res.transit_planets?.find(p => p.name === 'Sun');
    let moonPhase = '';
    if (moon && sun) {
      moonPhase = getMoonPhaseName(moon.longitude, sun.longitude);
    }
    // Lunation detection — use the same Julian-date phase math as the calendar
    // dots so the reading flags a New/Full Moon on the exact day the dot shows.
    // Eclipse detection needs the lunar nodes, so it uses the noon Sun/Moon.
    const moonPhaseEmoji = getMoonPhaseEmoji(date);
    const isExactNewMoon = moonPhaseEmoji === '🌑';
    const isExactFullMoon = moonPhaseEmoji === '🌕';
    let eclipseInfo = null;
    if (moon && sun && (isExactNewMoon || isExactFullMoon)) {
      eclipseInfo = detectEclipse({
        sunPlanet: sun,
        moonPlanet: moon,
        transitPlanets: res.transit_planets || [],
        isExactNewMoon,
        isExactFullMoon,
      });
    }
    const syntheticTransits = {
      transitPlanets: res.transit_planets || [],
      natalPlanets: mergeNatalPoints(res.natal || raw),
      natalAspects: (res.transit_aspects || []).filter(a => {
        // Include slow-planet transits (major transits to any natal target)
        if (SLOW.has(a.transit_planet) && a.orb <= 5) return true;
        // Always include transits to angles and nodes — significant even from
        // fast planets (e.g., Venus conjunct MC, Sun crossing Ascendant)
        if (ANGLE_NODE_POINTS.has(a.natal_planet) && a.orb <= 2) return true;
        // Transits to the natal lots (Part of Fortune, Tyche) — fortunate-point activations
        if (LOT_POINTS.has(a.natal_planet) && a.orb <= 2) return true;
        return false;
      }),
      lunarAspects: (res.transit_aspects || []).filter(a => a.transit_planet === 'Moon'),
      mundaneAspects: [],
      moonSign: moon?.sign || '',
      moonPhase,
      moonDegree: moon?.degree,
      stations: res.stations || [],
      ingresses: res.ingresses || [],
      isExactNewMoon,
      isExactFullMoon,
      isEclipse: !!eclipseInfo,
      eclipseType: eclipseInfo?.type || null,
      eclipseMoonSign: eclipseInfo?.moonSign || null,
    };
    generate(syntheticTransits);
  };

  const generate = async (transitData) => {
    setLoading(true);
    const raw = chart?.raw_data || {};
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const t = transitData || transits;
    const moonInfo = t?.moonSign ? `Moon in ${t.moonSign} at ${t.moonDegree?.toFixed(1)}° (${t.moonPhase})` : '';

    // Lunation events for today (New Moon / Full Moon / Eclipse)
    let lunationSection = '';
    if (t?.isEclipse && t?.eclipseType) {
      const meta = ECLIPSE_META[t.eclipseType];
      const sign = t.eclipseMoonSign || t.moonSign || '';
      lunationSection = `${meta.badge}${sign ? ` in ${sign}` : ''} — ${meta.meaning}`;
    } else if (t?.isExactNewMoon) {
      lunationSection = `NEW MOON today${t?.moonSign ? ` in ${t.moonSign}` : ''} — a fresh lunar cycle begins. A New Moon is an intention-setting, seed-planting moment; the monthly reset point.`;
    } else if (t?.isExactFullMoon) {
      lunationSection = `FULL MOON today${t?.moonSign ? ` in ${t.moonSign}` : ''} — culmination and illumination. A Full Moon brings things to light, peaks, and releases; what was building now surfaces.`;
    }

    // Use freshly calculated natal planets from the transit response — these have
    // correct house assignments for the current house system
    const natalPlanets = t?.natalPlanets || raw.planets || [];
    const transitPlanetsList = t?.transitPlanets || [];

    const fmtNatal = (t?.natalAspects || []).map(a =>
      formatTransitLabel(a, transitPlanetsList, natalPlanets, false));
    const fmtMundane = (t?.mundaneAspects || []).map(a =>
      formatTransitLabel(a, transitPlanetsList, transitPlanetsList, true));
    const fmtLunar = (t?.lunarAspects || []).map(a =>
      formatTransitLabel(a, transitPlanetsList, natalPlanets, false));

    const fmtStations = (t?.stations || []).map(s =>
      `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde (℞)' : 'direct (↗)'} in ${s.sign}`);

    const HOUSE_THEMES_LIST = ['', 'self and first impressions', 'money and values', 'communication and learning', 'home and family', 'creativity and romance', 'health and daily routines', 'partnerships', 'shared resources and intimacy', 'philosophy, travel, and higher learning', 'career and public standing', 'friendships and groups', 'solitude and spirituality'];
    const houseSystem = raw.house_system || 'whole_sign';
    const ascendantSign = raw.ascendant_sign || null;
    const fmtIngresses = (t?.ingresses || []).map(ing => {
      const natalHouses = raw.houses || [];
      const { entryHouse, crossesInto } = findNatalHouseForSign(ing.to_sign, natalHouses, houseSystem, ascendantSign);
      const base = `${ing.planet} enters ${ing.to_sign} (leaving ${ing.from_sign})`;
      if (entryHouse && crossesInto)
        return `${base} — enters ${entryHouse}H (${HOUSE_THEMES_LIST[entryHouse]}) then crosses into ${crossesInto.house}H (${HOUSE_THEMES_LIST[crossesInto.house]}) as it moves through the sign`;
      if (entryHouse) return `${base} — in natal ${entryHouse}H (${HOUSE_THEMES_LIST[entryHouse]})`;
      return base;
    });

    const ruler = getChartRuler(raw.ascendant_sign);
    const rulerGlyph = ruler ? (PLANET_GLYPHS[ruler.planet] || '') : '';
    const rulerNatal = ruler ? (natalPlanets.find(p => p.name === ruler.planet) || (raw.planets || []).find(p => p.name === ruler.planet)) : null;
    const rulerNatalInfo = rulerNatal ? ` (natal: ${rulerNatal.sign}${rulerNatal.house ? `, ${rulerNatal.house}H` : ''}${rulerNatal.retrograde ? ', Rx' : ''})` : '';
    const rulerLine = ruler
      ? `CHART RULER: ${rulerGlyph} ${ruler.label}${rulerNatalInfo} — this planet governs your identity, life direction, and how you meet the world.`
      : '';

    // Check if any of today's transits involve the chart ruler
    const rulerPlanet = ruler?.planet;
    const rulerInTransits = rulerPlanet
      ? [...(t?.natalAspects || []), ...(t?.mundaneAspects || []), ...(t?.lunarAspects || [])]
          .some(a => a.transit_planet === rulerPlanet || a.natal_planet === rulerPlanet)
      : false;
    const rulerIngress = rulerPlanet
      ? (t?.ingresses || []).some(ing => ing.planet === rulerPlanet)
      : false;
    const rulerStation = rulerPlanet
      ? (t?.stations || []).some(s => s.planet === rulerPlanet)
      : false;
    const rulerActiveVia = [
      rulerInTransits ? 'transits' : null, rulerIngress ? 'ingress' : null, rulerStation ? 'station' : null,
    ].filter(Boolean);

    // Chart dynamics — stelliums, oppositions, patterns activated by today's transits
    const dynamics = analyzeChartDynamics(raw);
    const activated = getActivatedDynamics(dynamics, t);
    let dynamicsSection = '';
    let dynamicsInstruction = '';
    if (activated.hasActivated) {
      const lines = [];
      if (activated.activatedStelliums.length > 0) {
        lines.push(`ACTIVATED STELLIUMS: ${activated.activatedStelliums.map(s => {
          const label = s.type === 'sign' ? `${s.sign} stellium` : `House ${s.house} stellium`;
          return `${label} (${s.planets.join(', ')})`;
        }).join('; ')}`);
      }
      if (activated.activatedOppositions.length > 0) {
        lines.push(`ACTIVATED OPPOSITIONS: ${activated.activatedOppositions.map(opp =>
          `${opp.sign1} ↔ ${opp.sign2} stellium opposition (${[...opp.planets1, ...opp.planets2].join(', ')})`).join('; ')}`);
      }
      if (activated.activatedPatterns.length > 0) {
        lines.push(`ACTIVATED PATTERNS: ${activated.activatedPatterns.map(p =>
          `${p.type} (${p.planets.join(', ')})${p.apex ? `, apex: ${p.apex}` : ''}`).join('; ')}`);
      }
      dynamicsSection = lines.join('\n');
      dynamicsInstruction = `- CHART DYNAMICS: Today's transits are activating your natal chart concentrations listed above. In the "dynamics_insight" field, write 1-2 sentences on how the transiting planet interacts with the concentrated natal energy — how the transit amplifies or challenges that life area. Stelliums represent where your chart's energy is most concentrated, so transits to them are personally significant.`;
    }

    // Essential dignities — classical planetary strength scoring (domicile, exaltation, detriment, fall)
    const natalDignities = analyzeChartDignities(raw);
    const transitDignities = getNotableTransitDignities(t?.transitPlanets);
    let dignitySection = '';
    let dignityInstruction = '';
    if (natalDignities.some(d => d.status !== 'peregrine') || transitDignities.length > 0) {
      const lines = [];
      const natalNotable = natalDignities.filter(d => d.status !== 'peregrine');
      if (natalNotable.length > 0) {
        lines.push(`NATAL DIGNITIES: ${natalNotable.map(d => `${d.planet} in ${d.sign} — ${d.label} (score ${d.score > 0 ? '+' : ''}${d.score})`).join('; ')}`);
      }
      if (transitDignities.length > 0) {
        lines.push(`TRANSIT DIGNITIES (planets in the sky right now): ${transitDignities.map(d => `${d.planet} in ${d.sign} — ${d.label} (score ${d.score > 0 ? '+' : ''}${d.score})`).join('; ')}`);
      }
      dignitySection = lines.join('\n');
      dignityInstruction = `- ESSENTIAL DIGNITIES: Use the classical dignity data above to inform your reading. When a transit planet is in domicile or exaltation, its effects are more constructive, natural, and powerful. When in detriment or fall, its effects are more challenging, distorted, or constrained by the sign it's in. Weave this naturally into the reading — note whether a transiting planet is strengthened or weakened by its current sign placement, and how that colors its influence. Do NOT use the word "dignity," "debility," or mention scores in the output. Just describe the quality of the planet's expression naturally.`;
    }

    // Mundane patterns — outer-planet cradles, conjunctions, aspect patterns, stelliums
    const mundanePatterns = getMundanePatterns(t?.transitPlanets);
    let mundaneSection = '';
    let mundaneInstruction = '';
    if (mundanePatterns.length > 0) {
      mundaneSection = mundanePatterns.map(p =>
        `${p.type}: ${p.planets.join(', ')}${p.sign ? ` in ${p.sign}` : ''}${p.element ? ` (${p.element})` : ''} — ${p.description}`
      ).join('\n');
      mundaneInstruction = `- MUNDANE PATTERNS: Today's sky contains notable collective configurations listed above. In the collective reading, mention any active mundane patterns (great conjunctions, outer-planet aspect patterns, cradles, stelliums) and what they mean for the collective. These are rare, era-defining alignments — treat them as significant collective context. Do NOT use the word "mundane" in the output — describe the pattern naturally.`;
    }

    const transitPositions = transitPlanetsList
      .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
      .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
      .join(', ');

    const result = await invokeLLMTask('day-synthesis', {
      knowledgeDepth,
      dateStr,
      sunSign: raw.sun_sign,
      moonSign: raw.moon_sign,
      ascSign: raw.ascendant_sign,
      natalPlacements: natalPlanets.map(p => `${p.name} in ${p.sign || '?'}${p.house ? ` (${p.house}H)` : ''}`).join(', '),
      rulerLine,
      rulerPlanet: ruler?.planet || '',
      rulerActiveVia,
      moonInfo,
      lunationSection,
      transitPositions,
      personalTransits: fmtNatal.join('\n'),
      mundaneTransits: fmtMundane.join('\n'),
      lunarTransits: fmtLunar.join('\n'),
      stations: fmtStations.join('\n'),
      ingresses: fmtIngresses.join('\n'),
      dynamicsSection,
      dignitySection,
      mundaneSection,
    });
    // Attach lunation metadata for UI rendering (not part of the LLM schema)
    if (t?.isEclipse || t?.isExactNewMoon || t?.isExactFullMoon) {
      result._lunation = {
        isNewMoon: !!t?.isExactNewMoon,
        isFullMoon: !!t?.isExactFullMoon,
        isEclipse: !!t?.isEclipse,
        eclipseType: t?.eclipseType || null,
        moonSign: t?.eclipseMoonSign || t?.moonSign || '',
      };
    }
    if (cacheKey) synthesisCache[cacheKey] = result;
    setSynthesis(result);
    onSynthesis?.(result);
    setLoading(false);
    // Persist to DB for instant future loads
    if (chart?.user_id && dbKey) {
      saveCachedSynthesis('day', dbKey, chart.user_id, result, {
        date_start: dateKey,
        date_end: dateKey,
        summary: `Daily Reading · ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      });
    }
  };

  const saveRating = async (newRating, newBookmarked) => {
    if (!userId || !dateKey) return;
    const data = {
      user_id: userId,
      date_key: dateKey,
      chart_id: chart?.id || '',
      rating: newRating,
      bookmarked: newBookmarked,
      synthesis_overview: synthesis?.overview?.slice(0, 300) || '',
    };
    if (ratingRecord) {
      const updated = await base44.entities.SynthesisRating.update(ratingRecord.id, data);
      setRatingRecord(updated);
    } else {
      const created = await base44.entities.SynthesisRating.create(data);
      setRatingRecord(created);
    }
  };

  const handleRating = async (val) => {
    const newRating = rating === val ? null : val;
    setRating(newRating);
    await saveRating(newRating, bookmarked);
  };

  const handleBookmark = async () => {
    const newBookmarked = !bookmarked;
    setBookmarked(newBookmarked);
    await saveRating(rating, newBookmarked);
  };

  const explainContext = synthesis ? [
    synthesis.overview,
    ...(synthesis.personal_reading || []),
    ...(synthesis.collective_reading || []),
    synthesis.maximize && `Maximize: ${synthesis.maximize}`,
    synthesis.focus && `Focus: ${synthesis.focus}`,
    synthesis.watch && `Watch: ${synthesis.watch}`,
  ].filter(Boolean).join('\n') : '';

  const handleExplain = async () => {
    if (explainOpen) { setExplainOpen(false); return; }
    setExplainOpen(true);
    if (explainText) return;
    setExplainLoading(true);
    try {
      const res = await fetchExplanation(explainContext, knowledgeDepth);
      setExplainText(res);
    } catch { /* non-critical */ }
    setExplainLoading(false);
  };

  const handleShare = async () => {
    const ascSign = chart?.raw_data?.ascendant_sign || chart?.ascendant_sign;
    if (!ascSign || shareLoading) return;
    setShareLoading(true);
    try {
      const shareDateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const res = await base44.functions.invoke('generateRisingSignCard', {
        sign: ascSign,
        dateKey,
        dateStr: shareDateStr,
        collectiveContext: formatCollectiveContext(transits),
      });
      setShareCard(buildRisingSignCardData(ascSign, res.data, shareDateStr));
    } catch { /* non-critical */ }
    setShareLoading(false);
  };

  return (
    <div className="celestial-card overflow-hidden">
      <CollapsibleCardHeader
        icon={<Sparkles size={14} />}
        title="Daily Reading"
        subtitle={synthesis?.best_areas?.[0] || (loading ? 'Reading the stars…' : 'Tap to generate your reading')}
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(!expanded)}
      />

      {expanded && (
        <div className="border-t border-gold-primary/20">
          {!synthesis && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="text-xl text-gold-accent animate-pulse">✦</div>
              <p className="font-body text-xs text-brass italic">Reading the stars...</p>
            </div>
          )}

          {synthesis && (
            <>
              {/* Tab bar — Personal first */}
              <div className="flex border-b border-white/[0.08]">
                <button
                  onClick={() => setActiveTab('personal')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                    activeTab === 'personal'
                      ? 'border-gold-accent text-white font-semibold'
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  <Sparkles size={11} /> Personal
                </button>
                <button
                  onClick={() => setActiveTab('collective')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                    activeTab === 'collective'
                      ? 'border-gold-accent text-white font-semibold'
                      : 'border-transparent text-white/40 hover:text-white/70'
                  }`}
                >
                  <Globe size={11} /> Collective
                </button>
              </div>

              <div className="px-4 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-body text-[10px] uppercase tracking-widest font-semibold text-brass">
                    {activeTab === 'personal' ? 'Your Sky' : 'The Collective'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-body text-[10px] text-brass/70">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {synthesis._lunation && (
                      <span className="font-body text-[9px] px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-accent border border-gold-primary/30 flex items-center gap-1">
                        <span style={{ fontVariantEmoji: 'text' }}>
                          {synthesis._lunation.isEclipse
                            ? (synthesis._lunation.eclipseType === 'solar' ? '🌑' : '🌕')
                            : synthesis._lunation.isNewMoon ? '🌑' : '🌕'}
                        </span>
                        {synthesis._lunation.isEclipse
                          ? (synthesis._lunation.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse')
                          : synthesis._lunation.isNewMoon ? 'New Moon' : 'Full Moon'}
                        {synthesis._lunation.moonSign && <span className="opacity-70">in {synthesis._lunation.moonSign}</span>}
                      </span>
                    )}
                  </div>
                </div>
                {synthesis.key_themes?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {synthesis.power_planet && (
                      <span className="font-body text-[9px] font-semibold px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-accent border border-gold-primary/30 flex items-center gap-1">
                        <span className="opacity-70">{PLANET_GLYPHS[synthesis.power_planet] || '✦'}</span>
                        {synthesis.power_planet}
                      </span>
                    )}
                    {synthesis.key_themes.map((theme, i) => (
                      <span key={i} className="font-body text-[9px] px-2 py-0.5 rounded-full bg-white/[0.06] text-brass border border-gold-primary/15">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 pt-2 space-y-3">
                {/* Collective tab */}
                {activeTab === 'collective' && (
                  <div className="space-y-3">
                    {synthesis.collective_highlight && (
                      <p className="font-body text-sm text-gold-primary/90 italic border-l-2 border-gold-primary/50 pl-3 leading-snug">
                        {highlightOnGold(synthesis.collective_highlight)}
                      </p>
                    )}
                    <p className="font-body text-[10px] text-brass/60 italic pt-1">
                      The full transit-by-transit breakdown lives in the Transits tab.
                    </p>
                  </div>
                )}

                {/* Personal tab */}
                {activeTab === 'personal' && (
                  <div className="space-y-3">
                    {synthesis.overview && (
                      <p className="font-body text-sm text-gold-primary/90 leading-relaxed italic border-l-2 border-gold-primary/50 pl-3">
                        {highlightOnGold(synthesis.overview)}
                      </p>
                    )}
                    {isPaid ? (
                      <>
                        {synthesis.dynamics_insight && (
                          <div className="rounded-lg border border-celestial-purple/30 bg-celestial-purple/10 p-3">
                            <p className="font-body text-[10px] uppercase tracking-widest font-semibold mb-1.5 text-celestial-purple">
                              <Layers size={11} className="inline mr-1" /> Chart Dynamics
                            </p>
                            <p className="font-body text-xs leading-snug text-white">{highlightOnWhite(synthesis.dynamics_insight)}</p>
                          </div>
                        )}
                        {['maximize', 'focus', 'watch'].map(cat => (
                          <SynthesisCategoryCard key={cat} category={cat} value={synthesis[cat]} highlightFn={highlightOnWhite} />
                        ))}
                      </>
                    ) : (
                      <GatedFeature
                        variant="interpret"
                        fromTier={tier}
                        context="daily synthesis"
                        title="Unlock your full daily synthesis"
                        description="Get maximize, focus, and watch guidance — plus chart-dynamics insight — for every day."
                        ctaLabel="Unlock Core — $5.55/mo"
                      />
                    )}
                    <p className="font-body text-[10px] text-brass/60 italic pt-1">
                      The full transit-by-transit breakdown lives in the Transits tab.
                    </p>
                  </div>
                )}

                {explainOpen && (explainLoading || explainText) && (
                  <div className="rounded-lg border border-gold-primary/20 bg-gold-primary/5 p-3">
                    {explainLoading ? (
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={11} className="animate-spin text-gold-primary" />
                        <span className="font-body text-[10px] text-brass italic">Simplifying...</span>
                      </div>
                    ) : (
                      <p className="font-body text-xs text-white/85 leading-snug">{highlightOnWhite(explainText)}</p>
                    )}
                  </div>
                )}
                {/* Rating & Bookmark bar */}
                <div className="flex items-center justify-between pt-1 border-t border-gold-primary/15">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleRating('thumbs_up')} title="Helpful reading"
                      className={`p-1.5 rounded-lg transition-all ${rating === 'thumbs_up' ? 'bg-green-soft/20 text-green-soft' : 'text-brass/30 hover:text-green-soft hover:bg-green-soft/10'}`}>
                      <ThumbsUp size={13} />
                    </button>
                    <button onClick={() => handleRating('thumbs_down')} title="Not useful"
                      className={`p-1.5 rounded-lg transition-all ${rating === 'thumbs_down' ? 'bg-gold-accent/20 text-gold-accent' : 'text-brass/30 hover:text-gold-accent hover:bg-gold-accent/10'}`}>
                      <ThumbsDown size={13} />
                    </button>
                    <button onClick={handleBookmark} title="Save this synthesis"
                      className={`p-1.5 rounded-lg transition-all ${bookmarked ? 'bg-gold-primary/20 text-gold-accent' : 'text-brass/30 hover:text-gold-accent hover:bg-gold-primary/10'}`}>
                      <Bookmark size={13} className={bookmarked ? 'fill-gold-accent' : ''} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleExplain}
                      className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-gold-accent transition-colors">
                      {explainLoading ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />} Explain it
                    </button>
                    <button onClick={() => { if (cacheKey) delete synthesisCache[cacheKey]; clearMemCache('day', dbKey, chart?.user_id); hasGenerated.current = false; autoExpand ? fetchTransitsAndGenerate() : generate(transits); }}
                      className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-brass transition-colors">
                      <RefreshCw size={10} /> Regenerate
                    </button>
                    <button onClick={handleShare}
                      className="flex items-center gap-1 font-body text-[10px] text-brass hover:text-gold-accent transition-colors">
                      {shareLoading ? <Loader2 size={10} className="animate-spin" /> : <Share2 size={10} />} Share
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename="astrosetta-rising-sign" textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}