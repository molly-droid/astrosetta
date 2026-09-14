import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getHouseName, findNatalHouseForLongitude } from '@/lib/houseUtils';
import { forceTextGlyph } from '@/lib/chartUtils';

function buildPrompt(item, chartContext) {
  const raw = chartContext?.raw_data || chartContext || {};
  const sun = raw?.sun_sign || '';
  const moon = raw?.moon_sign || '';
  const asc = raw?.ascendant_sign || '';
  const ctx = `Sun in ${sun}, Moon in ${moon}, Rising ${asc}`;

  const FORMAT = `
Format your response in clear sections using markdown:
- Start immediately with the first ### header — NO greetings, NO conversational openers (no "It's a pleasure...", "I'm happy to...", "Let's explore...", "Your chart reveals..."). Just go straight into the content.
- Use **bold** for key phrases and planet/sign names
- Use exactly 2-3 section headers. Each header MUST start with "### " (three hashes + space) followed by an emoji and title. Example of correct header format:
  ### ✨ Core Energy
  
  This is the paragraph under the header.
  
  ### 🌙 How It Shows Up
  
  This is the next paragraph.
- The "###" prefix is REQUIRED on every header line — without it, the text will not render as a header. Never output a header without "###" at the start of the line.
- Place each header on its own line with a blank line before and after it.
- For bullet lists, use standard markdown syntax: each item MUST start on its own line with "- " (hyphen + space), with a line break before the first item and between every item. Never run multiple bullets together on one line.
- NEVER use zodiac sign emojis (♈♉♊♋♌♍♎♏♐♑♒♓) — always write the sign name as a word
- Keep each paragraph tight — 3-4 sentences max
- Do not use "It's not X, it's Y" phrasing
- Write in warm, direct second person ("you/your") — these are statements, not a conversation
- Avoid generic astrology filler — be specific to the placements given
- Use ONLY the chart data explicitly provided in this prompt. Do NOT reference any planets, signs, houses, aspects, or placements other than those listed above. If information about another placement is not provided, speak to the archetype generally rather than inventing a specific placement for the user.
`;

  if (item.type === 'planet') {
    const houseName = getHouseName(item.house || item.number);
    return `You are a warm, insightful astrologer. The user has **${item.name} in ${item.sign}**, placed in the **${houseName}**${item.retrograde ? ', retrograde' : ''}. Their chart: ${ctx}.

Write a personal interpretation with these three sections:
### ✨ Core Energy
What this placement means at its core — the fundamental drive or quality it brings.

### 🌙 How It Shows Up
Specific ways this placement manifests in daily life, relationships, or self-expression.

### ⚡ Working With It
1-2 practical insights or growth edges for this placement.
${FORMAT}`;
  }

  if (item.type === 'house') {
    const houseName = getHouseName(item.number);
    return `You are a warm, insightful astrologer. The user has their **${houseName}** cusp in **${item.sign}**. Their chart: ${ctx}.

Write a personal interpretation with these three sections:
### 🏠 What This House Rules
The life themes and domains governed by this house.

### ✦ ${item.sign} Colors This Area
How having ${item.sign} on the cusp specifically shapes this life domain for them.

### 🔍 Themes to Explore
2-3 bullet points on practical themes, strengths, or questions this placement raises.
${FORMAT}`;
  }

  if (item.type === 'sign') {
    const planetsInSign = (raw?.planets || []).filter(p => p.sign === item.sign).map(p => p.name).join(', ');
    const pContext = planetsInSign ? `They have ${planetsInSign} in ${item.sign}.` : `They have no planets in ${item.sign}.`;
    return `You are a warm, insightful astrologer. Explain the **${item.sign}** archetype to this person. ${pContext} Their chart: ${ctx}.

### ✨ The ${item.sign} Archetype
Core energy, motivation, and style of this sign.

### 🌟 In Your Chart
How this sign's energy shows up specifically given their placements.

### 🔑 Key Qualities
3-4 bullet point traits or themes of ${item.sign}.
${FORMAT}`;
  }

  if (item.type === 'aspect') {
    const planets = raw?.planets || [];
    const p1Data = planets.find(p => p.name === item.planet1);
    const p2Data = planets.find(p => p.name === item.planet2);
    const p1Detail = p1Data ? `${item.planet1} in ${p1Data.sign} (${getHouseName(p1Data.house)}${p1Data.retrograde ? ', retrograde' : ''})` : item.planet1;
    const p2Detail = p2Data ? `${item.planet2} in ${p2Data.sign} (${getHouseName(p2Data.house)}${p2Data.retrograde ? ', retrograde' : ''})` : item.planet2;
    return `You are a warm, insightful astrologer. The user has **${p1Detail}** in a **${item.aspect}** with **${p2Detail}** (${item.orb?.toFixed(1)}° orb). Their Big 3: ${ctx}.

Write an interpretation with these three sections:
### ⚡ The Core Dynamic
The fundamental psychological tension or gift created by this aspect between these two planets.

### 🔄 How It Plays Out
Specific life areas, relationships, or patterns where this aspect is most visible — using the signs and houses involved.

### 🌱 Growth Edge
1-2 practical insights on how to work consciously with this aspect.
${FORMAT}`;
  }

  if (item.type === 'node') {
    const name = item.nodeType === 'north' ? 'North Node' : 'South Node';
    const opp = item.nodeType === 'north' ? 'South Node' : 'North Node';
    const oppSign = item.oppositeSign || 'the opposite sign';
    // Use the node's actual house from the chart calculator (correct for both
    // Placidus and whole sign). For old cached charts that predate the house
    // field on nodes, compute it from the node's longitude and the chart's
    // cusps — never use sign-matching, which is whole-sign logic.
    const houses = raw?.houses || [];
    const houseSystem = raw?.house_system || 'whole_sign';
    const ascendantSign = raw?.ascendant_sign || null;
    const houseNum = item.house
      || (item.longitude != null ? findNatalHouseForLongitude(item.longitude, houses, houseSystem, ascendantSign) : null);
    const houseDetail = houseNum ? ` in the ${getHouseName(houseNum)}` : '';
    return `You are a warm, insightful astrologer. The user has their **${name} in ${item.sign}**${houseDetail}. Their ${opp} is in ${oppSign}. Big 3: ${ctx}.

### 🌙 The Past Pattern (${opp} in ${oppSign})
What the ${opp} in ${oppSign} represents as ingrained tendencies and comfort zones carried from the past.

### ✨ The Soul's Direction (${name} in ${item.sign}${houseDetail})
What ${item.sign} calls them toward — the unfamiliar territory that holds the deepest growth.

### 🧭 Living the Axis
2-3 bullet points of practical, grounded ways to embody this nodal direction in everyday life.
${FORMAT}`;
  }

  return `You are a warm, insightful astrologer. Write a 2-3 paragraph interpretation for: ${JSON.stringify(item)}. Speak directly to the person. ${FORMAT}`;
}

