import React from 'react';
import GlyphInfo from '@/components/ui/GlyphInfo';
import GlossyTerm from '@/components/ui/GlossyTerm';
import { findNatalHouseForLongitude } from '@/lib/houseUtils';

/** Format a 24h time string (HH:MM) to 12h or 24h based on preference */
export function formatTime(time24, pref = '12h') {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  if (pref === '24h') return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Shared transit formatting utilities — used by all synthesis prompts and TransitList.
 */

/**
 * Tone directive appended to every interpretation prompt so the app's voice stays
 * invitational rather than diagnostic. Astrosetta teaches and guides — it never
 * diagnoses, prescribes, or declares what the user is feeling.
 */
export const TONE_DIRECTIVE = `TONE — INVITATIONAL, NOT DIAGNOSTIC:
- You are a guide and teacher, not an astrologer pronouncing truths about the user. Never speak as if you know what the user is experiencing.
- Frame every insight as an invitation to notice, reflect, or consider. Prefer language like "you may notice," "this can surface," "notice if," "you might find," "some people experience," "this may echo," rather than diagnostic declarations like "you are," "you feel," "this means," "you will," or "you struggle with."
- Never prescribe behavior or outcomes. Offer possibilities and gentle prompts for self-reflection, never commands or certainties.
- Keep the user positioned as their own astrologer: name the astrological mechanic, then invite them to find where it lands in their lived experience. Trust them to do the noticing.
- Do NOT hedge every sentence into vagueness — be specific about the astrology. The invitation is about how it lands in their life, not about the symbols themselves.`;

export const PLANET_GLYPHS = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E',
  Jupiter: '♃\uFE0E', Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E',
  Chiron: '⚷\uFE0E', 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E', 'Black Moon Lilith': '⚸\uFE0E',
  // Aliases — the LLM may shorten "Black Moon Lilith" to "Lilith" or "Black Moon" in synthesis text
  Lilith: '⚸\uFE0E', 'Black Moon': '⚸\uFE0E',
  'Part of Fortune': '⊕\uFE0E', Tyche: '⊛\uFE0E', Juno: '∯\uFE0E', Pallas: 'Ⴂ\uFE0E', Vesta: 'Ⴇ\uFE0E',
  Juno: '\u26B5\uFE0E', Pallas: '\u26B4\uFE0E', Vesta: '\u26B6\uFE0E', Ascendant: 'Asc', Midheaven: 'MC', Descendant: 'DC', IC: 'IC',
};

export const ASPECT_GLYPHS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', square: '□\uFE0E',
  trine: '△\uFE0E', sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E',
  semisextile: '\u26BA', semisquare: '\u2220', sesquisquare: '\u26BC',
};

export const SIGN_GLYPHS = {
  Aries: '♈\uFE0E', Taurus: '♉\uFE0E', Gemini: '♊\uFE0E', Cancer: '♋\uFE0E',
  Leo: '♌\uFE0E', Virgo: '♍\uFE0E', Libra: '♎\uFE0E', Scorpio: '♏\uFE0E',
  Sagittarius: '♐\uFE0E', Capricorn: '♑\uFE0E', Aquarius: '♒\uFE0E', Pisces: '♓\uFE0E',
};

const ASPECT_ABBREV = {
  conjunction: 'cnj', opposition: 'opp', square: 'sq',
  trine: 'tri', sextile: 'sxt', quincunx: 'qnx',
};

export const ASPECT_ANGLES = {
  conjunction: 0, opposition: 180, square: 90,
  trine: 120, sextile: 60, quincunx: 150,
};

/** Approximate daily motion in degrees — used to estimate transit exact times */
export const DAILY_MOTIONS = {
  Sun: 1.0, Moon: 12.0, Mercury: 1.2, Venus: 1.0, Mars: 0.5,
  Jupiter: 0.08, Saturn: 0.03, Uranus: 0.01, Neptune: 0.006, Pluto: 0.004,
  Chiron: 0.02, 'Black Moon Lilith': 0.11, 'North Node': 0.053, 'South Node': 0.053,
};

