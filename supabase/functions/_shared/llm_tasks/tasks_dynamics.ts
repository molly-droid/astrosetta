/**
 * Chart-dynamics LLM tasks — the expandable sections of ChartDynamicsCard
 * and the TransitNatalFormationsBanner (via the useDynamicsInterpretation
 * hook). Each client section assembles its data lines ("facts") exactly as
 * before; the surrounding instructions, grounding rules, and JSON schemas
 * live here. All Core-gated: chart-dynamics deep dives are interpretation
 * content (permissions.js canViewNatalInterpretations).
 */
import { PERSONA, s, block, LLMTaskDef } from './core.ts';

const str = { type: 'string' };
const strArray = { type: 'array', items: { type: 'string' } };

const GROUNDING = 'IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT reference any planets, signs, houses, or aspects other than those listed above.';

function dynamicsTask(opts: {
  intro: string;
  grounding?: string;
  instruction: string | ((p: Record<string, unknown>) => string);
  returnJson: string;
  schema: Record<string, unknown>;
}): LLMTaskDef {
  return {
    gate: 'core',
    schema: opts.schema,
    build: (p) => {
      const instruction = typeof opts.instruction === 'function' ? opts.instruction(p) : opts.instruction;
      return `${PERSONA}

${opts.intro}

${opts.grounding ?? GROUNDING}

${block(p.facts, 4000)}

${instruction}

Return JSON:
${opts.returnJson}`;
    },
  };
}

const chartRuler = dynamicsTask({
  intro: 'Analyze the chart ruler for this person.',
  instruction: "Provide a deep interpretation of how this chart ruler shapes the person's identity, life direction, and self-expression. Reference the specific house and sign placement.",
  returnJson: `{
  "summary": "2-3 sentences on what the chart ruler placement means for identity and life direction",
  "strengths": ["strength1", "strength2"],
  "challenges": ["challenge1", "challenge2"],
  "life_theme": "1 sentence on the overarching life theme this ruler creates"
}`,
  schema: { type: 'object', properties: { summary: str, strengths: strArray, challenges: strArray, life_theme: str }, required: ['summary'] },
});

const stellium = dynamicsTask({
  intro: 'Analyze this natal stellium.',
  instruction: 'Provide a deep interpretation of what this stellium means for the person — the concentrated energy, how these planets interact, and the life area most affected.',
  returnJson: `{
  "overview": "2-3 sentences on what this stellium concentration means",
  "expression": "1-2 sentences on how this stellium expresses in daily life",
  "shadow": "1 sentence on the potential shadow/challenge of this concentration",
  "integration": "1 sentence on how to best work with this energy"
}`,
  schema: { type: 'object', properties: { overview: str, expression: str, shadow: str, integration: str }, required: ['overview'] },
});

const emptyHouse = dynamicsTask({
  intro: "Analyze a single empty house in this person's natal chart.",
  grounding: 'IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT reference any planets, signs, or houses other than those listed above.',
  instruction: "This house is empty (no natal planets in it), which means it's governed by the planet that rules its cusp sign. Explain what this empty house means for the person practically — how the ruling planet's placement shapes this life area. Be specific and personal.",
  returnJson: `{
  "how_it_shows_up": "2 sentences on how this empty house manifests in the person's life based on where its ruler is placed",
  "practical_tip": "1 sentence on how to work with this house's energy consciously"
}`,
  schema: { type: 'object', properties: { how_it_shows_up: str, practical_tip: str }, required: ['how_it_shows_up'] },
});

const emptyHousesOverview = dynamicsTask({
  intro: "Analyze the empty houses in this person's natal chart.",
  grounding: 'IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT reference any planets, signs, or houses other than those listed above.',
  instruction: "Explain how empty houses work in astrology (they are NOT inactive — they are ruled by the planet governing their cusp). Focus on the 2-3 most significant empty houses and what their ruling planet's placement reveals about that life area.",
  returnJson: `{
  "principle": "2 sentences explaining how empty houses work astrologically",
  "key_insights": ["insight about specific empty house and its ruler", "..."],
  "balance_note": "1 sentence on what the pattern of empty houses reveals about the chart's overall energy distribution"
}`,
  schema: { type: 'object', properties: { principle: str, key_insights: strArray, balance_note: str }, required: ['principle'] },
});

const elementBalance = dynamicsTask({
  intro: 'Analyze the elemental and modality balance in this natal chart.',
  grounding: 'IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT reference any planets, signs, or houses other than those listed above.',
  instruction: "Provide a deep interpretation of what this balance reveals about the person's temperament, energy, and approach to life.",
  returnJson: `{
  "temperament": "2-3 sentences on the dominant element's influence on personality",
  "strengths": ["strength1", "strength2"],
  "growth_areas": ["area1", "area2"],
  "shadow": "1 sentence on how the weakest element manifests as a blind spot",
  "modality_note": "1 sentence on what the modality balance reveals about how they initiate and sustain"
}`,
  schema: { type: 'object', properties: { temperament: str, strengths: strArray, growth_areas: strArray, shadow: str, modality_note: str }, required: ['temperament'] },
});

