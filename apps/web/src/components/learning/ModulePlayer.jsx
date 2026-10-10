import React, { useState, useEffect, useMemo } from 'react';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleQuizOptions(block) {
  if (block.type !== 'quiz' || !block.options) return block;
  const correctText = typeof block.answer === 'number'
    ? block.options[block.answer]
    : block.answer;
  const shuffled = shuffleArray(block.options);
  const newIdx = shuffled.indexOf(correctText);
  return { ...block, options: shuffled, answer: newIdx };
}
import { X, ChevronRight, ChevronLeft, CheckCircle2, Sparkles, Compass } from 'lucide-react';
import ModuleMarkdown from './ModuleMarkdown';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import PlacementSlide from './PlacementSlide';
import MasteryChallenge from './MasteryChallenge';
import TraditionNoteBlock from './TraditionNoteBlock';
import { getModuleImage } from '@/lib/moduleImages';
import { getEnrichmentBlocks } from '@/lib/curriculumEnrichment';
import { awardXP, getLevelFromXP, LEVELS } from '@/lib/xpUtils';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { shouldShowBlock } from '@/lib/knowledgeDensity';
import { analyzeChartDignities } from '@/lib/essentialDignities';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const ELEMENT_MAP = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
};

const MODALITY_MAP = {
  Aries: 'Cardinal', Cancer: 'Cardinal', Libra: 'Cardinal', Capricorn: 'Cardinal',
  Taurus: 'Fixed', Leo: 'Fixed', Scorpio: 'Fixed', Aquarius: 'Fixed',
  Gemini: 'Mutable', Virgo: 'Mutable', Sagittarius: 'Mutable', Pisces: 'Mutable',
};

const PLANET_NAMES = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus',
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn',
  uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

const PLANET_THEMES = {
  Sun: 'your core identity and how you shine',
  Moon: 'your emotional inner world and instinctive needs',
  Mercury: 'how you think, communicate, and process information',
  Venus: 'what you love, value, and find beautiful',
  Mars: 'how you assert yourself, pursue what you want, and handle conflict',
  Jupiter: 'where you grow, expand, and find abundance',
  Saturn: 'where you face challenges, develop discipline, and build lasting structure',
  Uranus: 'where you seek freedom, break from convention, and invite change',
  Neptune: 'where you dream, dissolve boundaries, and seek transcendence',
  Pluto: 'where you undergo deep transformation and encounter power',
};

const SIGN_KEYWORDS = {
  Aries: 'bold, pioneering, and direct — a trailblazer driven by instinct and courage',
  Taurus: 'patient, sensual, and steadfast — anchored in the material world and slow to shift',
  Gemini: 'curious, versatile, and communicative — always gathering ideas and making connections',
  Cancer: 'nurturing, intuitive, and protective — deeply attuned to emotional undercurrents',
  Leo: 'generous, radiant, and expressive — needing to be seen and to lead from the heart',
  Virgo: 'analytical, devoted, and precise — finding meaning through service and refinement',
  Libra: 'diplomatic, aesthetic, and relational — seeking balance and beauty in all things',
  Scorpio: 'intense, perceptive, and transformative — unafraid of depth or shadow',
  Sagittarius: 'expansive, philosophical, and adventurous — forever reaching toward the horizon',
  Capricorn: 'ambitious, disciplined, and pragmatic — building toward something that lasts',
  Aquarius: 'innovative, independent, and visionary — marching to a different drum',
  Pisces: 'empathic, dreamy, and boundless — dissolving into the larger ocean of being',
};

const HOUSE_RULER_THEMES = {
  1: 'your self-image, physical body, and the mask you first show the world',
  2: 'your resources, earning power, and what you truly value',
  3: 'your mind, siblings, local community, and early schooling',
  4: 'your home, lineage, private emotional foundation',
  5: 'your creativity, children, romance, and joy',
  6: 'your work ethic, daily health habits, and acts of service',
  7: 'your committed partnerships — romantic and professional',
  8: 'intimacy, shared finances, death, rebirth, and the occult',
  9: 'your worldview, higher education, foreign cultures, and spiritual quest',
  10: 'your career, authority figures, and public standing',
  11: 'your social networks, hopes, and the groups you belong to',
  12: 'solitude, hidden enemies, karma, and the collective unconscious',
};

const ASPECT_MEANINGS = {
  conjunction: 'a fusion of energies that intensifies and blends both planets into one powerful force',
  opposition: 'a polarity that creates awareness through tension — learning to integrate two opposing drives',
  trine: 'a flowing, harmonious channel that makes the energies of both planets work together effortlessly',
  square: 'a productive friction that demands growth — challenges that ultimately build strength',
  sextile: 'an opportunity aspect that opens doors when you take initiative',
  quincunx: 'an awkward adjustment — two planets that must constantly recalibrate to work together',
};

const ELEMENT_FLAVOR = {
  Fire: 'with enthusiasm, directness, and a spark of inspiration',
  Earth: 'in practical, grounded, and tangible ways',
  Air: 'through ideas, communication, and social connection',
  Water: 'through feeling, intuition, and emotional depth',
};

const MODALITY_FLAVOR = {
  Cardinal: 'You bring an initiating, action-oriented quality to this planet\'s expression.',
  Fixed: 'You express this planet\'s energy with sustained commitment and depth.',
  Mutable: 'You express this planet\'s energy in a flexible, adaptable way.',
};

const HOUSE_THEMES = {
  1: 'your identity and how you present yourself to the world',
  2: 'your relationship with money, values, and personal resources',
  3: 'communication, learning, and your immediate environment',
  4: 'home, family, roots, and your private inner life',
  5: 'creativity, play, romance, and authentic self-expression',
  6: 'daily routines, health, and how you show up in service',
  7: 'partnerships, close relationships, and one-on-one dynamics',
  8: 'transformation, shared resources, and the deeper layers of life',
  9: 'philosophy, higher learning, travel, and the search for meaning',
  10: 'career, public reputation, and the legacy you are building',
  11: 'friendships, community, and your vision for the future',
  12: 'the unconscious, spiritual practice, and what lies beneath the surface',
};

