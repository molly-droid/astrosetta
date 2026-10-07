/**
 * Planner LLM tasks — the synthesis panels in apps/web/src/components/planner/*.
 * The client computes the astrological fact blocks (formatted transit lists,
 * dignities, dynamics, lunations) exactly as before and sends them as params;
 * the instruction text, output rules, and JSON schemas live here.
 *
 * All planner synthesis is Core-gated (permissions.js: free tier gets the
 * transit list and natal wheel only — no interpretations, no synthesis).
 */
import { PERSONA, TONE_DIRECTIVE, densityPromptSuffix, s, block, num, bool, LLMTaskDef } from './core.ts';

const strArray = { type: 'array', items: { type: 'string' } };

// ── DaySynthesis.jsx — the daily reading ────────────────────────────────────
const daySynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: { type: 'string' },
      personal_reading: strArray,
      personal_reading_core: strArray,
      collective_reading: strArray,
      collective_highlight: { type: 'string' },
      maximize: { type: 'string' },
      focus: { type: 'string' },
      watch: { type: 'string' },
      best_areas: strArray,
      power_planet: { type: 'string' },
      key_themes: strArray,
      dynamics_insight: { type: 'string' },
    },
    required: ['overview', 'personal_reading', 'collective_reading', 'maximize', 'focus', 'watch', 'best_areas'],
  },
  build: (p) => {
    const rulerPlanet = s(p.rulerPlanet, 40);
    const rulerVia = (Array.isArray(p.rulerActiveVia) ? p.rulerActiveVia : [])
      .filter((v) => v === 'transits' || v === 'ingress' || v === 'station');
    const rulerInstruction = rulerPlanet && rulerVia.length
      ? `⭐ CHART RULER ACTIVE: Your chart ruler ${rulerPlanet} is directly activated today (${rulerVia.join(' + ')}). Call special attention to this — chart ruler transits are personally significant because they directly activate your identity, life path, and sense of self. Weave this into your reading prominently.`
      : rulerPlanet
      ? `Your chart ruler is ${rulerPlanet}. If none of today's transits directly involve ${rulerPlanet}, you may briefly note what area of life ${rulerPlanet} governs for you (based on its natal placement), but don't force it.`
      : '';

    const lunationSection = block(p.lunationSection, 600);
    const dynamicsSection = block(p.dynamicsSection, 2000);
    const dignitySection = block(p.dignitySection, 2000);
    const mundaneSection = block(p.mundaneSection, 2000);

    return `${PERSONA}

${densityPromptSuffix(p.knowledgeDepth)}

Today: ${s(p.dateStr, 60)}
NATAL: ☉ ${s(p.sunSign, 20)} · ☽ ${s(p.moonSign, 20)}${bool(p.unknownTime) ? ' — birth time unknown: rising, houses, and angles CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output. Anchor every interpretation to planet, sign, and aspect only.' : ` · ASC ${s(p.ascSign, 20)}`}
NATAL PLACEMENTS: ${block(p.natalPlacements, 2000)}
${s(p.rulerLine, 400)}
${s(p.moonInfo, 120)}
${lunationSection ? `\nLUNAR EVENTS TODAY:\n${lunationSection}` : ''}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

=== TODAY'S TRANSITS (THIS IS THE CORE DATA TO INTERPRET) ===
PERSONAL (transit planet aspecting natal planet):
${block(p.personalTransits) || 'None today.'}

MUNDANE (transit planet aspecting another transit planet):
${block(p.mundaneTransits) || 'None today.'}

LUNAR (Moon aspecting natal planet):
${block(p.lunarTransits) || 'None today.'}

STATIONS:
${block(p.stations, 2000) || 'None today.'}

INGRESSES:
${block(p.ingresses, 2000) || 'None today.'}

=== SUPPLEMENTARY CONTEXT (secondary — do NOT let this dominate the reading) ===
${rulerInstruction}
${dynamicsSection ? `Chart dynamics note: ${dynamicsSection}` : ''}
${dignitySection ? `Dignities note: ${dignitySection}` : ''}
${mundaneSection ? `Mundane patterns note: ${mundaneSection}` : ''}

Rules:
- THE PERSONAL_READING IS ABOUT TRANSITS, NOT NATAL STRUCTURE. Every bullet in personal_reading MUST interpret a specific transit from TODAY'S TRANSITS above. Do NOT describe natal stelliums, Barbut's basket, chart patterns, or natal chart structure unless a specific transit is directly activating them. If you want to mention a stellium, you MUST first name the transit that is activating it.
- Every personal_reading bullet MUST begin by copying the exact transit label from TODAY'S TRANSITS above (which already includes transiting planet, sign, aspect, natal planet, natal sign, and house when available). If the label has no house, do NOT invent one.
- If PERSONAL transits say "None today," return an empty personal_reading array. Do NOT fill it with natal pattern descriptions.
- One bullet per transit. Do NOT combine multiple transits into one bullet.
- COVERAGE & ORDER LOCK: personal_reading MUST contain EXACTLY ONE bullet for EVERY transit listed in the PERSONAL section above, in the exact order they appear. Do not skip, add, or reorder any transit. Knowledge Density changes only the prose depth and vocabulary of each bullet — never which transits are covered.
- personal_reading_core is a SUBSET of personal_reading: include ONLY the bullets for transits whose natal target is the Sun, Moon, or Ascendant (the "Big Three"). Use the exact same label and interpretation as in personal_reading. If none of today's personal transits hit the Big Three, return an empty personal_reading_core array.
- After the label, write 2-3 sentences explaining the astrological mechanic in depth — name what the transiting planet represents (its drive/domain), how the sign it's in colors that energy, what the aspect does (flow/friction/merger), what the natal placement means in its sign and house, and the real-world life area activated. Teach the reader how the symbols combine so they learn to make their own interpretations. E.g. "Mercury in Cancer conjunction natal Chiron in Aries in your 8th house — Mercury is the mind and communication; in Cancer it speaks with emotional sensitivity and memory. A conjunction merges its energy with your natal Chiron wound in Aries (the wound to your sense of self and courage), sitting in the 8th house of shared resources and intimacy. Today, conversations can surface old pain around self-assertion within intimate or financial bonds — and naming it gently is what begins to heal it."
- Use ONLY the transit data listed above. Do NOT mention any aspects, ingresses, stations, or lunar events not listed. If a category says "None today," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are. Every time you mention a transiting planet, use the exact sign listed there.
- Use ONLY the Moon sign and phase provided above. Never substitute a different zodiac sign for the Moon.
- If a planet stations or ingresses today, mention it prominently — these are high-impact events.
- LUNAR EVENTS: If the LUNAR EVENTS TODAY section names a New Moon, Full Moon, or eclipse, you MUST mention it prominently in the overview and weave its meaning into the reading — lunations are the most visible sky events of the month and the user is reading this day specifically to understand them. Name the lunation type, the sign it falls in, and what it initiates or culminates. For eclipses, convey the added weight (a fated turning point rippling out over six months).
- LUNAR NODES: Transits to your natal North Node or South Node are karmically significant — the North Node marks your evolutionary direction and the South Node marks past-pattern comfort. When any transit aspects a node, you MUST include it in personal_reading AND name the nodal activation explicitly in the overview (e.g. "the Sun opposing your North Node..."). Never bury or omit a node transit.
- Use FULL planet names and FULL aspect names. Never use abbreviations.
- Do NOT include raw glyph symbols or the em-dash label format in your output. Write only prose.
- Do NOT include "applying" or "separating."
- PERSONALIZATION LOCK: The overview and personal_reading must feel like they belong to no one else. Every personal_reading bullet MUST name the user's natal placement it touches inside the prose — e.g. "Because your natal Mars in Scorpio sits in your 5th house, you may experience this transit Venus as..." or "With your Virgo Midheaven, you may experience this Virgo Moon as...". When the transit lands on an angle (Ascendant, Midheaven, IC, Descendant), name that angle in the sentence. If a bullet could be true for anyone with any chart, rewrite it until it couldn't.
- INVITING TONE: Speak directly to the user in warm possibility language — "you may experience," "you might notice," "for you, this can show up as." Never commands, guarantees, or collective phrasing ("everyone," "we all") in the overview or personal_reading.
- No platitudes, no generic horoscope language. Every sentence must be traceable to a specific transit configuration in the data above.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening for this person today — weave the day's personal transits and the collective sky into one coherent narrative. Name the key transit configurations and how they interact (which life areas are lit up, what the overall tone is). Speak directly to the user and name their natal reference points (e.g. "your Virgo Midheaven") where relevant. This is the headline the user reads first.",
  "personal_reading": ["TransitLabel — 2-3 sentence deep interpretation of the astrological mechanic", "..."],
  "personal_reading_core": ["Same format as personal_reading, but ONLY for transits to the natal Sun, Moon, or Ascendant. If none hit those three today, return an empty array."],
  "collective_reading": ["PlanetName in Sign aspectName PlanetName — 1 sentence on collective meaning", "..."],
  "collective_highlight": "1 sentence on single most significant mundane transit",
  "maximize": "1 action sentence tied to a specific transit",
  "focus": "1 attention sentence tied to a specific transit",
  "watch": "1 caution sentence tied to a specific transit",
  "best_areas": ["area1", "area2"],
  "power_planet": "planet name",
  "key_themes": ["theme1", "theme2", "theme3"],
  "dynamics_insight": "Only if chart dynamics activated: 1-2 sentences on how a specific transit interacts with the activated pattern. Omit if no dynamics activated."
}`;
  },
};