const PATTERN_GUIDANCE: Record<string, string> = {
  'Grand Trine': 'Focus on the flowing talent and its potential complacency.',
  'T-Square': "Focus on the apex planet's tension and the growth edge it demands.",
  'Grand Cross': 'Focus on the multi-directional pressure and the resilience it builds.',
  'Kite': 'Focus on how the opposition gives the Grand Trine direction, with the focal (apex) planet as the release point where talent turns into purpose.',
  'Mystic Rectangle': 'Focus on how the two oppositions create productive tension that the trines and sextiles channel into constructive resolution.',
  'Yod': 'Focus on the apex planet as a fated focal point requiring the integration of incompatible forces — a special mission demanding constant adjustment.',
};

const aspectPattern = dynamicsTask({
  intro: 'Analyze this natal aspect pattern.',
  grounding: "IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT invent specific aspects between the listed planets — describe the pattern's general meaning based on the pattern type and planets involved only.",
  instruction: (p) =>
    `Provide a deep interpretation of what this pattern means psychologically and practically. ${PATTERN_GUIDANCE[s(p.patternType, 40)] || 'Focus on the gifts and challenges this pattern creates, and how the planets interact within it.'}`,
  returnJson: `{
  "overview": "2-3 sentences on what this pattern represents",
  "dynamics": "1-2 sentences on how the planets interact within this pattern",
  "gift": "1 sentence on the natural talent or opportunity this pattern provides",
  "challenge": "1 sentence on the tension or growth edge this pattern creates",
  "integration": "1 sentence on how to work with this pattern constructively"
}`,
  schema: { type: 'object', properties: { overview: str, dynamics: str, gift: str, challenge: str, integration: str }, required: ['overview'] },
});

const stelliumOpposition = dynamicsTask({
  intro: 'Analyze this stellium opposition in the natal chart.',
  grounding: 'IMPORTANT: Use ONLY the data explicitly provided in this prompt. Do NOT reference any planets, signs, or houses other than those listed above.',
  instruction: 'These two signs are opposites — they represent a polarity axis. Explain how this opposition creates tension and complementarity, and how the two stelliums interact.',
  returnJson: `{
  "polarity": "2-3 sentences on what this opposition axis represents",
  "tension": "1 sentence on the core tension between the two stelliums",
  "integration": "1 sentence on how to work with this polarity constructively"
}`,
  schema: { type: 'object', properties: { polarity: str, tension: str, integration: str }, required: ['polarity'] },
});

// TransitNatalFormationsBanner — transit-activated aspect patterns.
const transitFormation: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: { overview: str, dynamics: str, opportunity: str, challenge: str, today_focus: str },
    required: ['overview'],
  },
  build: (p) => `${PERSONA}

Interpret this transit-activated aspect pattern forming TODAY against the person's natal chart.

IMPORTANT — GROUNDING RULES:
- Use ONLY the planets, signs, natal houses, aspects, and orbs explicitly listed below.
- Do NOT introduce any additional planet, celestial body, aspect, or house that is not listed.
- Natal planets show their natal house (e.g. 8H). Transiting planets have NO natal house listed — do NOT assign one.
- Do NOT invent retrograde status, degrees, or orbs beyond those provided.

${block(p.facts, 4000)}

Explain how this pattern is being activated by the transiting planet(s) today — what the formation means, how the transit triggers the natal configuration, and how the person can work with this energy in the next ~24 hours.

Return JSON:
{
  "overview": "2-3 sentences on what this pattern represents and how the transit activates it today",
  "dynamics": "1-2 sentences on how the planets interact within the pattern",
  "opportunity": "1 sentence on the specific opportunity or gift available today",
  "challenge": "1 sentence on the tension or caution to watch for today",
  "today_focus": "1 sentence on the practical way to work with this energy in the next 24 hours"
}`,
};

export const dynamicsTasks: Record<string, LLMTaskDef> = {
  'dynamics-chart-ruler': chartRuler,
  'dynamics-stellium': stellium,
  'dynamics-empty-house': emptyHouse,
  'dynamics-empty-houses-overview': emptyHousesOverview,
  'dynamics-element-balance': elementBalance,
  'dynamics-aspect-pattern': aspectPattern,
  'dynamics-stellium-opposition': stelliumOpposition,
  'transit-formation': transitFormation,
};
