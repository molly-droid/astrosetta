/**
 * Relationship LLM tasks — the synastry/relationship planner syntheses
 * (RelationshipDay/Week/MonthSynthesis via lib/relationshipSynthesis.js) and
 * the composite/synastry chart views. The client assembles the chart and
 * transit fact blocks exactly as before; the directives, rules, and JSON
 * schemas live here. All Core-gated (permissions.js canUseRelationship).
 */
import { PERSONA, densityPromptSuffix, s, block, LLMTaskDef } from './core.ts';

const str = { type: 'string' };
const strArray = { type: 'array', items: { type: 'string' } };

export const RELATIONSHIP_DIRECTIVE = `RELATIONSHIP LENS — SYMMETRIC, NOT ONE-SIDED:
- You are reading the period THROUGH THE RELATIONSHIP between two people. Either person's transits are fair game for the narrative — do not center one chart over the other. Weave them together.
- Frame every effect through the bond: how a transit landing on one person ripples into the connection, what it asks of the relationship, where it creates ease or friction between them.
- Use "you" for the user (the app owner) and the partner's first name for the saved chart. Never speak as if you know what either person is experiencing — keep the invitational tone from the TONE directive.
- Name BOTH people's placements when a transit activates one and connects to the other (e.g. "Saturn's square to your partner's Venus, landing on their 7th house, asks the relationship to get real about commitment").
- The static natal cross-aspects are the RELATIONSHIP'S anatomy — the wired-in chemistry. The transits are what's ACTIVATING that anatomy this period. Connect the two: a transit to one person's planet that sits in a tight cross-aspect to the other person's planet is especially charged.`;

function relLine(partnerName: string, relationship: string): string {
  return relationship && relationship !== 'Other'
    ? `${partnerName} is your ${relationship.toLowerCase()}. Frame the read through the lens of a ${relationship.toLowerCase()} bond where relevant.`
    : '';
}