// ── LunarHighlight.jsx — New/Full Moon & eclipse readings ───────────────────
const lunarHighlight: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      collective: { type: 'string' },
      personal: { type: 'string' },
      ritual: { type: 'string' },
    },
    required: ['collective', 'personal', 'ritual'],
  },
  build: (p) => {
    const phase = s(p.phase, 30);
    const moonSign = s(p.moonSign, 20);
    const eclipseLabel = s(p.eclipseLabel, 60);
    const eclipseContext = eclipseLabel
      ? `This ${phase} is also a ${eclipseLabel}. Eclipses amplify and catalyze the lunation — they are fated turning points whose effects can unfold for 6+ months. Solar eclipses seed dramatic new beginnings; lunar eclipses culminate, illuminate, and release. Frame the reading through this eclipse lens with extra weight and long-arc significance.`
      : '';
    return `You are a skilled astrologer. Today is ${s(p.dateStr, 60)} and there is a ${phase} in ${moonSign}${eclipseLabel ? ' — a ' + eclipseLabel : ''}.

NATAL CHART:
Sun: ${s(p.sunSign, 20)}, Moon: ${s(p.natalMoonSign, 20)}, Rising: ${s(p.ascSign, 20)}
Planets: ${block(p.natalPlanets, 3000) || 'not provided'}
Angles: ${block(p.natalAngles, 600) || 'not provided'}
House cusps: ${block(p.natalHouses, 600) || 'not provided'}
${s(p.moonHouseContext, 200)}
${s(p.conjunctionNote, 500)}
${s(p.lunarAspectContext, 1000)}
${eclipseContext}

Write a focused reading for this ${phase} in ${moonSign}${eclipseLabel ? ', through the lens of the eclipse' : ''}.

IMPORTANT: Use ONLY the natal chart data and transit data provided above. Do NOT mention any aspects, planetary placements, or lunar events that are not explicitly listed in the data above.

Return JSON:
- collective: 2 sentences on what this ${phase} means for everyone collectively — themes, archetypes, what is illuminated/released/seeded
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. You have their full chart above — reference the specific house it activates, any natal planets OR angles (ASC/DC/MC/IC) in ${moonSign} that are being hit, and any active Moon aspects listed. Be concrete and personal, not generic.
- ritual: 1 short practical suggestion for honoring this moon phase today`;
  },
};

