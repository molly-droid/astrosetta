/**
 * Chart-view LLM tasks — server-side prompt templates for the interpretation
 * panels in apps/web/src/components/chart/*. Each build() reproduces the
 * prompt the component previously composed client-side, byte-for-byte where
 * the same facts are supplied; the client now sends only the fact strings.
 *
 * Tier gates mirror apps/web/src/lib/permissions.js:
 *   canViewNatalInterpretations / canViewTransitInterpretations /
 *   canUseRelationship / canViewPeriodSynthesis → 'core';
 *   Big Three (Sun, Moon, Rising) deep dives stay free.
 */
import { PERSONA, densityPromptSuffix, s, block, num, bool, LLMTaskDef, Gate } from './core.ts';

// Free users get deep dives for the Big Three only (permissions.js:
// canViewBigThreeInterpretations); everything else is Core-gated.
function bigThreeGate(params: Record<string, unknown>): Gate {
  const kind = s(params.kind, 30);
  const name = s(params.name, 40);
  if (kind === 'planet' && (name === 'Sun' || name === 'Moon' || name === 'Ascendant')) return 'free';
  return 'core';
}

// ── NatalInterpretation.jsx — inline chart popover interpretations ──────────
const natalInterpretation: LLMTaskDef = {
  gate: bigThreeGate,
  build: (p) => {
    const kind = s(p.kind, 30);
    const ctx = s(p.ctx, 200);
    const name = s(p.name, 40);
    const sign = s(p.sign, 20);
    const retro = bool(p.retrograde);

    let body: string | null = null;

    if (kind === 'sky_planet') {
      body = `You are an expert astrologer. The transiting ${name} is currently at ${num(p.degree)?.toFixed(1)}° ${sign}${retro ? ', retrograde' : ''}.

CRITICAL: ${name} is in ${sign} — use ONLY this sign. Do NOT rely on your own knowledge of where planets currently are; your training data is outdated. Do NOT invent aspects, ingresses, or other planetary positions not provided in this prompt.

Write 3-4 sentences about what this transit brings — the collective energy it carries, what it activates or stirs up, and what to pay attention to while it moves through ${sign}. Be specific and insightful, not generic. No headers, no markdown, no greetings.`;
    }

    if (kind === 'planet') {
      const houseName = s(p.houseName, 40);
      const aspectList = s(p.aspectList, 600);
      body = `You are an expert astrologer writing for someone with ${ctx}.

Interpret ${name} in ${sign} in the ${houseName}${retro ? ', retrograde' : ''}${aspectList ? `, with aspects: ${aspectList}` : ''}.

Write 3-4 sentences. Cover: the core psychological drive of THIS specific placement (not generic ${name} descriptions), how it manifests practically in their daily life through the ${houseName} themes, and one growth edge or shadow potential to watch for. Be specific to ${sign} and the ${houseName}. No headers, no markdown, no greetings.`;
    }

    if (kind === 'sign') {
      const planetList = s(p.planetList, 600);
      body = `You are an expert astrologer writing for someone with ${ctx}.

Explain the ${sign} archetype${planetList ? ` — in their chart, they have ${planetList} in ${sign}` : ''}.

Write 3-4 sentences. Cover: the core motivation and style of ${sign}, how it specifically colors their chart given their placements, and one thing to be aware of about this sign's energy. Be insightful and specific, not generic. No headers, no markdown, no greetings.`;
    }

    if (kind === 'house') {
      const houseName = s(p.houseName, 40);
      const planetList = s(p.planetList, 600);
      body = `You are an expert astrologer writing for someone with ${ctx}.

Interpret the ${houseName} with ${sign} on the cusp${planetList ? `, containing ${planetList}` : ''}.

Write 3-4 sentences. Cover: the life themes and domains this house governs, how having ${sign} on the cusp specifically shapes these themes for them, and what to pay attention to in this area of life. Be specific to ${sign} and the ${houseName}. No headers, no markdown, no greetings.`;
    }

    if (kind === 'aspect') {
      const aspect = s(p.aspect, 30);
      const p1Detail = s(p.p1Detail, 150);
      const p2Detail = s(p.p2Detail, 150);
      const orb = num(p.orb);
      body = `You are an expert astrologer writing for someone with ${ctx}.

Interpret the natal ${aspect} between ${p1Detail} and ${p2Detail} (orb ${orb?.toFixed(1)}°).

Write 3-4 sentences. Cover: the core psychological dynamic this aspect creates between these specific planets in these specific signs and houses, how it tends to play out in their life, and one way to work with it consciously. Be specific — not generic aspect descriptions. No headers, no markdown, no greetings.`;
    }

    if (kind === 'transit_planet') {
      const aspects = s(p.aspects, 2000);
      body = `You are an expert astrologer. The transiting ${name} is at ${num(p.degree)?.toFixed(1)}° ${sign}${retro ? ', retrograde' : ''}.${aspects ? `\n\nThis transit is currently making these aspects to your natal chart: ${aspects}.` : ''}

CRITICAL: ${name} is in ${sign} — use ONLY this sign. Do NOT rely on your own knowledge of where planets currently are; your training data is outdated. Use ONLY the aspects listed above — do NOT invent aspects, ingresses, or other planetary positions not provided in this prompt.

Write 3-4 sentences about what this transit activates${aspects ? ' — grounded in the specific aspects above. Reference the natal planets and houses it touches' : ' and how to work with it constructively'}. Be specific to ${sign} and the nature of ${name}. No headers, no markdown, no greetings.`;
    }

    if (body == null) throw new Error(`natal-interpretation: unknown kind "${kind}"`);
    return `${PERSONA}\n\n${body}`;
  },
};

