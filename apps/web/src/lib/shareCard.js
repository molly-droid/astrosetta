import html2canvas from 'html2canvas';
import { PLANET_GLYPHS, SIGN_GLYPHS } from '@/lib/chartUtils';
import { ECLIPSE_META } from '@/lib/eclipseUtils';

const PLANET_DOMAINS = {
  Sun: 'identity, vitality, and creative purpose',
  Moon: 'emotions, instincts, and inner rhythms',
  Mercury: 'communication, learning, and ideas',
  Venus: 'love, beauty, and values',
  Mars: 'drive, action, and desire',
  Jupiter: 'expansion, wisdom, and opportunity',
  Saturn: 'structure, discipline, and mastery',
  Uranus: 'innovation, freedom, and disruption',
  Neptune: 'dreams, intuition, and dissolution',
  Pluto: 'transformation, power, and rebirth',
  Chiron: 'healing and the wound that teaches',
};

const PLANET_DURATIONS = {
  Sun: 'about a month', Mercury: '2–4 weeks', Venus: '3–4 weeks',
  Mars: 'about two months', Jupiter: 'about a year', Saturn: 'about 2½ years',
  Uranus: 'about 7 years', Neptune: 'about 14 years', Pluto: '12–30 years', Chiron: '4–8 years',
};

const STATION_DURATIONS = {
  Mercury: 'about 3 weeks', Venus: 'about 6 weeks',
  Mars: 'about 2½ months', Jupiter: 'about 4 months',
  Saturn: 'about 4–5 months', Uranus: 'about 5 months',
  Neptune: 'about 5–6 months', Pluto: 'about 5–6 months', Chiron: 'about 4–5 months',
};

function hashtag(str) {
  return '#' + String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Capture a DOM element (the 1080×1080 share card) as a PNG download.
 */
export async function captureCardAsPng(element, filename) {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0f1a2e',
    width: 1080,
    height: 1080,
    scale: 1,
    useCORS: true,
    logging: false,
    windowWidth: 1080,
    windowHeight: 1080,
  });
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function copyShareText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Build card data for a planetary ingress. */
export function buildIngressCardData(ing, dateStr) {
  const glyph = PLANET_GLYPHS[ing.planet] || '✦';
  const isApproaching = !!ing.approaching;
  const verb = isApproaching ? 'approaches' : 'enters';
  const title = `${ing.planet} ${verb} ${ing.to_sign}`;
  const kicker = isApproaching ? 'APPROACHING INGRESS' : ing.recent ? 'JUST ENTERED' : 'MAJOR INGRESS';
  const duration = PLANET_DURATIONS[ing.planet] || 'an extended period';
  const domain = PLANET_DOMAINS[ing.planet] || 'a shifting archetypal current';
  const body = `${ing.planet} ${verb} ${ing.to_sign}${ing.from_sign ? `, leaving ${ing.from_sign}` : ''}. Over the next ${duration}, the collective terrain of ${domain} is filtered through ${ing.to_sign}'s themes.`;
  const hashtags = ['#astrology', hashtag(ing.planet), hashtag(ing.to_sign), '#ingress', '#astrosetta'];
  const textFallback = `${title}\n${dateStr}\n\n${body}\n\n${hashtags.join(' ')}\n\nRead your chart → astrosetta.com`;
  return { glyph, glyphColor: '#C9A961', kicker, title, bodyType: 'prose', body, dateStr, hashtags, textFallback };
}

/** Build card data for a planetary station (retrograde / direct). */
export function buildStationCardData(station, dateStr) {
  const glyph = PLANET_GLYPHS[station.planet] || '✦';
  const isRx = station.type === 'retrograde';
  const verb = isRx ? 'stations retrograde' : 'stations direct';
  const title = `${station.planet} ${verb}`;
  const kicker = station.approaching
    ? `APPROACHING ${isRx ? 'RX' : 'DIRECT'} STATION`
    : `${isRx ? 'RETROGRADE' : 'DIRECT'} STATION`;
  const duration = STATION_DURATIONS[station.planet] || 'several weeks';
  const domain = PLANET_DOMAINS[station.planet] || 'this planet\'s energy';
  const direction = isRx ? 'inward, revisiting and reflecting' : 'outward, moving forward with momentum';
  const body = `${station.planet} ${verb} at ${station.degree?.toFixed(1)}° ${station.sign}. For the next ${duration}, ${domain} turns ${direction} across the collective.`;
  const hashtags = ['#astrology', hashtag(station.planet), hashtag(station.sign), isRx ? '#retrograde' : '#directmotion', '#astrosetta'];
  const textFallback = `${title}\n${dateStr}\n\n${body}\n\n${hashtags.join(' ')}\n\nRead your chart → astrosetta.com`;
  const glyphColor = isRx ? '#8B7B6B' : '#A8C8A8';
  return { glyph, glyphColor, kicker, title, bodyType: 'prose', body, dateStr, hashtags, textFallback };
}