const CHART_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

// Section-aware "your chart" context for modules without a specific planet/house/sign match.
function buildSectionSynthesis(chart, section) {
  const raw = chart?.raw_data || {};
  const planets = raw.planets || [];
  const aspects = raw.aspects || [];
  const sun = planets.find(p => p.name === 'Sun');
  const moon = planets.find(p => p.name === 'Moon');
  const asc = raw.ascendant_sign;
  const big3 = `Your foundational placements are Sun in ${sun?.sign || '?'}, Moon in ${moon?.sign || '?'}, and ${asc ? `a ${asc} Ascendant` : 'your rising sign'}.`;

  if (section === 'foundations' || section === 'planets') {
    return `${big3} These three form the core of who you are — your identity (Sun), emotional nature (Moon), and how you meet the world (Ascendant) — so every concept in this module lands somewhere in this foundation.${sun?.house ? ` Your Sun lights up your ${sun.house}${getOrdinalSuffix(sun.house)} house.` : ''}`;
  }

  if (section === 'signs' || section === 'elements_modalities') {
    const el = raw.element_distribution || {};
    const mod = raw.modality_distribution || {};
    const elTotal = Object.values(el).reduce((s, v) => s + v, 0) || 1;
    const modTotal = Object.values(mod).reduce((s, v) => s + v, 0) || 1;
    const sortedEl = Object.entries(el).sort((a, b) => b[1] - a[1]);
    const sortedMod = Object.entries(mod).sort((a, b) => b[1] - a[1]);
    let text = `${big3} `;
    if (sortedEl[0]) {
      const pct = Math.round((sortedEl[0][1] / elTotal) * 100);
      text += `Your chart is strongest in ${sortedEl[0][0]} (${pct}% of your planets), so you tend to move through life ${ELEMENT_FLAVOR[sortedEl[0][0]] || ''}.`;
    }
    if (sortedMod[0]) {
      const pct = Math.round((sortedMod[0][1] / modTotal) * 100);
      const behavior = sortedMod[0][0] === 'Cardinal' ? 'initiate and launch things' : sortedMod[0][0] === 'Fixed' ? 'commit and sustain what you start' : 'adapt and flow with change';
      text += ` You're also ${pct}% ${sortedMod[0][0].toLowerCase()}, meaning you tend to ${behavior}.`;
    }
    return text;
  }

  if (section === 'aspects') {
    const notable = aspects.filter(a => ['exact', 'strong'].includes(a.strength)).slice(0, 4);
    if (notable.length === 0) {
      return `${big3} Your chart's aspects are relatively wide, so your planets tend to operate more independently than in tight dialogue.`;
    }
    const lines = notable.map(a => `${a.planet1} ${a.aspect} ${a.planet2} — ${ASPECT_MEANINGS[a.aspect] || a.aspect}`);
    return `${big3} Among your chart's most exact aspects: ${lines.join('; ')}. These are the key dialogues between your planets that shape how your different drives interact.`;
  }

  if (section === 'dynamics') {
    let text = `${big3} `;
    const rulerName = asc ? CHART_RULERS[asc] : null;
    const ruler = rulerName ? planets.find(p => p.name === rulerName) : null;
    if (ruler) {
      text += `Because your rising sign is ${asc}, your chart ruler is ${ruler.name}${ruler.sign ? ` in ${ruler.sign}` : ''}${ruler.house ? ` (${ruler.house}${getOrdinalSuffix(ruler.house)} house)` : ''} — the planet that governs your identity and overall life direction.`;
    }
    const signCounts = {};
    planets.forEach(p => { if (p.sign) signCounts[p.sign] = (signCounts[p.sign] || 0) + 1; });
    const stelliums = Object.entries(signCounts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
    if (stelliums.length > 0) {
      text += ` You also have a stellium (${stelliums[0][1]} planets) in ${stelliums[0][0]}, concentrating major energy in that sign's themes.`;
    }
    return text;
  }

  if (section === 'classical_techniques') {
    const dignities = analyzeChartDignities(raw);
    const notable = dignities.filter(d => d.status !== 'peregrine');
    if (notable.length === 0) {
      return `${big3} In your chart, none of your planets sit in domicile, exaltation, detriment, or fall — each expresses through its peregrine (neutral) condition, free of classical dignity or debility.`;
    }
    const lines = notable.map(d => `${d.planet} in ${d.sign} — ${d.label}`);
    return `${big3} Looking at essential dignities in your chart: ${lines.join('; ')}. These classical placements shape how naturally or uncomfortably each planet expresses.`;
  }

  return big3;
}

function buildPersonalSynthesis(chart, subjectKey, section) {
  if (!chart) return null;

  const raw = chart.raw_data || {};
  const planets = raw.planets || [];
  const houses = raw.houses || [];
  const angles = raw.angles || {};
  const nodes = raw.nodes || {};
  const aspects = raw.aspects || [];

  // Planet module
  const planetName = PLANET_NAMES[subjectKey];
  if (planetName) {
    const planet = planets.find(p => p.name === planetName);
    if (!planet) return null;

    const sign = planet.sign;
    const house = planet.house;
    const element = ELEMENT_MAP[sign] || '';
    const modality = MODALITY_MAP[sign] || '';
    const theme = PLANET_THEMES[planetName] || 'this area of your chart';
    const elementFlavor = ELEMENT_FLAVOR[element] || '';
    const modalityFlavor = MODALITY_FLAVOR[modality] || '';
    const houseTheme = house ? HOUSE_THEMES[parseInt(house)] : null;
    const signKw = SIGN_KEYWORDS[sign] || sign;

    let text = `Your ${planetName} is in ${sign} — a sign that is ${signKw}. This means ${theme} expresses itself ${elementFlavor}.`;
    if (modality) text += ` ${modalityFlavor}`;
    if (houseTheme) text += ` ${planetName} falls in your ${house}${getOrdinalSuffix(house)} house — the sphere of ${houseTheme} — making this the primary arena where this energy plays out in daily life.`;
    if (planet.retrograde) text += ` ${planetName} is retrograde in your chart, suggesting this energy turns inward, requiring extra reflection before it flows outward with full force.`;

    // Add dominant aspects for this planet
    const planetAspects = aspects.filter(a =>
      ['exact','strong'].includes(a.strength) && (a.planet1 === planetName || a.planet2 === planetName)
    ).slice(0, 2);
    if (planetAspects.length > 0) {
      const aspDesc = planetAspects.map(a => {
        const other = a.planet1 === planetName ? a.planet2 : a.planet1;
        const meaning = ASPECT_MEANINGS[a.aspect] || a.aspect;
        return `a ${a.aspect} to ${other} (${meaning})`;
      }).join(', and ');
      text += ` Notable in your chart: ${planetName} forms ${aspDesc}.`;
    }

    return text;
  }

  // House module — find which planets fall in this house and what sign is on the cusp
  const houseMatch = subjectKey.match(/^house_(\d+)$/);
  if (houseMatch) {
    const houseNum = parseInt(houseMatch[1]);
    const theme = HOUSE_THEMES[houseNum] || 'this life area';
    const rulerTheme = HOUSE_RULER_THEMES[houseNum] || theme;
    const houseData = houses.find(h => h.number === houseNum);
    const cuspSign = houseData?.sign;
    const cuspSignKw = cuspSign ? SIGN_KEYWORDS[cuspSign] : null;
    const planetsInHouse = planets.filter(p => parseInt(p.house) === houseNum);

    let text = `Your ${houseNum}${getOrdinalSuffix(houseNum)} house governs ${rulerTheme}.`;
    if (cuspSign) {
      text += ` The cusp of this house falls in ${cuspSign} — ${cuspSignKw || cuspSign} — which colors the tone and style of this entire life domain with ${cuspSign}'s qualities.`;
    }
    if (planetsInHouse.length > 0) {
      const names = planetsInHouse.map(p => p.name).join(', ');
      text += ` You have ${names} placed here, ${planetsInHouse.length === 1 ? 'bringing that planet\'s energy' : 'bringing those planets\' energies'} directly into this sphere of life with added intensity and focus.`;
    } else {
      text += ` No planets occupy this house natally. This means the house operates through its sign's ruler rather than through concentrated planetary energy — it flows, but doesn't dominate your chart.`;
    }
    return text;
  }

  // Retrograde module — list the user's natal retrograde planets and what each means
  if (subjectKey === 'retrograde_planets') {
    const retroPlanets = planets.filter(p => p.retrograde && PLANET_THEMES[p.name]);
    if (retroPlanets.length === 0) {
      return `None of your planets are retrograde in your natal chart. Each planet's energy moves in its natural forward direction, so you may experience these archetypes more directly and outwardly. (This describes your birth chart — the daily retrogrades everyone experiences are a transit-level phenomenon, separate from your natal retrogrades.)`;
    }
    const lines = retroPlanets.map(p => {
      const theme = PLANET_THEMES[p.name] || 'this energy';
      let line = `${p.name} is retrograde in ${p.sign}`;
      if (p.house) line += ` in your ${p.house}${getOrdinalSuffix(p.house)} house`;
      line += ` — ${theme} turns inward, asking you to revisit and rethink this area before it flows outward with full force. Rather than expressing ${p.name}'s energy in a straight line, you may process it through reflection, review, and revisitation.`;
      return line;
    });
    return `You have ${retroPlanets.length} planet${retroPlanets.length > 1 ? 's' : ''} retrograde in your birth chart. ${lines.join(' ')}`;
  }

  // Lot & calculated-point modules (Arabic Lots, Lilith, Chiron, Tyche)
  const LOT_INFO = {
    part_of_fortune:   { name: 'Part of Fortune',   theme: 'the Lot of Fortune — a calculated point marking where ease, luck, and material opportunity naturally express in your life' },
    part_of_spirit:    { name: 'Part of Spirit',    theme: 'the Lot of Spirit — the inward vocation and what soulfully animates you, the intentional counterpart to the body\'s ease' },
    part_of_eros:      { name: 'Part of Eros',       theme: 'the Lot of Eros — where desire, passion, and the creative-erotic drive gather, what stirs you most powerfully' },
    part_of_necessity: { name: 'Part of Necessity', theme: 'the Lot of Necessity — the binding constraints and duties that shape your destiny, what you cannot escape' },
    tyche:             { name: 'Tyche',              theme: 'the lot of fortunate coincidence and providence — where serendipity and unearned grace tend to find you' },
    black_moon_lilith: { name: 'Black Moon Lilith',  theme: 'the mean lunar apogee — the repressed, instinctual, and untamed parts of the self seeking integration' },
    chiron:            { name: 'Chiron',             theme: 'the wounded healer — the core wound you carry and the gift of healing that emerges from tending it' },
  };
  if (LOT_INFO[subjectKey]) {
    const { name: lotName, theme: lotTheme } = LOT_INFO[subjectKey];
    const lot = planets.find(p => p.name === lotName);
    if (!lot) return null;
    const sign = lot.sign;
    const house = lot.house;
    const houseTheme = house ? HOUSE_THEMES[parseInt(house)] : null;
    const signKw = SIGN_KEYWORDS[sign] || sign;
    let text = `Your ${lotName} falls in ${sign} — a sign that is ${signKw}. ${lotName} is ${lotTheme}.`;
    if (houseTheme) text += ` It sits in your ${house}${getOrdinalSuffix(house)} house — the sphere of ${houseTheme} — making this the primary arena where this energy manifests.`;
    const lotAspects = aspects.filter(a =>
      ['exact','strong','moderate'].includes(a.strength) && (a.planet1 === lotName || a.planet2 === lotName)
    ).slice(0, 2);
    if (lotAspects.length > 0) {
      const aspDesc = lotAspects.map(a => {
        const other = a.planet1 === lotName ? a.planet2 : a.planet1;
        const meaning = ASPECT_MEANINGS[a.aspect] || a.aspect;
        return `a ${a.aspect} to ${other} (${meaning})`;
      }).join(', and ');
      text += ` Notable in your chart: ${lotName} forms ${aspDesc}, which shapes how this point operates.`;
    }
    return text;
  }

  // Lunar Nodes — the nodal axis
  if (subjectKey === 'lunar_nodes') {
    const north = nodes.north_node;
    const south = nodes.south_node;
    if (!north && !south) return null;
    const nSign = north?.sign || 'the unknown';
    const sSign = south?.sign || 'the opposite sign';
    const nHouse = north?.house;
    const sHouse = south?.house;
    const nHouseTheme = nHouse ? HOUSE_THEMES[parseInt(nHouse)] : null;
    const sHouseTheme = sHouse ? HOUSE_THEMES[parseInt(sHouse)] : null;
    let text = `Your nodal axis runs from the South Node in ${sSign} — the ingrained tendencies and comfort zone you arrived with — to the North Node in ${nSign} — the unfamiliar territory that holds your deepest growth.`;
    if (sHouseTheme) text += ` The South Node falls in your ${sHouse}${getOrdinalSuffix(sHouse)} house, the sphere of ${sHouseTheme} — the arena where your past mastery and habit both live.`;
    if (nHouseTheme) text += ` The North Node falls in your ${nHouse}${getOrdinalSuffix(nHouse)} house, the sphere of ${nHouseTheme} — the life area your growth most wants to inhabit.`;
    text += ` The work is not to abandon the South Node but to stop living there, letting its gifts resource the North Node's new direction.`;
    return text;
  }

  // Sign module — find which planets the user has in this sign (only for real zodiac signs)
  const signName = subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1);
  if (SIGN_KEYWORDS[signName]) {
    const signKw = SIGN_KEYWORDS[signName];
    const element = ELEMENT_MAP[signName] || '';
    const modality = MODALITY_MAP[signName] || '';
    const planetsInSign = planets.filter(p => p.sign === signName);

    let text = `${signName} is ${signKw}. It is a ${element} sign with a ${modality} quality — ${ELEMENT_FLAVOR[element] || ''}, ${(MODALITY_FLAVOR[modality] || '').replace('You express this planet\'s energy', 'expressing its energy').replace('.', '')}.`;

    if (planetsInSign.length > 0) {
      const names = planetsInSign.map(p => {
        const p2 = planets.find(pl => pl.name === p.name);
        return p2?.retrograde ? `${p.name} ℞` : p.name;
      }).join(', ');
      text += ` In your chart, you have ${names} in ${signName}, meaning ${planetsInSign.length === 1 ? 'that planet channels' : 'those planets channel'} all of ${signName}'s qualities into those areas of your life.`;
    } else {
      // Find which house cusp is in this sign
      const houseWithSign = houses.find(h => h.sign === signName);
      if (houseWithSign) {
        text += ` You have no planets in ${signName}, but your ${houseWithSign.number}${getOrdinalSuffix(houseWithSign.number)} house cusp falls here, meaning ${signName}'s energy shapes that life area — ${HOUSE_RULER_THEMES[houseWithSign.number] || 'that sphere'}.`;
      } else {
        text += ` You have no planets in ${signName}, yet every sign is active in every chart. Its archetype influences you through your chart's broader pattern.`;
      }
    }
    return text;
  }

  // Fallback — section-aware "your chart" context for any other module
  return buildSectionSynthesis(chart, section);
}