// ── InterpretationDrawer.jsx — sectioned deep-dive interpretations ──────────
const DEEP_DIVE_FORMAT = `
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

const interpretationDeepDive: LLMTaskDef = {
  gate: bigThreeGate,
  build: (p) => {
    const kind = s(p.kind, 30);
    const ctx = s(p.ctx, 200);
    const sign = s(p.sign, 20);

    if (kind === 'planet') {
      const name = s(p.name, 40);
      const houseName = s(p.houseName, 40);
      return `You are a warm, insightful astrologer. The user has **${name} in ${sign}**, placed in the **${houseName}**${bool(p.retrograde) ? ', retrograde' : ''}. Their chart: ${ctx}.

Write a personal interpretation with these three sections:
### ✨ Core Energy
What this placement means at its core — the fundamental drive or quality it brings.

### 🌙 How It Shows Up
Specific ways this placement manifests in daily life, relationships, or self-expression.

### ⚡ Working With It
1-2 practical insights or growth edges for this placement.
${DEEP_DIVE_FORMAT}`;
    }

    if (kind === 'house') {
      const houseName = s(p.houseName, 40);
      return `You are a warm, insightful astrologer. The user has their **${houseName}** cusp in **${sign}**. Their chart: ${ctx}.

Write a personal interpretation with these three sections:
### 🏠 What This House Rules
The life themes and domains governed by this house.

### ✦ ${sign} Colors This Area
How having ${sign} on the cusp specifically shapes this life domain for them.

### 🔍 Themes to Explore
2-3 bullet points on practical themes, strengths, or questions this placement raises.
${DEEP_DIVE_FORMAT}`;
    }

    if (kind === 'sign') {
      const pContext = s(p.pContext, 300);
      return `You are a warm, insightful astrologer. Explain the **${sign}** archetype to this person. ${pContext} Their chart: ${ctx}.

### ✨ The ${sign} Archetype
Core energy, motivation, and style of this sign.

### 🌟 In Your Chart
How this sign's energy shows up specifically given their placements.

### 🔑 Key Qualities
3-4 bullet point traits or themes of ${sign}.
${DEEP_DIVE_FORMAT}`;
    }

    if (kind === 'aspect') {
      const aspect = s(p.aspect, 30);
      const p1Detail = s(p.p1Detail, 150);
      const p2Detail = s(p.p2Detail, 150);
      return `You are a warm, insightful astrologer. The user has **${p1Detail}** in a **${aspect}** with **${p2Detail}** (${num(p.orb)?.toFixed(1)}° orb). Their Big 3: ${ctx}.

