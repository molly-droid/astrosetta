import React, { useState, useEffect, useRef } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { highlightSynthesisText, getChartRuler } from '@/lib/transitUtils';
import SignName from '@/components/ui/SignName';
import { Share2 } from 'lucide-react';
import { getCachedSynthesis, saveCachedSynthesis } from '@/lib/synthesisCache';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import { findNatalHouseForSign, ordinal } from '@/lib/houseUtils';
import ShareSheet from '@/components/share/ShareSheet';
import { buildIngressCardData } from '@/lib/shareCard';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const OUTER_PLANETS = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron']);

const PLANET_DURATIONS = {
  Sun: 'about 1 month', Mercury: '2–4 weeks', Venus: '3–4 weeks',
  Mars: 'about 2 months', Jupiter: 'about 1 year', Saturn: 'about 2.5 years',
  Uranus: 'about 7 years', Neptune: 'about 14 years', Pluto: '12–30 years', Chiron: '4–8 years',
};

const HOUSE_THEMES = [
  '', 'self, appearance, and first impressions',
  'money, values, and material security',
  'communication, learning, and immediate environment',
  'home, family, and emotional foundations',
  'creativity, romance, and self-expression',
  'health, daily routines, and service',
  'partnerships, marriage, and significant others',
  'shared resources, intimacy, and transformation',
  'philosophy, higher learning, travel, and beliefs',
  'career, public standing, and legacy',
  'friendships, groups, and hopes for the future',
  'solitude, spirituality, and hidden matters',
];

// Module-level cache: `${chartId}_${dateKey}_${planet}_${to_sign}` → result
const ingressCache = {};

export default function IngressBanner({ ingresses, chart, compact = false, onLinkToHighlights, ingressAutoExpand }) {
  if (!ingresses?.length) return null;

  // Astrologers prioritize ingresses by how slowly the planet moves —
  // a generational planet (Pluto, Neptune) changing signs is far more
  // significant than Venus or Mercury. Within the same planet, exact >
  // recent > approaching.
  const PLANET_RANK = {
    Pluto: 1, Neptune: 2, Uranus: 3, Saturn: 4, Jupiter: 5,
    Mars: 6, Venus: 7, Mercury: 8, Sun: 9,
  };
  const timingRank = (ing) => {
    if (ing.exact) return 0;
    if (ing.recent) return 1;
    if (ing.approaching) return 2;
    return 3;
  };
  const sorted = [...ingresses].sort((a, b) => {
    const ar = PLANET_RANK[a.planet] ?? 10;
    const br = PLANET_RANK[b.planet] ?? 10;
    if (ar !== br) return ar - br;
    return timingRank(a) - timingRank(b);
  });

  return (
    <div className="space-y-2">
      {sorted.map((ing, i) => (
        <IngressCard key={`ing_${i}`} ing={ing} chart={chart} compact={compact} onLinkToHighlights={onLinkToHighlights} autoExpandKey={ingressAutoExpand} />
      ))}
    </div>
  );
}