// ── RelationshipDaySynthesis.jsx ────────────────────────────────────────────
const relationshipDaySynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: str,
      relationship_focus: str,
      personal_reading: strArray,
      collective_reading: strArray,
      collective_highlight: str,
      maximize: str,
      focus: str,
      watch: str,
      best_areas: strArray,
      power_planet: str,
      key_themes: strArray,
    },
    required: ['overview', 'relationship_focus', 'personal_reading', 'collective_reading', 'maximize', 'focus', 'watch', 'best_areas'],
  },
  build: (p) => {
    const partnerName = s(p.partnerName, 60) || 'your partner';
    return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Today: ${s(p.dateStr, 60)}
${relLine(partnerName, s(p.relationship, 40))}

YOUR CHART (the app user): ${s(p.userBig3, 100)}
Your planets: ${block(p.userPlanets, 2000) || 'unavailable'}

${partnerName.toUpperCase()}'S CHART: ${s(p.partnerBig3, 100)}
${partnerName}'s planets: ${block(p.partnerPlanets, 2000) || 'unavailable'}

NATAL CROSS-ASPECTS (the wired-in chemistry between you two — the relationship's anatomy):
${block(p.crossAspects, 3000)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

=== TODAY'S TRANSITS, TO EACH CHART ===
${block(p.userTransitsBlock)}

${block(p.partnerTransitsBlock)}

Rules:
- THIS IS A RELATIONSHIP READ, NOT TWO SOLO READS. Weave the two charts together symmetrically — either person's transits can lead a sentence, and every transit should be connected to what it means for the BOND.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed. If a category says "none," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are.
- Every time you name a transit, name the transiting planet, its current sign, the aspect, and the natal planet + house — in full WORDS (no glyph symbols; the frontend adds glyphs). Then explain how it lands on the relationship.
- Connect transits to the natal cross-aspects where charged: if a transit hits a planet that's in a tight cross-aspect to the other person's planet, say so — that's where the relationship gets activated.
- Use "you" for the user and "${partnerName}" (first name) for the partner. Never use bare "your" for the partner's placements.
- Do NOT include raw glyph symbols, em-dash labels, "applying," or "separating." Write only prose.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening for the relationship today — weave transits to both charts into one coherent narrative naming the key configurations and where the relationship is lit up.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme today, framed through the bond (not one person).",
  "personal_reading": ["TransitLabel (which chart it hits) — 2-3 sentence interpretation of the mechanic and how it lands on the relationship", "..."],
  "collective_reading": ["PlanetName aspectName PlanetName — 1 sentence on collective meaning", "..."],
  "collective_highlight": "1 sentence on the single most significant mundane transit",
  "maximize": "1 action sentence for the relationship today",
  "focus": "1 attention sentence for the relationship today",
  "watch": "1 caution sentence for the relationship today",
  "best_areas": ["area1", "area2"],
  "power_planet": "planet name",
  "key_themes": ["theme1", "theme2", "theme3"]
}`;
  },
};

// ── RelationshipWeekSynthesis.jsx ───────────────────────────────────────────
const relationshipWeekSynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: str,
      relationship_focus: str,
      personal_focus: str,
      collective_theme: str,
      collective_tags: strArray,
      maximize: strArray,
      focus: str,
      watch: strArray,
      best_areas: strArray,
      day_sentences: {
        type: 'object',
        properties: {
          '0': str, '1': str, '2': str, '3': str, '4': str, '5': str, '6': str,
        },
        required: ['0', '1', '2', '3', '4', '5', '6'],
        additionalProperties: false,
      },
    },
    required: ['overview', 'relationship_focus', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas', 'day_sentences'],
  },
  build: (p) => {
    const partnerName = s(p.partnerName, 60) || 'your partner';
    return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Week: ${s(p.weekRange, 100)}
${relLine(partnerName, s(p.relationship, 40))}

YOUR CHART: ${s(p.userBig3, 100)}
${partnerName.toUpperCase()}'S CHART: ${s(p.partnerBig3, 100)}

NATAL CROSS-ASPECTS (the relationship's wired-in chemistry):
${block(p.crossAspects, 3000)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

DAILY TRANSITS (slow planets, to each chart):
${block(p.dayLines)}

Rules:
- THIS IS A RELATIONSHIP READ. Weave both charts symmetrically; frame the week through the bond.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- For days with no personal aspects to either chart, write the day_sentence about Moon sign energy.
- Each day_sentences entry max 18 words. Never repeat the same energy across days.
- When naming aspects in prose, write them as "PlanetName aspectName PlanetName" using FULL names. Never abbreviations.
- Do NOT include raw glyph symbols or em-dash labels. Write only prose.

Return JSON:
{
  "overview": "2-3 sentences on the overall energy of the week for the relationship, referencing specific transits to either chart.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme this week, framed through the bond.",
  "personal_focus": "1-2 sentences on the most significant personal transit theme for the user this week.",
  "collective_theme": "1 sentence on the collective backdrop for everyone.",
  "collective_tags": ["theme1", "theme2"],
  "maximize": ["opportunity1", "opportunity2", "opportunity3"],
  "focus": "1 attention sentence tied to a specific transit this week",
  "watch": ["caution1", "caution2"],
  "best_areas": ["area1", "area2", "area3"],
  "day_sentences": {
    "0": "Sun sentence", "1": "Mon sentence", "2": "Tue sentence",
    "3": "Wed sentence", "4": "Thu sentence", "5": "Fri sentence", "6": "Sat sentence"
  }
}`;
  },
};