Write an interpretation with these three sections:
### ⚡ The Core Dynamic
The fundamental psychological tension or gift created by this aspect between these two planets.

### 🔄 How It Plays Out
Specific life areas, relationships, or patterns where this aspect is most visible — using the signs and houses involved.

### 🌱 Growth Edge
1-2 practical insights on how to work consciously with this aspect.
${DEEP_DIVE_FORMAT}`;
    }

    if (kind === 'node') {
      const name = s(p.name, 20);
      const opp = s(p.opp, 20);
      const oppSign = s(p.oppSign, 30);
      const houseDetail = s(p.houseDetail, 60);
      return `You are a warm, insightful astrologer. The user has their **${name} in ${sign}**${houseDetail}. Their ${opp} is in ${oppSign}. Big 3: ${ctx}.

### 🌙 The Past Pattern (${opp} in ${oppSign})
What the ${opp} in ${oppSign} represents as ingrained tendencies and comfort zones carried from the past.

### ✨ The Soul's Direction (${name} in ${sign}${houseDetail})
What ${sign} calls them toward — the unfamiliar territory that holds the deepest growth.

### 🧭 Living the Axis
2-3 bullet points of practical, grounded ways to embody this nodal direction in everyday life.
${DEEP_DIVE_FORMAT}`;
    }

    return `You are a warm, insightful astrologer. Write a 2-3 paragraph interpretation for: ${s(p.itemJson, 500)}. Speak directly to the person. ${DEEP_DIVE_FORMAT}`;
  },
};

// ── TransitAspectInterpretation.jsx — transit-to-natal aspect rows ──────────
const transitAspectInterpretation: LLMTaskDef = {
  gate: 'core',
  build: (p) => `${PERSONA}

${s(p.label, 300)}
Natal ${s(p.natalPlanet, 40)}: ${s(p.natalDetail, 200)}

Write 2 sentences. Be specific to the house themes. Name one concrete awareness or action. No clichés.

CRITICAL: Use ONLY the signs, houses, and aspects provided above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Do NOT invent additional aspects, signs, or planetary positions not listed in the data above.`,
};

// ── MundaneAspectInterpretation.jsx — sky-to-sky aspect rows ────────────────
const mundaneAspectInterpretation: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const tp = s(p.transitPlanet, 40);
    const op = s(p.otherPlanet, 40);
    const aspect = s(p.aspect, 30);
    const p1Sign = s(p.p1Sign, 20);
    const p2Sign = s(p.p2Sign, 20);
    return `${PERSONA}

You are an expert astrologer. The transiting ${tp}${p1Sign ? ` in ${p1Sign}` : ''} is in a ${aspect} with transiting ${op}${p2Sign ? ` in ${p2Sign}` : ''} (orb ${num(p.orb)?.toFixed(1)}°). This is a mundane/collective aspect — it affects everyone, not just one person's chart.

Write 2-3 sentences about what this sky aspect means collectively — the energy it brings to the collective consciousness, what it tends to activate or surface in the world, and what to pay attention to while it's active. Be specific to these two planets in their current signs and this aspect type. No headers, no markdown, no greetings.

