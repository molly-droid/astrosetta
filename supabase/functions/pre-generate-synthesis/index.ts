/**
 * preGenerateSynthesis — Overnight job that pre-generates ALL synthesis types
 * for every user with a chart. Stores structured JSON in CalendarSynthesis.data
 * so the frontend can render instantly without LLM calls.
 *
 * Generates: day, week, month, lunar (if exact), ingress (if any).
 * Uses simplified J2000 orbital math (same as generateCalendarSynthesis).
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { fetchKnowledgeDepth, densityInstruction } from '../_shared/knowledgeDensity.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';

// ── Constants ────────────────────────────────────────────────────────────────
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const PLANET_GLYPHS = {Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇',Chiron:'⚷','North Node':'☊','South Node':'☋','Black Moon Lilith':'⚸',Lilith:'⚸','Black Moon':'⚸',Ascendant:'Asc',Midheaven:'MC'};
const ASPECT_GLYPHS = {conjunction:'☌',opposition:'☍',square:'□',trine:'△',sextile:'⚹'};
const ASPECT_ABBREV = {conjunction:'cnj',opposition:'opp',square:'sq',trine:'tri',sextile:'sxt'};
const ASPECT_ANGLES = {conjunction:0,opposition:180,trine:120,square:90,sextile:60};
const PERSONA = `You are a psychologically astute astrologer and educator — specific, warm, and grounded. You never use generic affirmations or vague spiritual language. You always show your work: you name the specific planetary configurations (planet, sign, aspect, natal planet, house) creating each interpretation and explain the astrological mechanic of how those elements interact to produce the effect. Your goal is to teach the reader how astrology works, not just deliver a horoscope.

${TONE_DIRECTIVE}`;
const SLOW_SET = new Set(['Jupiter','Saturn','Uranus','Neptune','Pluto']);
const ALL_TP = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOUSE_THEMES = ['','self and first impressions','money and values','communication and learning','home and family','creativity and romance','health and daily routines','partnerships','shared resources and intimacy','philosophy, travel, and higher learning','career and public standing','friendships and groups','solitude and spirituality'];
const PLANET_DURATIONS = {Sun:'about 1 month',Mercury:'2–4 weeks',Venus:'3–4 weeks',Mars:'about 2 months',Jupiter:'about 1 year',Saturn:'about 2.5 years',Uranus:'about 7 years',Neptune:'about 14 years',Pluto:'12–30 years'};
const CHART_RULERS = {Aries:{planet:'Mars'},Taurus:{planet:'Venus'},Gemini:{planet:'Mercury'},Cancer:{planet:'Moon'},Leo:{planet:'Sun'},Virgo:{planet:'Mercury'},Libra:{planet:'Venus'},Scorpio:{planet:'Pluto'},Sagittarius:{planet:'Jupiter'},Capricorn:{planet:'Saturn'},Aquarius:{planet:'Uranus'},Pisces:{planet:'Neptune'}};
const TRAD_RULERS = {Aries:'Mars',Taurus:'Venus',Gemini:'Mercury',Cancer:'Moon',Leo:'Sun',Virgo:'Mercury',Libra:'Venus',Scorpio:'Mars',Sagittarius:'Jupiter',Capricorn:'Saturn',Aquarius:'Saturn',Pisces:'Jupiter'};
const PROF_THEMES = {1:'identity and new beginnings',2:'resources and values',3:'communication and learning',4:'home and family',5:'creativity and pleasure',6:'health and daily routine',7:'partnerships and relationships',8:'transformation and shared resources',9:'beliefs and expansion',10:'career and public life',11:'community and future vision',12:'solitude and inner work'};

function getSolarReturnContext(raw, date) {
  if (!raw?.birth_date) return '';
  const parts = raw.birth_date.split('-');
  if (parts.length !== 3) return '';
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  if (birthYear < 1900) return '';

  const isBirthday = date.getMonth() === birthMonth && date.getDate() === birthDay;
  const nowYear = date.getFullYear();
  const birthdayThisYear = new Date(nowYear, birthMonth, birthDay);
  const birthdayPassed = date > birthdayThisYear;
  const age = (isBirthday || birthdayPassed) ? nowYear - birthYear : nowYear - birthYear - 1;
  if (age < 0) return '';

  // Days until next birthday
  let nextBday = new Date(nowYear, birthMonth, birthDay);
  if (date > nextBday) nextBday = new Date(nowYear + 1, birthMonth, birthDay);
  const daysUntil = Math.ceil((nextBday - date) / 86400000);

  // Profection
  const profectedHouse = (age % 12) + 1;
  const natalHouses = raw.houses || [];
  const houseData = natalHouses.find(h => h.number === profectedHouse);
  const profectedSign = houseData?.sign || raw.ascendant_sign || '';
  const yearLord = TRAD_RULERS[profectedSign] || '';
  const lordPlanet = (raw.planets || []).find(p => p.name === yearLord);
  const lordPlacement = lordPlanet ? `${yearLord} in ${lordPlanet.sign}${lordPlanet.house ? ` (${lordPlanet.house}H)` : ''}` : '';

  let ctx = '';
  if (isBirthday) {
    ctx += `SOLAR RETURN: TODAY IS THEIR BIRTHDAY — solar return #${age}. The Sun has returned to its exact natal position, marking a personal new year. Acknowledge this warmly and weave intention-setting, reflection, and renewal themes into the reading. `;
  } else if (daysUntil <= 7) {
    ctx += `SOLAR RETURN APPROACHING: Their birthday (solar return #${age + 1}) is in ${daysUntil} day(s). Weave anticipatory, reflective energy into the reading — a year is completing, a new one begins soon. `;
  }
  if (profectedSign && yearLord) {
    ctx += `PROFECTION YEAR: ${profectedHouse}th house profection year (${PROF_THEMES[profectedHouse]}). Year lord is ${yearLord} (ruler of ${profectedSign})${lordPlacement ? `, placed in ${lordPlacement}` : ''}. Weave the profection house theme and year lord placement into the reading where relevant.`;
  }
  return ctx;
}

// ── Orbital math ─────────────────────────────────────────────────────────────
function dateToJD(date) { return date.getTime() / 86400000 + 2440587.5; }

function planetLongitude(name, jd) {
  const T = (jd - 2451545.0) / 36525.0;
  const deg = v => ((v % 360) + 360) % 360;
  switch (name) {
    case 'Sun': return deg(280.460 + 35999.372 * T);
    case 'Moon': {
      const Lp = 218.3164477 + 481267.88123421 * T;
      const D = 297.8501921 + 445267.1114034 * T;
      const pert = 6.288774 * Math.sin(D * Math.PI / 180);
      return deg(Lp + pert);
    }
    case 'Mercury': return deg(252.251 + 149472.675 * T);
    case 'Venus': return deg(181.979 + 58517.816 * T);
    case 'Mars': return deg(355.433 + 19140.299 * T);
    case 'Jupiter': return deg(34.351519 + 3034.905675 * T);
    case 'Saturn': return deg(50.077444 + 1222.113794 * T);
    case 'Uranus': return deg(314.055005 + 428.466998 * T);
    case 'Neptune': return deg(304.348665 + 218.459213 * T);
    case 'Pluto': return deg(238.929 + 145.2069 * T);
    default: return 0;
  }
}

function longitudeToSign(lon) {
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30);
  return SIGNS[idx] || '';
}

function isRetrograde(name, date) {
  if (name === 'Sun' || name === 'Moon') return false;
  const prev = new Date(date.getTime() - 2 * 86400000);
  const next = new Date(date.getTime() + 2 * 86400000);
  const l0 = planetLongitude(name, dateToJD(prev));
  const l1 = planetLongitude(name, dateToJD(date));
  const l2 = planetLongitude(name, dateToJD(next));
  function motion(a, b) { let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
  return motion(l0, l1) < 0 || motion(l1, l2) < 0;
}

function getMoonPhaseName(moonLon, sunLon) {
  let diff = ((moonLon - sunLon) + 360) % 360;
  if (diff < 22.5 || diff >= 337.5) return 'New Moon';
  if (diff < 67.5) return 'Crescent';
  if (diff < 112.5) return 'First Quarter';
  if (diff < 157.5) return 'Gibbous';
  if (diff < 202.5) return 'Full Moon';
  if (diff < 247.5) return 'Disseminating';
  if (diff < 292.5) return 'Last Quarter';
  return 'Balsamic';
}

function checkAspect(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const [aspName, aspAngle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(diff - aspAngle);
    if (orb <= 2.0) return { aspect: aspName, orb };
  }
  return null;
}

function formatTransitLabel(tp, np, aspect) {
  const houseStr = np.house ? ` (${np.house}H)` : '';
  const tSign = tp.sign ? ` in ${tp.sign}` : '';
  const nSign = np.sign ? ` in ${np.sign}` : '';
  return `${tp.name}${tSign} ${aspect} ${np.name}${nSign}${houseStr}`;
}

function dateKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Re-assign natal planet houses using stored cusps — ensures correct house
// assignments even if the stored chart was calculated with a different
// house system than what's currently active.
function reassignHouses(natalRaw) {
  const planets = natalRaw?.planets || [];
  const houses = natalRaw?.houses || [];
  const houseSystem = natalRaw?.house_system || 'whole_sign';
  const ascSign = natalRaw?.ascendant_sign;
  if (houses.length < 12) return planets;
  const norm = v => ((v % 360) + 360) % 360;
  for (const np of planets) {
    if (np.longitude == null) continue;
    if (houseSystem === 'whole_sign' && ascSign) {
      const signIdx = Math.floor(norm(np.longitude) / 30);
      const ascIdx = SIGNS.indexOf(ascSign);
      np.house = ((signIdx - ascIdx + 12) % 12) + 1;
    } else {
      const lon = norm(np.longitude);
      for (let i = 0; i < 12; i++) {
        const a = norm(houses[i].longitude);
        const b = norm(houses[(i + 1) % 12].longitude);
        const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
        if (inside) { np.house = i + 1; break; }
      }
    }
  }
  return planets;
}

// ── Transit processing ────────────────────────────────────────────────────────
function processTransits(date, natalRaw) {
  const jd = dateToJD(date);
  const natalPlanets = reassignHouses(natalRaw);

  const transitPlanets = ALL_TP.map(name => {
    const lon = planetLongitude(name, jd);
    return { name, longitude: lon, sign: longitudeToSign(lon), retrograde: isRetrograde(name, date) };
  });

  // Natal aspects (slow planets + fast planets to natal)
  const PLANET_ORBS = { Sun: 2.0, Mercury: 2.0, Venus: 2.0, Mars: 2.0 };
  const natalAspects = [];
  for (const tp of transitPlanets) {
    if (tp.name === 'Moon') continue;
    const isSlow = SLOW_SET.has(tp.name);
    const maxOrb = isSlow ? 2.0 : (PLANET_ORBS[tp.name] ?? 2.0);
    for (const np of natalPlanets) {
      const result = checkAspect(tp.longitude, np.longitude);
      if (result && result.orb <= maxOrb) {
        natalAspects.push({ transit_planet: tp.name, natal_planet: np.name, aspect: result.aspect, orb: result.orb, type: 'natal' });
      }
    }
  }

  // Lunar aspects (Moon to natal, wider orb)
  const moon = transitPlanets.find(p => p.name === 'Moon');
  const lunarAspects = [];
  for (const np of natalPlanets) {
    const result = checkAspect(moon.longitude, np.longitude);
    if (result && result.orb <= 8.0) {
      lunarAspects.push({ transit_planet: 'Moon', natal_planet: np.name, aspect: result.aspect, orb: result.orb, type: 'lunar' });
    }
  }

  // Mundane aspects (transit to transit, excluding Moon)
  const MUNDANE_ORBS = { conjunction: 2.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
  const mundaneAspects = [];
  for (let i = 0; i < transitPlanets.length; i++) {
    for (let j = i + 1; j < transitPlanets.length; j++) {
      const p1 = transitPlanets[i], p2 = transitPlanets[j];
      if (p1.name === 'Moon' || p2.name === 'Moon') continue;
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const [asp, targetOrb] of Object.entries(MUNDANE_ORBS)) {
        const orb = Math.abs(diff - ASPECT_ANGLES[asp]);
        if (orb <= targetOrb) {
          mundaneAspects.push({ transit_planet: p1.name, natal_planet: p2.name, aspect: asp, orb: Math.round(orb * 100) / 100, type: 'mundane' });
          break;
        }
      }
    }
  }

  // Moon sign & phase
  const sun = transitPlanets.find(p => p.name === 'Sun');
  const moonPhase = (moon && sun) ? getMoonPhaseName(moon.longitude, sun.longitude) : '';
  let diff = ((moon.longitude - sun.longitude) + 360) % 360;
  const isExactNewMoon = diff <= 6 || diff >= 354;
  const isExactFullMoon = Math.abs(diff - 180) <= 6;

  // Stations
  const stations = [];
  for (const name of ALL_TP) {
    if (name === 'Sun' || name === 'Moon') continue;
    const prev = new Date(date.getTime() - 2 * 86400000);
    const next = new Date(date.getTime() + 2 * 86400000);
    const l0 = planetLongitude(name, dateToJD(prev));
    const l1 = planetLongitude(name, dateToJD(date));
    const l2 = planetLongitude(name, dateToJD(next));
    function motion(a, b) { let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
    const m0 = motion(l0, l1), m1 = motion(l1, l2);
    if ((m0 > 0 && m1 < 0) || (m0 < 0 && m1 > 0)) {
      stations.push({ planet: name, type: m0 > 0 ? 'retrograde' : 'direct', sign: longitudeToSign(l1) });
    }
  }

  // Ingresses (planet changed sign since yesterday)
  const ingresses = [];
  for (const name of ALL_TP) {
    const yesterday = new Date(date.getTime() - 86400000);
    const todayLon = planetLongitude(name, jd);
    const yesterdayLon = planetLongitude(name, dateToJD(yesterday));
    if (longitudeToSign(todayLon) !== longitudeToSign(yesterdayLon)) {
      ingresses.push({ planet: name, from_sign: longitudeToSign(yesterdayLon), to_sign: longitudeToSign(todayLon), degree: todayLon % 30, exact: true });
    }
  }

  return { transitPlanets, natalAspects, mundaneAspects, lunarAspects, moonSign: moon?.sign, moonPhase, isExactNewMoon, isExactFullMoon, stations, ingresses };
}

// ── Synthesis builders ───────────────────────────────────────────────────────
async function generateDaySynthesis(base44, raw, date, transits, depth) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const natalPlanets = raw.planets || [];
  const tPls = transits.transitPlanets || [];

  const fmtNatal = transits.natalAspects.map(a => formatTransitLabel(
    tPls.find(p => p.name === a.transit_planet) || { name: a.transit_planet, longitude: 0 },
    natalPlanets.find(p => p.name === a.natal_planet) || { name: a.natal_planet, longitude: 0 },
    a.aspect));
  const fmtMundane = transits.mundaneAspects.map(a => formatTransitLabel(
    tPls.find(p => p.name === a.transit_planet) || { name: a.transit_planet, longitude: 0 },
    tPls.find(p => p.name === a.natal_planet) || { name: a.natal_planet, longitude: 0 },
    a.aspect));
  const fmtLunar = transits.lunarAspects.map(a => formatTransitLabel(
    tPls.find(p => p.name === 'Moon') || { name: 'Moon', longitude: 0 },
    natalPlanets.find(p => p.name === a.natal_planet) || { name: a.natal_planet, longitude: 0 },
    a.aspect));

  const fmtStations = transits.stations.map(s => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde (℞)' : 'direct (↗)'} in ${s.sign}`);

  const fmtIngresses = transits.ingresses.map(ing => {
    const signIdx = SIGNS.indexOf(ing.to_sign);
    const natalHouses = raw.houses || [];
    const houseSystem = raw.house_system || 'whole_sign';
    const ascSign = raw.ascendant_sign;
    let entryH = null;
    if (houseSystem === 'whole_sign' && ascSign) {
      const ascIdx = SIGNS.indexOf(ascSign);
      if (signIdx >= 0 && ascIdx >= 0) entryH = ((signIdx - ascIdx + 12) % 12) + 1;
    } else if (signIdx >= 0) {
      const norm = v => ((v % 360) + 360) % 360;
      const startLon = signIdx * 30;
      for (let i = 0; i < natalHouses.length; i++) {
        const a = norm(natalHouses[i].longitude), b = norm(natalHouses[(i+1)%12].longitude);
        const inEntry = a <= b ? (norm(startLon) >= a && norm(startLon) < b) : (norm(startLon) >= a || norm(startLon) < b);
        if (inEntry) { entryH = natalHouses[i].number; break; }
      }
    }
    const base = `${ing.planet} enters ${ing.to_sign} (leaving ${ing.from_sign})`;
    return entryH ? `${base} — in natal ${entryH}H (${HOUSE_THEMES[entryH]})` : base;
  });

  const ruler = CHART_RULERS[raw.ascendant_sign];
  const rulerLine = ruler ? `CHART RULER: ${PLANET_GLYPHS[ruler.planet] || ''} ${ruler.planet} rules your ${raw.ascendant_sign} Ascendant — this planet governs your identity, life direction, and how you meet the world.` : '';
  const moonInfo = transits.moonSign ? `Moon in ${transits.moonSign} (${transits.moonPhase})` : '';

  const transitPositions = (tPls || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');

  const prompt = `${PERSONA}

${densityInstruction(depth)}

Today: ${dateStr}
NATAL: ☉ ${raw.sun_sign} · ☽ ${raw.moon_sign} · ASC ${raw.ascendant_sign}
NATAL PLACEMENTS: ${natalPlanets.map(p => `${p.name} in ${p.sign || '?'}${p.house ? ` (${p.house}H)` : ''}`).join(', ')}
${rulerLine}
${moonInfo}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

TODAY'S TRANSITS
PERSONAL:
${fmtNatal.join('\n') || 'None today.'}

MUNDANE:
${fmtMundane.join('\n') || 'None today.'}

LUNAR:
${fmtLunar.join('\n') || 'None today.'}

STATIONS:
${fmtStations.join('\n') || 'None today.'}

INGRESSES:
${fmtIngresses.join('\n') || 'None today.'}

Rules:
- THE PERSONAL_READING IS ABOUT TRANSITS, NOT NATAL STRUCTURE. Every bullet in personal_reading MUST interpret a specific transit from TODAY'S TRANSITS above. Do NOT describe natal stelliums, chart patterns, sign-to-house oppositions, or natal chart structure unless a specific transit is directly activating them. A zodiac SIGN cannot form an aspect — only planets and points aspect other planets and points. Never write things like "Aries opposes your 7th house."
- Every personal_reading bullet MUST begin by copying the exact transit label from TODAY'S TRANSITS above (transiting planet + sign, aspect, natal planet + natal sign and house when available). If the label has no house, do NOT invent one. One bullet per transit; do NOT combine multiple transits into one bullet.
- COVERAGE & ORDER LOCK: personal_reading MUST contain EXACTLY ONE bullet for EVERY transit listed in the PERSONAL section above, in the exact order they appear. Do not skip, add, or reorder any transit. Knowledge Density changes only the prose depth and vocabulary of each bullet — never which transits are covered.
- If PERSONAL transits say "None today," return an empty personal_reading array. Do NOT fill it with natal pattern descriptions.
- After the label, write 2-3 sentences explaining the astrological mechanic in depth — name what the transiting planet represents (its drive/domain), how the sign it's in colors that energy, what the aspect does (flow/friction/merger), what the natal placement means in its sign and house, and the real-world life area activated. Teach the reader how the symbols combine so they learn to make their own interpretations.
- personal_reading_core is a SUBSET of personal_reading: include ONLY the bullets for transits whose natal target is the Sun, Moon, or Ascendant (the "Big Three"). Use the exact same label and interpretation as in personal_reading. If none hit the Big Three, return an empty personal_reading_core array.
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, stations, or lunar events that are not explicitly listed. If a category says "None today," do NOT invent any.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- Use ONLY the Moon sign and phase provided above.
- LUNAR NODES: Transits to your natal North Node or South Node are karmically significant — the North Node marks your evolutionary direction and the South Node marks past-pattern comfort. When any transit aspects a node, you MUST include it in personal_reading AND name the nodal activation explicitly in the overview (e.g. "the Sun opposing your North Node..."). Never bury or omit a node transit.
- Use FULL planet names and FULL aspect names. Never use abbreviations.
- Do NOT include raw glyph symbols or the em-dash label format in your output. Write only prose — glyphs are added automatically by the frontend.
- Do NOT include the words "applying" or "separating."
- PERSONALIZATION LOCK: The overview and personal_reading must feel like they belong to no one else. Every personal_reading bullet MUST name the natal placement it touches inside the prose — e.g. "Because your natal Mars in Scorpio sits in your 5th house, you may experience this transit Venus as..." or "With your Virgo Midheaven, you may experience this Virgo Moon as...". When the transit lands on an angle (Ascendant, Midheaven, IC, Descendant), name that angle in the sentence. If a bullet could be true for anyone with any chart, rewrite it until it couldn't.
- INVITING TONE: Speak directly to the reader in warm possibility language — "you may experience," "you might notice," "for you, this can show up as." Never commands, guarantees, or collective phrasing ("everyone," "we all") in the overview or personal_reading.
- No platitudes, no generic horoscope language. Every sentence must be traceable to a specific transit configuration in the data above.

Return JSON:
{
  "overview": "3-4 sentences synthesizing the WHOLE of what is happening today — weave the personal transits and collective sky into one coherent narrative naming the key configurations and which life areas are lit up. Speak directly to the reader and name their natal reference points (e.g. \"your Virgo Midheaven\") where relevant",
  "personal_reading": ["TransitLabel — 2-3 sentence deep interpretation of the astrological mechanic", "..."],
  "personal_reading_core": ["Same format as personal_reading, but ONLY for transits to the natal Sun, Moon, or Ascendant. Empty array if none."],
  "collective_reading": ["Each bullet MUST start with 'PlanetName aspectName PlanetName' (e.g. 'Jupiter trine Sun') then the collective meaning", "..."],
  "collective_highlight": "1 sentence on single most significant mundane transit",
  "maximize": "1 action sentence",
  "focus": "1 attention sentence",
  "watch": "1 caution sentence",
  "best_areas": ["area1", "area2"],
  "power_planet": "planet name",
  "key_themes": ["theme1", "theme2", "theme3"]
}`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        personal_reading: { type: 'array', items: { type: 'string' } },
        personal_reading_core: { type: 'array', items: { type: 'string' } },
        collective_reading: { type: 'array', items: { type: 'string' } },
        collective_highlight: { type: 'string' },
        maximize: { type: 'string' },
        focus: { type: 'string' },
        watch: { type: 'string' },
        best_areas: { type: 'array', items: { type: 'string' } },
        power_planet: { type: 'string' },
        key_themes: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'personal_reading', 'collective_reading', 'maximize', 'focus', 'watch', 'best_areas'],
    },
  });

  const dk = dateKey(date);
  return {
    period_type: 'day',
    period_key: `day-v20-${dk}-${depth}`,
    date_start: dk,
    date_end: dk,
    summary: `Daily Reading · ${dateStr}`,
    description: result.overview || '',
    data: result,
  };
}

async function generateWeekSynthesis(base44, raw, weekDays) {
  const natalPlanets = [...(raw.planets || [])];
  const dayContexts = weekDays.map(d => {
    const t = processTransits(d, raw);
    const moonInfo = `Moon in ${t.moonSign}${t.moonPhase && (t.moonPhase === 'New Moon' || t.moonPhase === 'Full Moon') ? ` (${t.moonPhase})` : ''}`;
    const aspects = t.natalAspects.map(a => formatTransitLabel(
      t.transitPlanets.find(p => p.name === a.transit_planet) || { name: a.transit_planet, longitude: 0 },
      natalPlanets.find(p => p.name === a.natal_planet) || { name: a.natal_planet, longitude: 0 },
      a.aspect));
    return `${DOW_SHORT[d.getUTCDay()]} ${d.getUTCDate()}: ${moonInfo}. ${aspects.length ? aspects.join(', ') : 'no major personal aspects'}`;
  });

  const weekRange = `${weekDays[0].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' })} – ${weekDays[6].toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
  const solarContext = getSolarReturnContext(raw, weekDays[0]);

  const firstDayTransits = processTransits(weekDays[0], raw);
  const weekTransitPositions = (firstDayTransits.transitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');

  const prompt = `${PERSONA}

Week: ${weekRange}
NATAL: ☉ ${raw.sun_sign} · ☽ ${raw.moon_sign} · ASC ${raw.ascendant_sign}
${solarContext}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${weekTransitPositions || 'Data unavailable.'}

DAILY TRANSITS (slow planets ≤2° orb):
${dayContexts.join('\n')}

Rules:
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, stations, or lunar events that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- For days with no personal aspects, write day_sentence about Moon sign energy + any active mundane aspects
- Never write the same energy twice across day_sentences
- Each day_sentences entry max 15 words
- Do NOT include raw glyph symbols (☉☽☿♀♂♃♄♅♆♇ etc.) or the em-dash label format in your output. Write only prose using full planet and aspect names — glyphs are added automatically by the frontend.

Return JSON:
{
  "overview": "2 sentences summarizing the week's overall energy, referencing specific transit labels",
  "day_sentences": {
    "0": "Monday sentence",
    "1": "Tuesday sentence",
    "2": "Wednesday sentence",
    "3": "Thursday sentence",
    "4": "Friday sentence",
    "5": "Saturday sentence",
    "6": "Sunday sentence"
  },
  "best_days": ["DayName", "DayName"],
  "best_areas": ["area1", "area2"]
}`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        day_sentences: {
          type: 'object',
          properties: {
            '0': { type: 'string' }, '1': { type: 'string' }, '2': { type: 'string' },
            '3': { type: 'string' }, '4': { type: 'string' }, '5': { type: 'string' },
            '6': { type: 'string' },
          },
          required: ['0', '1', '2', '3', '4', '5', '6'],
          additionalProperties: false,
        },
        best_days: { type: 'array', items: { type: 'string' } },
        best_areas: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'day_sentences', 'best_days', 'best_areas'],
    },
  });

  const wkStart = dateKey(weekDays[0]);
  const wkEnd = dateKey(weekDays[6]);
  return {
    period_type: 'week',
    period_key: `week-v9-${wkStart}`,
    date_start: wkStart,
    date_end: wkEnd,
    summary: `Week at a Glance · ${weekRange}`,
    description: result.overview || '',
    data: result,
  };
}

async function generateMonthSynthesis(base44, raw, baseDate) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const monthName = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const midDay = new Date(Date.UTC(year, month, 15, 12, 0, 0));
  const t1 = processTransits(firstDay, raw);
  const t15 = processTransits(midDay, raw);

  const slowPositions = t1.transitPlanets
    .filter(p => SLOW_SET.has(p.name))
    .map(p => `${p.name} in ${p.sign}${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  const aspects1 = t1.natalAspects.map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
  const aspects15 = t15.natalAspects.map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`);
  const allAspects = [...new Set([...aspects1, ...aspects15])];

  const getLunation = (t) => {
    if (t.moonPhase === 'New Moon') return `New Moon in ${t.moonSign}`;
    if (t.moonPhase === 'Full Moon') return `Full Moon in ${t.moonSign}`;
    return null;
  };
  const lunarEvents = [getLunation(t1), getLunation(t15)].filter(Boolean);

  const natalPlanetsStr = (raw.planets || [])
    .map(p => `${p.name} in ${p.sign} (House ${p.house})`)
    .join('; ');

  const monthTransitPositions = (t1.transitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  const prompt = `${PERSONA}

Month: ${monthName}
NATAL: Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}, Rising: ${raw.ascendant_sign}
Planets: ${natalPlanetsStr || 'not provided'}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${monthTransitPositions || 'Data unavailable.'}

Slow planet positions this month: ${slowPositions}
Active personal transits: ${allAspects.join('; ') || 'none exact'}
Lunations: ${lunarEvents.join(', ') || 'none at sample dates'}

Rules:
- Use ONLY the transit data provided above. Do NOT mention or reference any planetary transits, aspects, or lunations that are not explicitly listed in the data provided.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there.

Return JSON:
- overview: 2-3 sentences summarizing the overall energy of the month, referencing specific slow planet transits and lunations
- personal_focus: 1-2 sentences on the most significant personal transit theme this month and which life area it activates
- collective_theme: 1 sentence on the collective/mundane backdrop for everyone
- collective_tags: array of 2-3 one-or-two-word thematic labels for the collective energy this month
- maximize: array of 3 specific opportunities or actions for this month
- watch: array of 2 challenges or cautions for this month
- best_areas: top 3 from [Love, Career, Finances, Creativity, Health, Spirituality, Relationships, Transformation]`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        personal_focus: { type: 'string' },
        collective_theme: { type: 'string' },
        collective_tags: { type: 'array', items: { type: 'string' } },
        maximize: { type: 'array', items: { type: 'string' } },
        watch: { type: 'array', items: { type: 'string' } },
        best_areas: { type: 'array', items: { type: 'string' } },
      },
      required: ['overview', 'personal_focus', 'collective_theme', 'collective_tags', 'maximize', 'watch', 'best_areas'],
    },
  });

  const mm = String(month + 1).padStart(2, '0');
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  const nextMM = String(nextMonth.getUTCMonth() + 1).padStart(2, '0');
  return {
    period_type: 'month',
    period_key: `month-v9-${year}-${mm}`,
    date_start: `${year}-${mm}-01`,
    date_end: `${nextMonth.getUTCFullYear()}-${nextMM}-01`,
    summary: `Month at a Glance · ${monthName}`,
    description: result.overview || '',
    data: result,
  };
}

async function generateLunarSynthesis(base44, raw, date, moonSign, exactPhase) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const natalPlanets = (raw.planets || []).map(p => `${p.name} in ${p.sign} (House ${p.house})`).join('; ');
  const natalHouses = (raw.houses || []).map(h => `House ${h.number}: ${h.sign}`).join(', ');

  const moonHouseObj = raw.houses?.find(h => h.sign === moonSign);
  const moonHouseNum = moonHouseObj?.number;
  const moonHouseContext = moonHouseNum
    ? `The ${exactPhase} falls in ${moonSign}, which is the ${moonHouseNum}th house for this person.`
    : `The ${exactPhase} is in ${moonSign}.`;

  const planetsInMoonSign = (raw.planets || []).filter(p => p.sign === moonSign);
  const conjunctionNote = planetsInMoonSign.length
    ? `Natal planets in ${moonSign}: ${planetsInMoonSign.map(p => p.name).join(', ')} — the transiting moon is conjunct these natal points.`
    : '';

  const prompt = `${PERSONA}

Today is ${dateStr} and there is a ${exactPhase} in ${moonSign}.

NATAL CHART:
Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}, Rising: ${raw.ascendant_sign}
Planets: ${natalPlanets || 'not provided'}
House cusps: ${natalHouses || 'not provided'}
${moonHouseContext}
${conjunctionNote}

Write a focused reading for this ${exactPhase} in ${moonSign}.

CRITICAL: Use ONLY the natal chart data provided above. Do NOT invent signs, houses, or planetary positions not listed. The Moon is in ${moonSign} — use ONLY this sign. Do NOT reference natal planets in signs other than those explicitly listed above.

Return JSON:
- collective: 2 sentences on what this ${exactPhase} means for everyone collectively — themes, archetypes, what is illuminated/released/seeded
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. Reference the specific house it activates, any natal planets in ${moonSign}. Be concrete and personal.
- ritual: 1 short practical suggestion for honoring this moon phase today`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        collective: { type: 'string' },
        personal: { type: 'string' },
        ritual: { type: 'string' },
      },
      required: ['collective', 'personal', 'ritual'],
    },
  });

  const dk = dateKey(date);
  const phaseKey = exactPhase.replace(/ /g, '_');
  return {
    period_type: 'lunar',
    period_key: `lunar-${dk}-${phaseKey}`,
    date_start: dk,
    date_end: dk,
    summary: `${exactPhase} in ${moonSign}`,
    description: result.collective || '',
    data: result,
  };
}

async function generateIngressSynthesis(base44, raw, date, ing) {
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const natalPlanets = (raw.planets || []).map(p => `${p.name} in ${p.sign} (House ${p.house})`).join('; ');
  const natalHouses = (raw.houses || []).map(h => `House ${h.number}: ${h.sign}`).join(', ');

  // Find natal house for the ingressing sign
  const signIdx = SIGNS.indexOf(ing.to_sign);
  const houseSystem = raw.house_system || 'whole_sign';
  const ascSign = raw.ascendant_sign;
  let entryHouse = null;
  if (houseSystem === 'whole_sign' && ascSign) {
    const ascIdx = SIGNS.indexOf(ascSign);
    if (signIdx >= 0 && ascIdx >= 0) entryHouse = ((signIdx - ascIdx + 12) % 12) + 1;
  } else if (signIdx >= 0) {
    const norm = v => ((v % 360) + 360) % 360;
    const startLon = signIdx * 30;
    const natalHousesArr = raw.houses || [];
    for (let i = 0; i < natalHousesArr.length; i++) {
      const a = norm(natalHousesArr[i].longitude), b = norm(natalHousesArr[(i+1)%12].longitude);
      const inEntry = a <= b ? (norm(startLon) >= a && norm(startLon) < b) : (norm(startLon) >= a || norm(startLon) < b);
      if (inEntry) { entryHouse = natalHousesArr[i].number; break; }
    }
  }
  const entryTheme = entryHouse ? HOUSE_THEMES[entryHouse] : '';
  const houseContext = entryHouse
    ? `${ing.planet} entering ${ing.to_sign} places it in your ${entryHouse}th house of ${entryTheme}.`
    : `${ing.planet} is entering ${ing.to_sign}.`;

  const planetsInNewSign = (raw.planets || []).filter(p => p.sign === ing.to_sign);
  const conjunctionNote = planetsInNewSign.length
    ? `Natal planets in ${ing.to_sign}: ${planetsInNewSign.map(p => `${p.name} (House ${p.house})`).join(', ')} — ${ing.planet} will conjunct these.`
    : '';

  const ruler = CHART_RULERS[raw.ascendant_sign];
  const isChartRuler = ruler && ing.planet === ruler.planet;
  const rulerNote = isChartRuler
    ? `⭐ This is YOUR CHART RULER — ${ruler.planet} rules your ${raw.ascendant_sign} Ascendant. This ingress is personally significant because it directly activates your identity, life direction, and how you meet the world.`
    : '';

  const duration = PLANET_DURATIONS[ing.planet] || 'an extended period';

  const prompt = `${PERSONA}

Today is ${dateStr} and ${ing.planet} enters ${ing.to_sign}, leaving ${ing.from_sign}.

NATAL CHART:
Sun: ${raw.sun_sign}, Moon: ${raw.moon_sign}, Rising: ${raw.ascendant_sign}
Planets: ${natalPlanets || 'not provided'}
House cusps: ${natalHouses || 'not provided'}
${houseContext}
${conjunctionNote}

${ing.planet} will stay in ${ing.to_sign} for ${duration}.

Write a focused reading for this ${ing.planet} ingress into ${ing.to_sign}.

${rulerNote}

CRITICAL: Use ONLY the natal chart data provided above. Do NOT invent signs, houses, or planetary positions not listed. ${ing.planet} is entering ${ing.to_sign} — use ONLY this sign. Do NOT reference natal planets in signs other than those explicitly listed above.

Return JSON:
- headline: a short evocative title (max 6 words), e.g. "Jupiter Enters Your 9th House"
- collective: 2 sentences on what this ingress means for everyone collectively — the archetypal shift, what themes ${ing.to_sign} activates for ${ing.planet}
- personal: 2-3 sentences on how this specifically activates THIS person's natal chart. Reference the house it enters and any natal planets in ${ing.to_sign}. Be concrete and personal.
- ritual: 1 short practical suggestion for working with this ingress energy`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        collective: { type: 'string' },
        personal: { type: 'string' },
        ritual: { type: 'string' },
      },
      required: ['headline', 'collective', 'personal', 'ritual'],
    },
  });

  const dk = dateKey(date);
  return {
    period_type: 'ingress',
    period_key: `ingress-${dk}-${ing.planet}-${ing.to_sign}`,
    date_start: dk,
    date_end: dk,
    summary: `${ing.planet} enters ${ing.to_sign}`,
    description: result.headline || '',
    data: result,
  };
}

// ── chartCalculator integration ─────────────────────────────────────────────
// Calls the chartCalculator backend function to get accurate transit data
// (matching exactly what the frontend uses). This ensures ingress period_keys
// match between pre-generation and frontend cache lookups.
async function getCalculatorTransits(base44, raw, dateStr) {
  const res = await base44.functions.invoke('chartCalculator', {
    chart_type: 'transit',
    birth_date: raw.birth_date,
    birth_time: raw.birth_time || '12:00:00',
    birth_location: raw.birth_location,
    transit_date: dateStr,
    transit_time: '12:00:00',
    utc_offset: 0,
    natal_planets_override: raw.planets || [],
    house_system: raw.house_system || 'whole_sign',
  });
  return res.data || res;
}

// Classify chartCalculator response into the format expected by generateDaySynthesis
// Mirrors the frontend's processTransits logic from useTransits.jsx
function classifyCalculatorTransits(calcData, natalRaw) {
  const transitPlanets = calcData.transit_planets || [];
  const transitAspects = calcData.transit_aspects || [];
  const natalPlanets = natalRaw?.planets || [];

  const SLOW_PLANETS = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Black Moon Lilith']);
  const PLANET_ORBS = { Sun: 2.0, Mercury: 2.0, Venus: 2.0, Mars: 2.0 };
  const SLOW_ORB = 2.0;
  const FAST_ORB = 2.0;
  const LUNAR_ORB = 8.0;

  // Natal: non-Moon transit planets aspecting natal planets
  const natalClassified = transitAspects
    .filter(a => {
      if (a.transit_planet === 'Moon') return false;
      const isSlow = SLOW_PLANETS.has(a.transit_planet);
      const maxOrb = isSlow ? SLOW_ORB : (PLANET_ORBS[a.transit_planet] ?? FAST_ORB);
      return (a.orb ?? 99) <= maxOrb;
    })
    .map(a => ({ ...a, type: 'natal' }));

  // Lunar: Moon to natal
  const lunarClassified = transitAspects
    .filter(a => a.transit_planet === 'Moon' && (a.orb ?? 99) <= LUNAR_ORB)
    .map(a => ({ ...a, type: 'lunar' }));

  // Mundane: transit-to-transit aspects (matching frontend)
  const MUNDANE_ORBS = { conjunction: 2.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
  const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
  const mundaneAspects = [];
  for (let i = 0; i < transitPlanets.length; i++) {
    for (let j = i + 1; j < transitPlanets.length; j++) {
      const p1 = transitPlanets[i], p2 = transitPlanets[j];
      if (p1.name === 'Moon' || p2.name === 'Moon') continue;
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const [asp, targetOrb] of Object.entries(MUNDANE_ORBS)) {
        const orb = Math.abs(diff - ASPECT_ANGLES[asp]);
        if (orb <= targetOrb) {
          mundaneAspects.push({ transit_planet: p1.name, natal_planet: p2.name, aspect: asp, orb: Math.round(orb * 100) / 100, type: 'mundane' });
          break;
        }
      }
    }
  }

  // Moon info
  const moon = transitPlanets.find(p => p.name === 'Moon');
  const sun = transitPlanets.find(p => p.name === 'Sun');
  let moonPhase = '';
  let isExactNewMoon = false;
  let isExactFullMoon = false;
  if (moon && sun) {
    moonPhase = getMoonPhaseName(moon.longitude, sun.longitude);
    let diff = ((moon.longitude - sun.longitude) + 360) % 360;
    isExactNewMoon = diff <= 6 || diff >= 354;
    isExactFullMoon = Math.abs(diff - 180) <= 6;
  }

  return {
    transitPlanets,
    natalAspects: natalClassified,
    mundaneAspects,
    lunarAspects: lunarClassified,
    moonSign: moon?.sign,
    moonPhase,
    isExactNewMoon,
    isExactFullMoon,
    stations: calcData.stations || [],
    ingresses: calcData.ingresses || [],
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
// Processes ONE chart per call to avoid timeouts. The scheduled automation
// runs every 5 minutes, so all charts get processed over ~1 hour.
// Pass { chart_id: "xxx" } to target a specific chart, or { process_all: true }
// to process every chart in one call (may timeout for many users).
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* no body — scheduled run */ }
    const { chart_id, process_all } = body;

    const charts = await base44.asServiceRole.entities.Chart.list();
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const dk = dateKey(today);

    // Select which chart(s) to process
    let toProcess;
    if (chart_id) {
      toProcess = charts.filter(c => c.id === chart_id);
    } else if (process_all) {
      toProcess = charts;
    } else {
      // Find first chart without today's day synthesis (at the user's current depth)
      toProcess = [];
      for (const c of charts) {
        const raw = c.raw_data || {};
        if (!raw.birth_date || !raw.planets?.length) continue;
        const depth = await fetchKnowledgeDepth(base44, c.user_id);
        const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
          user_id: c.user_id,
          period_key: `day-v20-${dk}-${depth}`,
        });
        if (!existing.length) { toProcess = [c]; break; }
      }
    }

    if (!toProcess.length) {
      return json({ status: 'complete', message: 'All charts already have today\'s synthesis', remaining: 0 });
    }

    // Week starts on Sunday
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - today.getUTCDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      return d;
    });

    const monthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12, 0, 0));
    const results = [];

    for (const chart of toProcess) {
      const raw = chart.raw_data || {};
      if (!raw.birth_date || !raw.planets?.length) {
        results.push({ id: chart.id, status: 'skipped', reason: 'missing data' });
        continue;
      }

      try {
        // Use chartCalculator for accurate transit data (matching the frontend exactly)
        // This ensures ingress period_keys match between pre-generation and frontend cache lookups
        let transits;
        try {
          const calcData = await getCalculatorTransits(base44, raw, dk);
          transits = classifyCalculatorTransits(calcData, raw);
          console.log(`[preGen] chartCalculator OK for chart ${chart.id}, ingresses: ${transits.ingresses?.length || 0}`);
        } catch (calcErr) {
          console.error(`[preGen] chartCalculator failed for chart ${chart.id}: ${calcErr.message}`);
          // Skip — using simplified fallback math would produce inaccurate transit
          // data that gets cached and shown to users as if it were real.
          results.push({ id: chart.id, status: 'skipped', reason: 'chartCalculator unavailable' });
          continue;
        }
        const syntheses = [];

        // Day synthesis (generated at the user's current knowledge density)
        const depth = await fetchKnowledgeDepth(base44, chart.user_id);
        syntheses.push(await generateDaySynthesis(base44, raw, today, transits, depth));

        // Lunar event synthesis (if exact new/full moon)
        if (transits.isExactFullMoon || transits.isExactNewMoon) {
          const exactPhase = transits.isExactFullMoon ? 'Full Moon' : 'New Moon';
          syntheses.push(await generateLunarSynthesis(base44, raw, today, transits.moonSign, exactPhase));
        }

        // Ingress syntheses (for each exact ingress today)
        for (const ing of transits.ingresses) {
          syntheses.push(await generateIngressSynthesis(base44, raw, today, ing));
        }

        // Week synthesis
        syntheses.push(await generateWeekSynthesis(base44, raw, weekDays));

        // Month synthesis
        syntheses.push(await generateMonthSynthesis(base44, raw, monthDate));

        // Store all records (update if exists, create if not)
        const genAt = new Date().toISOString();
        for (const synth of syntheses) {
          const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
            user_id: chart.user_id,
            period_key: synth.period_key,
          });
          const payload = { user_id: chart.user_id, ...synth, generated_at: genAt };
          if (existing[0]) {
            await base44.asServiceRole.entities.CalendarSynthesis.update(existing[0].id, payload);
          } else {
            await base44.asServiceRole.entities.CalendarSynthesis.create(payload);
          }
        }

        results.push({ id: chart.id, user_id: chart.user_id, status: 'ok', items: syntheses.length });
      } catch (err) {
        results.push({ id: chart.id, status: 'error', error: err.message });
      }
    }

    // Count remaining charts needing synthesis
    let remaining = 0;
    if (!chart_id && !process_all) {
      for (const c of charts) {
        const raw = c.raw_data || {};
        if (!raw.birth_date || !raw.planets?.length) continue;
        if (toProcess.find(p => p.id === c.id)) continue;
        const depth = await fetchKnowledgeDepth(base44, c.user_id);
        const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({
          user_id: c.user_id,
          period_key: `day-v20-${dk}-${depth}`,
        });
        if (!existing.length) remaining++;
      }
    }

    return json({ total: results.length, results, remaining });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});