/**
 * generateBonusQuiz — Generates a fresh set of 5 practice questions on demand.
 * Does NOT touch DailyQuiz entity. Used for bonus study rounds after daily quiz is done.
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

const SIGN_GLYPHS = { Aries:'♈',Taurus:'♉',Gemini:'♊',Cancer:'♋',Leo:'♌',Virgo:'♍',Libra:'♎',Scorpio:'♏',Sagittarius:'♐',Capricorn:'♑',Aquarius:'♒',Pisces:'♓' };
const ALL_SIGNS = Object.keys(SIGN_GLYPHS);
const ALL_PLANETS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const ELEMENTS = { Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',Gemini:'Air',Libra:'Air',Aquarius:'Air',Cancer:'Water',Scorpio:'Water',Pisces:'Water' };
const MODALITIES = { Aries:'Cardinal',Cancer:'Cardinal',Libra:'Cardinal',Capricorn:'Cardinal',Taurus:'Fixed',Leo:'Fixed',Scorpio:'Fixed',Aquarius:'Fixed',Gemini:'Mutable',Virgo:'Mutable',Sagittarius:'Mutable',Pisces:'Mutable' };
const SIGN_KEYWORDS = { Aries:'bold and pioneering',Taurus:'stable and sensual',Gemini:'curious and communicative',Cancer:'nurturing and intuitive',Leo:'creative and expressive',Virgo:'analytical and service-oriented',Libra:'harmonizing and relational',Scorpio:'intense and transformative',Sagittarius:'expansive and philosophical',Capricorn:'disciplined and ambitious',Aquarius:'innovative and independent',Pisces:'compassionate and mystical' };
const PLANET_KEYWORDS = { Sun:'vitality, ego, and life purpose',Moon:'emotions, instincts, and habits',Mercury:'communication, thinking, and travel',Venus:'love, beauty, and values',Mars:'drive, assertion, and desire',Jupiter:'expansion, luck, and wisdom',Saturn:'discipline, karma, and structure',Uranus:'revolution, sudden change, and liberation',Neptune:'dreams, illusion, and spirituality',Pluto:'transformation, power, and rebirth' };
const ASPECT_MEANINGS = { conjunction:'merging and intensifying',trine:'flowing harmony and ease',sextile:'opportunity and cooperation',square:'tension and challenge driving growth',opposition:'awareness through polarity and balance' };
const HOUSE_MEANINGS = { 1:'self, appearance, and identity',2:'values, money, and possessions',3:'communication, siblings, and short travel',4:'home, family, and roots',5:'creativity, romance, and play',6:'health, daily work, and service',7:'partnerships and open enemies',8:'transformation, shared resources, and death/rebirth',9:'philosophy, higher learning, and long travel',10:'career, reputation, and public life',11:'community, hopes, and friendships',12:'hidden matters, solitude, and the unconscious' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeOptions(correct, pool, count = 4) {
  const wrongs = shuffle(pool.filter(x => x !== correct)).slice(0, count - 1);
  const opts = shuffle([correct, ...wrongs]);
  return { options: opts, correct_index: opts.indexOf(correct) };
}

function buildBonusQuestions(transitPlanets, mundaneAspects, tier) {
  const questions = [];
  let id = 1;

  // Pool of question generators — pick 5 diverse ones
  const generators = shuffle([
    // Sign keywords
    () => {
      const sign = ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
      return {
        id: id++, type: 'sign_keywords',
        question: `Which phrase best describes the energy of ${sign}?`,
        options: shuffle([SIGN_KEYWORDS[sign], ...shuffle(ALL_SIGNS.filter(s => s !== sign)).slice(0,3).map(s => SIGN_KEYWORDS[s])]),
        get correct_index() { return this.options.indexOf(SIGN_KEYWORDS[sign]); },
        explanation: `${sign} is known for being ${SIGN_KEYWORDS[sign]}.`
      };
    },
    // Element of a sign
    () => {
      const sign = transitPlanets?.find(p => p.sign)?.sign || ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
      const elem = ELEMENTS[sign];
      const { options, correct_index } = makeOptions(elem, ['Fire','Earth','Air','Water']);
      return { id: id++, type: 'element', question: `${sign} belongs to which element?`, options, correct_index, explanation: `${sign} is a ${elem} sign.` };
    },
    // Modality of a sign
    () => {
      const sign = ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
      const mod = MODALITIES[sign];
      const { options, correct_index } = makeOptions(mod, ['Cardinal','Fixed','Mutable']);
      return { id: id++, type: 'modality', question: `What modality is ${sign}?`, options, correct_index, explanation: `${sign} is a ${mod} sign. ${mod} signs are ${mod === 'Cardinal' ? 'initiators who start new cycles' : mod === 'Fixed' ? 'stabilizers who sustain and commit' : 'adapters who bridge and transition'}.` };
    },
    // Planet glyph
    () => {
      const planet = ALL_PLANETS[Math.floor(Math.random() * ALL_PLANETS.length)];
      const PLANET_GLYPHS = { Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇' };
      const { options, correct_index } = makeOptions(PLANET_GLYPHS[planet], Object.values(PLANET_GLYPHS));
      return { id: id++, type: 'planet_glyph', question: `Which symbol represents ${planet}?`, options, correct_index, explanation: `${PLANET_GLYPHS[planet]} is the glyph for ${planet}, which governs ${PLANET_KEYWORDS[planet]}.` };
    },
    // Sign glyph from today's sky
    () => {
      const src = transitPlanets?.find(p => p.sign);
      const sign = src?.sign || ALL_SIGNS[Math.floor(Math.random() * ALL_SIGNS.length)];
      const { options, correct_index } = makeOptions(sign, ALL_SIGNS);
      return { id: id++, type: 'sign_glyph', question: `Which sign does ${SIGN_GLYPHS[sign]} represent?`, options: options.map(s => s), correct_index, explanation: `${SIGN_GLYPHS[sign]} is the glyph for ${sign}, known for being ${SIGN_KEYWORDS[sign]}.` };
    },
    // Planet keywords
    () => {
      const planet = ALL_PLANETS[Math.floor(Math.random() * ALL_PLANETS.length)];
      const keyword = PLANET_KEYWORDS[planet].split(',')[0];
      const others = shuffle(ALL_PLANETS.filter(p => p !== planet)).slice(0,3).map(p => PLANET_KEYWORDS[p].split(',')[0]);
      const opts = shuffle([keyword, ...others]);
      return { id: id++, type: 'planet_keywords', question: `${planet} is most associated with which theme?`, options: opts, correct_index: opts.indexOf(keyword), explanation: `${planet} governs ${PLANET_KEYWORDS[planet]}.` };
    },
    // House meaning
    () => {
      const house = String(Math.ceil(Math.random() * 12));
      const meaning = HOUSE_MEANINGS[house];
      const others = shuffle(Object.entries(HOUSE_MEANINGS).filter(([h]) => h !== house)).slice(0,3).map(([,m]) => m);
      const opts = shuffle([meaning, ...others]);
      return { id: id++, type: 'house_meaning', question: `The ${house}${['1','21','31'].includes(house) ? 'st' : ['2','22'].includes(house) ? 'nd' : ['3','23'].includes(house) ? 'rd' : 'th'} house in astrology represents…`, options: opts, correct_index: opts.indexOf(meaning), explanation: `The ${house}th house rules ${meaning}.` };
    },
    // Aspect meaning from today's sky
    () => {
      const usable = (mundaneAspects || []).filter(a => ASPECT_MEANINGS[a.aspect?.toLowerCase()]);
      const aspect = usable.length > 0
        ? usable[Math.floor(Math.random() * usable.length)].aspect.toLowerCase()
        : Object.keys(ASPECT_MEANINGS)[Math.floor(Math.random() * 5)];
      const allAspects = Object.keys(ASPECT_MEANINGS);
      const { options, correct_index } = makeOptions(aspect, allAspects);
      return { id: id++, type: 'aspect_meaning', question: `What energy does a ${aspect} generally bring between two planets?`, options: options.map(a => `${a.charAt(0).toUpperCase() + a.slice(1)} — ${ASPECT_MEANINGS[a]}`), correct_index, explanation: `A ${aspect} brings ${ASPECT_MEANINGS[aspect]}.` };
    },
    // Current transit planet sign (if available)
    () => {
      if (!transitPlanets?.length) return null;
      const tp = transitPlanets[Math.floor(Math.random() * Math.min(7, transitPlanets.length))];
      if (!tp?.sign) return null;
      const { options, correct_index } = makeOptions(tp.sign, ALL_SIGNS);
      return { id: id++, type: 'planet_sign_live', question: `Right now, ${tp.name} is transiting through which sign?`, options, correct_index, explanation: `${tp.name} is in ${tp.sign}, bringing ${PLANET_KEYWORDS[tp.name]?.split(',')[0] || 'its energy'} a ${SIGN_KEYWORDS[tp.sign]} quality.` };
    },
  ]);

  for (const gen of generators) {
    if (questions.length >= 5) break;
    const q = gen();
    if (q) questions.push(q);
  }

  // Fix any generator that computed correct_index lazily (planet_glyph bug guard)
  return questions.map((q, i) => ({ ...q, id: i + 1 }));
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const timezone = body.timezone || 'UTC';
    const tier = body.tier || 'apprentice';

    const now = new Date();
    const dateKey = now.toLocaleDateString('en-CA', { timeZone: timezone });

    let transitPlanets = [];
    let mundaneAspects = [];
    try {
      const transitRes = await base44.functions.invoke('astroEngine', {
        chart_type: 'transit',
        birth_date: '1990-01-01',
        birth_time: '12:00:00',
        birth_location: { latitude: 0, longitude: 0 },
        transit_date: dateKey
      });
      transitPlanets = transitRes?.data?.transit_planets || [];
      const ASPECT_ORBS = { conjunction:8, opposition:8, trine:6, square:6, sextile:4 };
      for (let i = 0; i < transitPlanets.length; i++) {
        for (let j = i + 1; j < transitPlanets.length; j++) {
          const p1 = transitPlanets[i], p2 = transitPlanets[j];
          if (p1.longitude == null || p2.longitude == null) continue;
          let diff = Math.abs(p1.longitude - p2.longitude);
          if (diff > 180) diff = 360 - diff;
          for (const [name, target] of [['conjunction',0],['opposition',180],['trine',120],['square',90],['sextile',60]]) {
            const orb = Math.abs(diff - target);
            if (orb <= (ASPECT_ORBS[name] || 6)) mundaneAspects.push({ transit_planet: p1.name, natal_planet: p2.name, aspect: name, orb });
          }
        }
      }
      mundaneAspects.sort((a, b) => a.orb - b.orb);
    } catch (_) {}

    const questions = buildBonusQuestions(transitPlanets, mundaneAspects, tier);

    return json({ questions, bonus: true });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});