CRITICAL: Use ONLY the signs provided above for these planets. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. ${tp} is in ${p1Sign} and ${op} is in ${p2Sign}. Do NOT invent additional aspects or planetary positions not listed above.`;
  },
};

// ── SynastryAspectInterpretation.jsx — cross-chart aspect rows ──────────────
const synastryAspectInterpretation: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const userName = s(p.userName, 60) || 'You';
    const overlayName = s(p.overlayName, 60) || 'Partner';
    const youInfo = s(p.youInfo, 250);
    const themInfo = s(p.themInfo, 250);
    const aspect = s(p.aspect, 30);
    const natalPlanet = s(p.natalPlanet, 40);
    const transitPlanet = s(p.transitPlanet, 40);
    const p1Sign = s(p.p1Sign, 20);
    const p2Sign = s(p.p2Sign, 20);
    const overlayInfo = s(p.overlayInfo, 300);
    const relationship = s(p.relationship, 40);
    const deceased = bool(p.deceased);
    const dateOfDeath = s(p.dateOfDeath, 30);
    const partnerPronouns = s(p.partnerPronouns, 20);

    const relContext = relationship && relationship !== 'Other'
      ? `${overlayName} is ${userName}'s ${relationship.toLowerCase()}. Frame the interpretation through the lens of a ${relationship.toLowerCase()} relationship.`
      : '';
    const deceasedContext = deceased
      ? `${overlayName} has passed away${dateOfDeath ? ` on ${dateOfDeath}` : ''}. This is a soul-level reading. Frame the insight through the lens of remembrance, the enduring bond, and what this aspect continues to mean for ${userName} now that ${overlayName} has transitioned. Speak with reverence.`
      : '';

    return `${PERSONA}

In a synastry comparison between ${userName} and ${overlayName}:
- ${userName}'s ${youInfo}  ← THIS IS ${userName.toUpperCase()}'S PLACEMENT
- ${overlayName}'s ${themInfo}  ← THIS IS ${overlayName.toUpperCase()}'S PLACEMENT
- Cross-chart aspect: ${aspect} (orb ${num(p.orb)?.toFixed(1)}°)
${overlayInfo ? `- House overlays: ${overlayInfo}` : ''}
${relContext}
${deceasedContext}

Write 2 sentences. Sentence 1: explain the relational dynamic — WHY ${overlayName}'s ${themInfo} making a ${aspect} to ${userName}'s ${youInfo} creates this pattern between them. Name the signs and houses.${overlayInfo ? ` You may reference the house overlay: ${overlayInfo}.` : ''}

PRONOUN ATTRIBUTION — CRITICAL:
- Use "your" ONLY for ${userName}'s ${natalPlanet} (the ${p1Sign || '?'} placement). Example: "your ${natalPlanet} in ${p1Sign || '?'}".
- Use "${overlayName}'s" for ${overlayName}'s ${transitPlanet} (the ${p2Sign || '?'} placement). Example: "${overlayName}'s ${transitPlanet} in ${p2Sign || '?'}".
- ${partnerPronouns ? `You may also use ${partnerPronouns} pronouns for ${overlayName} (e.g., "${partnerPronouns.split('/')[0]} ${transitPlanet}"). ` : ''}NEVER use bare "your" for ${overlayName}'s placement.
- WRONG: "Your ${transitPlanet} aspects your ${natalPlanet}" (whose is whose?)
- RIGHT: "${overlayName}'s ${transitPlanet} in ${p2Sign || '?'} ${aspect} your ${natalPlanet} in ${p1Sign || '?'}"

Sentence 2: one concrete insight about how this manifests in the relationship.${deceased ? ` Since ${overlayName} has passed, speak to what this aspect meant in life and what it continues to offer ${userName} in memory and spirit.` : ''} No clichés, no generic horoscope language. Speak directly about these two people.${relContext ? ` Speak to the ${relationship.toLowerCase()} nature of the bond.` : ''}

CRITICAL: Only reference the exact placements provided above. Do not invent signs, houses, degrees, or planetary positions not listed. Do NOT reference retrograde status unless explicitly marked (℞) in the data.${overlayInfo ? ` Only reference house overlays from the data above — never invent where a planet falls in the other's houses.` : ''}`;
  },
};

// ── MovementReading.jsx — period planet-movement readings ───────────────────
const movementReading: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const planet = s(p.planet, 40);
    const periodLabel = s(p.periodLabel, 60) || 'this period';
    const periodWord = /week/.test(periodLabel) ? 'week' : /month/.test(periodLabel) ? 'month' : 'period';
    return `${PERSONA}

You are a concise, warm astrologer. Over ${periodLabel}, ${planet} will ${bool(p.retrograde) ? 'retrograde' : 'move'} from ${s(p.startSign, 20)} to ${s(p.endSign, 20)}. ${s(p.context, 800)} In 3-4 sentences, tell the user what this means for them personally — which life areas and placements it activates, and how to work with it. Be specific and practical; no clichés or generic horoscope filler. Begin "This ${periodWord}, ${planet}". ${densityPromptSuffix(p.knowledgeDepth)}`;
  },
};