// ── TransitList.jsx — per-aspect-row interpretations ────────────────────────
const transitListInterpretation: LLMTaskDef = {
  gate: 'core',
  build: (p) => `${PERSONA}

${densityPromptSuffix(p.knowledgeDepth)}

${s(p.label, 300)}
Natal ${s(p.natalPlanet, 40)}: ${s(p.natalDetail, 200)}

Write 2 sentences. Sentence 1: explain the astrological mechanic — WHY this transiting planet in its current sign making this aspect to this natal planet in this house creates this effect. Name the sign and house. Sentence 2: one concrete awareness or action. No clichés, no generic horoscope language.`,
};

// ── PlanetBreakdownPopover.jsx — transiting-planet tap-through readings ─────
const planetBreakdownPersonal: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const sign = s(p.sign, 20);
    const rxNote = p.rx === true ? ' (currently retrograde)' : '';
    return `You are a concise astrologer. ${s(p.planet, 40)} is transiting through ${sign}${rxNote}, which falls in this person's ${s(p.houseContext, 80) || 'chart'}. Natal planets in ${sign}: ${s(p.natalInSign, 400) || 'none'}. In 2-3 sentences, describe how this transit personally affects them — which life area it activates and how to work with it. Be specific and practical, no clichés.`;
  },
};

