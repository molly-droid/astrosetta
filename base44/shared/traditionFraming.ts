/**
 * Tradition-specific LLM prompt framing.
 *
 * Imported by the synthesis / interpretation / email backend functions to
 * inject a tradition's interpretive lens into every LLM prompt. The active
 * tradition is read from the user's UserProgress record.
 *
 * tradition: 'modern' | 'hellenistic' | 'vedic' (defaults to 'modern')
 */

export type Tradition = 'modern' | 'hellenistic' | 'vedic';

interface Framing {
  name: string;
  zodiac: string;
  /** One-line directive appended to the system/persona instructions. */
  directive: string;
  /** Bullet points woven into the data/context section of the prompt. */
  emphasis: string[];
  /** Tone & terminology guidance. */
  terminology: string;
}

const FRAMINGS: Record<Tradition, Framing> = {
  modern: {
    name: 'Modern Psychological astrology',
    zodiac: 'tropical',
    directive:
      'Read the chart through a modern psychological lens. Prioritise archetypal depth, inner process, and growth-oriented integration. Treat Uranus, Neptune, and Pluto as full planets with co-rulerships (e.g. Uranus co-rules Aquarius, Neptune co-rules Pisces, Pluto co-rules Scorpio) alongside their classical rulers.',
    emphasis: [
      'Outer-planet archetypes and generational themes',
      'Psychological integration and self-actualisation',
      'Aspect patterns as inner dynamics',
      'House placements as life arenas for psychological expression',
    ],
    terminology:
      'Use contemporary, psychologically resonant language. Reference archetypes, the unconscious, and growth edges. Avoid prescriptive fate language.',
  },
  hellenistic: {
    name: 'Hellenistic (traditional) astrology',
    zodiac: 'tropical',
    directive:
      'Read the chart through a Hellenistic traditional lens. Determine sect (day vs. night chart) and use it to weight benefic/malefic planets. Use the classical seven-planet rulerships only (no outer-planet rulerships). Reference essential dignities (domicile, exaltation, detriment, fall, peregrine), bonifications (joys, sect benefics), and the Lots (Lot of Fortune, Lot of Spirit) where relevant.',
    emphasis: [
      'Sect determination and the sect benefic/malefic',
      'Essential dignities and debilities of each placement',
      'The ruler of the Ascendant and its condition',
      'Bonifications and maltreatments (witnesses, enclosure, overcoming)',
      'The Lots as authored points of fortune and spirit',
    ],
    terminology:
      'Use classical terminology — domicile, exaltation, detriment, fall, peregrine, sect, benefic/malefic, testimony, overseer. Frame outcomes as tendencies with room for rectification, not fixed fate.',
  },
  vedic: {
    name: 'Vedic / Jyotish astrology',
    zodiac: 'sidereal (Lahiri ayanamsa)',
    directive:
      'Read the chart through a Jyotish (Vedic) lens. All longitudes provided are sidereal (Lahiri ayanamsa). Use the classical Jyotish rulerships (Mars rules Aries and Scorpio, Mercury rules Gemini and Virgo, etc.; no outer-planet rulerships). Reference nakshatras (the 27 lunar mansions) where the Moon or luminaries are involved, and note the relevance of divisional charts (e.g. Navamsha for relationships and soul-purpose) without fabricating exact positions.',
    emphasis: [
      'Sidereal sign (rashi) placements',
      'Nakshatra of the Moon (and luminaries where relevant)',
      'Jyotish rulerships and disposititor chains',
      'Divisional-chart context (Navamsha, Dashamsha) noted conceptually',
      'Dasha/bhukti framing as a timing layer where appropriate',
    ],
    terminology:
      'Use Jyotish terminology — rashi, nakshatra, bhava, disposititor, dasha, divisional chart. Keep the tone reflective and remedial rather than fatalistic.',
  },
};

export function getTraditionFraming(tradition: string | null | undefined): Framing {
  const t = (tradition as Tradition) || 'modern';
  return FRAMINGS[t] || FRAMINGS.modern;
}

/**
 * Renders a compact "Tradition lens" preamble to prepend to an LLM prompt.
 */
export function traditionPromptPreamble(tradition: string | null | undefined): string {
  const f = getTraditionFraming(tradition);
  return [
    `You are reading this chart in the ${f.name}.`,
    `Zodiac: ${f.zodiac}.`,
    f.directive,
    `Emphasise: ${f.emphasis.join('; ')}.`,
    `Terminology & tone: ${f.terminology}`,
  ].join('\n');
}