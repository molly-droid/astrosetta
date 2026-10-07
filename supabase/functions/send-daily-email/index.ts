import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { insertGlyphs } from '../_shared/emailGlyphs.ts';
import { fetchKnowledgeDepth, densityInstruction } from '../_shared/knowledgeDensity.ts';
import { generateDaySynthesis, classifyCalculatorTransits } from '../_shared/daySynthesisGenerator.ts';
import { getActiveEmailHighlight } from '../_shared/featureSchedule.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';
import { ordinal } from '../_shared/emailUtils.ts';
import { sendDigestEmail } from '../_shared/resendEmail.ts';

// ── Glyphs ──────────────────────────────────────────────────────────────────
// \uFE0E (text variation selector) forces text rendering — prevents emoji on Apple Mail
const PLANET_GLYPHS = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E', Jupiter: '♃\uFE0E',
  Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E', Chiron: '⚷\uFE0E',
  Ascendant: 'AC', Midheaven: 'MC', 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E',
  'Black Moon Lilith': '⚸\uFE0E', Lilith: '⚸\uFE0E', 'Black Moon': '⚸\uFE0E',
};
const ASPECT_GLYPHS = { conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E', sextile: '⚹\uFE0E' };

// ── Moon phase ──────────────────────────────────────────────────────────────
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const SYNODIC = 29.53058867;
function moonPhaseName(date) {
  const diff = (date.getTime() - KNOWN_NEW_MOON.getTime()) / 86400000;
  const phase = ((diff % SYNODIC) + SYNODIC) % SYNODIC;
  if (phase < 1.85 || phase > SYNODIC - 1.85) return { name: 'New Moon', emoji: '🌑' };
  if (phase < 5.5) return { name: 'Waxing Crescent', emoji: '🌒' };
  if (phase < 9.2) return { name: 'First Quarter', emoji: '🌓' };
  if (phase < 12.9) return { name: 'Waxing Gibbous', emoji: '🌔' };
  if (phase < 16.6) return { name: 'Full Moon', emoji: '🌕' };
  if (phase < 20.3) return { name: 'Waning Gibbous', emoji: '🌖' };
  if (phase < 24) return { name: 'Last Quarter', emoji: '🌗' };
  return { name: 'Waning Crescent', emoji: '🌘' };
}

// ── Lunar event / eclipse detection ─────────────────────────────────────────
// Mirrors src/lib/eclipseUtils.js (detectEclipse) + useTransits exact-phase logic.
// The chartCalculator response carries Sun/Moon/node longitudes but not the
// derived flags, so the email re-derives them to feature eclipses & exact
// lunations as a headline banner.
const ECLIPSE_ORB = 18;
const ECLIPSE_META = {
  solar: { label: 'Solar Eclipse', badge: 'Solar · New Moon Eclipse', meaning: 'A solar eclipse supercharges the new moon — a fated new beginning and a turning point. What is seeded now carries far beyond a typical lunation and can unfold across the coming six months.' },
  lunar: { label: 'Lunar Eclipse', badge: 'Lunar · Full Moon Eclipse', meaning: 'A lunar eclipse illuminates and releases what has been building — a culminating full moon with extra weight. Revelations and closures arrive now and ripple out across the coming six months.' },
};
function detectLunarEvent(transitPlanets) {
  const norm = v => ((v % 360) + 360) % 360;
  const sun = transitPlanets.find(p => p.name === 'Sun');
  const moon = transitPlanets.find(p => p.name === 'Moon');
  if (!sun || !moon) return null;
  const diff = ((moon.longitude - sun.longitude) % 360 + 360) % 360;
  // Exact lunation gate (tight) — featured as a regular New/Full Moon banner.
  const EXACT = 6;
  const isExactNew = diff <= EXACT || diff >= 360 - EXACT;
  const isExactFull = Math.abs(diff - 180) <= EXACT;
  // Eclipse gate (wider) — eclipses can perfect hours from the noon snapshot
  // (often overnight), so the Moon may be up to ~13° from exact on the day it
  // perfects. Node proximity (ECLIPSE_ORB) still gates this, so regular
  // non-eclipse lunations never trigger. Mirrors src/lib/eclipseUtils.js.
  const ECLIPSE_PHASE_ORB = 13;
  const nearNew = diff <= ECLIPSE_PHASE_ORB || diff >= 360 - ECLIPSE_PHASE_ORB;
  const nearFull = Math.abs(diff - 180) <= ECLIPSE_PHASE_ORB;
  const nn = transitPlanets.find(p => p.name === 'North Node');
  const sn = transitPlanets.find(p => p.name === 'South Node');
  const nodeLons = [];
  if (nn) nodeLons.push(norm(nn.longitude));
  if (sn) nodeLons.push(norm(sn.longitude));
  if (nn && !sn) nodeLons.push(norm(nn.longitude + 180));
  let isEclipse = false, eclipseType = null;
  if (nodeLons.length) {
    const nearest = lon => { let m = Infinity; for (const n of nodeLons) { let d = Math.abs(norm(lon) - n); if (d > 180) d = 360 - d; if (d < m) m = d; } return m; };
    if (nearNew && nearest(sun.longitude) <= ECLIPSE_ORB) { isEclipse = true; eclipseType = 'solar'; }
    else if (nearFull && nearest(moon.longitude) <= ECLIPSE_ORB) { isEclipse = true; eclipseType = 'lunar'; }
  }
  // Surface an event only if it's an eclipse (wide window) OR an exact lunation.
  if (!isEclipse && !isExactNew && !isExactFull) return null;
  // Derive the lunation sign from the SUN, not the noon Moon snapshot.
  // The Moon moves ~12°/day and can sit a full sign behind its exact position
  // at the noon snapshot (e.g. noon Moon in late Aquarius while the Full Moon
  // perfects in Pisces). The Sun moves only ~1°/day, so its sign is stable:
  // New Moon ≈ Sun's sign; Full Moon ≈ Sun + 180°. Mirrors src/lib/eclipseUtils.js.
  const phaseIsFull = isEclipse ? eclipseType === 'lunar' : isExactFull;
  const _normLon = ((sun.longitude % 360) + 360) % 360;
  const sign = phaseIsFull
    ? SIGN_LIST[Math.floor(((_normLon + 180) % 360) / 30)]
    : SIGN_LIST[Math.floor(_normLon / 30)];
  return { phase: phaseIsFull ? 'Full Moon' : 'New Moon', sign, isEclipse, eclipseType };
}

// ── Collective aspects (transit planet to transit planet) ───────────────────
const COLLECTIVE_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
function collectiveAspects(transitPlanets) {
  const ps = transitPlanets.filter(p => COLLECTIVE_PLANETS.includes(p.name));
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      let d = Math.abs(ps[i].longitude - ps[j].longitude);
      if (d > 180) d = 360 - d;
      for (const [name, angle] of Object.entries(ANGLES)) {
        const orb = Math.abs(d - angle);
        if (orb <= 3) { out.push({ p1: ps[i].name, p2: ps[j].name, aspect: name, orb, s1: ps[i].sign, s2: ps[j].sign }); break; }
      }
    }
  }
  return out.sort((a, b) => a.orb - b.orb).slice(0, 5);
}



function getOrdinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const HOUSE_THEMES = [
  '', 'self, appearance, and first impressions',
  'money, values, and material security',
  'communication, learning, and immediate environment',
  'home, family, and emotional foundations',
  'creativity, romance, and self-expression',
  'health, daily routines, and service',
  'partnerships, marriage, and significant others',
  'shared resources, intimacy, and transformation',
  'philosophy, higher learning, travel, and beliefs',
  'career, public standing, and legacy',
  'friendships, groups, and hopes for the future',
  'solitude, spirituality, and hidden matters',
];

const PLANET_DURATIONS = {
  Sun: 'about 1 month', Mercury: '2–4 weeks', Venus: '3–4 weeks',
  Mars: 'about 2 months', Jupiter: 'about 1 year', Saturn: 'about 2.5 years',
  Uranus: 'about 7 years', Neptune: 'about 14 years', Pluto: '12–30 years', Chiron: '4–8 years',
};