const planetBreakdownCollective: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const rxNote = p.rx === true ? ' (currently retrograde)' : '';
    return `You are a concise astrologer. In 2 sentences, describe the collective energy of ${s(p.planet, 40)} transiting through ${s(p.sign, 20)}${rxNote} for everyone — the archetypal theme. Be specific and practical, no clichés.`;
  },
};

// ── PlanetTracker.jsx — planet-in-sign popover (collective) ─────────────────
const planetSignCollective: LLMTaskDef = {
  gate: 'core',
  build: (p) => {
    const rxNote = p.rx === true ? ' (currently retrograde)' : '';
    return `You are a concise astrologer. In 2 sentences, describe the energy of ${s(p.planet, 40)} transiting through ${s(p.sign, 20)}${rxNote} for the collective. Be specific and practical, no clichés.`;
  },
};

const headlineReadingSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    collective: { type: 'string' },
    personal: { type: 'string' },
    ritual: { type: 'string' },
  },
  required: ['headline', 'collective', 'personal', 'ritual'],
};

// ── IngressBanner.jsx — planet-changes-sign readings ────────────────────────
const ingressReading: LLMTaskDef = {
  gate: 'core',
  schema: headlineReadingSchema,
  build: (p) => {
    const planet = s(p.planet, 40);
    const toSign = s(p.toSign, 20);
    const ascSign = s(p.ascSign, 20);
    const action = p.action === 'is entering' || p.action === 'recently entered' ? p.action : 'enters';
    const entryHouse = num(p.entryHouse);
    const entryTheme = s(p.entryTheme, 80);
    const crossHouse = num(p.crossHouse);
    const crossTheme = s(p.crossTheme, 80);

    const rulerNote = bool(p.isChartRuler)
      ? `⭐ This is YOUR CHART RULER — ${planet} rules your ${ascSign} Ascendant. This ingress is personally significant because it directly activates your identity, life direction, and how you meet the world. Emphasize this as a personal milestone, not just a collective shift. Reference what natal house ${planet} occupies and what house it rules (the 1st house) to ground the reading.`
      : '';

    const personalHouseInstr = crossHouse
      ? `Reference BOTH houses it activates: it starts in your ${entryHouse}th house of ${entryTheme}, then as it advances through ${toSign} it crosses into your ${crossHouse}th house of ${crossTheme}. Describe what this transition means — e.g. "as it crosses into your ${crossHouse}th house, it shifts from ${entryTheme} to ${crossTheme}."`
      : `Reference the house it enters (the ${entryHouse ?? ''}th house of ${entryTheme}).`;

    return `You are a skilled astrologer. Today is ${s(p.dateStr, 60)} and ${planet} ${action} ${toSign}, leaving ${s(p.fromSign, 20)}.

NATAL CHART:
Sun: ${s(p.sunSign, 20)}, Moon: ${s(p.natalMoonSign, 20)}, Rising: ${ascSign}
Planets: ${block(p.natalPlanets, 3000) || 'not provided'}
House cusps: ${block(p.natalHouses, 600) || 'not provided'}
${s(p.houseContext, 500)}
${s(p.conjunctionNote, 500)}

${planet} will stay in ${toSign} for ${s(p.duration, 60)}.

Write a focused reading for this ${planet} ingress into ${toSign}.

IMPORTANT: Use ONLY the natal chart data and ingress data provided above. Do NOT mention any aspects or planetary placements that are not explicitly listed. Only reference natal planets in ${toSign} as listed in the conjunction note above — do not invent additional conjunctions.

${rulerNote}

Return JSON:
- headline: a short evocative title (max 6 words), e.g. "Jupiter Enters Your 9th House"
- collective: 2 sentences on what this ingress means for everyone collectively — the archetypal shift, what themes ${toSign} activates for ${planet}
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. ${personalHouseInstr} Mention any natal planets in ${toSign} that will be aspected, and what area of life is being expanded/challenged. Be concrete and personal.
- ritual: 1 short practical suggestion for working with this ingress energy`;
  },
};

