// Cards use existing, visible content. Sharing never calls an LLM or includes
// account identifiers, birth details or another hidden reading.
export function plainShareText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '').replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*|__|`/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// Keep all the text, splitting at word boundaries rather than clipping a
// longer interpretation to fit one image. New reading cards use Stories size.
export function buildReadingSharePages({ title, text, glyph = '✦', kicker = 'ASTROSETTA', audienceLabel = '', dateStr = '' }) {
  const body = plainShareText(text);
  if (!body) return [];
  const heading = plainShareText(title) || 'Astrosetta';
  const words = body.split(/\s+/);
  const chunks = [];
  let chunk = '';
  for (const word of words) {
    if (chunk && (chunk.length + 1 + word.length > 600 || chunk.split(' ').length >= 85)) {
      chunks.push(chunk); chunk = '';
    }
    chunk += `${chunk ? ' ' : ''}${word}`;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((body, index) => ({
    glyph, kicker, title: heading, bodyType: 'prose', body, format: 'story', compactReading: true,
    audienceLabel, dateStr: [dateStr, chunks.length > 1 ? `Card ${index + 1} of ${chunks.length}` : ''].filter(Boolean).join(' · '),
    textFallback: `${heading}\n\n${plainShareText(text)}\n\nastrosetta.com`,
  }));
}
