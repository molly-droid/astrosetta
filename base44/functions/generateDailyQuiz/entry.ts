/**
 * generateDailyQuiz — Creates or returns today's quiz for the authenticated user.
 * Idempotent: calling twice on the same day returns the cached quiz.
 * Tier: apprentice (template-based, varied pool), adept/maestro (LLM-assisted).
 *
 * Question variety: pulls from transit data, natal chart placements,
 * and LearningModule curriculum quiz blocks — shuffled into a fresh mix each day.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { TONE_DIRECTIVE } from '../../shared/toneDirective.ts';
import { pickBestProgress } from '../../shared/userProgress.ts';

const SIGN_GLYPHS = { Aries:'♈\uFE0E',Taurus:'♉\uFE0E',Gemini:'♊\uFE0E',Cancer:'♋\uFE0E',Leo:'♌\uFE0E',Virgo:'♍\uFE0E',Libra:'♎\uFE0E',Scorpio:'♏\uFE0E',Sagittarius:'♐\uFE0E',Capricorn:'♑\uFE0E',Aquarius:'♒\uFE0E',Pisces:'♓\uFE0E' };
const PLANET_GLYPHS = { Sun:'☉\uFE0E',Moon:'☽\uFE0E',Mercury:'☿\uFE0E',Venus:'♀\uFE0E',Mars:'♂\uFE0E',Jupiter:'♃\uFE0E',Saturn:'♄\uFE0E',Uranus:'♅\uFE0E',Neptune:'♆\uFE0E',Pluto:'♇\uFE0E',Chiron:'⚷\uFE0E' };
const ALL_SIGNS = Object.keys(SIGN_GLYPHS);
const ALL_PLANETS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const ELEMENTS = { Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',Gemini:'Air',Libra:'Air',Aquarius:'Air',Cancer:'Water',Scorpio:'Water',Pisces:'Water' };
const MODALITIES = { Aries:'Cardinal',Cancer:'Cardinal',Libra:'Cardinal',Capricorn:'Cardinal',Taurus:'Fixed',Leo:'Fixed',Scorpio:'Fixed',Aquarius:'Fixed',Gemini:'Mutable',Virgo:'Mutable',Sagittarius:'Mutable',Pisces:'Mutable' };
const SIGN_KEYWORDS = { Aries:'bold and pioneering',Taurus:'stable and sensual',Gemini:'curious and communicative',Cancer:'nurturing and intuitive',Leo:'creative and expressive',Virgo:'analytical and service-oriented',Libra:'harmonizing and relational',Scorpio:'intense and transformative',Sagittarius:'expansive and philosophical',Capricorn:'disciplined and ambitious',Aquarius:'innovative and independent',Pisces:'compassionate and mystical' };
const PLANET_KEYWORDS = { Sun:'vitality, ego, and life purpose',Moon:'emotions, instincts, and habits',Mercury:'communication, thinking, and travel',Venus:'love, beauty, and values',Mars:'drive, assertion, and desire',Jupiter:'expansion, luck, and wisdom',Saturn:'discipline, karma, and structure',Uranus:'revolution, sudden change, and liberation',Neptune:'dreams, illusion, and spirituality',Pluto:'transformation, power, and rebirth' };
const ASPECT_MEANINGS = { conjunction:'merging and intensifying',trine:'flowing harmony and ease',sextile:'opportunity and cooperation',square:'tension and challenge driving growth',opposition:'awareness through polarity and balance' };
const TRAD_RULERS = { Aries:'Mars',Taurus:'Venus',Gemini:'Mercury',Cancer:'Moon',Leo:'Sun',Virgo:'Mercury',Libra:'Venus',Scorpio:'Mars',Sagittarius:'Jupiter',Capricorn:'Saturn',Aquarius:'Saturn',Pisces:'Jupiter' };
const HOUSE_THEMES = { 1:'identity and self',2:'money and values',3:'communication and learning',4:'home and family',5:'creativity and romance',6:'health and daily routines',7:'partnerships',8:'transformation and shared resources',9:'philosophy and travel',10:'career and public standing',11:'friendships and community',12:'solitude and spirituality' };
const ELEMENT_GLYPHS = { Fire: '🜂', Earth: '🜃', Air: '🜁', Water: '🜄' };
const ELEMENT_MEANINGS = { Fire:'enthusiasm, action, and creative spark',Earth:'groundedness, practicality, and material focus',Air:'intellect, communication, and social connection',Water:'emotion, intuition, and deep feeling' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWrong(correct, pool, count) {
  return shuffle(pool.filter(x => x !== correct)).slice(0, count);
}

function makeOptions(correct, pool, count = 4) {
  const wrongs = pickWrong(correct, pool, count - 1);
  const opts = shuffle([correct, ...wrongs]);
  return { options: opts, correct_index: opts.indexOf(correct) };
}

// ── Transit-based question generators ────────────────────────────────────────
// Each returns a single question object or null.

function qPlanetGlyphFromTransit(transitPlanets, usedPlanets) {
  const pool = (transitPlanets || []).filter(p => p.sign && !usedPlanets.has(p.name));
  if (!pool.length) return null;
  const tp = pool[Math.floor(Math.random() * Math.min(6, pool.length))];
  usedPlanets.add(tp.name);
  const correctGlyph = PLANET_GLYPHS[tp.name];
  const signGlyph = SIGN_GLYPHS[tp.sign];
  const { options, correct_index } = makeOptions(tp.name, ALL_PLANETS);
  return {
    type: 'planet_glyph_id',
    question: `You see this symbol in a transit chart: "${correctGlyph} → ${signGlyph}". Which planet is moving through ${tp.sign}?`,
    options, correct_index,
    explanation: `${correctGlyph} is the symbol for ${tp.name}. Right now, ${tp.name} is transiting through ${tp.sign}, bringing ${PLANET_KEYWORDS[tp.name]?.split(',')[0] || 'its energy'} into ${tp.sign}'s territory.`,
    learn: { subject_key: tp.name.toLowerCase(), section: 'planets', title: tp.name }
  };
}

function qTransitSignId(transitPlanets, usedPlanets) {
  const pool = (transitPlanets || []).filter(p => p.sign && !usedPlanets.has(p.name));
  if (!pool.length) return null;
  const tp = pool[Math.floor(Math.random() * Math.min(6, pool.length))];
  usedPlanets.add(tp.name);
  const signGlyph = SIGN_GLYPHS[tp.sign];
  const wrongSigns = shuffle(ALL_SIGNS.filter(s => s !== tp.sign)).slice(0, 3);
  const allOpts = shuffle([tp.sign, ...wrongSigns]);
  return {
    type: 'transit_sign_id',
    question: `The transit chart shows ${PLANET_GLYPHS[tp.name] || tp.name} in ${signGlyph}. ${tp.name} is currently transiting — which sign is it moving through?`,
    options: allOpts,
    correct_index: allOpts.indexOf(tp.sign),
    explanation: `${tp.name} is moving through ${tp.sign} ${signGlyph} right now. ${tp.sign} is known for being ${SIGN_KEYWORDS[tp.sign]}.`,
    learn: { subject_key: tp.sign.toLowerCase(), section: 'signs', title: tp.sign }
  };
}

function qRetrograde(transitPlanets) {
  const retroPlanets = (transitPlanets || []).filter(p => p.retrograde && p.name !== 'North Node' && p.name !== 'South Node');
  if (retroPlanets.length > 0) {
    const rp = retroPlanets[Math.floor(Math.random() * retroPlanets.length)];
    const correctAnswer = `${rp.name} appears to move backward in the sky from Earth's perspective`;
    const allOpts = shuffle([
      `${rp.name} is moving faster through ${rp.sign} than usual`,
      correctAnswer,
      `${rp.name} has just entered a new sign`,
      `${rp.name} is at its closest point to Earth`
    ]);
    return {
      type: 'retrograde_live',
      question: `In today's sky, ${PLANET_GLYPHS[rp.name] || rp.name} ${rp.name} appears with an "Rx" symbol in ${rp.sign}. What does the Rx symbol mean?`,
      options: allOpts,
      correct_index: allOpts.indexOf(correctAnswer),
      explanation: `Rx means retrograde — an optical illusion where ${rp.name} appears to move backward as Earth passes it in orbit. Astrologers associate this with reviewing themes of ${PLANET_KEYWORDS[rp.name]?.split(',')[0] || 'its domain'}.`,
      learn: { subject_key: 'retrograde_planets', section: 'dynamics', title: 'Retrograde Planets' }
    };
  }
  const tp = transitPlanets?.[0];
  const correctAnswer = 'The planet appears to move backward from Earth\'s perspective';
  const allOpts = shuffle([
    'The planet is moving faster than usual',
    'The planet has just entered a new sign',
    correctAnswer,
    'The planet is at its brightest and closest to Earth'
  ]);
  return {
    type: 'retrograde_definition',
    question: tp
      ? `If you saw ${PLANET_GLYPHS[tp.name] || tp.name} ${tp.name} marked "Rx" in a transit chart, what would that indicate?`
      : 'In a transit chart, what does the "Rx" symbol next to a planet indicate?',
    options: allOpts,
    correct_index: allOpts.indexOf(correctAnswer),
    explanation: `Rx (retrograde) is an optical illusion caused by the relative orbital speeds of Earth and other planets. Astrologers associate retrograde periods with review, reflection, and revisiting unresolved themes.`,
    learn: { subject_key: 'retrograde_planets', section: 'dynamics', title: 'Retrograde Planets' }
  };
}

function qSignGlyph(transitPlanets, usedPlanets) {
  const tp = (transitPlanets || []).find(p => p.sign && !usedPlanets.has(p.name));
  const signForGlyph = tp ? tp.sign : ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
  if (tp) usedPlanets.add(tp.name);
  const { options, correct_index } = makeOptions(signForGlyph, ALL_SIGNS);
  return {
    type: 'sign_glyph',
    question: tp
      ? `${tp.name} is currently transiting through this sign: ${SIGN_GLYPHS[signForGlyph]}. Which sign is it?`
      : `Which zodiac sign does this symbol represent? ${SIGN_GLYPHS[signForGlyph]}`,
    options, correct_index,
    explanation: `${SIGN_GLYPHS[signForGlyph]} is the glyph for ${signForGlyph}, a sign known for being ${SIGN_KEYWORDS[signForGlyph]}.`,
    learn: { subject_key: signForGlyph.toLowerCase(), section: 'signs', title: signForGlyph }
  };
}

function qElementOfTransit(transitPlanets, usedPlanets) {
  const tp = (transitPlanets || []).find(p => p.sign && !usedPlanets.has(p.name));
  const elemSign = tp ? tp.sign : ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
  if (tp) usedPlanets.add(tp.name);
  const correctElem = ELEMENTS[elemSign];
  const allElems = ['Fire', 'Earth', 'Air', 'Water'];
  const { options, correct_index } = makeOptions(correctElem, allElems);
  return {
    type: 'element',
    question: tp
      ? `${tp.name} is in ${elemSign} today. Which element does ${elemSign} belong to?`
      : `Which element does ${elemSign} belong to?`,
    options: options.map(e => `${ELEMENT_GLYPHS[e]} ${e}`),
    correct_index,
    explanation: `${elemSign} is a ${correctElem} ${ELEMENT_GLYPHS[correctElem]} sign. ${correctElem} signs share ${ELEMENT_MEANINGS[correctElem]}.`,
    learn: { subject_key: elemSign.toLowerCase(), section: 'signs', title: elemSign }
  };
}

function qModalityOfTransit(transitPlanets, usedPlanets) {
  const tp = (transitPlanets || []).find(p => p.sign && !usedPlanets.has(p.name));
  const sign = tp ? tp.sign : ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
  if (tp) usedPlanets.add(tp.name);
  const correctMod = MODALITIES[sign];
  const allMods = ['Cardinal', 'Fixed', 'Mutable'];
  const { options, correct_index } = makeOptions(correctMod, allMods);
  return {
    type: 'modality',
    question: tp
      ? `${tp.name} is transiting through ${sign}. What is the modality of ${sign}?`
      : `What is the modality of ${sign} ${SIGN_GLYPHS[sign]}?`,
    options, correct_index,
    explanation: `${sign} is a ${correctMod} sign. ${correctMod} signs are known for ${correctMod === 'Cardinal' ? 'initiating and starting new things' : correctMod === 'Fixed' ? 'stabilizing and sustaining what exists' : 'adapting and transitioning'}.`,
    learn: { subject_key: sign.toLowerCase(), section: 'signs', title: sign }
  };
}

function qPlanetKeyword(transitPlanets) {
  const tp = (transitPlanets || []).find(p => PLANET_KEYWORDS[p.name]);
  if (!tp) return null;
  const planet = tp.name;
  const correctKw = PLANET_KEYWORDS[planet];
  const wrongKws = shuffle(Object.entries(PLANET_KEYWORDS).filter(([k]) => k !== planet).map(([,v]) => v)).slice(0, 3);
  const allOpts = shuffle([correctKw, ...wrongKws]);
  return {
    type: 'planet_keyword',
    question: `In astrology, what does ${PLANET_GLYPHS[planet] || ''} ${planet} represent?`,
    options: allOpts,
    correct_index: allOpts.indexOf(correctKw),
    explanation: `${planet} governs ${correctKw}. It is currently transiting through ${tp.sign}.`,
    learn: { subject_key: planet.toLowerCase(), section: 'planets', title: planet }
  };
}

function qAspectMeaning(mundaneAspects) {
  if (!mundaneAspects?.length) return null;
  const asp = mundaneAspects[Math.floor(Math.random() * Math.min(3, mundaneAspects.length))];
  const correctMeaning = ASPECT_MEANINGS[asp.aspect];
  const wrongMeanings = shuffle(Object.values(ASPECT_MEANINGS).filter(m => m !== correctMeaning)).slice(0, 3);
  const allOpts = shuffle([correctMeaning, ...wrongMeanings]);
  return {
    type: 'aspect_meaning',
    question: `Today, ${asp.transit_planet} forms a ${asp.aspect} with ${asp.natal_planet}. What does a ${asp.aspect} represent?`,
    options: allOpts,
    correct_index: allOpts.indexOf(correctMeaning),
    explanation: `A ${asp.aspect} represents ${correctMeaning}. With ${asp.transit_planet} and ${asp.natal_planet}, this brings those energies into dialogue.`,
    learn: { section: 'aspects', title: 'Aspects' }
  };
}

// ── Natal chart-based question generators ─────────────────────────────────────

function qNatalElement(natalPlanets) {
  const candidates = (natalPlanets || []).filter(p => p.sign && ALL_SIGNS.includes(p.sign));
  if (!candidates.length) return null;
  const np = candidates[Math.floor(Math.random() * candidates.length)];
  const correctElem = ELEMENTS[np.sign];
  const allElems = ['Fire', 'Earth', 'Air', 'Water'];
  const { options, correct_index } = makeOptions(correctElem, allElems);
  return {
    type: 'natal_element',
    question: `In your natal chart, your ${PLANET_GLYPHS[np.name] || ''} ${np.name} is in ${np.sign} ${SIGN_GLYPHS[np.sign]}. Which element does ${np.sign} belong to?`,
    options: options.map(e => `${ELEMENT_GLYPHS[e]} ${e}`),
    correct_index,
    explanation: `${np.sign} is a ${correctElem} sign. Your ${np.name} in a ${correctElem} sign means you express ${PLANET_KEYWORDS[np.name]?.split(',')[0] || 'its energy'} through ${ELEMENT_MEANINGS[correctElem]}.`,
    learn: { subject_key: np.sign.toLowerCase(), section: 'signs', title: np.sign }
  };
}

function qNatalModality(natalPlanets) {
  const candidates = (natalPlanets || []).filter(p => p.sign && ALL_SIGNS.includes(p.sign));
  if (!candidates.length) return null;
  const np = candidates[Math.floor(Math.random() * candidates.length)];
  const correctMod = MODALITIES[np.sign];
  const allMods = ['Cardinal', 'Fixed', 'Mutable'];
  const { options, correct_index } = makeOptions(correctMod, allMods);
  return {
    type: 'natal_modality',
    question: `Your natal ${PLANET_GLYPHS[np.name] || ''} ${np.name} is in ${np.sign}. What is the modality of ${np.sign}?`,
    options, correct_index,
    explanation: `${np.sign} is a ${correctMod} sign. Your ${np.name} here expresses its energy in a ${correctMod.toLowerCase()} way.`,
    learn: { subject_key: np.sign.toLowerCase(), section: 'signs', title: np.sign }
  };
}

function qNatalHouseTheme(natalPlanets) {
  const candidates = (natalPlanets || []).filter(p => p.house && HOUSE_THEMES[p.house]);
  if (!candidates.length) return null;
  const np = candidates[Math.floor(Math.random() * candidates.length)];
  const correctTheme = HOUSE_THEMES[np.house];
  const wrongThemes = shuffle(Object.values(HOUSE_THEMES).filter(t => t !== correctTheme)).slice(0, 3);
  const allOpts = shuffle([correctTheme, ...wrongThemes]);
  return {
    type: 'natal_house_theme',
    question: `Your natal ${PLANET_GLYPHS[np.name] || ''} ${np.name} is in your ${ordinal(np.house)} house. What life area does that house govern?`,
    options: allOpts,
    correct_index: allOpts.indexOf(correctTheme),
    explanation: `The ${ordinal(np.house)} house relates to ${correctTheme}. With ${np.name} here, that's where you express ${PLANET_KEYWORDS[np.name]?.split(',')[0] || 'its energy'} in your life.`,
    learn: { subject_key: `house_${np.house}`, section: 'houses', title: `House ${np.house}` }
  };
}

function qChartRuler(ascendantSign) {
  if (!ascendantSign || !TRAD_RULERS[ascendantSign]) return null;
  const correctRuler = TRAD_RULERS[ascendantSign];
  const { options, correct_index } = makeOptions(correctRuler, ALL_PLANETS);
  return {
    type: 'chart_ruler',
    question: `Your Ascendant (rising sign) is ${ascendantSign} ${SIGN_GLYPHS[ascendantSign]}. Which planet is the traditional ruler of ${ascendantSign}?`,
    options, correct_index,
    explanation: `${correctRuler} is the traditional ruler of ${ascendantSign}. As your chart ruler, it governs your overall life direction and how you meet the world.`,
    learn: { section: 'dynamics', title: 'Chart Ruler' }
  };
}

function qNatalPlanetSignId(natalPlanets) {
  const candidates = (natalPlanets || []).filter(p => p.sign && ALL_SIGNS.includes(p.sign));
  if (!candidates.length) return null;
  const np = candidates[Math.floor(Math.random() * candidates.length)];
  const signGlyph = SIGN_GLYPHS[np.sign];
  const wrongSigns = shuffle(ALL_SIGNS.filter(s => s !== np.sign)).slice(0, 3);
  const allOpts = shuffle([np.sign, ...wrongSigns]);
  return {
    type: 'natal_planet_sign',
    question: `Your natal ${PLANET_GLYPHS[np.name] || ''} ${np.name} is in this sign: ${signGlyph}. Which sign is it?`,
    options: allOpts,
    correct_index: allOpts.indexOf(np.sign),
    explanation: `Your ${np.name} is in ${np.sign} ${signGlyph}. ${np.sign} is known for being ${SIGN_KEYWORDS[np.sign]}.`,
    learn: { subject_key: np.sign.toLowerCase(), section: 'signs', title: np.sign }
  };
}

// ── Curriculum quiz questions ─────────────────────────────────────────────────
async function getCurriculumQuestions(base44, count) {
  const modules = await base44.asServiceRole.entities.LearningModule.list('-order_index', 100);
  const quizBlocks = [];
  for (const m of modules) {
    // ModulePlayer renders non-synthesis content_blocks first, so the slide
    // index within that filtered list is what we pass as the learn target.
    const nonSyn = (m.content_blocks || []).filter(b => b.type !== 'synthesis');
    for (const block of (m.content_blocks || [])) {
      if (block.type === 'quiz' && block.question && block.options?.length >= 3 && block.answer != null && block.answer < block.options.length) {
        const blockIndex = nonSyn.findIndex(b => b === block);
        quizBlocks.push({ block, module: m, blockIndex });
      }
    }
  }
  return shuffle(quizBlocks).slice(0, count).map((item, i) => {
    const b = item.block;
    const m = item.module;
    const correctAnswer = b.options[b.answer];
    const shuffledOpts = shuffle(b.options);
    const ci = shuffledOpts.indexOf(correctAnswer);
    // Skip if correct answer can't be resolved (e.g., duplicate option text)
    if (ci === -1) return null;
    return {
      id: i + 1,
      type: 'curriculum',
      question: b.question,
      options: shuffledOpts,
      correct_index: ci,
      explanation: b.explanation || '',
      learn: { subject_key: m.subject_key, section: m.section, block_index: item.blockIndex >= 0 ? item.blockIndex : 0, title: m.title }
    };
  }).filter(Boolean);
}

// ── Apprentice quiz builder — diverse pool, randomly selected ─────────────────
function buildApprenticeQuestions(transitPlanets, mundaneAspects, natalPlanets, ascendantSign) {
  const usedPlanets = new Set();
  const pool = [];

  // Transit-based generators
  const q1 = qPlanetGlyphFromTransit(transitPlanets, usedPlanets);    if (q1) pool.push(q1);
  const q2 = qTransitSignId(transitPlanets, usedPlanets);              if (q2) pool.push(q2);
  const q3 = qRetrograde(transitPlanets);                              if (q3) pool.push(q3);
  const q4 = qSignGlyph(transitPlanets, usedPlanets);                  if (q4) pool.push(q4);
  const q5 = qElementOfTransit(transitPlanets, usedPlanets);           if (q5) pool.push(q5);
  const q6 = qModalityOfTransit(transitPlanets, usedPlanets);          if (q6) pool.push(q6);
  const q7 = qPlanetKeyword(transitPlanets);                           if (q7) pool.push(q7);
  const q8 = qAspectMeaning(mundaneAspects);                          if (q8) pool.push(q8);

  // Natal-based generators
  const n1 = qNatalElement(natalPlanets);                             if (n1) pool.push(n1);
  const n2 = qNatalModality(natalPlanets);                            if (n2) pool.push(n2);
  const n3 = qNatalHouseTheme(natalPlanets);                          if (n3) pool.push(n3);
  const n4 = qChartRuler(ascendantSign);                              if (n4) pool.push(n4);
  const n5 = qNatalPlanetSignId(natalPlanets);                        if (n5) pool.push(n5);

  // Shuffle pool and pick 5 — ensures different mix each day
  const selected = shuffle(pool).slice(0, 5);
  return selected.map((q, i) => ({ id: i + 1, ...q }));
}

// ── Adept quiz builder — LLM + curriculum + natal mix ────────────────────────
async function buildAdeptQuestions(base44, transitPlanets, natalPlanets, mundaneAspects, ascendantSign) {
  const transitContext = (transitPlanets || []).slice(0, 7).map(p => `${p.name} in ${p.sign}${p.retrograde ? ' (Rx)' : ''}`).join(', ');
  const natalContext = (natalPlanets || []).slice(0, 5).map(p => `${p.name} in ${p.sign} in House ${p.house}`).join(', ');
  const mundaneContext = (mundaneAspects || []).slice(0, 5).map(a => `${a.transit_planet} ${a.aspect} ${a.natal_planet}`).join(', ');

  // Pull 1 curriculum question for variety
  const curriculumQs = await getCurriculumQuestions(base44, 1);

  // Generate 3 LLM questions
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are an astrology quiz question writer for intermediate students (Adept tier).

    ${TONE_DIRECTIVE}

    Current sky (transiting planets): ${transitContext}
    Today's mundane aspects (planet-to-planet in the collective sky): ${mundaneContext || 'None notable'}
    Student's natal placements: ${natalContext}
    Ascendant: ${ascendantSign || 'unknown'}

    CRITICAL — NO HALLUCINATION:
    - Use ONLY the transit positions, natal placements, and mundane aspects listed above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated.
    - Every time you mention a transiting planet, you MUST use the exact sign listed in "Current sky" above. For example, if the data says "Mars in Gemini", you must write "Mars in Gemini" — never any other sign.
    - Do NOT invent mundane aspects, natal placements, or retrograde statuses that are not explicitly listed above.
    - Do NOT reference any planetary positions, signs, or aspects other than those provided in the data above.

    Generate 3 multiple-choice quiz questions that test understanding of:
    1. What one of today's specific mundane aspects means psychologically or practically for everyone
    2. How a specific transit interacts with one of the student's natal placements
    3. A deeper concept — house themes, chart rulership, or aspect interpretation tied to their actual chart

    Each question must be clear, educational, and have exactly 4 options with one correct answer.
    Be specific — reference actual current transits and the student's natal placements where possible. Do not ask generic questions.`,
    response_json_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              correct_index: { type: 'integer' },
              explanation: { type: 'string' }
            }
          }
        }
      }
    }
  });

  const llmQuestions = (result?.questions || []).map((q, i) => ({ id: i + 1, type: 'interpretation', learn: { section: 'foundations', title: 'Foundations' }, ...q }));

  // Add 1 natal question for chart-specific variety
  const natalGenerators = [
    () => qNatalElement(natalPlanets),
    () => qNatalModality(natalPlanets),
    () => qNatalHouseTheme(natalPlanets),
    () => qChartRuler(ascendantSign),
  ].map(fn => fn()).filter(Boolean);
  const natalQ = natalGenerators.length ? { ...natalGenerators[0], id: llmQuestions.length + 1 + 1 } : null;

  // Combine: LLM questions + curriculum + natal
  const combined = [...llmQuestions];
  if (curriculumQs[0]) combined.push({ ...curriculumQs[0], id: combined.length + 1 });
  if (natalQ) combined.push(natalQ);

  if (combined.length < 3) {
    // Fallback to apprentice pool if LLM failed
    return buildApprenticeQuestions(transitPlanets, mundaneAspects, natalPlanets, ascendantSign);
  }
  return combined.slice(0, 5);
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const quiz_mode = body.quiz_mode || 'progression';

    // Determine user's current tier
    const progRecords = await base44.entities.UserProgress.filter({ user_id: user.id });
    // Pick the highest-tier record so a stale lower-tier duplicate can never
    // shadow the user's real progress (users are never pushed back a level).
    const progress = pickBestProgress(progRecords);
    const tier = body.tier || progress?.current_tier || 'apprentice';

    // Get user's timezone date key
    const timezone = body.timezone || progress?.timezone || 'UTC';
    const now = new Date();
    const dateKey = now.toLocaleDateString('en-CA', { timeZone: timezone });

    // Check for existing quiz today
    const existing = await base44.entities.DailyQuiz.filter({ user_id: user.id, date_key: dateKey });
    if (existing.length > 0) {
      const existingQuiz = existing[0];
      if (existingQuiz.completed_at) {
        return Response.json({ quiz: existingQuiz, cached: true });
      }
      // Regenerate if stale (missing new question types or learn-target metadata)
      const hasNewTypes = (existingQuiz.questions || []).some(q => q.type === 'natal_element' || q.type === 'curriculum' || q.type === 'modality' || q.type === 'natal_house_theme');
      const hasLearn = (existingQuiz.questions || []).some(q => q.learn);
      if (hasNewTypes && hasLearn && !body.force) {
        return Response.json({ quiz: existingQuiz, cached: true });
      }
      await base44.entities.DailyQuiz.delete(existingQuiz.id);
    }

    // Get user's natal chart
    const charts = await base44.entities.Chart.filter({ user_id: user.id });
    let natalPlanets = [];
    let ascendantSign = null;
    if (charts.length > 0) {
      natalPlanets = charts[0]?.raw_data?.planets || [];
      ascendantSign = charts[0]?.raw_data?.ascendant_sign || null;
    }

    const chart = charts[0];
    const birthDate = chart?.raw_data?.birth_date || '1990-01-01';
    const birthTime = chart?.raw_data?.birth_time || '12:00:00';
    const birthLocation = chart?.raw_data?.birth_location || { latitude: 0, longitude: 0 };

    // Get today's transits
    const transitRes = await base44.functions.invoke('astroEngine', {
      chart_type: 'transit',
      birth_date: birthDate,
      birth_time: birthTime,
      birth_location: birthLocation,
      transit_date: dateKey
    });
    const transitPlanets = transitRes?.data?.transit_planets || [];

    if (transitPlanets.length === 0) {
      return Response.json({ error: 'Transit data unavailable for today. Please try again.' }, { status: 503 });
    }

    // Compute mundane aspects
    const ASPECT_ORBS = { conjunction: 8, opposition: 8, trine: 6, square: 6, sextile: 4 };
    const mundaneAspects = [];
    for (let i = 0; i < transitPlanets.length; i++) {
      for (let j = i + 1; j < transitPlanets.length; j++) {
        const p1 = transitPlanets[i];
        const p2 = transitPlanets[j];
        if (p1.longitude == null || p2.longitude == null) continue;
        let diff = Math.abs(p1.longitude - p2.longitude);
        if (diff > 180) diff = 360 - diff;
        for (const [aspectName, target] of [['conjunction',0],['opposition',180],['trine',120],['square',90],['sextile',60]]) {
          const orb = Math.abs(diff - target);
          if (orb <= (ASPECT_ORBS[aspectName] || 6)) {
            mundaneAspects.push({ transit_planet: p1.name, natal_planet: p2.name, aspect: aspectName, orb });
          }
        }
      }
    }
    mundaneAspects.sort((a, b) => a.orb - b.orb);

    // Build questions based on tier
    let questions = [];
    if (tier === 'apprentice') {
      // Pull curriculum questions and mix into the apprentice pool
      const curriculumQs = await getCurriculumQuestions(base44, 2);
      const templateQuestions = buildApprenticeQuestions(transitPlanets, mundaneAspects, natalPlanets, ascendantSign);
      // Replace 1-2 template questions with curriculum for cross-topic variety
      questions = [...templateQuestions];
      for (const cq of curriculumQs) {
        if (questions.length >= 5) {
          questions[Math.floor(Math.random() * questions.length)] = { ...cq, id: questions.length };
        } else {
          questions.push({ ...cq, id: questions.length + 1 });
        }
      }
      // Re-number IDs
      questions = questions.slice(0, 5).map((q, i) => ({ ...q, id: i + 1 }));
    } else {
      questions = await buildAdeptQuestions(base44, transitPlanets, natalPlanets, mundaneAspects, ascendantSign);
      if (questions.length < 3) {
        questions = buildApprenticeQuestions(transitPlanets, mundaneAspects, natalPlanets, ascendantSign);
      }
    }

    // Create and store the quiz
    const quiz = await base44.entities.DailyQuiz.create({
      user_id: user.id,
      date_key: dateKey,
      user_timezone: timezone,
      tier,
      quiz_mode,
      questions,
      user_answers: [],
      score: null,
      completed_at: null
    });

    return Response.json({ quiz, cached: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});