// ── StationBanner.jsx — retrograde/direct station readings ──────────────────
const stationReading: LLMTaskDef = {
  gate: 'core',
  schema: headlineReadingSchema,
  build: (p) => {
    const planet = s(p.planet, 40);
    const sign = s(p.sign, 20);
    const stationType = p.stationType === 'retrograde' ? 'retrograde' : 'direct';
    const isRx = stationType === 'retrograde';
    const approaching = bool(p.approaching);
    const daysUntil = num(p.daysUntil);

    const timing = approaching
      ? `${planet} is currently ${isRx ? 'direct' : 'retrograde'} and will station ${stationType} in approximately ${daysUntil} day${daysUntil === 1 ? '' : 's'} (est. ${s(p.expectedDate, 30)}).`
      : `${planet} stations ${stationType} today.`;

    const rulerNote = bool(p.isChartRuler)
      ? `⭐ This is YOUR CHART RULER — ${planet} rules your ${s(p.ascSign, 20)} Ascendant. This station is personally significant because it directly activates your identity, life direction, and how you meet the world.`
      : '';

    return `You are a skilled astrologer. Today is ${s(p.dateStr, 60)}. ${timing}

${planet} is at ${num(p.degree)?.toFixed(1)}° in ${sign}.

NATAL CHART:
Sun: ${s(p.sunSign, 20)}, Moon: ${s(p.natalMoonSign, 20)}, Rising: ${s(p.ascSign, 20)}
Planets: ${block(p.natalPlanets, 3000) || 'not provided'}
${s(p.conjunctionNote, 500)}

${planet} will remain ${isRx ? 'retrograde' : 'direct'} for ${s(p.duration, 60)}.

Write a focused reading for this ${planet} station ${stationType}.

${approaching
  ? `Since the station is approaching in ${daysUntil} days, focus on: (1) what to prepare for, (2) what themes are already surfacing, (3) what this station will ask of the person. Frame it as a heads-up.`
  : `Since the station is happening today, focus on: (1) what this directional shift means, (2) what themes are activated now, (3) how to work with this energy.`}

IMPORTANT: Use ONLY the natal chart data provided above. Do NOT mention any aspects or placements not explicitly listed.

${rulerNote}

Return JSON:
- headline: a short evocative title (max 6 words)
- collective: 2 sentences on what this station means for everyone collectively — the archetypal shift
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. Reference which natal planets/houses are affected. Be concrete.
- ritual: 1 short practical suggestion for working with this station energy`;
  },
};