const SIGN_GLYPHS = {
  Aries: '♈\uFE0E', Taurus: '♉\uFE0E', Gemini: '♊\uFE0E', Cancer: '♋\uFE0E', Leo: '♌\uFE0E', Virgo: '♍\uFE0E',
  Libra: '♎\uFE0E', Scorpio: '♏\uFE0E', Sagittarius: '♐\uFE0E', Capricorn: '♑\uFE0E', Aquarius: '♒\uFE0E', Pisces: '♓\uFE0E',
};

const SIGN_LIST = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function findNatalHouse(longitude, natalHouses, houseSystem = 'whole_sign', ascendantSign = null) {
  if (!natalHouses?.length) return null;
  const norm = v => ((v % 360) + 360) % 360;
  const lon = norm(longitude);

  // Whole Sign: house determined by zodiac sign, not cusp degree
  if (houseSystem === 'whole_sign' && ascendantSign) {
    const signIdx = Math.floor(lon / 30);
    const sign = SIGN_LIST[signIdx];
    const ascIdx = SIGN_LIST.indexOf(ascendantSign);
    const sIdx = SIGN_LIST.indexOf(sign);
    if (sIdx >= 0 && ascIdx >= 0) return ((sIdx - ascIdx + 12) % 12) + 1;
  }

  // Placidus / fallback: cusp-longitude comparison
  for (let i = 0; i < natalHouses.length; i++) {
    const a = norm(natalHouses[i].longitude);
    const b = norm(natalHouses[(i + 1) % natalHouses.length].longitude);
    const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
    if (inside) return natalHouses[i].number;
  }
  return null;
}

/**
 * Find which natal house(s) a zodiac sign spans.
 * Whole Sign: one sign = one house (no crossings possible).
 * Placidus / quadrant: a sign may span two houses — detects the entry house
 * and the house it crosses into as the planet moves through the sign.
 */
function findNatalHousesForSign(sign, natalHouses, houseSystem = 'whole_sign', ascendantSign = null) {
  const SIGN_LIST_LOCAL = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  if (!sign) return { entryHouse: null, entryTheme: '', crossesInto: null, crossesIntoTheme: '' };

  if (houseSystem === 'whole_sign') {
    let house = null;
    if (ascendantSign) {
      const signIdx = SIGN_LIST_LOCAL.indexOf(sign);
      const ascIdx = SIGN_LIST_LOCAL.indexOf(ascendantSign);
      if (signIdx >= 0 && ascIdx >= 0) house = ((signIdx - ascIdx + 12) % 12) + 1;
    } else {
      const h = natalHouses.find(h => h.sign === sign);
      house = h?.number || null;
    }
    return { entryHouse: house, entryTheme: house ? HOUSE_THEMES[house] : '', crossesInto: null, crossesIntoTheme: '' };
  }

  // Placidus / quadrant: a sign may span two houses
  const signIdx = SIGN_LIST_LOCAL.indexOf(sign);
  if (signIdx < 0) return { entryHouse: null, entryTheme: '', crossesInto: null, crossesIntoTheme: '' };
  const norm = v => ((v % 360) + 360) % 360;
  const startLon = signIdx * 30;

  const entryHouse = findNatalHouse(startLon, natalHouses, 'placidus');
  const housesSpanned = [];
  const crossings = [];
  for (let i = 0; i < natalHouses.length; i++) {
    const a = norm(natalHouses[i].longitude);
    const b = norm(natalHouses[(i + 1) % natalHouses.length].longitude);
    for (let deg = 0; deg < 30; deg += 1) {
      const lon = norm(startLon + deg);
      const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
      if (inside) {
        const h = natalHouses[i].number;
        if (!housesSpanned.includes(h)) {
          housesSpanned.push(h);
          if (h !== entryHouse && crossings.length === 0) crossings.push({ house: h });
        }
        break;
      }
    }
  }
  const crossesInto = crossings.length > 0 ? crossings[0] : null;
  return {
    entryHouse,
    entryTheme: entryHouse ? HOUSE_THEMES[entryHouse] : '',
    crossesInto,
    crossesIntoTheme: crossesInto ? HOUSE_THEMES[crossesInto.house] : '',
  };
}

// Feature highlight for the digest — single shared source (shared/featureHighlights.ts).
// The newest feature shows for one week, then drops out (no cycling).