// ── SynastrySynthesis.jsx — full synastry/event-chart synthesis ─────────────
const synastrySynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: { type: 'string', description: "2-sentence summary of the relationship's core dynamic" },
      areas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            insight: { type: 'string' },
            supporting_aspects: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
  build: (p) => {
    const isEvent = bool(p.isEvent);
    const userName = s(p.userName, 60) || 'You';
    const partnerName = s(p.partnerName, 60) || 'your partner';
    const relationship = s(p.relationship, 40);
    const partnerPronouns = s(p.partnerPronouns, 20);
    const deceased = bool(p.deceased);
    const dateOfDeath = s(p.dateOfDeath, 30);
    const areas = (Array.isArray(p.areas) ? p.areas : []).map((a) => s(a, 60)).filter(Boolean);

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

    return `${PERSONA}

${intro}

Key placements:
- ${p1Label}: Sun in ${s(p.sun1, 20)}, Moon in ${s(p.moon1, 20)}, Rising ${s(p.asc1, 20)}, MC ${s(p.mc1, 20)}
- ${p2Label}: Sun in ${s(p.sun2, 20)}, Moon in ${s(p.moon2, 20)}, Rising ${s(p.asc2, 20)}, MC ${s(p.mc2, 20)}

Full ${isEvent ? 'placements' : 'natal placements'} (with houses):
- ${p1Label}: ${block(p.chart1Planets, 3000)}
- ${p2Label}: ${block(p.chart2Planets, 3000)}

Cross-chart aspects (tightest orbs first, with houses):
${block(p.aspectsList, 8000)}

${block(p.overlayText, 6000)}

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
  },
};

// ── SynastryView.jsx — per-cross-aspect drill-down (synastry or event) ──────
const synastryAspectDetail: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const isEvent = bool(p.isEvent);
    const person1Name = s(p.person1Name, 60) || 'You';
    const person2Name = s(p.person2Name, 60) || 'the other chart';
    const relationship = s(p.relationship, 40);
    const person1Planet = s(p.person1Planet, 40);
    const person2Planet = s(p.person2Planet, 40);
    const aspect = s(p.aspect, 30);
    const p1Info = s(p.p1Info, 250);
    const p2Info = s(p.p2Info, 250);
    const p1Sign = s(p.p1Sign, 20) || '?';
    const p2Sign = s(p.p2Sign, 20) || '?';
    const overlayInfo = s(p.overlayInfo, 300);
    const orbStr = num(p.orb)?.toFixed(1);

    if (isEvent) {
      return `You are a warm, insightful astrologer. ${person1Name} wants to understand the moment of "${person2Name}"${relationship ? ` (${relationship})` : ''} against their natal chart.
- ${person1Name}'s natal placement: ${p1Info}  ← THIS IS ${person1Name.toUpperCase()}'S NATAL PLACEMENT
- At this moment: ${p2Info}  ← THIS IS THE EVENT'S PLACEMENT (not ${person1Name}'s)
- Cross-chart aspect: ${aspect} (${orbStr}° orb)
${overlayInfo ? `- House overlays: ${overlayInfo}` : ''}

Write 2 sentences. Sentence 1: explain what this ${aspect} between ${person1Name}'s natal placement and the moment's placement activates. Name the signs and houses.${overlayInfo ? ` You may reference the house overlay: ${overlayInfo}.` : ''}

