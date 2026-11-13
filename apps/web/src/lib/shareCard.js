import html2canvas from 'html2canvas';
import { PLANET_GLYPHS, SIGN_GLYPHS } from '@/lib/chartUtils';
import { ECLIPSE_META } from '@/lib/eclipseUtils';
import { HOUSE_NAMES } from '@/lib/houseUtils';
import { isNativePlatform } from '@/lib/platform';

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
 * Capture a DOM element (the 1080×1080 share card) as a PNG and hand it to the
 * user (B-03).
 *
 * On web that's an <a download>. In the native app that link is a no-op —
 * WKWebView ignores downloads of data: URLs, which is why "Download image" did
 * nothing on Molly's phone. Native instead writes the PNG to the app's cache
 * and opens the system share sheet, whose "Save Image" action saves to Photos
 * (iOS shows the NSPhotoLibraryAddUsageDescription prompt at that point) and
 * also allows sharing straight to Messages/Instagram — the point of a share
 * card.
 *
 * Returns 'shared' | 'downloaded'; throws if the capture itself fails.
 */
export async function captureCardAsPng(element, filename, size = { width: 1080, height: 1080 }) {
  const { width, height } = size;
  const canvas = await html2canvas(element, {
    backgroundColor: '#0f1a2e',
    width,
    height,
    scale: 1,
    useCORS: true,
    logging: false,
    windowWidth: width,
    windowHeight: height,
  });
  const dataUrl = canvas.toDataURL('image/png');

  if (isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const path = `${filename}-${Date.now()}.png`;
    await Filesystem.writeFile({
      path,
      data: dataUrl.split(',')[1], // base64 payload without the data: prefix
      directory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title: filename, files: [uri] });
    return 'shared';
  }

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
  return 'downloaded';
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
export function buildRisingSignCardData(sign, content, dateStr, { basis = 'rising', period = 'day' } = {}) {
  const glyph = SIGN_GLYPHS[sign] || '✦';
  const bullets = Array.isArray(content?.bullets) ? content.bullets : [];
  const signLabel = basis === 'sun' ? 'Sun' : 'Rising';
  const headline = content?.headline || `What ${period === 'week' ? 'this week' : 'today'} means for ${sign} ${signLabel}`;
  const hashtags = ['#astrology', hashtag(sign), basis === 'sun' ? '#sunsign' : '#rising', '#horoscope', '#astrosetta'];
  // AI-01: the image shows the short standalone summary (the full bullet list
  // overflowed the square card). The copied text keeps the bullets, where
  // there is no size limit.
  const summary = typeof content?.summary === 'string' ? content.summary.trim() : '';
  const readingText = bullets.length ? bullets.map(b => `✦ ${b}`).join('\n') : summary;
  const textFallback = `${headline}\n${dateStr}\n\n${readingText}\n\n${hashtags.join(' ')}\n\nGet your chart → astrosetta.com`;
  const base = { glyph, glyphColor: '#C9A961', kicker: `${period === 'week' ? 'WEEKLY' : 'DAILY'} ${basis === 'sun' ? 'SUN-SIGN READING' : 'HOROSCOPE'}`, title: headline, dateStr, hashtags, textFallback };
  return summary
    ? { ...base, bodyType: 'prose', body: summary, bullets }
    : { ...base, bodyType: 'bullets', bullets };
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
// ── F-04 / F-05 / F-06 card builders ─────────────────────────────────────────
// "everyone" cards describe the collective sky and carry no personal chart
// details; "mine" cards say how the same event lands in the user's chart.

const ASPECT_WORDS = {
  conjunction: 'merge and amplify each other',
  opposition: 'pull against each other, asking for balance',
  trine: 'flow together with ease',
  square: 'create friction that pushes for change',
  sextile: 'open a cooperative opportunity',
};
const INVITE = 'Learn astrology through your own chart · astrosetta.com';

const houseLabel = (house) => (house ? HOUSE_NAMES[house] : null);

/** Tag an existing (collective) card as the "Today's sky" variant. */
export function asEveryone(card) {
  return card ? { ...card, audience: 'everyone' } : card;
}

/** Personal version of an ingress: which of the user's houses it enters. */
export function buildPersonalIngressCardData(ing, dateStr, house) {
  const base = buildIngressCardData(ing, dateStr);
  const where = houseLabel(house);
  if (!where) return null;
  const body = `${ing.planet} ${ing.approaching ? 'approaches' : 'enters'} ${ing.to_sign} in my ${where}. For ${PLANET_DURATIONS[ing.planet] || 'a while'}, ${PLANET_DOMAINS[ing.planet] || 'its themes'} play out in this part of my life.`;
  return { ...base, audience: 'mine', kicker: 'MY INGRESS', body, textFallback: `${base.title}, in my ${where}\n${dateStr}\n\n${body}\n\n${INVITE}` };
}

/** Personal version of a station. */
export function buildPersonalStationCardData(station, dateStr, house) {
  const base = buildStationCardData(station, dateStr);
  const where = houseLabel(house);
  if (!where) return null;
  const isRx = station.type === 'retrograde';
  const body = `${station.planet} ${isRx ? 'stations retrograde' : 'stations direct'} at ${station.degree?.toFixed(1)}° ${station.sign}, in my ${where}. ${isRx ? 'Time to revisit and rethink' : 'Things start moving again'} in this part of my life.`;
  return { ...base, audience: 'mine', kicker: 'MY STATION', body, textFallback: `${base.title}, in my ${where}\n${dateStr}\n\n${body}\n\n${INVITE}` };
}

/** Personal version of a lunation. */
export function buildPersonalLunationCardData(lunation, dateStr, house) {
  const base = buildLunationCardData(lunation, dateStr);
  const where = houseLabel(house);
  if (!where) return null;
  const isFull = lunation.phase === 'Full Moon';
  const body = `This ${base.title} lands in my ${where}. ${isFull ? 'Something in this part of my life comes to light or completes.' : 'A fresh start is seeded in this part of my life.'}`;
  return { ...base, audience: 'mine', kicker: `MY ${base.kicker}`, body, textFallback: `${base.title}, in my ${where}\n${dateStr}\n\n${body}\n\n${INVITE}` };
}

/** A collective planet-to-planet transit, for everyone. */
export function buildSkyAspectCardData(a, dateStr) {
  const p1 = a.planet1 || a.transit_planet, p2 = a.planet2 || a.natal_planet;
  const title = `${p1} ${a.aspect} ${p2}`;
  const body = `${p1} and ${p2} ${ASPECT_WORDS[a.aspect] || 'meet in the sky'}. Everyone feels it through ${PLANET_DOMAINS[p1] || p1} meeting ${PLANET_DOMAINS[p2] || p2}.`;
  const hashtags = ['#astrology', hashtag(p1), hashtag(p2), hashtag(a.aspect), '#astrosetta'];
  return { glyph: `${PLANET_GLYPHS[p1] || ''} ${PLANET_GLYPHS[p2] || ''}`.trim() || '✦', glyphColor: '#C9A961', kicker: "TODAY'S TRANSIT", title, bodyType: 'prose', body, dateStr, audience: 'everyone', hashtags, textFallback: `${title}\n${dateStr}\n\n${body}\n\n${hashtags.join(' ')}\n\nRead your chart → astrosetta.com` };
}

/** The same collective transit, through the user's houses. */
export function buildMySkyAspectCardData(a, dateStr, house1, house2) {
  const base = buildSkyAspectCardData(a, dateStr);
  const p1 = a.planet1 || a.transit_planet, p2 = a.planet2 || a.natal_planet;
  if (!house1 || !house2) return null;
  const body = house1 === house2
    ? `${p1} and ${p2} ${ASPECT_WORDS[a.aspect] || 'meet'} in my ${HOUSE_NAMES[house1]}.`
    : `${p1} in my ${HOUSE_NAMES[house1]} and ${p2} in my ${HOUSE_NAMES[house2]} ${ASPECT_WORDS[a.aspect] || 'meet'}, linking those two parts of my life.`;
  return { ...base, audience: 'mine', kicker: 'MY TRANSIT', body, textFallback: `${base.title}\n${dateStr}\n\n${body}\n\n${INVITE}` };
}

/** An aspect-pattern formation (Grand Trine, T-Square, …). */
export function buildFormationCardData(pattern, dateStr, personalNote = null) {
  const names = pattern.planets || [];
  const andList = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] || '');
  // Named formations ("Saturn-Neptune Conjunction") already carry the planets.
  const title = names.every(n => pattern.type.includes(n)) ? pattern.type : `${pattern.type}: ${andList}`;
  const body = personalNote
    ? personalNote
    : `${andList} form a ${pattern.type.replace(/^.*?(Conjunction|Grand Trine|T-Square|Grand Cross|Kite|Yod|Stellium|Cradle|Basket)$/i, '$1') || 'formation'}${pattern.sign ? ` in ${pattern.sign}` : ''} in today's sky, working as one linked unit for everyone.`;
  return { glyph: '✧', glyphColor: '#C9A961', kicker: personalNote ? 'MY FORMATION' : 'SKY FORMATION', title, bodyType: 'prose', body, dateStr, audience: personalNote ? 'mine' : 'everyone', textFallback: `${title}\n${dateStr}\n\n${body}\n\n${personalNote ? INVITE : 'Read your chart → astrosetta.com'}` };
}