function buildAspectInterpretation(aspect, chart) {
  if (!chart) return null;
  const p1 = aspect.planet1;
  const p2 = aspect.planet2;
  const type = aspect.aspect;
  const meaning = ASPECT_MEANINGS[type] || type;

  const raw = chart?.raw_data || {};
  const planets = raw.planets || [];
  const pl1 = planets.find(p => p.name === p1);
  const pl2 = planets.find(p => p.name === p2);

  const t1 = PLANET_THEMES[p1] || p1;
  const t2 = PLANET_THEMES[p2] || p2;

  let text = `In your chart, ${p1} and ${p2} form a ${type} — ${meaning}. `;
  text += `This creates a dynamic interplay between ${t1} and ${t2}. `;

  if (pl1 && pl2) {
    text += `Your ${p1} is in ${pl1.sign} and your ${p2} is in ${pl2.sign}, so this ${type} operates across ${pl1.sign}'s ${ELEMENT_MAP[pl1.sign] || ''} quality and ${pl2.sign}'s ${ELEMENT_MAP[pl2.sign] || ''} quality.`;
  }

  if (type === 'conjunction') text += ` These two drives are fused — you may experience them as inseparable parts of your nature.`;
  else if (type === 'opposition') text += ` You may oscillate between these two drives, feeling pulled in opposite directions before integrating them.`;
  else if (type === 'trine') text += ` This is a gift in your chart — this energy flows naturally, perhaps so naturally it goes unnoticed.`;
  else if (type === 'square') text += ` This creates inner tension that pushes you to develop both energies into something stronger. Squares build character.`;
  else if (type === 'sextile') text += ` The opportunity here is real but requires your engagement — when you act, these two planets amplify each other.`;

  return text;
}