// ── WeekSynthesis.jsx — week-at-a-glance ────────────────────────────────────
const weekSynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: { type: 'string' },
      day_sentences: {
        type: 'object',
        properties: {
          '0': { type: 'string' }, '1': { type: 'string' }, '2': { type: 'string' },
          '3': { type: 'string' }, '4': { type: 'string' }, '5': { type: 'string' },
          '6': { type: 'string' },
        },
        required: ['0', '1', '2', '3', '4', '5', '6'],
        additionalProperties: false,
      },
      best_days: strArray,
      best_areas: strArray,
      maximize: { type: 'string' },
      focus: { type: 'string' },
      watch: { type: 'string' },
    },
    required: ['overview', 'day_sentences', 'best_days', 'best_areas', 'maximize', 'focus', 'watch'],
  },
  build: (p) => `${PERSONA}

Week: ${s(p.weekRange, 80)}
NATAL: ☉ ${s(p.sunSign, 20)} · ☽ ${s(p.natalMoonSign, 20)}${bool(p.unknownTime) ? ' — birth time unknown: rising, houses, and angles CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output.' : ` · ASC ${s(p.ascSign, 20)}`}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${block(p.transitPositions, 2000) || 'Data unavailable.'}

DAILY TRANSITS (slow planets ≤2.5° orb):
${block(p.dailyTransits)}

Rules:
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, or lunar events that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- For days with no personal aspects, write day_sentence about Moon sign energy + any active mundane aspects
- Never write the same energy twice across day_sentences
- Each day_sentences entry max 15 words
- When naming aspects in prose, ALWAYS write them as "PlanetName aspectName PlanetName" using FULL planet names and FULL aspect names (e.g. "Mercury conjunction Jupiter", "Mars square Saturn"). Never use abbreviations.
- Do NOT include raw glyph symbols (☉☽☿♀♂♃♄♅♆♇ etc.) or the em-dash label format in your output. Write only prose using full planet and aspect names — glyphs are added automatically by the frontend.

Return JSON:
{
  "overview": "2 sentences summarizing the week's overall energy, referencing specific transit labels",
  "day_sentences": {
    "0": "Monday sentence",
    "1": "Tuesday sentence",
    "2": "Wednesday sentence",
    "3": "Thursday sentence",
    "4": "Friday sentence",
    "5": "Saturday sentence",
    "6": "Sunday sentence"
  },
  "best_days": ["DayName", "DayName"],
  "best_areas": ["area1", "area2"],
  "maximize": "1 action sentence tied to a specific transit this week",
  "focus": "1 attention sentence tied to a specific transit this week",
  "watch": "1 caution sentence tied to a specific transit this week"
}`,
};

