import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { highlightSynthesisText, PERSONA, PLANET_GLYPHS } from '@/lib/transitUtils';
import { findChartPoint, getHouseForLongitude } from '@/lib/chartUtils';
import { Loader2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import SynastryAspectInterpretation from '@/components/chart/SynastryAspectInterpretation';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E', semisextile: '⚺\uFE0E',
};

const ASPECT_COLORS = {
  conjunction: '#C9A961', opposition: '#c0392b', trine: '#2980b9',
  square: '#c0392b', sextile: '#27ae60', quincunx: '#8e44ad', semisextile: '#27ae60',
};

const NODE_GLYPHS = { 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E' };

function getGlyph(name) {
  return PLANET_GLYPHS[name] || NODE_GLYPHS[name] || '✦';
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const RELATIONSHIP_AREAS = {
  'Partner': ['Love & Romance', 'Communication', 'Emotional Bond', 'Physical Chemistry', 'Long-Term Potential'],
  'Potential Partner': ['Attraction', 'Communication', 'Emotional Compatibility', 'Challenges to Watch', 'Long-Term Potential'],
  'Crush': ['Attraction', 'First Impressions', 'Communication', 'Potential'],
  'Ex': ['What Drew You Together', 'Where It Fractured', 'Lessons Learned', 'Current Dynamic'],
  'Friend': ['Friendship Bond', 'Communication', 'Shared Interests', 'Emotional Support', 'Navigating Conflict'],
  'Child': ['Parent-Child Bond', 'Communication', 'Nurturing', 'Developmental Support', 'Challenges'],
  'Mother': ['Maternal Bond', 'Communication', 'Nurturing', 'Authority & Autonomy', 'Emotional Dynamics', 'Lessons'],
  'Father': ['Paternal Bond', 'Communication', 'Authority & Autonomy', 'Emotional Dynamics', 'Lessons'],
  'Parent': ['Family Bond', 'Communication', 'Authority & Autonomy', 'Emotional Dynamics', 'Lessons'],
  'Sibling': ['Sibling Bond', 'Communication', 'Competition & Cooperation', 'Emotional Dynamics', 'Lifelong Connection'],
  'Colleague': ['Work Dynamic', 'Communication', 'Collaboration', 'Power Balance', 'Professional Growth'],
  'Boss': ['Authority Dynamic', 'Communication', 'Expectations', 'Growth Opportunity', 'Navigating Tension'],
  'Client': ['Professional Rapport', 'Communication', 'Trust Building', 'Delivering Value', 'Long-Term Partnership'],
  'Mentor': ['Guidance Dynamic', 'Learning & Growth', 'Communication', 'Power Balance', 'Long-Term Impact'],
  'Other': ['Core Connection', 'Communication', 'Emotional Bond', 'Growth Areas'],
};

const EVENT_AREAS = {
  'When We Met': ['First Impressions', 'The Spark', 'What Was Activated', 'What It Meant'],
  'First Date': ['First Impressions', 'Chemistry', 'Communication', 'Potential Seeds'],
  'Wedding': ['The Bond Sealed', 'Commitment', 'Emotional Foundation', 'Long-Term Vision'],
  'Engagement': ['Commitment', 'Partnership Dynamic', 'Emotional Bond', 'Future Vision'],
  'Partnership': ['Partnership Dynamic', 'Communication', 'Power Balance', 'Growth Potential'],
  'Career Milestone': ['Career Activation', 'Recognition', 'Challenge & Growth', 'Long-Term Impact'],
  'Relocation': ['New Beginnings', 'Foundation', 'Emotional Landscape', 'Growth Areas'],
  'Travel': ['The Journey', 'Expansion', 'What It Opens Up', 'Lessons'],
  'Achievement': ['The Achievement', 'Recognition', 'Inner Meaning', 'What It Seeds'],
  'Other': ['Core Themes', 'What It Activates', 'Growth Areas'],
};

function getAreas(relationship, isEvent) {
  if (isEvent) return EVENT_AREAS[relationship] || EVENT_AREAS['Other'];
  return RELATIONSHIP_AREAS[relationship] || RELATIONSHIP_AREAS['Other'];
}

// Build the ChartWheel highlight key for a cross-aspect.
// ChartWheel's nested-ring synastry renders partner aspects with the
// pasp_<transit_planet(person2)>_<aspect>_<natal_planet(person1)> key.
function makeAspectKey(aspect) {
  return `pasp_${aspect.person2_planet}_${aspect.aspect}_${aspect.person1_planet}`;
}

// Match an LLM-generated aspect label (e.g. "Venus trine Mars") to an actual cross-aspect
function findAspectByLabel(label, crossAspects) {
  if (!crossAspects || !label) return null;
  const labelLower = label.toLowerCase().trim();
  // Exact match in either ordering
  let found = crossAspects.find(a => {
    const key1 = `${a.person1_planet} ${a.aspect} ${a.person2_planet}`.toLowerCase();
    const key2 = `${a.person2_planet} ${a.aspect} ${a.person1_planet}`.toLowerCase();
    return labelLower === key1 || labelLower === key2;
  });
  if (found) return found;
  // Fallback: both planet names + aspect word appear in the label
  return crossAspects.find(a => {
    const hasAspect = labelLower.includes(a.aspect.toLowerCase());
    const hasP1 = labelLower.includes(a.person1_planet.toLowerCase());
    const hasP2 = labelLower.includes(a.person2_planet.toLowerCase());
    return hasAspect && hasP1 && hasP2;
  });
}

const GLYPH_STYLE = { fontVariantEmoji: 'text', fontVariant: 'normal' };

function SupportingAspectChip({ aspect, onClick, active }) {
  const sym = ASPECT_SYMBOLS[aspect.aspect] || '';
  const col = ASPECT_COLORS[aspect.aspect] || '#8B7355';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
        active
          ? 'bg-gold-primary/15 border-gold-accent/50'
          : 'bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.15]'
      }`}
    >
      <span style={GLYPH_STYLE} className="font-body text-xs text-brass">{getGlyph(aspect.person1_planet)}</span>
      <span style={{ ...GLYPH_STYLE, color: col }} className="font-body text-xs">{sym}</span>
      <span style={GLYPH_STYLE} className="font-body text-xs text-brass">{getGlyph(aspect.person2_planet)}</span>
      <span className="font-body text-[9px] text-white/35 ml-0.5">{aspect.orb?.toFixed(0)}°</span>
    </button>
  );
}

function AreaCard({ area, crossAspects, onAspectHighlight, natalPlanets, transitPlanets, natalHouses, transitHouses, overlayName, relationship, deceased, dateOfDeath }) {
  const [open, setOpen] = useState(false);
  const [activeAspect, setActiveAspect] = useState(null);

  const supporting = (area.supporting_aspects || [])
    .map(label => findAspectByLabel(label, crossAspects))
    .filter(Boolean);

  const handleToggle = () => {
    const newOpen = !open;
    setOpen(newOpen);
    // Auto-highlight the tightest supporting aspect when expanding
    if (newOpen && supporting.length > 0) {
      const tightest = [...supporting].sort((a, b) => a.orb - b.orb)[0];
      onAspectHighlight?.(makeAspectKey(tightest));
    }
  };

  const handleChipClick = (asp) => {
    const key = makeAspectKey(asp);
    onAspectHighlight?.(key);
    setActiveAspect(prev => prev === asp ? null : asp);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025]">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="font-display text-sm text-gold-accent font-semibold">{area.name}</span>
          {!open && (
            <p className="font-body text-xs text-white/70 mt-1 leading-snug line-clamp-2">{area.insight}</p>
          )}
        </div>
        <div className="shrink-0 ml-2">
          {open ? <ChevronDown size={14} className="text-brass/50" /> : <ChevronRight size={14} className="text-brass/50" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
          <div className="font-body text-sm text-white/85 leading-relaxed mt-2">
            {highlightSynthesisText(area.insight, onAspectHighlight, 'text-gold-primary')}
          </div>
          {supporting.length > 0 && (
            <div className="mt-3">
              <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-2">Supporting Aspects</p>
              <div className="flex flex-wrap gap-1.5">
                {supporting.map((a, i) => (
                  <SupportingAspectChip
                    key={i}
                    aspect={a}
                    onClick={() => handleChipClick(a)}
                    active={activeAspect === a}
                  />
                ))}
              </div>
              {activeAspect && (
                <div className="mt-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] p-2.5">
                  <SynastryAspectInterpretation
                    item={{
                      key: makeAspectKey(activeAspect),
                      type: 'transit_aspect',
                      transit_planet: activeAspect.person2_planet,
                      natal_planet: activeAspect.person1_planet,
                      aspect: activeAspect.aspect,
                      orb: activeAspect.orb,
                    }}
                    natalPlanets={natalPlanets}
                    transitPlanets={transitPlanets}
                    natalHouses={natalHouses}
                    transitHouses={transitHouses}
                    overlayName={overlayName}
                    relationship={relationship}
                    deceased={deceased}
                    dateOfDeath={dateOfDeath}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SynastrySynthesis({ userName, partnerName, relationship, partnerPronouns, deceased, dateOfDeath, c1Data, c2Data, crossAspects, onAspectHighlight, natalPlanets, transitPlanets, overlayName, isEvent }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const cacheKey = `${userName}_${partnerName}_${relationship || 'Other'}_${crossAspects?.length || 0}_${deceased ? 'd' : 'l'}_${dateOfDeath || ''}_${isEvent ? 'ev' : 'pr'}_v3`;

  useEffect(() => {
    if (!crossAspects || crossAspects.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setData(null);

      const sun1 = c1Data?.planets?.find(p => p.name === 'Sun')?.sign;
      const moon1 = c1Data?.planets?.find(p => p.name === 'Moon')?.sign;
      const asc1 = c1Data?.angles?.ascendant?.sign;
      const mc1 = c1Data?.angles?.midheaven?.sign;
      const sun2 = c2Data?.planets?.find(p => p.name === 'Sun')?.sign;
      const moon2 = c2Data?.planets?.find(p => p.name === 'Moon')?.sign;
      const asc2 = c2Data?.angles?.ascendant?.sign;
      const mc2 = c2Data?.angles?.midheaven?.sign;

      const aspectsList = [...crossAspects]
        .sort((a, b) => a.orb - b.orb)
        .slice(0, 30)
        .map(a => {
          const p1 = findChartPoint(c1Data, a.person1_planet);
          const p2 = findChartPoint(c2Data, a.person2_planet);
          return `${a.person1_planet}${p1?.sign ? ` in ${p1.sign}` : ''}${p1?.degree != null ? ` at ${p1.degree.toFixed(1)}°` : ''}${p1?.house ? `, ${ordinal(p1.house)} house` : ''}${p1?.retrograde ? ' ℞' : ''} ${a.aspect} ${a.person2_planet}${p2?.sign ? ` in ${p2.sign}` : ''}${p2?.degree != null ? ` at ${p2.degree.toFixed(1)}°` : ''}${p2?.house ? `, ${ordinal(p2.house)} house` : ''}${p2?.retrograde ? ' ℞' : ''} (${a.orb?.toFixed(1)}° orb)`;
        })
        .join('\n');

      // Build full placement lists including angles and nodes
      const fullPointList = (chartData) => {
        const pts = [...(chartData?.planets || [])];
        if (chartData?.angles) {
          if (chartData.angles.ascendant) pts.push({ name: 'Ascendant', ...chartData.angles.ascendant, house: 1 });
          if (chartData.angles.descendant) pts.push({ name: 'Descendant', ...chartData.angles.descendant, house: 7 });
          if (chartData.angles.midheaven) pts.push({ name: 'Midheaven', ...chartData.angles.midheaven, house: 10 });
          if (chartData.angles.ic) pts.push({ name: 'IC', ...chartData.angles.ic, house: 4 });
        }
        if (chartData?.nodes) {
          if (chartData.nodes.north_node) pts.push({ name: 'North Node', ...chartData.nodes.north_node });
          if (chartData.nodes.south_node) pts.push({ name: 'South Node', ...chartData.nodes.south_node });
        }
        return pts.map(p => `${p.name} in ${p.sign}${p.degree != null ? ` at ${p.degree.toFixed(1)}°` : ''}${p.house ? ` (${ordinal(p.house)}H)` : ''}${p.retrograde ? ' ℞' : ''}`).join(', ');
      };
      const chart1Planets = fullPointList(c1Data);
      const chart2Planets = fullPointList(c2Data);

      // Compute cross-house overlays — where each person's points fall in the other's houses
      const c1Cusps = c1Data?.houses || [];
      const c2Cusps = c2Data?.houses || [];
      const allPoints1 = [
        ...(c1Data?.planets || []),
        ...(c1Data?.angles?.ascendant ? [{ name: 'Ascendant', ...c1Data.angles.ascendant }] : []),
        ...(c1Data?.angles?.descendant ? [{ name: 'Descendant', ...c1Data.angles.descendant }] : []),
        ...(c1Data?.angles?.midheaven ? [{ name: 'Midheaven', ...c1Data.angles.midheaven }] : []),
        ...(c1Data?.angles?.ic ? [{ name: 'IC', ...c1Data.angles.ic }] : []),
        ...(c1Data?.nodes?.north_node ? [{ name: 'North Node', ...c1Data.nodes.north_node }] : []),
        ...(c1Data?.nodes?.south_node ? [{ name: 'South Node', ...c1Data.nodes.south_node }] : []),
      ];
      const allPoints2 = [
        ...(c2Data?.planets || []),
        ...(c2Data?.angles?.ascendant ? [{ name: 'Ascendant', ...c2Data.angles.ascendant }] : []),
        ...(c2Data?.angles?.descendant ? [{ name: 'Descendant', ...c2Data.angles.descendant }] : []),
        ...(c2Data?.angles?.midheaven ? [{ name: 'Midheaven', ...c2Data.angles.midheaven }] : []),
        ...(c2Data?.angles?.ic ? [{ name: 'IC', ...c2Data.angles.ic }] : []),
        ...(c2Data?.nodes?.north_node ? [{ name: 'North Node', ...c2Data.nodes.north_node }] : []),
        ...(c2Data?.nodes?.south_node ? [{ name: 'South Node', ...c2Data.nodes.south_node }] : []),
      ];
      const overlaysP2inP1 = allPoints2
        .map(p => ({ name: p.name, sign: p.sign, house: getHouseForLongitude(p.longitude, c1Cusps) }))
        .filter(p => p.house);
      const overlaysP1inP2 = allPoints1
        .map(p => ({ name: p.name, sign: p.sign, house: getHouseForLongitude(p.longitude, c2Cusps) }))
        .filter(p => p.house);
      const overlayText = isEvent
        ? `Event placements in ${userName}'s natal houses (where the moment's planets activate your chart):
${overlaysP2inP1.map(p => `- ${p.name} in ${p.sign} → your ${ordinal(p.house)} house`).join('\n')}`
        : `Cross-House Overlays (where each person's placements fall in the other's houses):
${partnerName}'s placements in ${userName}'s houses:
${overlaysP2inP1.map(p => `- ${partnerName}'s ${p.name} in ${p.sign} → your ${ordinal(p.house)} house`).join('\n')}
${userName}'s placements in ${partnerName}'s houses:
${overlaysP1inP2.map(p => `- your ${p.name} in ${p.sign} → ${partnerName}'s ${ordinal(p.house)} house`).join('\n')}`;

      const areas = getAreas(relationship, isEvent);
      const relLabel = relationship && relationship !== 'Other' ? relationship.toLowerCase() : (isEvent ? 'significant moment' : 'general connection');
      const pronounNote = !isEvent && partnerPronouns ? ` Refer to ${partnerName} using ${partnerPronouns} pronouns.` : '';
      const deceasedContext = !isEvent && deceased
        ? `${partnerName} has passed away${dateOfDeath ? ` on ${dateOfDeath}` : ''}. This is a soul-level reading between the living and the departed. Frame every insight through the lens of the enduring bond, remembrance, grief, and what ${partnerName}'s soul continues to teach ${userName} from beyond the veil. Speak with reverence for the transition. The relationship lives on in memory, spirit, and the lessons it forged — honor both what was lived and what remains. If the date of death is known, you may reflect on what the transition may have meant astrologically, but keep the focus on the enduring soul connection.`
        : '';

      const intro = isEvent
        ? `You are analyzing what the moment of "${partnerName}"${relationship ? ` (${relationship})` : ''} means for ${userName}. This is an event chart — a snapshot of the sky at a specific moment — compared against ${userName}'s natal chart.`
        : `You are analyzing the synastry (relationship astrology) between ${userName} and ${partnerName}. Their relationship type: ${relLabel}.${pronounNote}${deceasedContext ? `\n\n${deceasedContext}` : ''}`;

      const p1Label = isEvent ? `${userName} (natal)` : userName;
      const p2Label = isEvent ? 'At this moment' : partnerName;

      const areaIntro = isEvent
        ? `Write a synthesis organized by these key areas for this moment: ${areas.join(', ')}.`
        : `Write a relationship synthesis organized by these key areas for a ${relLabel}: ${areas.join(', ')}.`;

      const houseRule = isEvent
        ? `When referencing a house, use the planet name and house (e.g., "Mars in the 7th house"). Clarify which is natal vs at this moment — the house context reveals WHERE in life the moment is felt.`
        : `When referencing a house, use the planet name and house (e.g., "Mars in the 7th house"). Both charts' houses are provided — reference which person's house is activated when it adds depth (e.g., "${partnerName}'s Venus in your 7th house" or "your Mars falls in ${partnerName}'s 4th house"). The house context reveals WHERE in each person's life the connection is felt.`;

      const attributionRule = isEvent
        ? `Use "your" ONLY for ${userName}'s natal placements (e.g., "your Venus in Aries"). Use "at this moment" for the event's placements (e.g., "Mars at this moment in Scorpio"). Never use ambiguous "their". WRONG: "your Mars at this moment" (Mars belongs to the event, not to ${userName}). RIGHT: "Mars at this moment in Scorpio aspects your Venus in Aries".`
        : `PRONOUN ATTRIBUTION — CRITICAL:
- Use "your" ONLY for ${userName}'s placements. ${userName}'s chart is the inner/natal chart.
- Use "${partnerName}'s" for ${partnerName}'s placements.${partnerPronouns ? ` You may also use ${partnerPronouns} pronouns for ${partnerName} (e.g., "${partnerPronouns.split('/')[0]} Mars in Scorpio").` : ''}
- NEVER use bare "your" when referring to ${partnerName}'s placement. This is the most common error — always double-check.
- WRONG: "Your Venus trines your Mars" (if Mars is ${partnerName}'s, the second "your" is wrong)
- RIGHT: "Your Venus trines ${partnerName}'s Mars" or "${partnerName}'s Venus in your 7th house"
- When mentioning a house overlay, always clarify whose house: "${partnerName}'s Venus falls in your 7th house" (not "Venus in your 7th house" without context).`;

      const areaInsight = isEvent
        ? `Write a 2-3 sentence insight synthesizing the relevant aspects. Name the supporting planets, signs, aspects, and houses as evidence using the formats above. Speak directly to ${userName} about what this moment activates for them. Be specific — no generic horoscope language. Weave in house placements where they illuminate which life domain is activated.`
        : `Write a 2-3 sentence insight that synthesizes the relevant aspects into specific, actionable understanding. Name the supporting planets, signs, aspects, and houses as evidence using the formats above. Speak directly to ${userName} about how to best navigate this area with ${partnerName}. Be specific — no generic horoscope language. Weave in house placements where they illuminate which life domain is activated.${deceased ? ` Since ${partnerName} has passed, frame these insights as what the bond taught, what endures in memory, and how the soul connection continues to shape ${userName}'s path.` : ''}`;

      const overviewInstruction = isEvent
        ? `Also write a 2-sentence overview capturing the core theme of what this moment means for ${userName}.`
        : `Also write a 2-sentence overview capturing the core dynamic of this relationship — the overarching theme that defines how ${userName} and ${partnerName} connect.${deceased ? ` For a deceased loved one, speak to the eternal nature of the bond and what it continues to mean.` : ''}`;

      const prompt = `${PERSONA}

${intro}

Key placements:
- ${p1Label}: Sun in ${sun1}, Moon in ${moon1}, Rising ${asc1}, MC ${mc1}
- ${p2Label}: Sun in ${sun2}, Moon in ${moon2}, Rising ${asc2}, MC ${mc2}

Full ${isEvent ? 'placements' : 'natal placements'} (with houses):
- ${p1Label}: ${chart1Planets}
- ${p2Label}: ${chart2Planets}

Cross-chart aspects (tightest orbs first, with houses):
${aspectsList}

${overlayText}

${areaIntro}

CRITICAL FORMATTING RULES for educational reinforcement:
- When referencing an aspect${isEvent ? '' : ' between charts'}, ALWAYS use the format "Planet aspect Planet" (e.g., "Venus trine Mars", "Sun square Moon", "Mercury conjunct Mercury").
- When referencing a placement, use "Planet in Sign" (e.g., "Sun in Aries", "Moon in Taurus").
- ${houseRule}
- PRONOUN ATTRIBUTION: ${attributionRule}
- Always use full planet names: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node, South Node, Chiron, Ascendant, Descendant, Midheaven, IC.
- Always use full aspect words: conjunction, opposition, trine, square, sextile, quincunx.
- These will be automatically rendered with astrological glyphs alongside the text.

CRITICAL — NO HALLUCINATION:
- ONLY reference cross-chart aspects from the list provided above. Do NOT invent or reference any aspect that is not in the provided list.
- ONLY reference placements (planet, sign, house) from the data provided above. Do NOT invent signs, houses, or planetary positions not listed.
- ONLY reference house overlays from the Cross-House Overlays list above. NEVER invent where a planet falls in the other person's houses — always use the exact overlay data provided. If you mention "X falls in your Yth house", it MUST come from the overlay list.
- If an area has no relevant aspects from the provided list, acknowledge this directly rather than fabricating supporting aspects.
- Do NOT reference retrograde status (℞) unless it is explicitly marked in the data above. If a planet is not marked retrograde, it is direct.
- Do NOT invent specific degree positions. If referencing a degree, it must match the data above exactly.
- Do NOT reference aspect patterns (e.g., "grand trine", "T-square", "kite") unless they are directly derivable from the aspects listed above.
- Every planet, sign, house, aspect, and retrograde status you mention MUST come from the data above.

For each area:
1. ${areaInsight}
2. List supporting aspects in "Planet1 aspect Planet2" format (e.g., "Venus trine Mars", "Sun square Moon"). Only include aspects that genuinely support the insight.

${overviewInstruction} Use the same formatting rules for referencing planets, signs, and aspects.`;

      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              overview: { type: "string", description: "2-sentence summary of the relationship's core dynamic" },
              areas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    insight: { type: "string" },
                    supporting_aspects: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          }
        });
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [cacheKey]);

  if (loading) {
    return (
      <div className="celestial-card p-4">
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          <div className="text-lg text-gold-accent animate-pulse" style={GLYPH_STYLE}>✦</div>
          <Loader2 size={14} className="animate-spin text-gold-primary" />
          <p className="font-body text-xs text-brass italic">Synthesizing your connection...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div className="celestial-card p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={10} className="text-gold-accent" />
          <span className="font-body text-[10px] uppercase tracking-widest text-brass/50">{isEvent ? 'Moment Overview' : 'Relationship Overview'}</span>
        </div>
        <p className="font-body text-sm text-white/85 leading-relaxed italic border-l-2 border-gold-accent/40 pl-3">
          {highlightSynthesisText(data.overview, onAspectHighlight, 'text-gold-primary')}
        </p>
      </div>

      {/* Key areas */}
      <div className="space-y-2">
        <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 px-1">
          {isEvent
            ? (relationship && relationship !== 'Other' ? `What This ${relationship} Activates` : 'Key Themes of This Moment')
            : (relationship && relationship !== 'Other' ? `Navigating Your ${relationship} Dynamic` : 'Key Areas of Connection')}
        </p>
        <OrnamentDivider />
        {data.areas?.map((area, i) => (
          <AreaCard
            key={i}
            area={area}
            crossAspects={crossAspects}
            onAspectHighlight={onAspectHighlight}
            natalPlanets={natalPlanets}
            transitPlanets={transitPlanets}
            natalHouses={c1Data?.houses}
            transitHouses={c2Data?.houses}
            overlayName={overlayName}
            relationship={relationship}
            deceased={deceased}
            dateOfDeath={dateOfDeath}
          />
        ))}
      </div>
    </div>
  );
}