/** F-05: a Stories-sized list of key dates for a week or month. */
export function buildKeyDatesCardData({ title, kicker, dates, audience, dateStr }) {
  if (!dates?.length) return null;
  const textFallback = `${title}\n${dateStr}\n\n${dates.map(d => `${d.date}: ${d.text}`).join('\n')}\n\n${audience === 'mine' ? INVITE : 'Read your chart → astrosetta.com'}`;
  return { glyph: '✦', glyphColor: '#C9A961', kicker, title, bodyType: 'dates', dates: dates.slice(0, 8), dateStr, audience, audienceLabel: audience === 'mine' ? 'MY SKY' : 'THE SKY', format: 'story', textFallback };
}

/** F-06: quiz result / milestone card that doubles as an invite. */
export function buildQuizResultCardData({ title, kicker = 'DAILY QUIZ', stats, badge, dateStr }) {
  const textFallback = `${title}\n${(stats || []).map(s => `${s.label}: ${s.value}`).join(' · ')}${badge ? `\n${badge}` : ''}\n\n${INVITE}`;
  return { glyph: '✦', glyphColor: '#C9A961', kicker, title, bodyType: 'stats', stats, badge, dateStr, cta: INVITE, textFallback };
}

/** F-04: the two share choices for an event; drops the personal one when it
 *  can't be built (unknown birth time, no house). */
export function shareVariants(everyoneCard, mineCard) {
  return [
    everyoneCard && { key: 'everyone', label: 'Share for everyone', card: asEveryone(everyoneCard) },
    mineCard && { key: 'mine', label: 'Share my reading', card: mineCard },
  ].filter(Boolean);
}

/** The user's ascendant sign, wherever this chart vintage stores it (B-07). */
export function chartAscendantSign(chart) {
  const raw = chart?.raw_data || {};
  if (raw.unknown_time) return null;
  return raw.ascendant_sign || raw.angles?.ascendant?.sign || chart?.ascendant_sign || null;
}
