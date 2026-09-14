import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { HOUSE_THEMES, PERSONA, highlightSynthesisText } from '@/lib/transitUtils';
import { getHouseForLongitude } from '@/lib/chartUtils';
import { Loader2 } from 'lucide-react';
import Eli5Button from '@/components/ui/Eli5Button';

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Module-level cache — switching between selections won't re-fetch
const cache = {};

/**
 * Fetches a synastry-specific interpretation for a cross-chart aspect
 * via InvokeLLM. Uses relationship language (partner names, "your" vs
 * "their") instead of transit language.
 *
 * In ChartWheel synastry mode:
 *   item.transit_planet = person 2 (overlay) planet
 *   item.natal_planet   = person 1 (inner/you) planet
 */
export default function SynastryAspectInterpretation({ item, natalPlanets, transitPlanets, natalHouses = null, transitHouses = null, overlayName = 'Partner', userName = 'You', relationship = '', deceased = false, dateOfDeath = '', partnerPronouns = '' }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = item?.key ? `${item.key}_v3` : null;

  useEffect(() => {
    if (!cacheKey) return;

    if (cache[cacheKey]) {
      setText(cache[cacheKey]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setText(null);

    const p1 = natalPlanets?.find(p => p.name === item.natal_planet);      // You
    const p2 = transitPlanets?.find(p => p.name === item.transit_planet);  // Partner
    const houseTheme = p1?.house ? HOUSE_THEMES[p1.house] || '' : '';

    const houseTheme2 = p2?.house ? HOUSE_THEMES[p2.house] || '' : '';
    const youInfo = `${item.natal_planet}${p1?.sign ? ` in ${p1.sign}` : ''}${p1?.degree != null ? ` at ${p1.degree.toFixed(1)}°` : ''}${p1?.house ? `, ${ordinal(p1.house)} house` : ''}${p1?.retrograde ? ' ℞' : ''}${houseTheme ? ` (${houseTheme})` : ''}`;
    const themInfo = `${item.transit_planet}${p2?.sign ? ` in ${p2.sign}` : ''}${p2?.degree != null ? ` at ${p2.degree.toFixed(1)}°` : ''}${p2?.house ? `, ${ordinal(p2.house)} house` : ''}${p2?.retrograde ? ' ℞' : ''}${houseTheme2 ? ` (${houseTheme2})` : ''}`;

    // Cross-house overlays: where each placement falls in the OTHER person's houses
    const p2InYourHouse = p2 ? getHouseForLongitude(p2.longitude, natalHouses) : null;
    const p1InTheirHouse = p1 ? getHouseForLongitude(p1.longitude, transitHouses) : null;
    const overlayInfo = p2InYourHouse
      ? `${overlayName}'s ${item.transit_planet} falls in your ${ordinal(p2InYourHouse)} house${p1InTheirHouse ? `; your ${item.natal_planet} falls in ${overlayName}'s ${ordinal(p1InTheirHouse)} house` : ''}`
      : '';

    const relContext = relationship && relationship !== 'Other'
      ? `${overlayName} is ${userName}'s ${relationship.toLowerCase()}. Frame the interpretation through the lens of a ${relationship.toLowerCase()} relationship.`
      : '';
    const deceasedContext = deceased
      ? `${overlayName} has passed away${dateOfDeath ? ` on ${dateOfDeath}` : ''}. This is a soul-level reading. Frame the insight through the lens of remembrance, the enduring bond, and what this aspect continues to mean for ${userName} now that ${overlayName} has transitioned. Speak with reverence.`
      : '';

    const prompt = `${PERSONA}

In a synastry comparison between ${userName} and ${overlayName}:
- ${userName}'s ${youInfo}  ← THIS IS ${userName.toUpperCase()}'S PLACEMENT
- ${overlayName}'s ${themInfo}  ← THIS IS ${overlayName.toUpperCase()}'S PLACEMENT
- Cross-chart aspect: ${item.aspect} (orb ${item.orb?.toFixed(1)}°)
${overlayInfo ? `- House overlays: ${overlayInfo}` : ''}
${relContext}
${deceasedContext}

Write 2 sentences. Sentence 1: explain the relational dynamic — WHY ${overlayName}'s ${themInfo} making a ${item.aspect} to ${userName}'s ${youInfo} creates this pattern between them. Name the signs and houses.${overlayInfo ? ` You may reference the house overlay: ${overlayInfo}.` : ''}

PRONOUN ATTRIBUTION — CRITICAL:
- Use "your" ONLY for ${userName}'s ${item.natal_planet} (the ${p1?.sign || '?'} placement). Example: "your ${item.natal_planet} in ${p1?.sign || '?'}".
- Use "${overlayName}'s" for ${overlayName}'s ${item.transit_planet} (the ${p2?.sign || '?'} placement). Example: "${overlayName}'s ${item.transit_planet} in ${p2?.sign || '?'}".
- ${partnerPronouns ? `You may also use ${partnerPronouns} pronouns for ${overlayName} (e.g., "${partnerPronouns.split('/')[0]} ${item.transit_planet}"). ` : ''}NEVER use bare "your" for ${overlayName}'s placement.
- WRONG: "Your ${item.transit_planet} aspects your ${item.natal_planet}" (whose is whose?)
- RIGHT: "${overlayName}'s ${item.transit_planet} in ${p2?.sign || '?'} ${item.aspect} your ${item.natal_planet} in ${p1?.sign || '?'}"

Sentence 2: one concrete insight about how this manifests in the relationship.${deceased ? ` Since ${overlayName} has passed, speak to what this aspect meant in life and what it continues to offer ${userName} in memory and spirit.` : ''} No clichés, no generic horoscope language. Speak directly about these two people.${relContext ? ` Speak to the ${relationship.toLowerCase()} nature of the bond.` : ''}

CRITICAL: Only reference the exact placements provided above. Do not invent signs, houses, degrees, or planetary positions not listed. Do NOT reference retrograde status unless explicitly marked (℞) in the data.${overlayInfo ? ` Only reference house overlays from the data above — never invent where a planet falls in the other's houses.` : ''}`;

    base44.integrations.Core.InvokeLLM({ prompt })
      .then(res => {
        if (!cancelled) {
          cache[cacheKey] = res;
          setText(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cacheKey, overlayName, userName, relationship, deceased, dateOfDeath, partnerPronouns]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <Loader2 size={11} className="animate-spin text-gold-primary" />
        <span className="font-body text-[10px] text-brass italic">Reading the synastry...</span>
      </div>
    );
  }

  if (!text) return null;

  const p1 = natalPlanets?.find(p => p.name === item.natal_planet);
  const p2 = transitPlanets?.find(p => p.name === item.transit_planet);
  const eli5Context = `${overlayName}'s ${item.transit_planet}${p2?.sign ? ` in ${p2.sign}` : ''} ${item.aspect} your ${item.natal_planet}${p1?.sign ? ` in ${p1.sign}` : ''}`;

  return (
    <div className="mt-1.5">
      <p className="font-body text-[11px] text-white/80 leading-snug">
        {highlightSynthesisText(text, undefined, 'text-gold-primary')}
      </p>
      <Eli5Button context={eli5Context} />
    </div>
  );
}