function IngressCard({ ing, chart, compact, onLinkToHighlights, autoExpandKey }) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const hasGenerated = useRef(false);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Linked from a Today banner — auto-expand the matching ingress card
  useEffect(() => {
    if (autoExpandKey && autoExpandKey.split('#')[0] === `${ing.planet}__${ing.to_sign}`) setExpanded(true);
  }, [autoExpandKey]);
  const dateKey = new Date().toLocaleDateString('en-CA');

  const cacheKey = chart?.id ? `${chart.id}_${dateKey}_${ing.planet}_${ing.to_sign}_v4` : null;

  useEffect(() => {
    if (!dateKey || !ing?.to_sign) return;
    setCacheChecked(false);
    const dbKey = `ingress-${dateKey}-${ing.planet}-${ing.to_sign}`;

    // Check memory cache first
    if (cacheKey && ingressCache[cacheKey]) {
      setReading(ingressCache[cacheKey]);
      hasGenerated.current = true;
      setCacheChecked(true);
      return;
    }

    // Check DB cache async
    if (chart?.user_id) {
      getCachedSynthesis('ingress', dbKey, chart.user_id).then(cached => {
        if (cached) {
          if (cacheKey) ingressCache[cacheKey] = cached;
          setReading(cached);
          hasGenerated.current = true;
        } else {
          hasGenerated.current = false;
          setReading(null);
        }
        setCacheChecked(true);
      });
      return;
    }

    hasGenerated.current = false;
    setReading(null);
    setCacheChecked(true);
  }, [cacheKey, chart?.user_id]);

  useEffect(() => {
    if (!cacheChecked) return; // Wait for DB cache check to complete before generating
    if (!chart || compact || hasGenerated.current || loading) return;
    if (!expanded) return; // Only generate when user expands
    hasGenerated.current = true;
    generate();
  }, [chart, cacheKey, expanded, cacheChecked]);

  const generate = async () => {
    setLoading(true);
    const raw = chart?.raw_data || {};
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const natalPlanets = (raw.planets || [])
      .map(p => `${p.name} in ${p.sign} (House ${p.house}${p.retrograde ? ', Rx' : ''})`)
      .join('; ');
    const natalHouses = (raw.houses || [])
      .map(h => `House ${h.number}: ${h.sign}`)
      .join(', ');

    // Find which natal house(s) the ingressing sign spans
    const houseSystem = raw.house_system || 'whole_sign';
    const ascendantSign = raw.ascendant_sign || null;
    const { entryHouse, housesSpanned, crossesInto } = findNatalHouseForSign(ing.to_sign, raw.houses || [], houseSystem, ascendantSign);
    const entryTheme = entryHouse ? HOUSE_THEMES[entryHouse] : '';
    const crossTheme = crossesInto ? HOUSE_THEMES[crossesInto.house] : '';

    let houseContext;
    if (entryHouse && crossesInto) {
      houseContext = `${ing.planet} entering ${ing.to_sign} begins in your ${entryHouse}th house of ${entryTheme}, but ${ing.to_sign} spans two houses in your chart — as ${ing.planet} moves through the sign, it will cross into your ${crossesInto.house}th house of ${crossTheme} at approximately ${crossesInto.degree}° ${ing.to_sign}.`;
    } else if (entryHouse) {
      houseContext = `${ing.planet} entering ${ing.to_sign} places it in your ${entryHouse}th house of ${entryTheme}.`;
    } else {
      houseContext = `${ing.planet} is entering ${ing.to_sign}.`;
    }

    // Find natal planets in the sign being entered
    const planetsInNewSign = (raw.planets || []).filter(p => p.sign === ing.to_sign);
    const conjunctionNote = planetsInNewSign.length
      ? `Natal planets in ${ing.to_sign}: ${planetsInNewSign.map(p => `${p.name} (House ${p.house})`).join(', ')} — ${ing.planet} will conjunct these.`
      : '';

    const ruler = getChartRuler(raw.ascendant_sign);
    const isChartRuler = !!(ruler && ing.planet === ruler.planet);

    const duration = PLANET_DURATIONS[ing.planet] || 'an extended period';
    const action = ing.approaching ? 'is entering' : ing.recent ? 'recently entered' : 'enters';

    try {
      const result = await invokeLLMTask('ingress-reading', {
        dateStr,
        planet: ing.planet,
        action,
        toSign: ing.to_sign,
        fromSign: ing.from_sign,
        sunSign: raw.sun_sign,
        natalMoonSign: raw.moon_sign,
        ascSign: raw.ascendant_sign,
        natalPlanets,
        natalHouses,
        houseContext,
        conjunctionNote,
        duration,
        isChartRuler,
        entryHouse,
        entryTheme,
        crossHouse: crossesInto?.house,
        crossTheme,
      });
      if (cacheKey) ingressCache[cacheKey] = result;
      setReading(result);
      // Persist to DB for instant future loads
      if (chart?.user_id) {
        saveCachedSynthesis('ingress', `ingress-${dateKey}-${ing.planet}-${ing.to_sign}`, chart.user_id, result, {
          date_start: dateKey,
          date_end: dateKey,
          summary: `${ing.planet} enters ${ing.to_sign}`,
        });
      }
    } catch {
      // fallback — still show the headline
    }
    setLoading(false);
  };

  const glyph = PLANET_GLYPHS[ing.planet] || '✦';
  const ingressLabel = ing.approaching ? 'Approaching Ingress' : ing.recent ? '✦ Just Entered' : '★ Major Ingress';

  // Chart ruler check — show a special badge
  const ruler = getChartRuler(chart?.raw_data?.ascendant_sign);
  const isChartRuler = ruler && ing.planet === ruler.planet;

  // Approaching ingresses haven't crossed yet — say "approaching" instead of "enters"
  const isApproaching = !!ing.approaching;
  const titleVerb = isApproaching ? 'approaching' : 'enters';
  const expectedDateLabel = (isApproaching && ing.expected_date)
    ? new Date(ing.expected_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  if (compact) {
    const content = (
      <p className="font-body text-xs text-white/80">
        <span className="text-gold-accent font-semibold">{glyph} {ing.planet}</span> {titleVerb}{' '}
        <SignName sign={ing.to_sign} />
        {isApproaching && expectedDateLabel && <span className="text-brass/50 ml-1">· est. {expectedDateLabel}</span>}
        {ing.recent && <span className="text-brass/50 ml-1">just entered</span>}
        {onLinkToHighlights && <span className="text-brass/50 ml-1">· highlights ↓</span>}
      </p>
    );
    if (onLinkToHighlights) {
      return (
        <button
          type="button"
          onClick={() => onLinkToHighlights('ingresses', `${ing.planet}__${ing.to_sign}`)}
          className="rounded-xl px-3 py-2 w-full text-left cursor-pointer hover:brightness-110 transition"
          style={{ background: 'linear-gradient(135deg, rgba(201,169,97,0.15), rgba(212,175,133,0.05))', border: '1px solid rgba(201,169,97,0.35)' }}
        >
          {content}
        </button>
      );
    }
    return (
      <div
        className="rounded-xl px-3 py-2"
        style={{ background: 'linear-gradient(135deg, rgba(201,169,97,0.15), rgba(212,175,133,0.05))', border: '1px solid rgba(201,169,97,0.35)' }}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="celestial-card overflow-hidden">
      <CollapsibleCardHeader
        icon={<span className="text-lg" style={{ fontVariantEmoji: 'text' }}>{glyph}</span>}
        title={<>{ing.planet} {titleVerb} <SignName sign={ing.to_sign} /></>}
        subtitle={<>{ingressLabel} · {isApproaching ? `at ${ing.degree?.toFixed(1)}° ${ing.from_sign}` : ing.recent ? `now at ${ing.degree?.toFixed(1)}° ${ing.to_sign}` : 'today'}{isApproaching && expectedDateLabel && <> · est. {expectedDateLabel}</>}</>}
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(!expanded)}
        rightExtra={isChartRuler ? (
          <span className="px-1.5 py-0.5 rounded-full bg-gold-primary/20 border border-gold-accent/40 text-gold-accent font-semibold text-[9px] whitespace-nowrap">⭐ Chart Ruler</span>
        ) : null}
      />

      {expanded && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gold-primary/15">
          {loading && (
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              <span className="text-lg text-gold-accent animate-pulse">{glyph}</span>
              <p className="font-body text-xs text-brass italic">Reading the ingress...</p>
            </div>
          )}

          {reading && (
            <>
              {reading.headline && (
                <p className="font-display text-sm font-bold text-gold-accent">{reading.headline}</p>
              )}
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Collective</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.collective)}</p>
              </div>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Personal · Your Chart</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.personal)}</p>
              </div>
              <div className="rounded-lg bg-gold-primary/10 border border-gold-primary/20 px-3 py-2">
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">✦ Work With This</p>
                <p className="font-body text-xs text-brass leading-relaxed">{highlightSynthesisText(reading.ritual)}</p>
              </div>
              <button
                onClick={() => setShareCard(buildIngressCardData(ing, dateStr))}
                className="flex items-center gap-1.5 self-start font-body text-[10px] text-brass/60 hover:text-gold-accent transition-colors pt-1"
              >
                <Share2 size={11} /> Share this ingress
              </button>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename={`astrosetta-${ing.planet}-${ing.to_sign}-ingress`} textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}