// ── RelationshipMonthSynthesis.jsx ──────────────────────────────────────────
const relationshipMonthSynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: str,
      relationship_focus: str,
      personal_focus: str,
      collective_theme: str,
      collective_tags: strArray,
      maximize: strArray,
      focus: str,
      watch: strArray,
      best_areas: strArray,
    },
    required: ['overview', 'relationship_focus', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas'],
  },
  build: (p) => {
    const partnerName = s(p.partnerName, 60) || 'your partner';
    const lunation = s(p.lunation, 60);
    return `${PERSONA}

${RELATIONSHIP_DIRECTIVE}

Month: ${s(p.monthName, 40)}
${relLine(partnerName, s(p.relationship, 40))}

YOUR CHART: ${s(p.userBig3, 100)}
Your planets: ${block(p.userPlanets, 2000) || 'unavailable'}

${partnerName.toUpperCase()}'S CHART: ${s(p.partnerBig3, 100)}
${partnerName}'s planets: ${block(p.partnerPlanets, 2000) || 'unavailable'}

NATAL CROSS-ASPECTS (the relationship's wired-in chemistry):
${block(p.crossAspects, 3000)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

Slow planet positions this month: ${s(p.slowPositions, 500) || 'unavailable'}
Active transits to YOUR chart: ${block(p.userActive, 3000) || 'none exact'}
Active transits to ${partnerName.toUpperCase()}'S chart: ${block(p.partnerActive, 3000) || 'none exact'}
${lunation ? `Lunation: ${lunation}` : ''}

Rules:
- THIS IS A RELATIONSHIP READ. Weave both charts symmetrically; frame the month through the bond.
- Use ONLY the transit data provided. Do NOT mention any transit, aspect, or lunation not listed.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- Connect the month's transits to the natal cross-aspects where charged.
- Do NOT include raw glyph symbols or em-dash labels. Write only prose.

Return JSON:
- overview: 2-3 sentences summarizing the month's energy for the relationship, referencing specific transits to either chart and lunations
- relationship_focus: 1-2 sentences on the single most important relationship theme this month, framed through the bond
- personal_focus: 1-2 sentences on the most significant personal transit theme for the user this month
- collective_theme: 1 sentence on the collective backdrop
- collective_tags: array of 2-3 thematic labels
- maximize: array of 3 opportunities for the relationship this month
- focus: 1 attention sentence tied to a specific transit this month
- watch: array of 2 cautions for the relationship this month
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]`;
  },
};

// ── CompositeDaySynthesis.jsx — the relationship as one composite entity ────
export const COMPOSITE_DIRECTIVE = `COMPOSITE LENS — THE RELATIONSHIP AS ONE ENTITY:
- The composite chart is the chart of the RELATIONSHIP ITSELF: a single entity born from the midpoint of two people's placements. It is NOT either person.
- Transits to the composite chart show what is ACTIVATING THE RELATIONSHIP as a whole — not either individual. Frame every effect through the relationship as the subject ("the relationship is being asked to…", "this transit lands on the relationship's Venus…").
- The composite's internal aspects are the relationship's BUILT-IN DYNAMICS — its wired-in chemistry and tension points. The transits are what's activating those dynamics now. Connect them: a transit hitting a composite planet that sits in a tight internal aspect names exactly where the relationship gets lit up.
- Use "the relationship" or "your bond with [partner name]" as the subject. Use "you" only when directly addressing the user. Never speak as if you know what either person is experiencing — keep the invitational tone from the TONE directive.
- Composite Sun = the relationship's core identity; composite Moon = the relationship's emotional climate; composite Ascendant = how the relationship presents to the world; composite Venus = how the relationship loves; composite Saturn = the relationship's structure, limits, and commitments.`;

const compositeDaySynthesis: LLMTaskDef = {
  gate: 'core',
  // Same shape as the synastry day read so the rendering component stays identical.
  schema: relationshipDaySynthesis.schema,
  build: (p) => {
    const partnerName = s(p.partnerName, 60) || 'your partner';
    return `${PERSONA}

${COMPOSITE_DIRECTIVE}

Today: ${s(p.dateStr, 60)}
Reading the relationship between you and ${partnerName} as a single composite entity.

COMPOSITE CHART (the relationship itself):
Big 3: ${s(p.compositeBig3, 100)}
Composite planets: ${block(p.compositePlanets, 2000) || 'unavailable'}

COMPOSITE INTERNAL ASPECTS (the relationship's built-in dynamics — its wired-in chemistry and tension points):
${block(p.compositeAspects, 3000)}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

=== TODAY'S TRANSITS, TO THE COMPOSITE CHART ===
${block(p.transitsBlock)}

Rules:
- THIS IS A COMPOSITE READ. The subject is the RELATIONSHIP, not either person. Frame every transit through what it activates in the relationship as a whole.
- Use ONLY the transit data listed above. Do NOT mention any aspect, ingress, station, or lunar event not listed. If a category says "none," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above.
- Every time you name a transit, name the transiting planet, its current sign, the aspect, and the composite planet + house — in full WORDS (no glyph symbols; the frontend adds glyphs). Then explain how it activates the relationship.
- Connect transits to the composite's internal aspects where charged: if a transit hits a composite planet that sits in a tight internal aspect, name it — that's where the relationship gets activated.
- Use "the relationship" or "your bond with ${partnerName}" as the subject. Never use bare "your" for either person's placements.
- Do NOT include raw glyph symbols, em-dash labels, "applying," or "separating." Write only prose.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening for the relationship today — weave transits to the composite chart into one coherent narrative naming the key configurations and where the relationship is lit up.",
  "relationship_focus": "1-2 sentences on the single most important relationship theme today, framed through the composite chart.",
  "personal_reading": ["TransitLabel — 2-3 sentence interpretation of the mechanic and how it activates the relationship's built-in dynamics", "..."],
  "collective_reading": ["PlanetName aspectName PlanetName — 1 sentence on collective meaning", "..."],
  "collective_highlight": "1 sentence on the single most significant mundane transit",
  "maximize": "1 action sentence for the relationship today",
  "focus": "1 attention sentence for the relationship today",
  "watch": "1 caution sentence for the relationship today",
  "best_areas": ["area1", "area2"],
  "power_planet": "planet name",
  "key_themes": ["theme1", "theme2", "theme3"]
}`;
  },
};