/** Build card data for a lunation (New / Full Moon) or eclipse. */
export function buildLunationCardData(lunation, dateStr) {
  const isFull = lunation.phase === 'Full Moon';
  const isEclipse = !!lunation.isEclipse;
  const eclipseMeta = isEclipse && lunation.eclipseType ? ECLIPSE_META[lunation.eclipseType] : null;
  const label = eclipseMeta ? eclipseMeta.label : lunation.phase;
  const glyph = isFull ? '●' : '○';
  const title = `${label} in ${lunation.moonSign}`;
  const kicker = eclipseMeta
    ? (lunation.eclipseType === 'solar' ? 'SOLAR ECLIPSE' : 'LUNAR ECLIPSE')
    : (isFull ? 'FULL MOON' : 'NEW MOON');
  const domain = isFull
    ? 'illuminating what is ready to culminate and release'
    : 'seeding a fresh cycle of intention';
  const body = eclipseMeta
    ? `${label} in ${lunation.moonSign} — a fated checkpoint, not an ordinary ${isFull ? 'full' : 'new'} moon. ${isFull ? 'Closures and revelations' : 'Beginnings and intentions'} seeded now ripple out across the coming six months.`
    : `${lunation.phase} in ${lunation.moonSign} — ${domain}. The emotional weather of the next two weeks is set by this lunation's sign.`;
  const hashtags = ['#astrology', '#moon', hashtag(lunation.moonSign), isFull ? '#fullmoon' : '#newmoon', isEclipse ? '#eclipse' : '#lunation', '#astrosetta'];
  const textFallback = `${title}\n${dateStr}\n\n${body}\n\n${hashtags.join(' ')}\n\nRead your chart → astrosetta.com`;
  const glyphColor = isEclipse ? (lunation.eclipseType === 'solar' ? '#C9A961' : '#D4AF85') : '#C9A961';
  return { glyph, glyphColor, kicker, title, bodyType: 'prose', body, dateStr, hashtags, textFallback };
}

/** Build card data for a rising-sign listicle (from backend function output). */
export function buildRisingSignCardData(sign, content, dateStr) {
  const glyph = SIGN_GLYPHS[sign] || '✦';
  const bullets = Array.isArray(content?.bullets) ? content.bullets : [];
  const headline = content?.headline || `What today means for ${sign} Rising`;
  const hashtags = ['#astrology', hashtag(sign), '#rising', '#horoscope', '#astrosetta'];
  const textFallback = `${headline}\n${dateStr}\n\n${bullets.map(b => `✦ ${b}`).join('\n')}\n\n${hashtags.join(' ')}\n\nGet your chart → astrosetta.com`;
  return { glyph, glyphColor: '#C9A961', kicker: 'DAILY HOROSCOPE', title: headline, bodyType: 'bullets', bullets, dateStr, hashtags, textFallback };
}

/** Format today's top collective transits into a context string for the rising-sign LLM. */
export function formatCollectiveContext(transits) {
  if (!transits) return '';
  const lines = [];
  const ingresses = (transits.ingresses || []).slice(0, 2);
  ingresses.forEach(ing => {
    const verb = ing.approaching ? 'approaches' : 'enters';
    lines.push(`${ing.planet} ${verb} ${ing.to_sign}`);
  });
  const stations = (transits.stations || []).filter(s => !s.approaching).slice(0, 1);
  stations.forEach(s => {
    lines.push(`${s.planet} stations ${s.type} at ${s.degree?.toFixed(0)}° ${s.sign}`);
  });
  const mundane = (transits.mundaneAspects || []).slice(0, 2);
  mundane.forEach(a => {
    lines.push(`${a.planet1} ${a.aspect} ${a.planet2} (orb ${a.orb?.toFixed(1)}°)`);
  });
  if (transits.isExactFullMoon || transits.isExactNewMoon) {
    const phase = transits.isExactFullMoon ? 'Full Moon' : 'New Moon';
    lines.push(`${transits.isEclipse ? 'Eclipse: ' : ''}${phase} in ${transits.moonSign}`);
  }
  return lines.join('; ');
}