// ── MonthSynthesis.jsx — month-at-a-glance ──────────────────────────────────
const monthSynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: { type: 'string' },
      personal_focus: { type: 'string' },
      collective_theme: { type: 'string' },
      collective_tags: strArray,
      maximize: strArray,
      focus: { type: 'string' },
      watch: strArray,
      best_areas: strArray,
    },
    required: ['overview', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas'],
  },
  build: (p) => `You are a skilled astrologer. Write a monthly astrological synthesis for ${s(p.monthName, 40)}.

${TONE_DIRECTIVE}

NATAL CHART:
Sun: ${s(p.sunSign, 20)}, Moon: ${s(p.natalMoonSign, 20)}${bool(p.unknownTime) ? ' — birth time unknown: rising, houses, and angles CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output.' : `, Rising: ${s(p.ascSign, 20)}`}
Planets: ${block(p.natalPlanets, 3000) || 'not provided'}

${block(p.planetContext, 6000)}

Rules:
- Use ONLY the transit data provided above. Do NOT mention or reference any planetary transits, aspects, or lunations that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- The Part of Fortune (⊕, Pars Fortunae) is a calculated lot marking where ease, luck, and material opportunity express; Tyche (asteroid 258) is the lot of fortunate coincidence; Juno (asteroid 3) governs committed partnership and soul-contracts; Pallas (asteroid 2) is creative intelligence and strategy; Vesta (asteroid 4) is devotion and the inner flame. If any of these appear among the natal planets, weave them in where relevant.

Return JSON:
- overview: 2-3 sentences summarizing the overall energy of the month for this person, referencing specific slow planet transits and lunations
- personal_focus: 1-2 sentences on the most significant personal transit theme this month and which life area it activates
- collective_theme: 1 sentence on the collective/mundane backdrop for everyone
- collective_tags: array of 2-3 one-or-two-word thematic labels for the collective energy this month (e.g. ["Restructuring", "Bold Moves", "Clarity"])
- maximize: array of 3 specific opportunities or actions for this month
- focus: 1 attention sentence tied to a specific transit this month
- watch: array of 2 challenges or cautions for this month
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]`,
};

// Planner life-theme keys — mirror of apps/web/src/lib/plannerTopics.js TOPICS.
const TOPIC_KEYS = ['love', 'career', 'money', 'health', 'communication', 'creativity', 'spirituality', 'home'];
const topicDayArray = { type: 'array', items: { type: 'string', enum: TOPIC_KEYS } };

// ── PlannerWeekView.jsx — week view synthesis with day sentences/topics ─────
const plannerWeekSynthesis: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      overview: { type: 'string' },
      personal_focus: { type: 'string' },
      collective_theme: { type: 'string' },
      collective_tags: strArray,
      maximize: strArray,
      focus: { type: 'string' },
      watch: strArray,
      best_areas: strArray,
      day_sentences: {
        type: 'object',
        properties: {
          '0': { type: 'string' }, '1': { type: 'string' }, '2': { type: 'string' },
          '3': { type: 'string' }, '4': { type: 'string' }, '5': { type: 'string' },
          '6': { type: 'string' },
        },
        required: ['0', '1', '2', '3', '4', '5', '6'],
        additionalProperties: false,
      },
      day_topics: {
        type: 'object',
        properties: {
          '0': topicDayArray, '1': topicDayArray, '2': topicDayArray,
          '3': topicDayArray, '4': topicDayArray, '5': topicDayArray,
          '6': topicDayArray,
        },
      },
    },
    required: ['overview', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'focus', 'watch', 'best_areas', 'day_sentences', 'day_topics'],
  },
  build: (p) => `${PERSONA}

Week: ${s(p.weekRange, 80)}
NATAL: ☉ ${s(p.sunSign, 20)} · ☽ ${s(p.natalMoonSign, 20)}${bool(p.unknownTime) ? ' — birth time unknown: rising, houses, and angles CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output.' : ` · ASC ${s(p.ascSign, 20)}`}

DAILY TRANSITS (slow planets ≤2.5° orb):
${block(p.dailyTransits)}

Rules:
- Use ONLY the Moon sign provided in the daily transits data above. Never substitute a different zodiac sign for the Moon.
- If a day has a STATION (planet turning retrograde or direct), mention it prominently — this is a rare, high-impact event.
- If a day has an INGRESS (planet entering a new zodiac sign), mention it prominently — especially for outer planets. This is a major collective shift.
- overview: 2-3 sentences summarizing the overall energy of the week for this person, referencing specific slow planet transits and lunations
- personal_focus: 1-2 sentences on the most significant personal transit theme this week and which life area it activates
- collective_theme: 1 sentence on the collective/mundane backdrop for everyone
- collective_tags: 2-3 short thematic tags for the collective energy this week, e.g. ["Clarity", "Tension"]
- maximize: 3 specific opportunities or actions for this week
- focus: 1 attention sentence tied to a specific transit this week
- watch: 2 challenges or cautions for this week
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]
- day_sentences: one sentence per day stating the key focus or caution for that day — what to maximize, lean into, or watch out for. Max 15 words. Never repeat the same energy across days.
- day_sentences must NOT open by restating the Moon's sign or phase (never write "Moon in Leo...") — the moon's sign is displayed separately on the day card. Lead with the day's key transit, station, ingress, or lunation theme.
- day_topics: for each day, 0-3 keys from [love, career, money, health, communication, creativity, spirituality, home] representing which life themes are most activated by that day's transits or lunations. Only include a theme when a supporting transit or lunation is present that day.

Return JSON:
{
  "overview": "2-3 sentences on the overall energy of the week",
  "personal_focus": "1-2 sentences on the key personal transit theme",
  "collective_theme": "1 sentence on the collective backdrop",
  "collective_tags": ["theme1", "theme2"],
  "maximize": ["opportunity1", "opportunity2", "opportunity3"],
  "focus": "1 attention sentence tied to a specific transit this week",
  "watch": ["caution1", "caution2"],
  "best_areas": ["area1", "area2", "area3"],
  "day_sentences": {
    "0": "Sun sentence", "1": "Mon sentence", "2": "Tue sentence",
    "3": "Wed sentence", "4": "Thu sentence", "5": "Fri sentence", "6": "Sat sentence"
  }
}`,
};