// ── Build one user's email ──────────────────────────────────────────────────
async function buildEmailForUser(base44, targetUser, appUrl) {
  const tier = getEffectiveTier(targetUser);
  // BETA: all users treated as paid. Set to false once payments launch.
  const BETA_ALL_PAID = true;

  const isPaid = BETA_ALL_PAID || tier === 'interpret' || tier === 'calendar';
  const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: targetUser.id }, '-created_date');
  const chart = charts[0];
  if (!chart?.raw_data) return null;
  const raw = chart.raw_data;
  if (!raw.birth_date || !raw.birth_location?.latitude) return null;

  // Knowledge Density — shapes the tone of the generated synthesis
  const knowledgeDepth = await fetchKnowledgeDepth(base44, targetUser.id);
  const densityLine = densityInstruction(knowledgeDepth);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const prettyDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

  // Solar return (birthday) detection — month + day match
  const birthDateParts = (raw.birth_date || '').split('-'); // YYYY-MM-DD
  let isBirthday = false;
  let ageNum = 0;
  if (birthDateParts.length === 3) {
    const birthMonth = parseInt(birthDateParts[1], 10);
    const birthDay = parseInt(birthDateParts[2], 10);
    isBirthday = (now.getUTCMonth() + 1) === birthMonth && now.getUTCDate() === birthDay;
    const birthYear = parseInt(birthDateParts[0], 10);
    if (birthYear > 1900) ageNum = now.getUTCFullYear() - birthYear;
  }
  const ageLabel = ageNum > 0 ? ` (solar return #${ageNum})` : '';

  // Profection calculation — same logic as src/lib/solarReturn.js (frontend can't be imported)
  const TRAD_RULERS = { Aries:'Mars',Taurus:'Venus',Gemini:'Mercury',Cancer:'Moon',Leo:'Sun',Virgo:'Mercury',Libra:'Venus',Scorpio:'Mars',Sagittarius:'Jupiter',Capricorn:'Saturn',Aquarius:'Saturn',Pisces:'Jupiter' };
  const PROF_THEMES = { 1:'identity and new beginnings',2:'resources and values',3:'communication and learning',4:'home and family',5:'creativity and pleasure',6:'health and daily routine',7:'partnerships and relationships',8:'transformation and shared resources',9:'beliefs and expansion',10:'career and public life',11:'community and future vision',12:'solitude and inner work' };
  // Unknown birth time — rising/houses/angles cannot be determined. Declared
  // BEFORE first use (the profection calc below reads it); previously this sat
  // ~26 lines lower, crashing every email build (TDZ ReferenceError).
  const unknownTime = !!raw.unknown_time;
  const profectedHouse = (!unknownTime && ageNum >= 0) ? (ageNum % 12) + 1 : null;
  const natalHousesForProf = raw.houses || [];
  const profHouseData = natalHousesForProf.find(h => h.number === profectedHouse);
  const profectedSign = profHouseData?.sign || chart.ascendant_sign || raw.ascendant_sign || '';
  const yearLord = TRAD_RULERS[profectedSign] || '';
  const lordPlanet = (raw.planets || []).find(p => p.name === yearLord);
  const profectionText = profectedHouse && yearLord
    ? `${profectedHouse}th house profection year (${PROF_THEMES[profectedHouse]}). Year lord is ${yearLord} (ruler of ${profectedSign})${lordPlanet ? `, placed in ${lordPlanet.sign} in their ${lordPlanet.house ? (lordPlanet.house + getOrdinal(lordPlanet.house)) : ''} house` : ''}.`
    : '';

  // Compute today's transits via chartCalculator — same engine the on-site chart uses
  const transitRes = await base44.asServiceRole.functions.invoke('chartCalculator', {
    chart_type: 'transit',
    birth_date: raw.birth_date,
    birth_time: raw.birth_time || '12:00:00',
    birth_location: raw.birth_location,
    utc_offset: typeof raw.utc_offset === 'number' ? raw.utc_offset : undefined,
    natal_planets_override: raw.planets,
    house_system: raw.house_system || 'whole_sign',
    transit_date: todayStr,
    transit_time: '12:00:00',
  });
  const tData = transitRes.data || transitRes;
  const transitPlanets = tData.transit_planets || [];
  const ANGLE_TARGETS = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
  // Use freshly calculated natal planets from the transit response — these have
  // correct house assignments for the current house system
  const natalPlanets = (tData.natal?.planets || raw.planets || [])
    .map(p => unknownTime ? { ...p, house: null } : p);

  // Personal transits (to natal), top 6 by tightest orb
  const personal = (tData.transit_aspects || [])
    .filter(a => a.natal_planet !== a.transit_planet)
    .filter(a => !unknownTime || !ANGLE_TARGETS.has(a.natal_planet))
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 6)
    .map(a => {
      const nP = natalPlanets.find(p => p.name === a.natal_planet);
      const tP = transitPlanets.find(p => p.name === a.transit_planet);
      return { ...a, natal_sign: nP?.sign, natal_house: nP?.house, transit_sign: tP?.sign };
    });
  // Free-tier daily reading covers only transits to the Big Three (Sun, Moon, Ascendant)
  const personalForTier = isPaid ? personal : personal.filter(a => ['Sun','Moon','Ascendant'].includes(a.natal_planet));

  const collective = collectiveAspects(transitPlanets);
  const moon = transitPlanets.find(p => p.name === 'Moon');
  const phase = moonPhaseName(now);

  // Lunar event (exact New/Full Moon or eclipse) — featured banner, mirrors the site
  const lunarEvent = detectLunarEvent(transitPlanets);

  // Ingresses — planets changing signs today (or approaching)
  // Use freshly calculated natal houses from the chartCalculator response —
  // same data the on-site chart uses. raw.houses may be stale.
  const natalHouses = unknownTime ? [] : (tData.natal?.houses || raw.houses || []);
  const freshAscendantSign = unknownTime ? null : (tData.natal?.angles?.ascendant?.sign || chart.ascendant_sign || raw.ascendant_sign);
  const ingresses = (tData.ingresses || []).map(ing => {
    const info = findNatalHousesForSign(ing.to_sign, natalHouses, raw.house_system || 'whole_sign', freshAscendantSign);
    const houseDesc = info.crossesInto
      ? `enters the ${ordinal(info.entryHouse)} house (${info.entryTheme}), then shifts into the ${ordinal(info.crossesInto.house)} house (${info.crossesIntoTheme}) as it moves through the sign`
      : info.entryHouse
        ? `enters the ${ordinal(info.entryHouse)} house (${info.entryTheme})`
        : '';
    return {
      ...ing,
      house: info.entryHouse,
      crossesInto: info.crossesInto,
      house_desc: houseDesc,
      entry_theme: info.entryTheme,
      crosses_into_theme: info.crossesIntoTheme,
      duration: PLANET_DURATIONS[ing.planet] || '',
      glyph: PLANET_GLYPHS[ing.planet] || '',
      sign_glyph: SIGN_GLYPHS[ing.to_sign] || '',
      house_theme: info.entryTheme,
    };
  });

  // Retrograde stations
  const stations = (tData.stations || []).map(s => ({
    ...s,
    glyph: PLANET_GLYPHS[s.planet] || '',
    sign_glyph: SIGN_GLYPHS[s.sign] || '',
  }));

  // Build text descriptions for the LLM
  const personalText = personalForTier.map(a =>
    `Transiting ${a.transit_planet}${a.transit_sign ? ` in ${a.transit_sign}` : ''} ${a.aspect} natal ${a.natal_planet}${a.natal_sign ? ` in ${a.natal_sign}` : ''}${a.natal_house ? ` (${ordinal(a.natal_house)} house)` : ''} — orb ${a.orb.toFixed(1)}°`
  ).join('\n') || 'No tight personal transits today.';
  const collectiveText = collective.map(a =>
    `${a.p1} in ${a.s1} ${a.aspect} ${a.p2} in ${a.s2} (orb ${a.orb.toFixed(1)}°)`
  ).join('\n') || 'Quiet collective sky.';

  // Authoritative transit positions — the LLM must use THESE signs, never its own knowledge
  const transitPositions = transitPlanets
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');
  const ingressText = ingresses.length
    ? ingresses.map(i => `${i.planet} ${i.exact ? 'ingresses' : 'is approaching ingress'} from ${i.from_sign} to ${i.to_sign}${i.house_desc ? ` — ${i.house_desc}` : ''}${i.duration ? `. ${i.planet} will remain in ${i.to_sign} for ${i.duration}` : ''}`)
      .join('\n')
    : 'No sign ingresses today.';
  const stationText = stations.length
    ? stations.map(s => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`)
      .join('\n')
    : 'No stations today.';

  // Reuse the site's cached daily synthesis when available — single source of truth.
  // The site (DaySynthesis.jsx) and the pre-generation job both store the day reading
  // in CalendarSynthesis under a depth-suffixed v20 key matching the recipient's
  // Knowledge Density. If the exact record isn't there yet (pre-generation hasn't
  // reached this chart, or the user changed Knowledge Density after their slot),
  // generate it NOW with the SAME shared generator the site uses and store it
  // under the same key — guaranteeing the email and the app show the same reading.
  let cachedSynthesis = null;
  try {
    const recs = await base44.asServiceRole.entities.CalendarSynthesis.filter({
      user_id: targetUser.id, period_type: 'day', date_start: todayStr,
    }, '-updated_date', 10);
    const exact = recs.find(r => r.period_key === `day-v20-${todayStr}-${knowledgeDepth}`);
    if (exact?.data) {
      cachedSynthesis = exact.data;
    } else {
      const genDate = new Date();
      genDate.setUTCHours(12, 0, 0, 0);
      const rec = await generateDaySynthesis(
        base44, raw, genDate, classifyCalculatorTransits(tData, raw), knowledgeDepth);
      const payload = { user_id: targetUser.id, ...rec, generated_at: new Date().toISOString() };
      const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
        user_id: targetUser.id, period_key: rec.period_key,
      });
      if (existing[0]) {
        await base44.asServiceRole.entities.CalendarSynthesis.update(existing[0].id, payload);
      } else {
        await base44.asServiceRole.entities.CalendarSynthesis.create(payload);
      }
      cachedSynthesis = rec.data;
    }
  } catch { /* fall back to inline generation below */ }

  let llm = null;
  if (cachedSynthesis) {
    const wrapperPrompt = `You are a warm astrologer writing ONLY the presentation layer for a daily email. The reading below is ALREADY GENERATED and authoritative — do NOT re-interpret transits, do NOT invent new signs, planets, or aspects, and do NOT contradict it. Base every word on the reading provided.

${TONE_DIRECTIVE}

Today is ${prettyDate}. Recipient: ${targetUser.full_name || 'a student of astrology'}.
NATAL: Sun ${chart.sun_sign}, Moon ${chart.moon_sign}${unknownTime ? ' — birth time unknown, so the rising sign, angles, and houses CANNOT be determined' : `, Rising ${chart.ascendant_sign}`}.

ALREADY-GENERATED READING (authoritative):
OVERVIEW: ${cachedSynthesis.overview || ''}
PERSONAL: ${(isPaid ? (cachedSynthesis.personal_reading || []) : (cachedSynthesis.personal_reading_core?.length ? cachedSynthesis.personal_reading_core : (cachedSynthesis.personal_reading || []))).join(' | ')}
COLLECTIVE: ${(cachedSynthesis.collective_reading || []).join(' | ')}
COLLECTIVE HIGHLIGHT: ${cachedSynthesis.collective_highlight || ''}
MAXIMIZE: ${cachedSynthesis.maximize || ''}
FOCUS: ${cachedSynthesis.focus || ''}
WATCH: ${cachedSynthesis.watch || ''}
BEST AREAS: ${(cachedSynthesis.best_areas || []).join(', ')}
POWER PLANET: ${cachedSynthesis.power_planet || ''}
KEY THEMES: ${(cachedSynthesis.key_themes || []).join(', ')}
${lunarEvent ? `LUNAR EVENT TODAY: ${lunarEvent.isEclipse ? (lunarEvent.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse') : lunarEvent.phase} in ${lunarEvent.sign}. This is a major celestial headline — acknowledge it prominently in the greeting and weave its meaning into personal_synthesis.` : ''}
WEEK-AHEAD CONTEXT (use ONLY this — do not invent signs or planets):
${ingressText}
${stationText}
LUNAR: ${lunarEvent ? `${lunarEvent.isEclipse ? (lunarEvent.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse') : lunarEvent.phase} in ${lunarEvent.sign}` : 'No exact lunation today'}; Moon currently in ${moon?.sign || ''}, ${phase.name}.
${isBirthday ? `TODAY IS THEIR BIRTHDAY / SOLAR RETURN${ageLabel}.` : ''}

Write ONLY these email presentation fields. Do NOT add any transit not present in the reading above.

Rules:
- A zodiac SIGN cannot form an aspect; only planets and points can. Never write things like "Aries opposes your 7th house."
${unknownTime ? '- BIRTH TIME UNKNOWN: Their birth time is unknown, so the Ascendant (rising), angles, and houses CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output. Interpret by planet, sign, and aspect only.' : ''}
${lunarEvent ? `- A LUNAR EVENT is listed above (${lunarEvent.isEclipse ? (lunarEvent.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse') : lunarEvent.phase} in ${lunarEvent.sign}). Feature it prominently in the greeting and personal_synthesis — it is the day's headline celestial event.` : ''}
- greeting: one warm sentence opening the email, referencing the day's feel.
- personal_synthesis: 1-2 short paragraphs in flowing prose summarizing the PERSONAL reading above. Write ONLY in full English words — name every planet, sign, and aspect by its WORD (e.g. "Mercury in Cancer conjunction natal Chiron in your 8th house of shared resources"). Do NOT include any Unicode glyph symbols anywhere — the email inserts glyphs automatically next to each word. Stay grounded in the reading above; do not invent transits. PRESERVE the natal reference points from the reading — if it names a natal placement (e.g. "your Virgo Midheaven," "your natal Mars in Scorpio in your 5th house"), keep that anchor in your summary, and keep the possibility framing ("you may experience," "you might notice").
- collective_synthesis: 1 short paragraph from the COLLECTIVE reading above.
- maximize: array of 2-3 short actionable items derived from MAXIMIZE and FOCUS. Each starts with an emoji, one sentence max 15 words.
- watch_out: array of 1-2 short cautionary notes derived from WATCH. Each starts with an emoji, one sentence max 15 words.
- quiz_teaser: one intriguing sentence tied to today's power planet or key themes.
- week_ahead: 2-3 short sentences on the key planetary highlights for the week ahead, grounded ONLY in the WEEK-AHEAD CONTEXT above (approaching ingresses, ongoing stations, lunar backdrop). No new signs or planets.
${isBirthday ? `- solar_return_message: 2-3 warm sentences celebrating their solar return, specific to Sun sign ${chart.sun_sign}.` : ''}

${densityLine}

Return JSON with keys: greeting, personal_synthesis, collective_synthesis, maximize, watch_out, quiz_teaser, week_ahead${isBirthday ? ', solar_return_message' : ''}.`;

    const wrapper = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: wrapperPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          personal_synthesis: { type: 'string' },
          collective_synthesis: { type: 'string' },
          maximize: { type: 'array', items: { type: 'string' } },
          watch_out: { type: 'array', items: { type: 'string' } },
          quiz_teaser: { type: 'string' },
          week_ahead: { type: 'string' },
          solar_return_message: { type: 'string' },
        },
        required: ['greeting', 'personal_synthesis', 'collective_synthesis', 'maximize', 'watch_out', 'quiz_teaser', 'week_ahead'],
      },
    });

    llm = {
      greeting: wrapper.greeting,
      personal_synthesis: wrapper.personal_synthesis,
      collective_synthesis: wrapper.collective_synthesis,
      key_themes: cachedSynthesis.key_themes || [],
      maximize: wrapper.maximize,
      watch_out: wrapper.watch_out,
      power_planet: cachedSynthesis.power_planet || '',
      power_planet_glyph: PLANET_GLYPHS[cachedSynthesis.power_planet] || '✦',
      quiz_teaser: wrapper.quiz_teaser,
      week_ahead: wrapper.week_ahead || '',
      synthesis_overview: cachedSynthesis.overview || '',
      synthesis_personal: cachedSynthesis.personal_reading || [],
      synthesis_collective: cachedSynthesis.collective_reading || [],
      synthesis_collective_highlight: cachedSynthesis.collective_highlight || '',
      synthesis_maximize: cachedSynthesis.maximize || '',
      synthesis_focus: cachedSynthesis.focus || '',
      synthesis_watch: cachedSynthesis.watch || '',
      synthesis_best_areas: cachedSynthesis.best_areas || [],
      solar_return_message: wrapper.solar_return_message || '',
    };
  }
  if (!llm) {
  const prompt = `You are an expert, warm astrologer writing a daily email for ${targetUser.full_name || 'a student of astrology'}.
Today is ${prettyDate}.

${TONE_DIRECTIVE}

THEIR NATAL CHART: Sun ${chart.sun_sign}, Moon ${chart.moon_sign}${unknownTime ? ' — birth time unknown, so the rising sign, angles, and houses CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output.' : `, Rising ${chart.ascendant_sign}`}.

CURRENT TRANSIT POSITIONS (authoritative — use these exact signs, do NOT use your own knowledge of where planets are):
${transitPositions}
${isBirthday ? `TODAY IS THEIR BIRTHDAY / SOLAR RETURN${ageLabel}. The Sun has returned to its exact natal position — a personal new year. Acknowledge this warmly in the greeting and make the synthesis reflect the themes of a solar return year (intention-setting, reflection, renewal).` : ''}
PROFECTION YEAR CONTEXT: ${profectionText || 'Profection data unavailable.'}

TODAY'S PERSONAL TRANSITS (to their natal chart):
${personalText}

TODAY'S COLLECTIVE SKY (mundane):
${collectiveText}

PLANETARY INGRESSES (sign changes):
${ingressText}

RETROGRADE STATIONS:
${stationText}

Moon: ${moon?.sign || ''}, ${phase.name}.
${lunarEvent ? `LUNAR EVENT TODAY: ${lunarEvent.isEclipse ? (lunarEvent.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse') : lunarEvent.phase} in ${lunarEvent.sign}. ${ECLIPSE_META[lunarEvent.eclipseType]?.meaning || ''} This is the day's headline celestial event — acknowledge it prominently in the greeting and weave its meaning into the personal and collective synthesis.` : ''}

Rules:
- CRITICAL: Use ONLY the signs from CURRENT TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed in CURRENT TRANSIT POSITIONS or in TODAY'S PERSONAL TRANSITS. For example, if the data says "Mars: Gemini 20°", you must write "Mars in Gemini" — never "Mars in Scorpio" or any other sign.
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, stations, or lunar events that are not explicitly listed in the data provided. If the data says "none," do not invent any.
${unknownTime ? '- BIRTH TIME UNKNOWN: Their birth time is unknown, so the Ascendant (rising), angles, and houses CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output. Interpret by planet, sign, and aspect only. Anchor every transit explanation to the natal planet and its sign.' : ''}
${lunarEvent ? `- A LUNAR EVENT is listed (${lunarEvent.isEclipse ? (lunarEvent.eclipseType === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse') : lunarEvent.phase} in ${lunarEvent.sign}). Feature it prominently in the greeting and synthesis — it is the day's headline celestial event.` : ''}
- THE PERSONAL SYNTHESIS IS ABOUT TRANSITS, NOT NATAL STRUCTURE. Every transit you mention in personal_synthesis and synthesis_personal MUST be a real transit listed in TODAY'S PERSONAL TRANSITS above. Do NOT describe static natal chart structure — never write things like "Aries opposes your 7th house," "your 1st house sign opposes the 7th," or describe a sign opposing a house. A zodiac SIGN cannot form an aspect; only PLANETS and POINTS form aspects to other planets and points. Houses do not aspect each other. If you want to mention a life area, tie it to a specific transiting planet aspecting a specific natal planet in that house — never to a sign-to-house relationship.
- Do NOT describe natal stelliums, chart patterns, sign-to-house oppositions, or natal chart architecture unless a specific transit from TODAY'S PERSONAL TRANSITS is directly activating it. If you mention a house, you MUST first name the transit (planet, sign, aspect, natal planet) that is activating that house.
- SHOW YOUR WORK — this app teaches astrology. Every time you mention a transit, name the transiting planet, its current sign, the aspect, and the natal planet with its house — all in full English WORDS (e.g. "Mercury in Cancer conjunction natal Chiron in your 8th house of shared resources"). Do NOT include Unicode glyph symbols — the email inserts them automatically next to each word.
- Each synthesis_personal bullet MUST begin by copying the exact transit from TODAY'S PERSONAL TRANSITS above — transiting planet + sign, aspect, natal planet + natal sign and house when available. If the transit has no house, do NOT invent one. One bullet per transit; do NOT combine multiple transits into one bullet.
- After naming each configuration, write 1 sentence explaining the astrological mechanic — WHY this planet in this sign making this aspect to this natal placement creates this effect. Teach the reader how the elements interact.
- For planetary ingresses (sign changes), mention them prominently — especially for outer planets. Name the natal house the planet enters and what that life area means for the user. If an ingress sign spans two natal houses, note both: which house it enters first and which it shifts into as it moves through the sign, and what that transition means practically.
- PERSONALIZATION LOCK: The personal_synthesis and synthesis_overview must feel written for this one person, not a collective horoscope. Anchor each transit explanation to their natal chart by naming the natal placement inside the prose — e.g. "Because your natal Mars in Scorpio sits in your 5th house, you may experience this transit Venus as..." or "With your Virgo Midheaven, you may experience this Virgo Moon as...". When a transit lands on an angle (Ascendant, Midheaven, IC, Descendant), name that angle. If a sentence could be true for anyone with any chart, rewrite it.
- INVITING TONE: Warm possibility language — "you may experience," "you might notice," "for you, this can show up as." Never commands, guarantees, or collective phrasing ("everyone," "we all") in the personal sections.
- No generic horoscope language. Every sentence must be traceable to a specific planetary configuration in the data above.

Write JSON:
- greeting: one warm sentence opening the email, referencing the day's feel.
- personal_synthesis: 2 short paragraphs (3-4 sentences total) on what today means for THEM specifically. Each transit mentioned MUST include the planet word, sign word, aspect word, and natal planet word with house — e.g. "Saturn in Pisces square natal Mars in your 5th house of creativity." Do NOT use glyph symbols; the email inserts them. Then explain the mechanic of why this creates the effect. Concrete and grounded, no clichés.
- collective_synthesis: 1 short paragraph on the collective energy everyone shares today, including any ingresses or stations.
- key_themes: array of 3 short theme phrases (e.g. "creative courage").
- maximize: array of 2-3 short, actionable things to lean into today. Each starts with an emoji and is one sentence max 15 words. e.g. "🎯 Launch that project you've been planning".
- watch_out: array of 1-2 short cautionary notes. Each starts with an emoji and is one sentence max 15 words. e.g. "⚠️ Avoid rushed decisions under the Mercury square".
- power_planet: the single most influential planet for them today (name only).
- power_planet_glyph: its unicode glyph.
- quiz_teaser: one intriguing sentence that makes them want to take today's astrology quiz, tied to today's sky.
- synthesis_overview: 2-3 sentences mixing personal + collective energy, naming specific transit labels. This is the FULL daily synthesis for paid subscribers.
- synthesis_personal: array of 3-4 bullet points. Each bullet MUST begin with the transit label in WORDS (e.g. "Mercury in Cancer conjunction natal Chiron (8th house)") then 1 sentence explaining the astrological mechanic of how this configuration creates the effect. Do NOT use glyph symbols; the email inserts them.
- synthesis_collective: array of 2-3 bullet points on the mundane sky. Each bullet MUST begin with the aspect in WORDS (e.g. "Jupiter trine Saturn") then 1 sentence on the collective meaning of that specific configuration. Do NOT use glyph symbols; the email inserts them.
- synthesis_collective_highlight: 1 sentence on the single most significant collective transit.
- synthesis_maximize: 1 action sentence (max 20 words) — what to lean into today.
- synthesis_focus: 1 attention sentence (max 20 words) — where to direct energy.
- synthesis_watch: 1 caution sentence (max 20 words) — what to be careful of.
- synthesis_best_areas: array of 2 life areas most supported today (e.g. "Creativity", "Communication").
- week_ahead: 2-3 short sentences on the key planetary highlights for the week ahead — approaching ingresses, ongoing stations, and the lunar backdrop. Grounded ONLY in the data above; no new signs or planets.
${isBirthday ? `- solar_return_message: 2-3 sentences celebrating their solar return. Warm, reflective, and specific to their Sun sign (${chart.sun_sign}). Frame it as a personal new year — what themes this solar return year invites. If not their birthday, return an empty string.` : ''}
${densityLine}`;

  llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        greeting: { type: 'string' },
        personal_synthesis: { type: 'string' },
        collective_synthesis: { type: 'string' },
        key_themes: { type: 'array', items: { type: 'string' } },
        maximize: { type: 'array', items: { type: 'string' } },
        watch_out: { type: 'array', items: { type: 'string' } },
        power_planet: { type: 'string' },
        power_planet_glyph: { type: 'string' },
        quiz_teaser: { type: 'string' },
        synthesis_overview: { type: 'string' },
        synthesis_personal: { type: 'array', items: { type: 'string' } },
        synthesis_collective: { type: 'array', items: { type: 'string' } },
        synthesis_collective_highlight: { type: 'string' },
        synthesis_maximize: { type: 'string' },
        synthesis_focus: { type: 'string' },
        synthesis_watch: { type: 'string' },
        synthesis_best_areas: { type: 'array', items: { type: 'string' } },
        week_ahead: { type: 'string' },
        solar_return_message: { type: 'string' },
      },
      required: ['greeting', 'personal_synthesis', 'collective_synthesis', 'key_themes', 'maximize', 'watch_out', 'power_planet', 'quiz_teaser', 'synthesis_overview', 'synthesis_personal', 'synthesis_collective', 'synthesis_maximize', 'synthesis_focus', 'synthesis_watch', 'week_ahead'],
    },
  });
  }

  const featureHighlight = await getActiveEmailHighlight(base44);

  const html = renderEmailHtml({
    user: targetUser, prettyDate, llm, personal: personalForTier, collective, moon, phase, ingresses, stations, lunarEvent, appUrl, isPaid,
    isBirthday, ageLabel, profectionText, profectedHouse, yearLord, profectedSign, featureHighlight,
  });
  const subject = isBirthday
    ? `✦ ${llm.power_planet_glyph || '☀'} Happy Solar Return, ${targetUser.full_name || 'Friend'}!`
    : `✦ ${llm.power_planet_glyph || '✦'} Your sky for ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`;
  return { html, subject };
}

// ── HTML renderer ─────────────────────────────────────────────────────────────
function getEffectiveTier(user) {
  if (!user) return 'free';
  const tier = user.subscription_tier;
  if (!tier || tier === 'free') return 'free';
  if (user.subscription_expires) {
    const expires = new Date(user.subscription_expires);
    if (expires < new Date()) return 'free';
  }
  return tier;
}

function renderEmailHtml({ user, prettyDate, llm, personal, collective, moon, phase, ingresses, stations, lunarEvent, appUrl, isPaid, isBirthday, ageLabel, profectionText, profectedHouse, yearLord, profectedSign, featureHighlight = null }) {
  const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355', BLUE = '#4E6E8E', CREAM = '#2C3E50';
  const quiz = appUrl ? `${appUrl}/home?tab=learn` : '#';
  const planner = appUrl ? `${appUrl}/planner` : '#';
  const plannerWeek = appUrl ? `${appUrl}/planner?view=Week` : '#';
  const plannerMonth = appUrl ? `${appUrl}/planner?view=Month` : '#';
  const subscribe = appUrl ? `${appUrl}/subscribe` : '#';

  // Lunar event banner (exact New/Full Moon or eclipse) — the day's headline
  // celestial event. Featured at the very top of the email so eclipses and
  // exact lunations are never missed.
  const lunarEventBanner = lunarEvent ? (() => {
    const isEclipse = !!lunarEvent.isEclipse;
    const meta = isEclipse ? ECLIPSE_META[lunarEvent.eclipseType] : null;
    const label = isEclipse ? meta.label : lunarEvent.phase;
    const glyph = lunarEvent.phase === 'Full Moon' ? '🌕' : '🌑';
    const badge = isEclipse ? meta.badge : 'Notable celestial event';
    const meaning = isEclipse ? meta.meaning : (lunarEvent.phase === 'New Moon'
      ? 'A new moon marks a fresh lunar cycle — a potent moment for setting intentions and planting seeds for the weeks ahead.'
      : 'A full moon brings culmination and illumination — what has been building since the last new moon now reaches clarity and release.');
    const border = isEclipse ? '#D4AF85' : '#C9A961';
    return `
  <tr><td style="padding:0 24px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:2px solid ${border};border-radius:14px;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">${badge}</div>
        <div style="font-family:Georgia,serif;font-size:30px;margin-bottom:8px;">${glyph}</div>
        <div style="font-family:Georgia,serif;font-size:18px;color:${GOLD2};margin-bottom:4px;">${label} in ${SIGN_GLYPHS[lunarEvent.sign] || ''} ${lunarEvent.sign}</div>
        <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:8px 0 14px;">${meaning}</p>
        <a href="${planner}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 18px;border-radius:999px;">Read your lunation insights →</a>
      </td></tr>
    </table>
  </td></tr>`;
  })() : '';

  const transitRow = (label, sub) => `
    <tr><td style="padding:8px 14px;border-left:2px solid ${GOLD}33;background:${CARD};border-radius:6px;">
      <div style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.4;">${label}</div>
      ${sub ? `<div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:2px;">${sub}</div>` : ''}
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`;

  const personalRows = personal.length ? personal.map(a => transitRow(
    `<span style="color:${GOLD2};font-size:16px;">${PLANET_GLYPHS[a.transit_planet] || '✦'}</span> <strong>${a.transit_planet}</strong>${a.transit_sign ? ` in ${SIGN_GLYPHS[a.transit_sign] || ''} ${a.transit_sign}` : ''} <span style="color:${GOLD};">${ASPECT_GLYPHS[a.aspect] || '·'}</span> <span style="color:${GOLD};font-size:11px;">${a.aspect}</span> <span style="color:${GOLD2};font-size:16px;">${PLANET_GLYPHS[a.natal_planet] || '✦'}</span> natal <strong>${a.natal_planet}</strong>`,
    `${a.natal_sign ? `${SIGN_GLYPHS[a.natal_sign] || ''} ${a.natal_sign} · ` : ''}${a.natal_house ? `${ordinal(a.natal_house)} house · ` : ''}orb ${a.orb.toFixed(1)}°`,
  )).join('') : transitRow('🌙 A quiet day for your personal chart — a good time to integrate.', '');

  const collectiveRows = collective.length ? collective.map(a => transitRow(
    `<span style="color:${BLUE};font-size:16px;">${PLANET_GLYPHS[a.p1] || '✦'}</span> <strong>${a.p1}</strong>${a.s1 ? ` in ${SIGN_GLYPHS[a.s1] || ''} ${a.s1}` : ''} <span style="color:${GOLD};">${ASPECT_GLYPHS[a.aspect] || '·'}</span> <span style="color:${GOLD};font-size:11px;">${a.aspect}</span> <span style="color:${BLUE};font-size:16px;">${PLANET_GLYPHS[a.p2] || '✦'}</span> <strong>${a.p2}</strong>${a.s2 ? ` in ${SIGN_GLYPHS[a.s2] || ''} ${a.s2}` : ''}`,
    `orb ${a.orb.toFixed(1)}°`,
  )).join('') : transitRow('The collective sky is calm today.', '');

  // Ingress rows — planets changing signs
  const ingressRows = ingresses.length ? ingresses.map(i => {
    const statusText = i.exact ? 'Enters today' : 'Approaching';
    const houseLine = i.crossesInto
      ? `Enters your ${ordinal(i.house)} house — ${i.entry_theme}, shifts to ${ordinal(i.crossesInto.house)} house as it moves through`
      : (i.house ? `Your ${ordinal(i.house)} house — ${i.house_theme}` : '');
    const durationText = i.duration ? `Stays ${i.duration}` : '';
    const sub = [statusText, houseLine, durationText].filter(Boolean).join(' · ');
    return transitRow(
      `${i.glyph || '✦'} <strong>${i.planet}</strong> ${i.exact ? 'enters' : 'approaching'} <span style="color:${GOLD2};">${i.sign_glyph || ''} ${i.to_sign}</span>`,
      sub,
    );
  }).join('') : '';

  // Station rows — retrograde/direct stations
  const stationRows = stations.length ? stations.map(s => transitRow(
    `${s.glyph || '✦'} <strong>${s.planet}</strong> stations <strong style="color:${s.type === 'retrograde' ? '#A85D75' : '#5E8A5E'};">${s.type === 'retrograde' ? '↺ Retrograde' : '→ Direct'}</strong> in <span style="color:${GOLD2};">${s.sign_glyph || ''} ${s.sign}</span>`,
    s.type === 'retrograde' ? '🔄 Time to review and revisit matters ruled by this planet' : '✅ Forward momentum resumes — integrate lessons and move ahead',
  )).join('') : '';

  const themeChips = (llm.key_themes || []).map(t =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${GOLD2};border:1px solid ${GOLD}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${t}</span>`
  ).join('');

  // Astro glyph highlighter — must be declared before first usage below.
  // Appends \uFE0E (text variation selector) to force text rendering and prevent emoji in Apple Mail.
  const highlightAstro = (txt) => insertGlyphs(txt, GOLD2);
  const _oldHighlightAstro = (txt) => (txt || '').replace(/([☉☽☿♀♂♃♄♅♆♇⚷⚸☌☍△□⚹☊☋♈♉♊♋♌♍♎♏♐♑♒♓])(?!\uFE0E)/g, `<span style="color:${GOLD2};">$1\uFE0E</span>`);

  // Maximize items — actionable highlights
  const maximizeItems = (llm.maximize || []).map(m =>
    `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid ${GOLD}22;">
      <div style="font-family:Georgia,serif;font-size:14px;color:${TEXT};line-height:1.4;">${highlightAstro(m)}</div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('');

  // Watch out items
  const watchItems = (llm.watch_out || []).map(w =>
    `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid #D8B4C233;">
      <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.4;">${highlightAstro(w)}</div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('');

  const para = (txt) => (txt || '').split('\n').filter(Boolean).map(p =>
    `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${TEXT};margin:0 0 12px;">${highlightAstro(p)}</p>`
  ).join('');

  // Full daily synthesis section (paid subscribers only)
  const synthesisBullets = (arr) => (arr || []).map(b =>
    `<li style="font-family:Georgia,serif;font-size:14px;line-height:1.5;color:${TEXT};margin-bottom:6px;padding-left:4px;">• ${highlightAstro(b)}</li>`
  ).join('');

  const synthesisSection = isPaid ? `
    <!-- Full Daily Synthesis -->
    <tr><td style="padding:6px 28px 6px;">
      <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✨ Your Daily Synthesis</div>
    </td></tr>
    <tr><td style="padding:0 28px 6px;">
      <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0 0 14px;border-left:2px solid ${GOLD}55;padding-left:14px;">${highlightAstro(llm.synthesis_overview || '')}</p>
      ${(llm.synthesis_best_areas || []).length ? `<div style="margin-bottom:14px;">${llm.synthesis_best_areas.map(a => `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${GOLD2};border:1px solid ${GOLD}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${a}</span>`).join('')}</div>` : ''}
    </td></tr>

    <!-- Personal reading -->
    <tr><td style="padding:6px 28px 4px;">
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${GOLD2};margin-bottom:8px;">Personal Reading</div>
      ${para(llm.personal_synthesis)}
    </td></tr>

    <!-- Maximize / Focus / Watch -->
    <tr><td style="padding:4px 28px 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${llm.synthesis_maximize ? `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid ${GOLD}22;">
          <div style="font-family:Georgia,serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#5E8A5E;margin-bottom:3px;">✦ Maximize</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};line-height:1.4;">${highlightAstro(llm.synthesis_maximize)}</div>
        </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>` : ''}
        ${llm.synthesis_focus ? `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid ${BLUE}22;">
          <div style="font-family:Georgia,serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${BLUE};margin-bottom:3px;">◎ Focus On</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};line-height:1.4;">${highlightAstro(llm.synthesis_focus)}</div>
        </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>` : ''}
        ${llm.synthesis_watch ? `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid #D8B4C233;">
          <div style="font-family:Georgia,serif;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#A85D75;margin-bottom:3px;">⚠ Watch Out For</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.4;">${highlightAstro(llm.synthesis_watch)}</div>
        </td></tr>` : ''}
      </table>
    </td></tr>

    <!-- Collective reading -->
    <tr><td style="padding:6px 28px 4px;">
      <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${BLUE};margin-bottom:8px;">Collective Reading</div>
      ${llm.synthesis_collective_highlight ? `<p style="font-family:Georgia,serif;font-size:13px;color:${GOLD2};font-style:italic;margin:0 0 8px;border-left:2px solid ${GOLD}33;padding-left:10px;">${highlightAstro(llm.synthesis_collective_highlight)}</p>` : ''}
      ${para(llm.collective_synthesis)}
    </td></tr>

    <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  ` : `
    <!-- Free user synthesis teaser -->
    <tr><td style="padding:6px 28px 6px;">
      <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✨ Your Sky Today</div>
      ${para(llm.personal_synthesis)}
    </td></tr>
    <tr><td style="padding:6px 28px 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}22;border-radius:10px;">
        <tr><td style="padding:14px 18px;text-align:center;">
          <p style="font-family:Georgia,serif;font-size:13px;color:${MUTED};margin:0 0 10px;line-height:1.5;">Unlock your full daily synthesis — structured personal &amp; collective readings with maximize, focus, and watch guidance.</p>
          <a href="${subscribe}" style="display:inline-block;background:transparent;color:${GOLD2};font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:6px 18px;border:1px solid ${GOLD}55;border-radius:999px;">Upgrade to unlock →</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  `;

  // Static decorative sparkles — email clients strip CSS animations and <style> blocks,
  // so we use inline-styled table cells with star symbols instead of animated confetti.
  const sparkleRow = isBirthday ? (() => {
    const symbols = ['✦', '✧', '✦', '✧', '✦', '✧', '✦', '✧', '✦', '✧', '✦'];
    const colors = [GOLD2, GOLD, CREAM, GOLD2, GOLD, CREAM, GOLD2, GOLD, CREAM, GOLD2, GOLD];
    return symbols.map((s, i) =>
      `<td style="text-align:center;font-family:Georgia,serif;font-size:13px;color:${colors[i]};padding:0 2px;opacity:0.7;">${s}</td>`
    ).join('');
  })() : '';

  // Summarized profection content for birthday emails (inlined — backend can't import src/)
  const HOUSE_TITLES = { 1:'The House of Self',2:'The House of Resources',3:'The House of Communication',4:'The House of Home & Family',5:'The House of Creativity & Joy',6:'The House of Health & Daily Routine',7:'The House of Partnerships',8:'The House of Transformation',9:'The House of Meaning',10:'The House of Career & Calling',11:'The House of Community & Vision',12:'The House of Solitude & Soul' };
  const HOUSE_SUMMARY = { 1:'A year of personal reinvention — fresh starts, heightened visibility, and a powerful urge to redefine who you are.',2:'A year focused on what you earn, own, and truly value. Income may shift; clarify what matters at a practical level.',3:'A year of mental stimulation — ideas, writing, short trips, and connections that reshape your thinking.',4:'A year to tend your roots — shifts in living situation, family matters, and inner emotional foundations.',5:'A year to follow your joy — creative projects flourish, romance blossoms, and play becomes meaningful.',6:'A year to refine daily life — health routines, work environment, and sustainable habits come into focus.',7:'A year defined by relationships — romantic, business, or collaborative partnerships take center stage.',8:'A year of deep change — shared finances, psychological transformation, and what is hidden coming to light.',9:'A year to expand horizons — travel, higher education, and experiences that reshape your worldview.',10:'A year of ambition and visibility — career developments, recognition, and stepping into authority.',11:'A year of connection — friendships, groups, and collective endeavors aligned with your values.',12:'A year of turning inward — solitude, spiritual practice, healing, and preparing for a new cycle.' };
  const HOUSE_FOCUS = { 1:'Clarify goals, invest in self-development, step into visibility.',2:'Plan finances, negotiate your value, declutter what no longer serves.',3:'Learn something new, write regularly, strengthen local connections.',4:'Create a nourishing home, heal family patterns, honor your need for retreat.',5:'Pursue creative passions, date with intention, prioritize joy.',6:'Establish health routines, optimize your work process, care for your body.',7:'Deepen your primary relationship, form alliances, learn to balance self and other.',8:'Face fears, resolve debts, deepen intimacy, embrace necessary change.',9:'Travel with purpose, study deeply, examine your beliefs.',10:'Set ambitious goals, build your reputation, align work with your calling.',11:'Strengthen friendships, clarify your vision, contribute to causes you believe in.',12:'Prioritize rest and spiritual practice, complete unfinished cycles, listen to your dreams.' };
  const LORD_TITLES = { Sun:'The Illuminator',Moon:'The Nurturer',Mercury:'The Messenger',Venus:'The Beloved',Mars:'The Warrior',Jupiter:'The Expander',Saturn:'The Builder' };
  const LORD_SUMMARY = { Sun:'A year of identity, vitality, and creative self-expression. You are called to step into your light and clarify what you truly want.',Moon:'A year of emotional depth, home, and family. Your emotional life intensifies — tend your inner garden and strengthen your roots.',Mercury:'A year of communication, learning, and connection. A busy, mentally stimulating period with lots of movement and social interaction.',Venus:'A year of love, beauty, values, and pleasure. Cultivate what you love, deepen connections, and align choices with your authentic values.',Mars:'A year of drive, action, and assertion. Forward momentum, conflict resolution, and the will to pursue what you want with intensity.',Jupiter:'A year of expansion, opportunity, and growth. Doors open, horizons broaden — say yes, take risks, and trust in abundance.',Saturn:'A year of structure, responsibility, and mastery. Consolidate efforts, do the hard work, and build foundations that endure.' };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="text-align:center;padding:8px 24px 20px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta ✦</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin-top:6px;">${prettyDate}</div>
  </td></tr>

  ${lunarEventBanner}

  <!-- Feature Highlight — cycles through features, shown for at least a week each -->
  ${featureHighlight ? `
  <tr><td style="padding:14px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:none;border-radius:14px;">
      <tr><td style="padding:20px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✦ ${featureHighlight.title}</div>
        <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:0 0 14px;">${featureHighlight.description}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="center" style="padding-bottom:8px;"><a href="${appUrl ? `${appUrl}${featureHighlight.deep_link}` : '#'}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 18px;border-radius:999px;">${featureHighlight.subtitle} →</a></td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
  ` : ''}

  <!-- Solar Return / Birthday banner -->
  ${isBirthday ? `
  <tr><td style="padding:0 24px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}66;border-radius:14px;position:relative;overflow:hidden;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <div style="position:relative;z-index:2;">
        ${sparkleRow ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;"><tr>${sparkleRow}</tr></table>` : ''}
        <div style="font-family:Georgia,serif;font-size:28px;color:${GOLD2};margin-bottom:8px;">☉</div>
        <div style="font-family:Georgia,serif;font-size:18px;color:${TEXT};margin-bottom:4px;">Happy Solar Return${ageLabel ? `, ${user.full_name || 'Friend'}` : ''}!</div>
        <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${GOLD};margin-bottom:12px;">The Sun returns to your natal position</div>
        ${llm.solar_return_message ? `<p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0 0 14px;">${llm.solar_return_message}</p>` : ''}
        ${profectedHouse ? `
        <div style="display:inline-block;background:rgba(201,169,97,0.10);border:1px solid ${GOLD}33;border-radius:10px;padding:14px 18px;text-align:left;max-width:460px;">
          <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${GOLD};margin-bottom:8px;">☉ Your Profection Year</div>
          <p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:${TEXT};margin:0 0 10px;">You are in your <strong style="color:${GOLD2};">${ordinal(profectedHouse)} house</strong> profection year${profectedSign ? ` — <span style="color:${GOLD2};">${profectedSign}</span>` : ''}. <span style="color:${MUTED};">${HOUSE_TITLES[profectedHouse] || ''}</span></p>
          <p style="font-family:Georgia,serif;font-size:12px;line-height:1.5;color:${GOLD2};font-style:italic;margin:0 0 10px;">${HOUSE_SUMMARY[profectedHouse] || ''}</p>
          ${yearLord ? `
          <div style="border-top:1px solid ${GOLD}22;padding-top:10px;margin-bottom:10px;">
            <p style="font-family:Georgia,serif;font-size:13px;line-height:1.5;color:${TEXT};margin:0 0 6px;">Year Lord: <strong style="color:${GOLD2};">${yearLord}</strong> <span style="color:${MUTED};">· ${LORD_TITLES[yearLord] || ''}</span></p>
            <p style="font-family:Georgia,serif;font-size:12px;line-height:1.5;color:${GOLD2};font-style:italic;margin:0;">${LORD_SUMMARY[yearLord] || ''}</p>
          </div>` : ''}
          ${HOUSE_FOCUS[profectedHouse] ? `
          <div style="background:rgba(168,200,168,0.08);border:1px solid rgba(168,200,168,0.18);border-radius:8px;padding:8px 12px;">
            <div style="font-family:Georgia,serif;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#5E8A5E;margin-bottom:3px;">✦ Focus this year</div>
            <p style="font-family:Georgia,serif;font-size:11px;line-height:1.4;color:${TEXT};margin:0;">${HOUSE_FOCUS[profectedHouse]}</p>
          </div>` : ''}
        </div>` : ''}
        </div>
        </td></tr>
        </table>
        </td></tr>
        ` : ''}

        <!-- Power planet -->
  <tr><td style="text-align:center;padding:0 24px 18px;">
    <div style="display:inline-block;background:${CARD};border:1px solid ${GOLD}33;border-radius:999px;padding:8px 18px;">
      <span style="font-family:Georgia,serif;font-size:22px;color:${GOLD2};vertical-align:middle;">${llm.power_planet_glyph || '✦'}</span>
      <span style="font-family:Georgia,serif;font-size:13px;color:${TEXT};vertical-align:middle;margin-left:8px;">${llm.power_planet} leads your day</span>
    </div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:0 28px 18px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0;">${highlightAstro(llm.greeting)}</p>
    <div style="margin-top:14px;">${themeChips}</div>
  </td></tr>

  <!-- Daily synthesis (paid: full, free: teaser) -->
  ${synthesisSection}

  ${!isPaid ? `
  <!-- Collective reading (free) -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🌌 Collective Reading</div>
    ${para(llm.collective_synthesis)}
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  ` : ''}

  <!-- Today's Edge (free users only — paid get it in synthesis) -->
  ${!isPaid && (maximizeItems || watchItems) ? `
  <tr><td style="padding:14px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🎯 Today's Edge</div>
  </td></tr>
  ${maximizeItems ? `<tr><td style="padding:0 28px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${maximizeItems}</table></td></tr>` : ''}
  ${watchItems ? `<tr><td style="padding:4px 28px 6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${watchItems}</table></td></tr>` : ''}
  ` : ''}

  <!-- Planetary highlights for the week ahead -->
  ${llm.week_ahead ? `
  <tr><td style="padding:14px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:none;border-radius:14px;">
      <tr><td style="padding:18px 24px;">
        <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🔭 Planetary Highlights — Week Ahead</div>
        <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:0;">${highlightAstro(llm.week_ahead)}</p>
      </td></tr>
    </table>
  </td></tr>
  ` : ''}

  <!-- Quiz CTA -->
  <tr><td style="padding:22px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}44;border-radius:14px;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:8px;">📖 Today's Quiz</div>
        <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${TEXT};margin:0 0 16px;">${highlightAstro(llm.quiz_teaser)}</p>
        <a href="${quiz}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:999px;">Take today's quiz →</a>
        <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:12px;">🔥 Keep your streak alive</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Deeper insights CTA -->
  <tr><td style="padding:8px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;">
      <tr><td style="padding:16px 24px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:6px;">📅 Deeper Insights</div>
        <p style="font-family:Georgia,serif;font-size:13px;color:${MUTED};margin:0 0 14px;line-height:1.5;">Explore your full synthesis and transit calendar in the Planner.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td align="center" style="padding-bottom:8px;"><a href="${planner}" style="display:inline-block;background:transparent;color:${GOLD2};font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 16px;border:1px solid ${GOLD}55;border-radius:999px;">Daily →</a></td>
          ${isPaid ? `<td align="center" style="padding-bottom:8px;"><a href="${plannerWeek}" style="display:inline-block;background:transparent;color:${GOLD2};font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 16px;border:1px solid ${GOLD}55;border-radius:999px;">Week →</a></td>
          <td align="center" style="padding-bottom:8px;"><a href="${plannerMonth}" style="display:inline-block;background:transparent;color:${GOLD2};font-family:Georgia,serif;font-size:12px;font-weight:bold;text-decoration:none;padding:8px 16px;border:1px solid ${GOLD}55;border-radius:999px;">Month →</a></td>` : ''}
        </tr></table>
        ${isPaid ? '' : `<a href="${subscribe}" style="font-family:Georgia,serif;font-size:11px;color:${GOLD};text-decoration:underline;">Upgrade to unlock weekly & monthly synthesis →</a>`}
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 28px 8px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.6;">
      You're receiving this because you opted in to the daily digest.<br>
      <a href="${appUrl ? `${appUrl}/profile` : '#'}" style="color:${GOLD};text-decoration:underline;">Manage email preferences</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const body = await req.json().catch(() => ({}));
    const appUrl = body.appUrl || 'https://astrosetta.com';

    // SCHEDULED MODE — triggered by automation, no user context
    if (body.scheduled) {
      const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
      let userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
      // Optional batch support: when user_ids is passed, only process those users
      // (lets the caller split the run into chunks that fit the execution window).
      if (Array.isArray(body.user_ids) && body.user_ids.length) {
        const wanted = new Set(body.user_ids);
        userIds = userIds.filter(uid => wanted.has(uid));
      }
      let sent = 0, skipped = 0, optedOut = 0, failed = 0;
      for (const uid of userIds) {
        const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
        if (!target?.email) { skipped++; continue; }
        // Respect the user's daily email opt-in preference
        if (target.daily_email_opt_in === false) { optedOut++; continue; }
        // One bad recipient must not abort the whole run — everyone after it
        // would silently lose their digest.
        try {
          const built = await buildEmailForUser(base44, target, appUrl);
          if (!built) { skipped++; continue; }
          await sendDigestEmail({ to: target.email, subject: built.subject, html: built.html });
          sent++;
        } catch (err) {
          failed++;
          console.error(`[daily-digest] send failed for user ${uid}:`, err?.message || err);
        }
      }
      return json({ success: true, sent, skipped, optedOut, failed });
    }

    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    // TEST MODE — send only to the calling user
    if (body.test) {
      const built = await buildEmailForUser(base44, user, appUrl);
      if (!built) return json({ error: 'No natal chart found for your account. Create your chart first.' }, { status: 400 });
      await sendDigestEmail({ to: user.email, subject: built.subject, html: built.html });
      return json({ success: true, sent_to: user.email });
    }

    // BULK MODE — admin only (manual trigger from dashboard)
    if (user.role !== 'admin') return json({ error: 'Forbidden: admin only' }, { status: 403 });
    const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
    const userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
    let sent = 0, skipped = 0, optedOut = 0;
    for (const uid of userIds) {
      const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
      if (!target?.email) { skipped++; continue; }
      if (target.daily_email_opt_in === false) { optedOut++; continue; }
      const built = await buildEmailForUser(base44, target, appUrl);
      if (!built) { skipped++; continue; }
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: target.email, from_name: 'Astrosetta', subject: built.subject, body: built.html,
      });
      sent++;
    }
    return json({ success: true, sent, skipped, optedOut });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});