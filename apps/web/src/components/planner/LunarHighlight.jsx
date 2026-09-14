import React, { useState, useEffect, useRef } from 'react';
import SignName from '@/components/ui/SignName';
import { base44 } from '@/api/base44Client';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { ECLIPSE_META } from '@/lib/eclipseUtils';
import { getHouseName } from '@/lib/houseUtils';
import { Share2 } from 'lucide-react';
import { getCachedSynthesis, saveCachedSynthesis } from '@/lib/synthesisCache';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import ShareSheet from '@/components/share/ShareSheet';
import { buildLunationCardData } from '@/lib/shareCard';

// Module-level cache: `${chartId}_${dateKey}_${phase}${isEclipse?_eclipse}` → result
const lunarCache = {};

/**
 * Expandable lunar/eclipse highlight that lives inside the Planetary Highlights
 * expanded view. Generates a collective + personal + ritual reading via LLM,
 * enriched with natal angles (ASC/DC/MC/IC) and active Moon aspects (which may
 * include angles) so the personal interpretation speaks to angle activations.
 */
export default function LunarHighlight({ lunation, chart, date, autoExpand = false }) {
  const { phase, moonSign, isEclipse, eclipseType, lunarAspects = [] } = lunation;
  const meta = isEclipse ? ECLIPSE_META[eclipseType] : null;

  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const hasGenerated = useRef(false);
  const shareDateStr = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
  const cacheKey = chart?.id ? `${chart.id}_${dateKey}_${phase}${isEclipse ? '_eclipse' : ''}` : null;
  const dbKey = `lunar-${dateKey}-${phase.replace(/ /g, '_')}${isEclipse ? '-eclipse' : ''}`;

  const raw = chart?.raw_data || {};
  const moonHouseObj = raw.houses?.find(h => h.sign === moonSign);
  const moonHouseNum = moonHouseObj?.number;

  useEffect(() => {
    if (autoExpand) setExpanded(true);
  }, [autoExpand]);

  useEffect(() => {
    if (!dateKey) return;
    if (cacheKey && lunarCache[cacheKey]) { setReading(lunarCache[cacheKey]); hasGenerated.current = true; return; }
    if (chart?.user_id) {
      getCachedSynthesis('lunar', dbKey, chart.user_id).then(cached => {
        if (cached) { if (cacheKey) lunarCache[cacheKey] = cached; setReading(cached); hasGenerated.current = true; }
        else { hasGenerated.current = false; setReading(null); }
      });
      return;
    }
    hasGenerated.current = false; setReading(null);
  }, [dateKey, phase, isEclipse, chart?.user_id]);

  useEffect(() => {
    if (!expanded || hasGenerated.current || loading) return;
    hasGenerated.current = true;
    generate();
  }, [expanded]);

  const generate = async () => {
    setLoading(true);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const natalPlanets = (raw.planets || [])
      .map(p => `${p.name} in ${p.sign} (House ${p.house}${p.retrograde ? ', Rx' : ''})`)
      .join('; ');
    const natalHouses = (raw.houses || [])
      .map(h => `House ${h.number}: ${h.sign}`)
      .join(', ');

    const angles = raw.angles || {};
    const angleList = [];
    if (angles.ascendant) angleList.push(`Ascendant (ASC) in ${angles.ascendant.sign} (${angles.ascendant.degree?.toFixed(1)}°)`);
    if (angles.descendant) angleList.push(`Descendant (DC) in ${angles.descendant.sign} (${angles.descendant.degree?.toFixed(1)}°)`);
    if (angles.midheaven) angleList.push(`Midheaven (MC) in ${angles.midheaven.sign} (${angles.midheaven.degree?.toFixed(1)}°)`);
    if (angles.ic) angleList.push(`IC in ${angles.ic.sign} (${angles.ic.degree?.toFixed(1)}°)`);
    const natalAngles = angleList.join('; ');

    const moonHouseContext = moonHouseNum
      ? `The ${phase} falls in ${moonSign}, which is the ${moonHouseNum}th house for this person.`
      : `The ${phase} is in ${moonSign}.`;

    const planetsInMoonSign = (raw.planets || []).filter(p => p.sign === moonSign);
    const anglesInMoonSign = [];
    if (angles.ascendant?.sign === moonSign) anglesInMoonSign.push('Ascendant');
    if (angles.descendant?.sign === moonSign) anglesInMoonSign.push('Descendant');
    if (angles.midheaven?.sign === moonSign) anglesInMoonSign.push('Midheaven');
    if (angles.ic?.sign === moonSign) anglesInMoonSign.push('IC');
    const conjParts = [];
    if (planetsInMoonSign.length) conjParts.push(`Natal planets in ${moonSign}: ${planetsInMoonSign.map(p => p.name).join(', ')}`);
    if (anglesInMoonSign.length) conjParts.push(`Natal angles in ${moonSign}: ${anglesInMoonSign.join(', ')}`);
    const conjunctionNote = conjParts.length
      ? `The transiting ${phase === 'New Moon' ? 'Sun–Moon conjunction' : 'Full Moon'} is conjunct these natal points by sign — ${conjParts.join('; ')}.`
      : '';

    const lunarAspectContext = lunarAspects.length
      ? `Active Moon aspects to natal chart (may include angles): ${lunarAspects.map(a => `Moon ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`).join(', ')}`
      : '';

    const eclipseContext = meta
      ? `This ${phase} is also a ${meta.label}. Eclipses amplify and catalyze the lunation — they are fated turning points whose effects can unfold for 6+ months. Solar eclipses seed dramatic new beginnings; lunar eclipses culminate, illuminate, and release. Frame the reading through this eclipse lens with extra weight and long-arc significance.`
      : '';

    const prompt = `You are a skilled astrologer. Today is ${dateStr} and there is a ${phase} in ${moonSign}${meta ? ' — a ' + meta.label : ''}.

NATAL CHART:
Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}, Rising: ${raw.ascendant_sign}
Planets: ${natalPlanets || 'not provided'}
Angles: ${natalAngles || 'not provided'}
House cusps: ${natalHouses || 'not provided'}
${moonHouseContext}
${conjunctionNote}
${lunarAspectContext}
${eclipseContext}

Write a focused reading for this ${phase} in ${moonSign}${meta ? ', through the lens of the eclipse' : ''}.

IMPORTANT: Use ONLY the natal chart data and transit data provided above. Do NOT mention any aspects, planetary placements, or lunar events that are not explicitly listed in the data above.

Return JSON:
- collective: 2 sentences on what this ${phase} means for everyone collectively — themes, archetypes, what is illuminated/released/seeded
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. You have their full chart above — reference the specific house it activates, any natal planets OR angles (ASC/DC/MC/IC) in ${moonSign} that are being hit, and any active Moon aspects listed. Be concrete and personal, not generic.
- ritual: 1 short practical suggestion for honoring this moon phase today`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          collective: { type: 'string' },
          personal: { type: 'string' },
          ritual: { type: 'string' },
        },
        required: ['collective', 'personal', 'ritual'],
      },
    });
    if (cacheKey) lunarCache[cacheKey] = result;
    setReading(result);
    setLoading(false);
    if (chart?.user_id) {
      saveCachedSynthesis('lunar', dbKey, chart.user_id, result, {
        date_start: dateKey,
        date_end: dateKey,
        summary: `${meta ? meta.label : phase} in ${moonSign}`,
      });
    }
  };

  const label = meta ? meta.label : phase;
  const glyph = meta?.glyph || (phase === 'Full Moon' ? '🌕' : '🌑');
  const sub = meta ? meta.badge : 'Notable celestial event';

  return (
    <div className={`rounded-xl border overflow-hidden ${meta ? `${meta.border} ${meta.bg}` : 'border-gold-primary/25'}`} style={meta ? undefined : { background: 'rgba(15,26,46,0.96)' }}>
      <CollapsibleCardHeader
        icon={<span className="text-lg" style={{ fontVariantEmoji: 'text', filter: meta ? `drop-shadow(0 0 5px ${meta.glow})` : undefined }}>{glyph}</span>}
        title={<>{label} in <SignName sign={moonSign} /></>}
        subtitle={`${sub}${moonHouseNum ? ` · activates ${getHouseName(moonHouseNum)}` : ''} · tap to read`}
        expanded={expanded}
        loading={loading}
        onToggle={() => setExpanded(e => !e)}
      />

      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-3 border-t border-gold-primary/15">
          {loading && (
            <div className="flex flex-col items-center justify-center py-5 gap-2">
              <span className="text-lg text-gold-accent animate-pulse">{glyph}</span>
              <p className="font-body text-xs text-brass italic">Reading the moon...</p>
            </div>
          )}
          {reading && (
            <>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Collective</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.collective)}</p>
              </div>
              <div>
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Personal · Your Chart</p>
                <p className="font-body text-sm text-white/90 leading-relaxed">{highlightSynthesisText(reading.personal)}</p>
              </div>
              <div className="rounded-lg bg-gold-primary/10 border border-gold-primary/20 px-3 py-2">
                <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">✦ Today's Ritual</p>
                <p className="font-body text-xs text-brass leading-relaxed">{highlightSynthesisText(reading.ritual)}</p>
              </div>
              <button
                onClick={() => setShareCard(buildLunationCardData({ phase, moonSign, isEclipse, eclipseType }, shareDateStr))}
                className="flex items-center gap-1.5 self-start font-body text-[10px] text-brass/60 hover:text-gold-accent transition-colors pt-1"
              >
                <Share2 size={11} /> Share this {isEclipse ? 'eclipse' : phase.toLowerCase()}
              </button>
            </>
          )}
        </div>
      )}
      <ShareSheet open={!!shareCard} onOpenChange={(o) => !o && setShareCard(null)} card={shareCard} filename={`astrosetta-${phase.toLowerCase().replace(' ', '-')}-${moonSign.toLowerCase()}`} textFallback={shareCard?.textFallback || ''} />
    </div>
  );
}