function getOrdinalSuffix(n) {
  const num = parseInt(n);
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
}

const EXPLORE_SECTIONS = [
  { key: 'signs', label: 'Signs', glyph: '♎', blurb: 'The 12 zodiac signs, elements, and modalities.' },
  { key: 'houses', label: 'Houses', glyph: 'XII', blurb: 'The 12 life areas where planetary energy plays out.' },
  { key: 'aspects', label: 'Aspects', glyph: '☌', blurb: 'The angles planets make to each other and what they mean.' },
  { key: 'dynamics', label: 'Dynamics', glyph: '◇', blurb: 'Chart ruler, stelliums, empty houses, and patterns — your chart as a whole.' },
];

export default function ModulePlayer({ module: mod, progress, userId, user, chart, modules, onClose, onComplete, onNavigate, initialBlockIndex, onViewChart, activeTradition = 'modern' }) {
  const [blockIndex, setBlockIndex] = useState(() => (typeof initialBlockIndex === 'number' ? initialBlockIndex : 0));
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWhatsNext, setShowWhatsNext] = useState(false);
  const [showMastery, setShowMastery] = useState(false);
  // Knowledge Density — filters technical blocks out for users at lower depths
  const { knowledgeDepth } = useUserPrefs();

  useEffect(() => {
    setBlockIndex(typeof initialBlockIndex === 'number' ? initialBlockIndex : 0);
    setSelectedAnswer(null);
    setAnswered(false);
    setShowWhatsNext(false);
  }, [mod.id]);

  const hasSynthesis = !!chart ||
    !!PLANET_NAMES[mod.subject_key] ||
    /^house_\d+$/.test(mod.subject_key) ||
    mod.subject_key === 'retrograde_planets' ||
    mod.subject_key === 'part_of_fortune' || mod.subject_key === 'part_of_spirit' || mod.subject_key === 'part_of_eros' || mod.subject_key === 'part_of_necessity' || mod.subject_key === 'tyche' || mod.subject_key === 'lunar_nodes' || mod.subject_key === 'black_moon_lilith' || mod.subject_key === 'chiron' ||
    Object.keys(SIGN_KEYWORDS).includes(mod.subject_key?.charAt(0).toUpperCase() + mod.subject_key?.slice(1));
  const blocks = useMemo(() => {
    const baseBlocks = (mod.content_blocks || []).filter(b => b.type !== 'synthesis' && b.type !== 'tradition_note');
    const traditionNotes = (mod.content_blocks || []).filter(b => b.type === 'tradition_note');
    const enrichmentBlocks = getEnrichmentBlocks(mod.subject_key, mod.title);
    const personalBlock = { type: 'synthesis', heading: mod.subject_key === 'retrograde_planets' ? 'Your Planets in Retrograde' : `${mod.title} in Your Chart` };
    const allBlocks = [
      ...baseBlocks,
      ...enrichmentBlocks,
      ...(traditionNotes.length > 0 ? [{ type: 'tradition_notes', notes: traditionNotes }] : []),
      ...(hasSynthesis ? [personalBlock] : []),
    ];
    // Knowledge Density filter — hide blocks tagged for a deeper level than the user's current depth.
    // Blocks without a `required_depth` tag are always shown.
    const filtered = allBlocks.filter(b => shouldShowBlock(b, knowledgeDepth));
    // Shuffle quiz answer positions so the correct answer isn't always the same letter
    return filtered.map(b => b.type === 'quiz' ? shuffleQuizOptions(b) : b);
  }, [mod.id, mod.subject_key, mod.title, hasSynthesis, knowledgeDepth]);
  const block = blocks[blockIndex];
  const isLast = blockIndex === blocks.length - 1;

  // Mastery challenge — unlocks at Practitioner level (500+ XP)
  const userXP = user?.xp_total || 0;
  const userLevel = getLevelFromXP(userXP);
  const isPractitionerPlus = ['practitioner', 'sage'].includes(userLevel.name);
  const hasMastery = isPractitionerPlus && (mod.mastery_blocks?.length || 0) > 0;
  const masteryCompleted = !!progress?.mastery_completed_at;

  const saveProgress = async (newIndex, completed = false) => {
    setSaving(true);
    const data = {
      user_id: userId,
      module_id: mod.id,
      status: completed ? 'completed' : 'in_progress',
      current_block_index: newIndex,
      xp_earned: completed ? (mod.xp_reward || 50) : (progress?.xp_earned || 0),
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    };
    if (progress?.id) {
      await base44.entities.UserModuleProgress.update(progress.id, data);
    } else {
      await base44.entities.UserModuleProgress.create(data);
    }
    // Only award XP on the FIRST completion — re-completing a finished module
    // is a refresher and must not double-award points into the XP ledger.
    if (completed && progress?.status !== 'completed') {
      // Refresh modules_completed on UserProgress so tier progress card stays in sync
      try {
        const progRecords = await base44.entities.UserProgress.filter({ user_id: userId });
        const prog = progRecords[0];
        if (prog) {
          const completedModules = await base44.entities.UserModuleProgress.filter({ user_id: userId, status: 'completed' });
          await base44.entities.UserProgress.update(prog.id, { modules_completed: completedModules.length });
        }
      } catch { /* best-effort sync */ }
      // Compute level before awarding to detect graduation
      const prevEvents = await base44.entities.XPEvent.filter({ user_id: userId });
      const prevTotal = prevEvents.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
      const prevLevel = getLevelFromXP(prevTotal).name;
      const result = await awardXP(userId, 'card_completed', mod.xp_reward || 50, mod.id, prevLevel);
      if (result.leveledUp) {
        const newLevelInfo = LEVELS.find(l => l.name === result.newLevel);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        toast.success(
          <div className="text-center">
            <p className="font-display font-bold text-base">✦ Level Up! ✦</p>
            <p className="font-body text-sm mt-0.5">You've reached <span className="font-bold capitalize">{newLevelInfo?.label || result.newLevel}</span></p>
          </div>,
          { duration: 5000 }
        );
      }
    }
    setSaving(false);
  };

  const handleNext = async () => {
    if (block?.type === 'quiz' && !answered) return;
    const nextIndex = blockIndex + 1;
    if (isLast) {
      await saveProgress(nextIndex, true);
      setShowWhatsNext(true);
    } else {
      await saveProgress(nextIndex);
      setBlockIndex(nextIndex);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  };

  const nextModule = modules
    ? modules.find(m => m.section === mod.section && m.order_index > mod.order_index)
    : null;

  const handleBack = () => {
    if (blockIndex === 0) { onClose(); return; }
    setBlockIndex(blockIndex - 1);
    setSelectedAnswer(null);
    setAnswered(false);
  };

  const handleAnswer = (idx) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
  };

  // block.answer may be an index (number) or the option string itself
  const correctIdx = block?.type === 'quiz'
    ? (typeof block.answer === 'number'
        ? block.answer
        : block.options?.findIndex(o => o === block.answer))
    : -1;
  const isCorrect = answered && block?.type === 'quiz' && selectedAnswer === correctIdx;
  const rawSynthesisText = buildPersonalSynthesis(chart, mod.subject_key, mod.section);
  const synthesisText = rawSynthesisText?.replace(/ — /g, ', ').replace(/—/g, ', ');

  if (showMastery) {
    return (
      <MasteryChallenge
        module={mod}
        progress={progress}
        userId={userId}
        onClose={() => setShowMastery(false)}
        onComplete={() => {
          setShowMastery(false);
          onComplete();
        }}
      />
    );
  }

  if (showWhatsNext) {
    return (
      <div className="fixed inset-0 bg-cream z-[10020] flex flex-col">
        <div className="bg-paper border-b border-gold-primary/30 px-4 pb-4 flex items-center gap-3" style={{ paddingTop: 'max(2.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}>
          <button onClick={onClose} className="text-brass hover:text-white transition-colors">
            <X size={20} />
          </button>
          <div className="flex-1">
            <p className="font-body text-xs text-brass uppercase tracking-widest"><span style={{fontVariantEmoji:'text', fontVariant:'normal'}}>{mod.glyph + '\uFE0E'}</span> {mod.title}</p>
             <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
               <div className="h-full bg-gold-accent rounded-full w-full" />
            </div>
          </div>
          <CheckCircle2 size={18} className="text-green-soft" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-8 max-w-lg mx-auto w-full space-y-6 pb-28">
          <div className="text-center space-y-2 animate-fade-up">
            <div className="text-4xl text-gold-accent">✦</div>
            <h2 className="font-display text-xl font-bold text-white">Module Complete!</h2>
            <p className="font-body text-sm text-brass">
              {progress?.status === 'completed'
                ? 'A good refresher — this module stays complete. Where would you like to go next?'
                : `You earned ${mod.xp_reward || 50} XP. Where would you like to go next?`}
            </p>
          </div>

          <OrnamentDivider />

          {nextModule && (
            <div className="space-y-2">
              <p className="font-body text-xs text-brass uppercase tracking-widest">Continue</p>
              <button
                onClick={() => onNavigate(nextModule)}
                className="w-full celestial-card p-4 text-left hover:shadow-md transition-all flex items-center gap-4"
              >
                <span className="text-2xl text-gold-accent" style={{fontVariantEmoji:'text'}}>{(nextModule.glyph || '☽') + '\uFE0E'}</span>
                <div>
                  <p className="font-display text-sm font-bold text-white">{nextModule.title}</p>
                  {nextModule.subtitle && <p className="font-body text-xs text-brass">{nextModule.subtitle}</p>}
                </div>
                <ChevronRight size={16} className="ml-auto text-brass/40" />
              </button>
            </div>
          )}

          {hasMastery && !masteryCompleted && (
            <div className="space-y-2">
              <p className="font-body text-xs text-gold-accent uppercase tracking-widest">✦ Practitioner's Lens Available</p>
              <button
                onClick={() => setShowMastery(true)}
                className="w-full celestial-card p-4 text-left hover:shadow-md transition-all flex items-center gap-4"
                style={{ borderLeft: '3px solid #C9A961' }}
              >
                <Sparkles size={20} className="text-gold-accent shrink-0" />
                <div className="flex-1">
                  <p className="font-display text-sm font-bold text-white">Open the Practitioner's Lens</p>
                  <p className="font-body text-xs text-brass">Hypothetical case studies with practitioner cheat-codes. Earn +{mod.mastery_xp_reward || 100} XP.</p>
                </div>
                <ChevronRight size={16} className="text-gold-accent/60" />
              </button>
            </div>
          )}

          {masteryCompleted && (
            <div className="celestial-card p-4 flex items-center gap-3" style={{ borderLeft: '3px solid #86efac' }}>
              <CheckCircle2 size={20} className="text-green-soft shrink-0" />
              <div>
                <p className="font-display text-sm font-bold text-white">Practitioner's Lens Completed</p>
                <p className="font-body text-xs text-brass">You've earned +{progress?.mastery_xp_earned || mod.mastery_xp_reward || 100} XP from this Practitioner's Lens.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-body text-xs text-brass uppercase tracking-widest">Or Explore</p>
            <div className="space-y-2.5 mt-1">
              {EXPLORE_SECTIONS.map(sec => (
                <button
                  key={sec.key}
                  onClick={() => onNavigate(null, sec.key)}
                  className="w-full celestial-card p-4 text-left hover:shadow-md transition-all flex items-center gap-4"
                >
                  <span className="text-xl text-gold-accent w-7 text-center" style={{fontVariantEmoji:'text'}}>{sec.glyph + '\uFE0E'}</span>
                  <div>
                    <p className="font-display text-sm font-bold text-white">{sec.label}</p>
                    <p className="font-body text-xs text-brass">{sec.blurb}</p>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-brass/40" />
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-gold-primary/40 text-brass font-body text-sm"
          >
            Back to Learn
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cream z-[10020] flex flex-col">
      {/* Header */}
      <div className="bg-paper border-b border-gold-primary/30 px-4 pb-4 flex items-center gap-3" style={{ paddingTop: 'max(2.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}>
        <button onClick={handleBack} className="text-brass hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <p className="font-body text-xs text-brass uppercase tracking-widest"><span style={{fontVariantEmoji:'text', fontVariant:'normal'}}>{mod.glyph + '\uFE0E'}</span> {mod.title}</p>
           <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
             <div
               className="h-full bg-gold-accent rounded-full transition-all duration-500"
              style={{ width: `${((blockIndex + 1) / blocks.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onViewChart && (
            <button onClick={() => onViewChart(blockIndex)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gold-primary/15 border border-gold-primary/30 text-gold-accent hover:bg-gold-primary/25 transition-colors" title="View your chart">
              <Compass size={12} />
              <span className="font-body text-[9px] uppercase tracking-wide">Chart</span>
            </button>
          )}
          {hasMastery && !masteryCompleted && (
            <button onClick={() => setShowMastery(true)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gold-accent/15 border border-gold-accent/30 text-gold-accent hover:bg-gold-accent/25 transition-colors" title="Practitioner's Lens">
              <Sparkles size={12} />
              <span className="font-body text-[9px] uppercase tracking-wide">Lens</span>
            </button>
          )}
          {masteryCompleted && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-soft/10 border border-green-soft/20 text-green-soft" title="Practitioner's Lens completed">
              <CheckCircle2 size={12} />
              <span className="font-body text-[9px] uppercase tracking-wide">Lens</span>
            </span>
          )}
          <button onClick={onClose} className="text-brass/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Block content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 max-w-lg mx-auto w-full">

        {blockIndex === 0 && getModuleImage(mod.subject_key) && (
          <img
            src={getModuleImage(mod.subject_key)}
            alt=""
            className="w-full rounded-xl object-cover max-h-56 mb-5 animate-fade-up"
          />
        )}

        {block?.type === 'text' && (
          <div className="animate-fade-up space-y-4">
            {block.image_url && (
              <img
                src={block.image_url}
                alt=""
                className="w-full rounded-xl object-cover max-h-48"
              />
            )}
            <div className="prose prose-sm max-w-none font-body text-white/90 leading-relaxed
              [&_strong]:font-bold [&_strong]:text-white
              [&_em]:italic [&_em]:text-brass
              [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-4 [&_h2]:mb-1
              [&_h3]:font-display [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-3 [&_h3]:mb-1
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
              [&_p]:mb-3 [&_p:last-child]:mb-0">
              <ModuleMarkdown>{block.content}</ModuleMarkdown>
            </div>
          </div>
        )}

        {block?.type === 'synthesis' && (
          <div className="animate-fade-up space-y-4">
            <div className="text-center">
              <span className="text-3xl text-gold-accent" style={{fontVariantEmoji:'text'}}>{(mod.glyph || '✦') + '\uFE0E'}</span>
              <h2 className="font-display text-lg font-bold text-white mt-2">
                {block.heading || `${mod.title} in Your Chart`}
              </h2>
            </div>
            <OrnamentDivider />
            {synthesisText ? (
              <>
                <PlacementSlide chart={chart} subjectKey={mod.subject_key} />
                <div className="celestial-card p-5">
                  <p className="font-body text-sm text-white/90 leading-relaxed">{synthesisText}</p>
                </div>
              </>
            ) : (
              <div className="celestial-card p-5">
                <p className="font-body text-sm text-brass italic leading-relaxed">
                  Complete your birth chart in onboarding to see your personal {mod.title} placement here.
                </p>
              </div>
            )}
          </div>
        )}

        {block?.type === 'glyphs' && (
          <div className="animate-fade-up space-y-4">
            <h2 className="font-display text-lg font-bold text-white text-center">{block.heading}</h2>
            <OrnamentDivider />
            <div className="grid grid-cols-2 gap-2">
              {block.items?.map((item, i) => {
                const el = ELEMENT_MAP[item.label];
                const elBg = {
                  Fire:  'rgba(251,146,60,0.12)',
                  Earth: 'rgba(134,239,172,0.10)',
                  Air:   'rgba(147,197,253,0.12)',
                  Water: 'rgba(103,232,249,0.12)',
                };
                const elGlyph = {
                  Fire: '#fb923c', Earth: '#86efac', Air: '#93c5fd', Water: '#67e8f9',
                };
                const bg = elBg[el] || 'rgba(212,175,133,0.08)';
                const gc = elGlyph[el] || '#C9A961';
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-transform hover:scale-[1.02] cursor-default"
                    style={{ background: bg, border: `1px solid ${gc}22` }}
                  >
                    <span className="text-xl w-7 text-center flex-shrink-0" style={{ fontVariantEmoji: 'text', fontVariant: 'normal', color: gc }}>{(item.glyph || '').replace(/\uFE0F/g, '') + '\uFE0E'}</span>
                    <span className="font-body text-sm text-white">{item.label}</span>
                    {el && <span className="ml-auto font-body text-[10px] opacity-40">{el}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {block?.type === 'fact' && (
          <div className="animate-fade-up space-y-4">
            {block.image_url && (
              <img src={block.image_url} alt="" className="w-full rounded-xl object-cover max-h-48" />
            )}
            <div className="relative celestial-card overflow-hidden bg-gold-primary/10"
              style={{ borderLeft: '3px solid #C9A961', paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
              {/* Large decorative background glyph */}
              <span className="absolute -bottom-2 right-3 text-8xl pointer-events-none select-none font-display"
                style={{ color: 'rgba(201,169,97,0.07)', fontVariantEmoji: 'text' }}>✦</span>
              <p className="font-display text-xs text-gold-accent uppercase tracking-widest mb-2">✦ {block.heading || 'Did You Know?'}</p>
              <OrnamentDivider className="mb-3" />
              <div className="font-body text-sm text-white/90 leading-relaxed italic
                [&_strong]:font-bold [&_strong]:not-italic [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ModuleMarkdown>{block.content}</ModuleMarkdown>
              </div>
            </div>
          </div>
        )}

        {block?.type === 'mythology' && (
          <div className="animate-fade-up space-y-4">
            {block.image_url && (
              <img
                src={block.image_url}
                alt=""
                className="w-full rounded-xl object-cover max-h-52"
              />
            )}
            <div className="relative celestial-card overflow-hidden"
              style={{ borderLeft: '3px solid #C9A961', paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
              <span className="absolute -bottom-2 right-3 text-8xl pointer-events-none select-none font-display"
                style={{ color: 'rgba(201,169,97,0.07)', fontVariantEmoji: 'text' }}>✦</span>
              <p className="font-display text-xs text-gold-accent uppercase tracking-widest mb-2">✦ {block.heading || 'Mythology'}</p>
              <OrnamentDivider className="mb-3" />
              <div className="font-body text-sm text-white/90 leading-relaxed
                [&_strong]:font-bold [&_strong]:text-white
                [&_p]:mb-3 [&_p:last-child]:mb-0">
                <ModuleMarkdown>{block.content}</ModuleMarkdown>
              </div>
            </div>
          </div>
        )}

        {block?.type === 'associations' && (
          <div className="animate-fade-up space-y-4">
            {block.image_url && (
              <img
                src={block.image_url}
                alt=""
                className="w-full rounded-xl object-cover max-h-40"
              />
            )}
            <h2 className="font-display text-lg font-bold text-white text-center">{block.heading || 'Correspondences'}</h2>
            <OrnamentDivider />
            <div className="space-y-2">
              {Object.entries(block.data || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-transform hover:scale-[1.01]"
                  style={{ background: 'rgba(212,175,133,0.06)', border: '1px solid rgba(212,175,133,0.12)' }}
                >
                  <span className="font-body text-[10px] text-gold-accent font-semibold uppercase tracking-widest w-24 flex-shrink-0 pt-0.5">{key}</span>
                  <span className="font-body text-sm text-white/90 leading-snug flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {block?.type === 'tradition_notes' && (
          <div className="animate-fade-up">
            <TraditionNoteBlock notes={block.notes} activeTradition={activeTradition} />
          </div>
        )}

        {block?.type === 'quiz' && (
          <div className="animate-fade-up space-y-4">
            <p className="font-display text-base font-bold text-white/90 leading-snug">{block.question}</p>
            <OrnamentDivider />
            <div className="space-y-2.5">
              {block.options.map((opt, i) => {
                const letters = ['A', 'B', 'C', 'D', 'E'];
                let rowStyle = 'border-gold-primary/30 bg-paper text-white/90';
                let circleStyle = 'bg-gold-primary/20 text-gold-accent';
                let icon = letters[i];
                if (answered) {
                  if (i === correctIdx) {
                    rowStyle = 'border-green-soft/60 bg-green-soft/15 text-white';
                    circleStyle = 'bg-green-soft/40 text-white';
                    icon = '✓';
                  } else if (i === selectedAnswer) {
                    rowStyle = 'border-destructive/40 bg-destructive/10 text-red-300';
                    circleStyle = 'bg-destructive/20 text-red-300';
                    icon = '✗';
                  } else {
                    rowStyle = 'border-gold-primary/10 bg-paper/40 text-white/30';
                    circleStyle = 'bg-paper/60 text-white/20';
                  }
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={answered}
                    className={`w-full text-left px-3 py-3 rounded-xl border font-body text-sm transition-all flex items-center gap-3 ${rowStyle} ${!answered ? 'hover:border-gold-accent hover:scale-[1.01] cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleStyle}`}>
                      {icon}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className={`relative overflow-hidden px-4 py-3 rounded-xl font-body text-sm border ${isCorrect ? 'bg-green-soft/15 border-green-soft/30 text-white' : 'bg-gold-primary/10 border-gold-primary/30 text-brass'}`}>
                <span className="absolute right-4 top-2 text-3xl opacity-10 font-display">{isCorrect ? '✓' : '✦'}</span>
                <p className="font-semibold">{isCorrect ? '✓ That\'s right!' : `The answer is: ${block.options?.[correctIdx] ?? block.answer}`}</p>
                {block.explanation && <p className="text-xs opacity-75 mt-1 not-italic">{block.explanation}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-paper border-t border-gold-primary/30 px-5 pt-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {(isLast && answered) || (isLast && block?.type !== 'quiz') ? (
          <Button
            onClick={handleNext}
            disabled={saving}
            className="w-full bg-gold-primary hover:bg-gold-accent text-paper font-display font-bold py-3 text-base"
          >
            <CheckCircle2 size={18} className="mr-2" />
            {saving ? 'Saving...' : `Complete & Earn ${mod.xp_reward || 50} XP`}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={(block?.type === 'quiz' && !answered) || saving}
            className="w-full bg-gold-primary hover:bg-gold-accent text-paper font-display font-bold disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Continue'}
            <ChevronRight size={18} className="ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}