/**
 * Estimate the local time a transit aspect becomes exact.
 * Uses approximate daily motion for the transiting planet.
 * @param {number} transitLon - Transit planet longitude at noon
 * @param {number} natalLon - Natal planet longitude
 * @param {string} aspect - Aspect name (conjunction, opposition, etc.)
 * @param {number} orb - Current orb from exact
 * @param {boolean} isRetrograde - Whether transit planet is retrograde
 * @param {string} planetName - Name of the transiting planet (for daily motion lookup)
 * @param {number} noonHour - Decimal hour representing noon (default 12)
 * @returns {{ time: string, applying: boolean, withinDay: boolean } | null}
 */
export function estimateTransitTime(transitLon, natalLon, aspect, orb, isRetrograde, planetName, noonHour = 12) {
  if (transitLon == null || natalLon == null || orb == null) return null;
  const aspectAngle = ASPECT_ANGLES[aspect] ?? 0;
  const exact1 = (natalLon + aspectAngle) % 360;
  const exact2 = (natalLon - aspectAngle + 360) % 360;
  const fwd1 = ((exact1 - transitLon) + 360) % 360;
  const fwd2 = ((exact2 - transitLon) + 360) % 360;
  const fwdToExact = Math.min(fwd1, fwd2);
  const applying = isRetrograde ? fwdToExact > 180 : fwdToExact < 180;

  const dailyMotion = DAILY_MOTIONS[planetName] || 1.0;
  const hoursToExact = (orb / dailyMotion) * 24;
  const withinDay = hoursToExact <= 12;
  const offsetHours = applying ? hoursToExact : -hoursToExact;
  const exactHour = noonHour + offsetHours;
  const clamped = ((exactHour % 24) + 24) % 24;
  const h = Math.floor(clamped);
  let m = Math.round((clamped % 1) * 60);
  // Fix edge case where rounding pushes minutes to 60 (e.g. 11:60)
  let adjustedH = h;
  if (m === 60) { m = 0; adjustedH = (h + 1) % 24; }
  return { time: `${adjustedH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, applying, withinDay };
}

export const HOUSE_THEMES = {
  1: 'identity, appearance',
  2: 'money, values',
  3: 'communication, siblings',
  4: 'home, family',
  5: 'creativity, romance',
  6: 'health, daily work',
  7: 'partnerships, marriage',
  8: 'transformation, shared resources',
  9: 'travel, beliefs, higher learning',
  10: 'career, public reputation',
  11: 'community, friendships, goals',
  12: 'solitude, hidden matters, spirituality',
};

/** Modern rulers — with traditional co-ruler where different */
export const CHART_RULERS = {
  Aries:       { planet: 'Mars',    glyph: '♂\uFE0E',  traditional: null },
  Taurus:      { planet: 'Venus',   glyph: '♀\uFE0E',  traditional: null },
  Gemini:      { planet: 'Mercury', glyph: '☿\uFE0E',  traditional: null },
  Cancer:      { planet: 'Moon',    glyph: '☽\uFE0E',  traditional: null },
  Leo:         { planet: 'Sun',     glyph: '☉\uFE0E',  traditional: null },
  Virgo:       { planet: 'Mercury', glyph: '☿\uFE0E',  traditional: null },
  Libra:       { planet: 'Venus',   glyph: '♀\uFE0E',  traditional: null },
  Scorpio:     { planet: 'Pluto',   glyph: '♇\uFE0E',  traditional: 'Mars' },
  Sagittarius: { planet: 'Jupiter', glyph: '♃\uFE0E',  traditional: null },
  Capricorn:   { planet: 'Saturn',  glyph: '♄\uFE0E',  traditional: null },
  Aquarius:    { planet: 'Uranus',  glyph: '♅\uFE0E',  traditional: 'Saturn' },
  Pisces:      { planet: 'Neptune', glyph: '♆\uFE0E',  traditional: 'Jupiter' },
};

export function getChartRuler(ascendantSign) {
  if (!ascendantSign) return null;
  const entry = CHART_RULERS[ascendantSign];
  if (!entry) return null;
  const ruler = {
    planet: entry.planet,
    glyph: entry.glyph,
    sign: ascendantSign,
    traditional: entry.traditional,
  };
  const trad = entry.traditional ? ` (traditional: ${entry.traditional})` : '';
  ruler.label = `${ruler.planet} rules ${ascendantSign} rising${trad}`;
  return ruler;
}

export const PERSONA = `You are a psychologically astute astrologer and educator — specific, warm, and grounded. You never use generic affirmations or vague spiritual language. You always show your work: you name the specific planetary configurations (planet, sign, aspect, natal planet, house) creating each interpretation and explain the astrological mechanic of how those elements interact to produce the effect. Your goal is to teach the reader how astrology works, not just deliver a horoscope. The Part of Fortune (⊕, Pars Fortunae) is a calculated lot marking where ease, luck, and material opportunity naturally express; Tyche (asteroid 258) is the lot of fortunate coincidence and providence. Juno (asteroid 3) governs committed partnership, marriage, and soul-contracts; Pallas (asteroid 2) is the strategist — creative intelligence, pattern-vision, and skilled craft; Vesta (asteroid 4) is the keeper of the sacred flame — devotion, focused service, and the inner hearth. Treat transits to these points as activations of those life areas, weaving them in where relevant.

${TONE_DIRECTIVE}`;

/**
 * Merge natal planets, angles, and nodes into a single flat array.
 * This ensures transit aspects to angles (Ascendant, MC, DC, IC) and nodes
 * (North/South Node) can be looked up by name — they're stored separately
 * in the chart data (angles/nodes objects, not the planets array).
 */
export function mergeNatalPoints(raw) {
  if (!raw) return [];
  const pts = [...(raw.planets || [])];
  const a = raw.angles || {};
  if (a.ascendant) pts.push({ name: 'Ascendant', ...a.ascendant, house: 1 });
  if (a.midheaven) pts.push({ name: 'Midheaven', ...a.midheaven, house: 10 });
  if (a.descendant) pts.push({ name: 'Descendant', ...a.descendant, house: 7 });
  if (a.ic) pts.push({ name: 'IC', ...a.ic, house: 4 });
  const n = raw.nodes || {};
  const houses = raw.houses || [];
  const houseSystem = raw.house_system || 'whole_sign';
  const ascSign = raw.ascendant_sign;
  // Compute accurate houses for nodes — they don't get houses from chartCalculator
  // but they DO have longitude and sign. Without this, transit labels to nodes
  // show no house, and the LLM hallucinates one from outdated knowledge.
  const fixNodeHouse = (node) => {
    if (node.house == null && node.longitude != null && houses.length) {
      node.house = findNatalHouseForLongitude(node.longitude, houses, houseSystem, ascSign);
    }
    return node;
  };
  if (n.north_node) pts.push(fixNodeHouse({ name: 'North Node', ...n.north_node }));
  if (n.south_node) pts.push(fixNodeHouse({ name: 'South Node', ...n.south_node }));
  return pts;
}

/**
 * Shared glyph pattern for all synthesis content highlighting.
 * Captures astrological symbols and aspects.
 */
const GLYPH_PATTERN = /([☉☽☿♀♂♃♄♅♆♇☊☋☌☍△□⚹⚻⚺∠⚼♈♉♊♋♌♍♎♏♐♑♒♓⚷⚸]+[\uFE0E]?)/g;

/**
 * Highlight astrological glyphs within a text string.
 * `highlightClassName` controls the color of highlighted glyphs — pass the
 * OPPOSITE color of the surrounding body copy (gold body → white highlights,
 * white body → gold highlights). Defaults to white for backward compat.
 */
export function highlightGlyphs(text, highlightClassName = 'text-white') {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = GLYPH_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    parts.push(
      <GlyphInfo key={match.index} glyph={match[1]} className={`${highlightClassName} font-semibold`}>
        {match[1]}
      </GlyphInfo>
    );
    lastIndex = GLYPH_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 1 ? parts : text;
}

const PLANET_NAMES = Object.keys(PLANET_GLYPHS).sort((a, b) => b.length - a.length);
const ASPECT_NAMES = Object.keys(ASPECT_GLYPHS).sort((a, b) => b.length - a.length);
const SIGN_NAMES = Object.keys(SIGN_GLYPHS).sort((a, b) => b.length - a.length);

// Map aspect word forms and abbreviations → canonical name
const ASPECT_WORD_MAP = {
  conjunction: 'conjunction', conjunct: 'conjunction', cnj: 'conjunction', conj: 'conjunction', conjuncting: 'conjunction',
  opposition: 'opposition', opposing: 'opposition', opp: 'opposition', opposite: 'opposition',
  square: 'square', sq: 'square', squaring: 'square', squares: 'square',
  trine: 'trine', tri: 'trine', trining: 'trine', trines: 'trine',
  sextile: 'sextile', sxt: 'sextile', sextiling: 'sextile', sextiles: 'sextile',
  quincunx: 'quincunx', qnx: 'quincunx', inconjunct: 'quincunx', quincunxing: 'quincunx',
  semisextile: 'semisextile', semisquare: 'semisquare', sesquisquare: 'sesquisquare', sesquiquadrate: 'sesquisquare',
};

// Glossary concept terms — transit/event types rendered as clickable GlossyTerm
// popovers alongside the glyph-based planet/sign/aspect highlighting.
const GLOSSARY_TERMS = ['nodal axis', 'ascendant', 'midheaven', 'descendant', 'asc', 'mc', 'dc', 'ic', 'ingresses', 'ingress', 'retrogrades', 'retrograde', 'stations', 'station', 'transits', 'transit', 'stellium', 'stelliums'];
const GLOSSARY_CANON = {
  ingresses: 'ingress', retrogrades: 'retrograde', stations: 'station',
  transits: 'transit', stelliums: 'stellium',
  asc: 'ascendant', mc: 'midheaven', dc: 'descendant', ic: 'ic',
};
const GLOSSARY_TERM_LIST = GLOSSARY_TERMS.sort((a, b) => b.length - a.length).join('|');

// Build regex to match "Planet aspect Planet" patterns — supports full words and abbreviations
const PLANET_LIST = PLANET_NAMES.join('|');
const ASPECT_LIST = Object.keys(ASPECT_WORD_MAP).sort((a, b) => b.length - a.length).join('|');
const TRANSIT_PATTERN = new RegExp(
  `(${PLANET_LIST})\\s+(${ASPECT_LIST})\\s+(${PLANET_LIST})`,
  'gi'
);

/**
 * Highlight transit labels (e.g. "Saturn square Mars", "Mercury opp Saturn")
 * Renders as: glyphs (Planet aspect Planet) with proper Unicode symbols.
 * Shared across all synthesis components for consistent styling.
 */
export function highlightTransitLabels(text) {
  if (!text) return text;
  // Reset regex
  TRANSIT_PATTERN.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = TRANSIT_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
    const p1 = match[1]; // e.g. "Mercury"
    const aspRaw = match[2].toLowerCase(); // e.g. "opp"
    const p2 = match[3]; // e.g. "Saturn"
    const canonAspect = ASPECT_WORD_MAP[aspRaw] || aspRaw;
    const glyph1 = PLANET_GLYPHS[p1] || p1;
    const aspGlyph = ASPECT_GLYPHS[canonAspect] || aspRaw;
    const glyph2 = PLANET_GLYPHS[p2] || p2;
    // Use verb forms for the parenthetical label
    const ASPECT_VERBS = {
      conjunction: 'conjunct', opposition: 'opposing', square: 'squaring',
      trine: 'trining', sextile: 'sextiling', quincunx: 'quincunxing',
    };
    const aspLabel = ASPECT_VERBS[canonAspect] || (canonAspect.charAt(0).toUpperCase() + canonAspect.slice(1));
    parts.push(
      <span key={match.index} className="font-medium" style={{ fontVariantEmoji: 'text' }}>
        <GlyphInfo glyph={glyph1} className="text-white cursor-pointer">{glyph1}</GlyphInfo>
        {' '}
        <GlyphInfo glyph={aspGlyph} className="text-white cursor-pointer">{aspGlyph}</GlyphInfo>
        {' '}
        <GlyphInfo glyph={glyph2} className="text-white cursor-pointer">{glyph2}</GlyphInfo>
        {' '}
        <span className="text-brass/60 font-normal text-[0.85em]">({p1} {aspLabel} {p2})</span>
      </span>
    );
    lastIndex = TRANSIT_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 1 ? parts : text;
}

const SIGN_LIST = SIGN_NAMES.join('|');
const ASPECT_VERBS = {
  conjunction: 'conjunct', opposition: 'opposing', square: 'squaring',
  trine: 'trining', sextile: 'sextiling', quincunx: 'quincunxing',
};

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Case-insensitive planet name lookup — fixes "Black Moon Lilith" matching
// when the LLM outputs different capitalization (e.g. "black moon lilith")
const PLANET_LOOKUP = {};
for (const name of PLANET_NAMES) {
  PLANET_LOOKUP[name.toLowerCase()] = name;
}

/**
 * Strip "applying" and "separating" status words from synthesis text.
 * The LLM sometimes includes these despite instructions not to.
 */
export function stripApplyingSeparating(text) {
  if (!text) return text;
  return text.replace(/\s*\b(applying|separating)\b\s*,?\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}

// Combined pattern: transit patterns (Planet aspect Planet) take priority,
// then standalone planets, signs, and aspect words
const ALL_LABELS_PATTERN = new RegExp(
  `\\b(${PLANET_LIST})(?:\\s+in\\s+(?:${SIGN_LIST}))?\\s+(${ASPECT_LIST})\\s+(?:natal\\s+)?(${PLANET_LIST})(?:\\s+in\\s+(?:${SIGN_LIST}))?\\b` +
  `|\\b(${PLANET_LIST})\\b` +
  `|\\b(${SIGN_LIST})\\b` +
  `|\\b(${ASPECT_LIST})\\b` +
  `|\\b(\\d{1,2}(?:st|nd|rd|th)\\s+House)\\b` +
  `|\\b(${GLOSSARY_TERM_LIST})\\b`,
  'gi'
);

/**
 * Comprehensive highlighter for all astrological terms in synthesis text.
 * Renders glyph + word for planets, signs, aspects, and full transit patterns.
 * Transit patterns get all three glyphs plus a parenthetical label.
 */
export function highlightAllLabels(text, onTransitClick, highlightClassName = 'text-white') {
  if (!text) return text;
  ALL_LABELS_PATTERN.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = ALL_LABELS_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));

    if (match[1] && match[2] && match[3]) {
      // Transit pattern: Planet aspect Planet
      const p1 = PLANET_LOOKUP[match[1].toLowerCase()] || capitalizeFirst(match[1]);
      const aspRaw = match[2].toLowerCase();
      const p2 = PLANET_LOOKUP[match[3].toLowerCase()] || capitalizeFirst(match[3]);
      const canonAspect = ASPECT_WORD_MAP[aspRaw] || aspRaw;
      const glyph1 = PLANET_GLYPHS[p1] || '';
      const aspGlyph = ASPECT_GLYPHS[canonAspect] || '';
      const glyph2 = PLANET_GLYPHS[p2] || '';
      const aspLabel = ASPECT_VERBS[canonAspect] || canonAspect;
      parts.push(
        <span key={match.index} className="font-medium" style={{ fontVariantEmoji: 'text' }} onClick={onTransitClick ? () => onTransitClick(`tasp_${p1}_${canonAspect}_${p2}`) : undefined}>
          <GlyphInfo glyph={glyph1} className={`${highlightClassName} cursor-pointer`}>{glyph1}</GlyphInfo>
          {' '}
          <GlyphInfo glyph={aspGlyph} className={`${highlightClassName} cursor-pointer`}>{aspGlyph}</GlyphInfo>
          {' '}
          <GlyphInfo glyph={glyph2} className={`${highlightClassName} cursor-pointer`}>{glyph2}</GlyphInfo>
          {' '}
          <span className="text-brass/60 font-normal text-[0.85em]">({p1} {aspLabel} {/\bnatal\b/i.test(match[0]) ? 'natal ' : ''}{p2})</span>
        </span>
      );
    } else if (match[4]) {
      // Standalone planet — glyph + word together clickable
      const planet = PLANET_LOOKUP[match[4].toLowerCase()] || capitalizeFirst(match[4]);
      const glyph = PLANET_GLYPHS[planet];
      if (glyph) {
        parts.push(
          <GlyphInfo key={match.index} glyph={glyph} className={`${highlightClassName} font-medium cursor-pointer`} style={{ fontVariantEmoji: 'text' }}>
            {glyph} {planet}
          </GlyphInfo>
        );
      } else {
        parts.push(match[0]);
      }
    } else if (match[5]) {
      // Standalone sign — glyph + word together clickable
      const sign = capitalizeFirst(match[5]);
      const glyph = SIGN_GLYPHS[sign];
      if (glyph) {
        parts.push(
          <GlyphInfo key={match.index} glyph={glyph} className={`${highlightClassName} font-medium cursor-pointer`} style={{ fontVariantEmoji: 'text' }}>
            {glyph} {sign}
          </GlyphInfo>
        );
      } else {
        parts.push(match[0]);
      }
    } else if (match[6]) {
      // Standalone aspect word — glyph + word together clickable
      const aspRaw = match[6].toLowerCase();
      const canonAspect = ASPECT_WORD_MAP[aspRaw] || aspRaw;
      const glyph = ASPECT_GLYPHS[canonAspect];
      if (glyph) {
        parts.push(
          <GlyphInfo key={match.index} glyph={glyph} className={`${highlightClassName} font-medium cursor-pointer`} style={{ fontVariantEmoji: 'text' }}>
            {glyph} {match[6]}
          </GlyphInfo>
        );
      } else {
        parts.push(match[0]);
      }
    } else if (match[7]) {
      // House reference, e.g. "8th House"
      parts.push(
        <span key={match.index} className={`${highlightClassName} font-medium`}>
          {match[7].replace(/\s+/g, ' ')}
        </span>
      );
    } else if (match[8]) {
      // Glossary concept term — ingress, retrograde, station, nodal axis, transit, stellium
      const raw = match[8];
      const lower = raw.toLowerCase();
      const termKey = GLOSSARY_CANON[lower] || lower;
      parts.push(
        <GlossyTerm key={match.index} term={termKey} className={highlightClassName}>
          {raw}
        </GlossyTerm>
      );
    }

    lastIndex = ALL_LABELS_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 1 ? parts : text;
}

/**
 * Apply glyph and comprehensive label highlighting to synthesis text.
 * Matches planets, signs, aspects, and full transit patterns — rendering
 * each with its glyph symbol alongside the word for educational reinforcement.
 * Use this for all synthesis content blocks.
 */
export function highlightSynthesisText(text, onTransitClick, highlightClassName = 'text-white') {
  if (!text) return text;
  const cleaned = stripApplyingSeparating(text);
  const glyphHighlighted = highlightGlyphs(cleaned, highlightClassName);
  if (typeof glyphHighlighted === 'string') return highlightAllLabels(glyphHighlighted, onTransitClick, highlightClassName);
  return glyphHighlighted.flatMap(part =>
    typeof part === 'string' ? highlightAllLabels(part, onTransitClick, highlightClassName) : part
  );
}

/**
 * Infer whether a transit is applying (moving toward exactness) or separating.
 * @param {number|null} transitLon - Transiting planet longitude
 * @param {number|null} natalLon   - Natal planet longitude
 * @param {string|number} aspect   - Aspect name or angle in degrees
 * @param {boolean} isRetrograde   - Whether the transit planet is retrograde
 * @returns {boolean} true = applying (▲), false = separating (▽)
 */
export function isApplying(transitLon, natalLon, aspect, isRetrograde) {
  if (transitLon == null || natalLon == null) return true;
  const aspectAngle = typeof aspect === 'number' ? aspect : (ASPECT_ANGLES[aspect] ?? 0);
  // Two possible exact points (aspect can occur from either side)
  const exact1 = (natalLon + aspectAngle) % 360;
  const exact2 = (natalLon - aspectAngle + 360) % 360;
  // Forward distance to each exact point
  const fwd1 = ((exact1 - transitLon) + 360) % 360;
  const fwd2 = ((exact2 - transitLon) + 360) % 360;
  // Closest exact point, forward distance
  const fwdToExact = Math.min(fwd1, fwd2);
  // Direct planets apply by moving forward; retrograde apply by moving backward
  return isRetrograde ? fwdToExact > 180 : fwdToExact < 180;
}

/**
 * Format a transit aspect as a standardized glyph label string.
 * Personal: "♄ □ ♂ — Saturn sq Mars (3H) ▲"
 * Mundane:  "♀ ☌ ♆ — Venus cnj Neptune ▲"
 *
 * @param {object} a              - Aspect object with transit_planet, natal_planet, aspect, orb
 * @param {Array}  transitPlanets - Array of transiting planet objects (with longitude, retrograde)
 * @param {Array}  natalPlanets   - Array of natal planet objects (with longitude, house)
 * @param {boolean} isMundane     - If true, natal_planet is also a transit planet
 */
export function formatTransitLabel(a, transitPlanets, natalPlanets, isMundane = false) {
  const tGlyph = PLANET_GLYPHS[a.transit_planet] || '';
  const aspGlyph = ASPECT_GLYPHS[a.aspect] || a.aspect;
  const nGlyph = PLANET_GLYPHS[a.natal_planet] || '';
  const aspAbbrev = ASPECT_ABBREV[a.aspect] || a.aspect;
  const tP = transitPlanets?.find(p => p.name === a.transit_planet);
  const nP = isMundane
    ? transitPlanets?.find(p => p.name === a.natal_planet)
    : natalPlanets?.find(p => p.name === a.natal_planet);
  const house = !isMundane ? nP?.house : null;
  const houseStr = house ? ` (${house}H)` : '';
  return `${tGlyph} ${aspGlyph} ${nGlyph} — ${a.transit_planet} ${aspAbbrev} ${a.natal_planet}${houseStr}`;
}

/**
 * Prose-only transit label for LLM prompts — no glyphs or em-dash format.
 * Returns: "Saturn square natal Sun (3H) ▲"
 */
export function formatTransitLabelProse(a, transitPlanets, natalPlanets, isMundane = false) {
  const tP = transitPlanets?.find(p => p.name === a.transit_planet);
  const nP = isMundane
    ? transitPlanets?.find(p => p.name === a.natal_planet)
    : natalPlanets?.find(p => p.name === a.natal_planet);
  const tSign = tP?.sign ? ` in ${tP.sign}` : '';
  const nSign = nP?.sign ? ` in ${nP.sign}` : '';
  const house = !isMundane ? nP?.house : null;
  const houseStr = house ? ` (${house}H)` : '';
  const natalPrefix = isMundane ? '' : 'natal ';
  return `${a.transit_planet}${tSign} ${a.aspect} ${natalPrefix}${a.natal_planet}${nSign}${houseStr}`;
}