// ── SharedTransitsList.jsx — one transit hitting both charts ────────────────
const sharedTransitInterpretation: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const transitPlanet = s(p.transitPlanet, 40);
    const sign = s(p.sign, 20) || '?';
    const rx = p.retrograde === true ? ' (retrograde)' : '';
    const partnerName = s(p.partnerName, 60) || 'your partner';
    return `${PERSONA}

${densityPromptSuffix(p.knowledgeDepth)}

GROUNDING RULES:
- Use ONLY the transiting planet, signs, natal planets, houses, aspects, and orbs explicitly listed below.
- Do NOT introduce any additional planet, celestial body, aspect, sign, or house that is not listed.
- The transiting planet is ${transitPlanet} in ${sign}${rx} — do not assign it a different sign or invent its retrograde status.
- Name each natal planet and house exactly as listed; do not invent houses for placements that have none listed.

Today's transiting ${transitPlanet} in ${sign}${rx} is simultaneously:
- To you: ${block(p.userLines, 2000)}
- To ${partnerName}: ${block(p.partnerLines, 2000)}

This transit activates BOTH people's charts. Write 2-3 sentences on how this shared activation lands on the relationship dynamic — where it creates alignment, tension, or a shared theme. Frame it through the bond, not one person. Name signs and houses. No clichés, no generic horoscope language.`;
  },
};

// ── CompositeView.jsx — static composite chart reading ──────────────────────
const compositeOverview: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      essence: str,
      strengths: strArray,
      tensions: strArray,
      north_star: str,
    },
  },
  build: (p) => {
    const userName = s(p.userName, 60) || 'You';
    const partnerName = s(p.partnerName, 60) || 'your partner';
    return `You are a warm, insightful relationship astrologer. Read the COMPOSITE CHART (the midpoint of two people's charts) as the chart of the RELATIONSHIP ITSELF — a single entity, not either person.
- Composite Sun = the relationship's core identity; Moon = its emotional climate; Ascendant = how it presents to the world; Venus = how it loves; Saturn = its structure, limits, and commitments.
- The composite's internal aspects are the relationship's BUILT-IN dynamics — its wired-in chemistry and tension points.

Relationship: ${userName} and ${partnerName}.

COMPOSITE CHART:
Big 3: ${s(p.big3, 100)}
Planets: ${block(p.planetsLine, 2000) || 'unavailable'}
Internal aspects: ${block(p.aspectsLine, 3000) || 'none notable'}

Write a warm, insightful static composite reading. Frame every insight through the relationship as the subject ("the relationship...", "your bond..."). Do not speak for either person's individual experience. No raw glyph symbols.

Return JSON:
{
  "essence": "3-4 sentences on the relationship's core identity, emotional climate, and how it presents to the world",
  "strengths": ["1 sentence each — 2-3 built-in gifts of this bond"],
  "tensions": ["1 sentence each — 0-3 wired-in friction points to navigate"],
  "north_star": "1 sentence on what this relationship is here to become"
}`;
  },
};

export const relationshipTasks: Record<string, LLMTaskDef> = {
  'shared-transit-interpretation': sharedTransitInterpretation,
  'composite-overview': compositeOverview,
  'relationship-day-synthesis': relationshipDaySynthesis,
  'relationship-week-synthesis': relationshipWeekSynthesis,
  'relationship-month-synthesis': relationshipMonthSynthesis,
  'composite-day-synthesis': compositeDaySynthesis,
};