// ── Module-level cache ─────────────────────────────────────────────────────
const interpretationCache = {};

export function clearInterpretationCache() {
  Object.keys(interpretationCache).forEach(k => delete interpretationCache[k]);
}

function makeCacheKey(item, chartContext) {
  const base = chartContext?.id ? `${chartContext.id}_${item?.key}` : item?.key;
  const houseTag = item?.house != null ? `_h${item.house}` : '';
  return `${base}${houseTag}`;
}

export function preloadInterpretation(item, chartContext) {
  const cacheKey = makeCacheKey(item, chartContext);
  if (!item?.key || interpretationCache[cacheKey]) return;
  const prompt = buildPrompt(item, chartContext);
  interpretationCache[cacheKey] = base44.integrations.Core.InvokeLLM({ prompt }).then(res => forceTextGlyph(res));
}

// ── Hook: used by InterpretCard in MyChart ─────────────────────────────────
export function useInterpretation(item, chartContext) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!item?.key) return;
    const cacheKey = makeCacheKey(item, chartContext);
    let cancelled = false;

    // Resolved string in cache → show instantly
    if (typeof interpretationCache[cacheKey] === 'string') {
      setText(interpretationCache[cacheKey]);
      setError(null);
      setLoading(false);
      return;
    }

    // Fire (or reuse an in-flight) LLM call. We do NOT permanently cache a
    // rejected promise — on error we delete it so a retry can fire fresh.
    if (!interpretationCache[cacheKey]) {
      const prompt = buildPrompt(item, chartContext);
      interpretationCache[cacheKey] = base44.integrations.Core.InvokeLLM({ prompt });
    }
    const cached = interpretationCache[cacheKey];

    setLoading(true);
    setError(null);

    Promise.resolve(cached)
      .then(res => {
        if (cancelled) return;
        const cleaned = forceTextGlyph(res);
        interpretationCache[cacheKey] = cleaned;
        setText(cleaned);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        delete interpretationCache[cacheKey]; // clear poisoned promise so retry works
        setError(err?.message || 'Unable to generate this reading');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [item?.key, retryCount]);

  const retry = () => setRetryCount(c => c + 1);
  return { text, loading, error, retry };
}

// Legacy default export kept for any remaining usages
export default function InterpretationDrawer() { return null; }