// ── PlannerMonthView.jsx — bulk per-theme monthly outlooks ──────────────────
const monthTopics: LLMTaskDef = {
  gate: 'core',
  schema: {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic_key: { type: 'string', enum: TOPIC_KEYS },
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
  build: (p) => {
    const daysInMonth = num(p.daysInMonth) ?? 31;
    return `You are a professional astrologer. For ${s(p.monthName, 40)}, generate a focused monthly outlook for EACH of these life themes:\n${block(p.topicList, 800)}\n\nNATAL CHART:\nSun: ${s(p.sunSign, 20)}, Moon: ${s(p.natalMoonSign, 20)}, Rising: ${s(p.ascSign, 20)}\nPlanets: ${block(p.natalPlanets, 3000) || 'not provided'}\n\n${block(p.transitContext, 12000)}\n\nIMPORTANT: Use ONLY the actual transit positions and dates above. Do not hallucinate planet signs. Use precise aspect terms (trine, square, sextile, conjunction, opposition); never use "alignment" as a synonym for conjunction.\n\nReturn JSON with a "topics" array — one entry per theme in the list above. Each entry must include: topic_key, overview (2-3 sentences referencing specific transit dates), best_windows (short note on 2-3 date ranges), key_transits (2-3 most relevant transits copied VERBATIM from the ALL TRANSIT EVENTS list with description/date/type fields), and highlight_days (4-8 day numbers 1-${daysInMonth} that are especially powerful for this theme based on the dated transit events and lunations).`;
  },
};

export const plannerTasks: Record<string, LLMTaskDef> = {
  'planner-week-synthesis': plannerWeekSynthesis,
  'month-topics': monthTopics,
  'week-synthesis': weekSynthesis,
  'month-synthesis': monthSynthesis,
  'day-synthesis': daySynthesis,
  'lunar-highlight': lunarHighlight,
  'transit-list-interpretation': transitListInterpretation,
  'planet-breakdown-personal': planetBreakdownPersonal,
  'planet-breakdown-collective': planetBreakdownCollective,
  'planet-sign-collective': planetSignCollective,
  'ingress-reading': ingressReading,
  'station-reading': stationReading,
};