PRONOUN ATTRIBUTION — CRITICAL:
- Use "your" ONLY for ${person1Name}'s ${person1Planet} (the ${p1Sign} natal placement).
- Use "at this moment" for the event's ${person2Planet} (the ${p2Sign} placement). NEVER use "your" for the event's placement.
- WRONG: "Your ${person2Planet} activates your ${person1Planet}" (the ${person2Planet} is the event's, not yours)
- RIGHT: "At this moment, ${person2Planet} in ${p2Sign} ${aspect} your natal ${person1Planet} in ${p1Sign}"

Sentence 2: one concrete insight about what this moment's energy means for ${person1Name}.

CRITICAL: Only reference the exact placements provided above. Do not invent signs, houses, degrees, or planetary positions not listed. Do NOT reference retrograde status unless explicitly marked (℞) in the data.${overlayInfo ? ` Only reference house overlays from the data above — never invent where a planet falls in the other's houses.` : ''}`;
    }

    const person2Pronouns = s(p.person2Pronouns, 20);
    const person2Deceased = bool(p.person2Deceased);
    const person2DateOfDeath = s(p.person2DateOfDeath, 30);
    const relContext = relationship && relationship !== 'Other'
      ? `${person2Name} is ${person1Name}'s ${relationship.toLowerCase()}. Frame the interpretation through the lens of a ${relationship.toLowerCase()} dynamic.`
      : '';
    const pronounNote = person2Pronouns ? ` Use ${person2Pronouns} pronouns for ${person2Name}.` : '';
    const deceasedContext = person2Deceased
      ? `${person2Name} has passed away${person2DateOfDeath ? ` on ${person2DateOfDeath}` : ''}. This is a soul-level reading. Frame the insight through remembrance, the enduring bond, and what this aspect continues to mean for ${person1Name} now that ${person2Name} has transitioned. Speak with reverence.`
      : '';
    return `You are a warm, insightful relationship astrologer. In a synastry comparison between ${person1Name} and ${person2Name}:
- ${person1Name}'s placement: ${p1Info}  ← THIS IS ${person1Name.toUpperCase()}'S PLACEMENT
- ${person2Name}'s placement: ${p2Info}  ← THIS IS ${person2Name.toUpperCase()}'S PLACEMENT
- Cross-chart aspect: ${aspect} (${orbStr}° orb)
${overlayInfo ? `- House overlays: ${overlayInfo}` : ''}
${relContext}
${deceasedContext}

Write 2 sentences. Sentence 1: explain the astrological dynamic — WHY this cross-chart ${aspect} between these two placements creates this relational pattern. Name the signs and houses.${overlayInfo ? ` You may reference the house overlay: ${overlayInfo}.` : ''}

PRONOUN ATTRIBUTION — CRITICAL:
- Use "your" ONLY for ${person1Name}'s ${person1Planet} (the ${p1Sign} placement). Example: "your ${person1Planet} in ${p1Sign}".
- Use "${person2Name}'s" for ${person2Name}'s ${person2Planet} (the ${p2Sign} placement). Example: "${person2Name}'s ${person2Planet} in ${p2Sign}".
${pronounNote ? `- ${pronounNote.trim()}\n` : ''}- NEVER use bare "your" for ${person2Name}'s placement.
- WRONG: "Your ${person2Planet} aspects your ${person1Planet}" (whose is whose?)
- RIGHT: "${person2Name}'s ${person2Planet} in ${p2Sign} ${aspect} your ${person1Planet} in ${p1Sign}"

Sentence 2: one concrete insight about how this manifests in the relationship.${person2Deceased ? ` Since ${person2Name} has passed, speak to what this aspect meant in life and what it continues to offer ${person1Name} in memory and spirit.` : ''} No clichés, speak directly. Keep it specific to these placements.${relContext ? ` Speak to the ${relationship.toLowerCase()} nature of the bond.` : ''}

CRITICAL: Only reference the exact placements provided above. Do not invent signs, houses, degrees, or planetary positions not listed. Do NOT reference retrograde status unless explicitly marked (℞) in the data.${overlayInfo ? ` Only reference house overlays from the data above — never invent where a planet falls in the other's houses.` : ''}`;
  },
};

export const chartTasks: Record<string, LLMTaskDef> = {
  'synastry-synthesis': synastrySynthesis,
  'synastry-aspect-detail': synastryAspectDetail,
  'natal-interpretation': natalInterpretation,
  'interpretation-deep-dive': interpretationDeepDive,
  'transit-aspect-interpretation': transitAspectInterpretation,
  'mundane-aspect-interpretation': mundaneAspectInterpretation,
  'synastry-aspect-interpretation': synastryAspectInterpretation,
  'movement-reading': movementReading,
};
