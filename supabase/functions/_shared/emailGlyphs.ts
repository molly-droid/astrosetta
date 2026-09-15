/**
 * Shared email glyph inserter — mirrors src/lib/transitUtils.jsx highlightAllLabels.
 *
 * Email synthesis text is written by the LLM in plain English WORDS (no glyph
 * symbols). This module inserts the matching Unicode glyph before each planet,
 * sign, and aspect word so the email reliably renders word + symbol together —
 * the same approach the in-app Daily Reading uses. This avoids the LLM emitting
 * glyph-only "soup" (e.g. "☿ ☌ ♇") which is unreadable and uneducational.
 *
 * \uFE0E (text variation selector) is appended to every glyph to force text
 * rendering and prevent emoji presentation in Apple Mail and other clients.
 */

const PLANET_GLYPHS: Record<string, string> = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E',
  Jupiter: '♃\uFE0E', Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E',
  Chiron: '⚷\uFE0E', 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E',
  'Black Moon Lilith': '⚸\uFE0E', Lilith: '⚸\uFE0E', 'Black Moon': '⚸\uFE0E',
  Ascendant: 'AC', Midheaven: 'MC', Descendant: 'DC',
};
const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', square: '□\uFE0E',
  trine: '△\uFE0E', sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E',
};
const SIGN_GLYPHS: Record<string, string> = {
  Aries: '♈\uFE0E', Taurus: '♉\uFE0E', Gemini: '♊\uFE0E', Cancer: '♋\uFE0E',
  Leo: '♌\uFE0E', Virgo: '♍\uFE0E', Libra: '♎\uFE0E', Scorpio: '♏\uFE0E',
  Sagittarius: '♐\uFE0E', Capricorn: '♑\uFE0E', Aquarius: '♒\uFE0E', Pisces: '♓\uFE0E',
};
const ASPECT_WORD_MAP: Record<string, string> = {
  conjunction: 'conjunction', conjunct: 'conjunction', conjuncting: 'conjunction',
  opposition: 'opposition', opposing: 'opposition', opposite: 'opposition',
  square: 'square', squaring: 'square', squares: 'square',
  trine: 'trine', trining: 'trine', trines: 'trine',
  sextile: 'sextile', sextiling: 'sextile', sextiles: 'sextile',
  quincunx: 'quincunx', quincunxing: 'quincunx', inconjunct: 'quincunx',
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "IC" excluded — too short for reliable case-insensitive word-boundary matching.
const PLANET_NAMES = Object.keys(PLANET_GLYPHS).filter(n => n !== 'IC').sort((a, b) => b.length - a.length);
const SIGN_NAMES = Object.keys(SIGN_GLYPHS).sort((a, b) => b.length - a.length);
const ASPECT_WORDS = Object.keys(ASPECT_WORD_MAP).sort((a, b) => b.length - a.length);
const ALL_TERMS = [...PLANET_NAMES, ...SIGN_NAMES, ...ASPECT_WORDS];
const TERM_RE = new RegExp('\\b(' + ALL_TERMS.map(escapeRegex).join('|') + ')\\b', 'gi');

const PLANET_LOOKUP: Record<string, string> = {};
for (const n of PLANET_NAMES) PLANET_LOOKUP[n.toLowerCase()] = n;
const SIGN_LOOKUP: Record<string, string> = {};
for (const s of SIGN_NAMES) SIGN_LOOKUP[s.toLowerCase()] = s;

/**
 * Insert the matching glyph before each planet, sign, and aspect word in prose.
 * @param text      Plain-English synthesis text (no HTML).
 * @param goldColor CSS color string for the glyph span.
 * @returns HTML string with glyph spans inserted.
 */
export function insertGlyphs(text: string, goldColor: string): string {
  if (!text) return '';
  return String(text).replace(TERM_RE, (match: string) => {
    const lower = match.toLowerCase();
    let glyph: string | null = null;
    let display = match;
    const pKey = PLANET_LOOKUP[lower];
    if (pKey) { glyph = PLANET_GLYPHS[pKey]; display = pKey; }
    if (!glyph) {
      const sKey = SIGN_LOOKUP[lower];
      if (sKey) { glyph = SIGN_GLYPHS[sKey]; display = sKey; }
    }
    if (!glyph) {
      const canon = ASPECT_WORD_MAP[lower];
      if (canon) { glyph = ASPECT_GLYPHS[canon]; display = match; }
    }
    if (!glyph) return match;
    return `<span style="color:${goldColor};">${glyph}</span> ${display}`;
  });
}