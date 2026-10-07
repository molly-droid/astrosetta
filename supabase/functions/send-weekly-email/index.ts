import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { insertGlyphs } from '../_shared/emailGlyphs.ts';
import { fetchKnowledgeDepth, densityInstruction } from '../_shared/knowledgeDensity.ts';
import { getActiveEmailHighlight } from '../_shared/featureSchedule.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';
import { sendDigestEmail } from '../_shared/resendEmail.ts';

// ── Glyphs & helpers ──────────────────────────────────────────────────────────
const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃',
  Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Chiron: '⚷',
  Ascendant: 'Asc', Midheaven: 'MC', 'North Node': '☊', 'South Node': '☋',
  'Black Moon Lilith': '⚸', Lilith: '⚸', 'Black Moon': '⚸',
};
const ASPECT_GLYPHS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };
const SIGN_GLYPHS = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};
const COLLECTIVE_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
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

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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

const SIGN_LIST_H = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
function findNatalHouse(longitude, natalHouses, houseSystem = 'whole_sign', ascendantSign = null) {
  if (!natalHouses?.length) return null;
  const norm = v => ((v % 360) + 360) % 360;
  const lon = norm(longitude);

  // Whole Sign: house determined by zodiac sign relative to ascendant
  if (houseSystem === 'whole_sign' && ascendantSign) {
    const signIdx = Math.floor(lon / 30);
    const sign = SIGN_LIST_H[signIdx];
    const ascIdx = SIGN_LIST_H.indexOf(ascendantSign);
    const sIdx = SIGN_LIST_H.indexOf(sign);
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

  let nextBday = new Date(nowYear, birthMonth, birthDay);
  if (date > nextBday) nextBday = new Date(nowYear + 1, birthMonth, birthDay);
  const daysUntil = Math.ceil((nextBday - date) / 86400000);

  const TRAD = {Aries:'Mars',Taurus:'Venus',Gemini:'Mercury',Cancer:'Moon',Leo:'Sun',Virgo:'Mercury',Libra:'Venus',Scorpio:'Mars',Sagittarius:'Jupiter',Capricorn:'Saturn',Aquarius:'Saturn',Pisces:'Jupiter'};
  const PROF_THEMES = {1:'identity and new beginnings',2:'resources and values',3:'communication and learning',4:'home and family',5:'creativity and pleasure',6:'health and daily routine',7:'partnerships and relationships',8:'transformation and shared resources',9:'beliefs and expansion',10:'career and public life',11:'community and future vision',12:'solitude and inner work'};

  // Unknown birth time — houses/rising cannot be determined; skip profection
  const profectedHouse = raw.unknown_time ? null : (age % 12) + 1;
  const natalHouses = raw.unknown_time ? [] : (raw.houses || []);
  const houseData = natalHouses.find(h => h.number === profectedHouse);
  const profectedSign = houseData?.sign || (raw.unknown_time ? '' : raw.ascendant_sign) || '';
  const yearLord = TRAD[profectedSign] || '';
  const lordPlanet = (raw.planets || []).find(p => p.name === yearLord);
  const lordPlacement = lordPlanet ? `${yearLord} in ${lordPlanet.sign}${lordPlanet.house ? ` (${lordPlanet.house}H)` : ''}` : '';

  let ctx = '';
  if (isBirthday) {
    ctx += `SOLAR RETURN: THIS WEEK CONTAINS THEIR BIRTHDAY — solar return #${age}. The Sun returns to its natal position, marking a personal new year. Acknowledge this warmly in the greeting and weave intention-setting and renewal themes throughout. `;
  } else if (daysUntil <= 7) {
    ctx += `SOLAR RETURN APPROACHING: Their birthday (solar return #${age + 1}) is in ${daysUntil} day(s). Weave anticipatory, reflective energy into the weekly reading — a year is completing. `;
  }
  if (profectedSign && yearLord) {
    ctx += `PROFECTION YEAR: ${profectedHouse}th house profection year (${PROF_THEMES[profectedHouse]}). Year lord is ${yearLord} (ruler of ${profectedSign})${lordPlacement ? `, placed in ${lordPlacement}` : ''}. Weave the profection theme into the week overview where relevant.`;
  }
  return ctx;
}

function getEffectiveTier(user) {
  if (!user) return 'free';
  // BETA: all users treated as paid. Set to false once payments launch.
  const BETA_ALL_PAID = true;
  if (BETA_ALL_PAID) return 'calendar';
  const tier = user.subscription_tier;
  if (!tier || tier === 'free') return 'free';
  if (user.subscription_expires) {
    const expires = new Date(user.subscription_expires);
    if (expires < new Date()) return 'free';
  }
  return tier;
}

// ── Build weekly email for one user ──────────────────────────────────────────
function mergeNatalPoints(natal, includeAngles = true) {
  if (!natal) return [];
  const pts = [...(natal.planets || [])];
  const a = includeAngles ? (natal.angles || {}) : {};
  if (a.ascendant) pts.push({ name: 'Ascendant', ...a.ascendant, house: 1 });
  if (a.midheaven) pts.push({ name: 'Midheaven', ...a.midheaven, house: 10 });
  if (a.descendant) pts.push({ name: 'Descendant', ...a.descendant, house: 7 });
  if (a.ic) pts.push({ name: 'IC', ...a.ic, house: 4 });
  const n = natal.nodes || {};
  if (n.north_node) pts.push({ name: 'North Node', ...n.north_node });
  if (n.south_node) pts.push({ name: 'South Node', ...n.south_node });
  return pts;
}

async function buildWeeklyEmailForUser(base44, targetUser, appUrl) {
  const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: targetUser.id }, '-created_date');
  const chart = charts[0];
  if (!chart?.raw_data) return null;
  const raw = chart.raw_data;
  if (!raw.birth_date || !raw.birth_location?.latitude) return null;

  const unknownTime = !!raw.unknown_time;
  const ANGLE_TARGETS = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
  const natalPlanets = (raw.planets || []).map(p => unknownTime ? { ...p, house: null } : p);
  const natalHouses = unknownTime ? [] : (raw.houses || []);

  // Week start = today (Monday)
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // Compute transits for each day of the week
  const daySummaries = [];
  let firstDayTransitPlanets = [];
  const allIngresses = [];
  const allStations = [];
  const seenIngressKeys = new Set();
  const seenStationKeys = new Set();

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateKey = d.toLocaleDateString('en-CA');

    const transitRes = await base44.asServiceRole.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time || '12:00:00',
      birth_location: raw.birth_location,
      utc_offset: typeof raw.utc_offset === 'number' ? raw.utc_offset : undefined,
      natal_planets_override: natalPlanets,
      house_system: raw.house_system || 'whole_sign',
      transit_date: dateKey,
      transit_time: '12:00:00',
    });
    const tData = transitRes.data || transitRes;
    const tPlanets = tData.transit_planets || [];
    if (i === 0) firstDayTransitPlanets = tPlanets;
    // Use freshly calculated natal planets (correct houses) from the response
    // Include angles and nodes so transit aspects to them resolve correctly
    const freshNatal = tData.natal ? mergeNatalPoints(tData.natal, !unknownTime) : natalPlanets;

    // Top personal aspects for this day (angles excluded when birth time unknown)
    const personal = (tData.transit_aspects || [])
      .filter(a => a.natal_planet !== a.transit_planet)
      .filter(a => !unknownTime || !ANGLE_TARGETS.has(a.natal_planet))
      .sort((a, b) => a.orb - b.orb)
      .slice(0, 3)
      .map(a => {
        const nP = freshNatal.find(p => p.name === a.natal_planet);
        return { ...a, natal_sign: nP?.sign, natal_house: unknownTime ? null : nP?.house };
      });

    const moon = tPlanets.find(p => p.name === 'Moon');
    const phase = moonPhaseName(d);

    // Collect ingresses
    for (const ing of (tData.ingresses || [])) {
      const key = `${ing.planet}-${ing.to_sign}`;
      if (!seenIngressKeys.has(key)) {
        seenIngressKeys.add(key);
        const signIdx = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].indexOf(ing.to_sign);
        const signStartLon = signIdx >= 0 ? signIdx * 30 : 0;
        const freshHouses = unknownTime ? [] : (tData.natal?.houses || natalHouses);
        const freshAscSign = unknownTime ? null : (tData.natal?.angles?.ascendant?.sign || raw.ascendant_sign);
        const entryHouse = unknownTime ? null : findNatalHouse(signStartLon, freshHouses, raw.house_system || 'whole_sign', freshAscSign);
        allIngresses.push({
          ...ing,
          house: entryHouse,
          duration: PLANET_DURATIONS[ing.planet] || '',
          glyph: PLANET_GLYPHS[ing.planet] || '',
          sign_glyph: SIGN_GLYPHS[ing.to_sign] || '',
          house_theme: entryHouse ? HOUSE_THEMES[entryHouse] : '',
        });
      }
    }

    // Collect stations
    for (const s of (tData.stations || [])) {
      const key = `${s.planet}-${s.type}`;
      if (!seenStationKeys.has(key)) {
        seenStationKeys.add(key);
        allStations.push({
          ...s,
          glyph: PLANET_GLYPHS[s.planet] || '',
          sign_glyph: SIGN_GLYPHS[s.sign] || '',
        });
      }
    }

    // Collective aspects for this day
    const collective = collectiveAspects(tPlanets);

    daySummaries.push({
      dayName: DOW[d.getDay()],
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      moonSign: moon?.sign || '',
      moonPhase: phase,
      personal,
      collective,
    });
  }

  // Authoritative transit positions — the LLM must use THESE signs, never its own knowledge
  const transitPositions = (firstDayTransitPlanets || [])
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°`)
    .join(', ');

  // Build text for LLM
  const dayLines = daySummaries.map(ds => {
    const aspects = ds.personal.length
      ? ds.personal.map(a => `${a.transit_planet}${a.transit_sign ? ` in ${a.transit_sign}` : ''} ${a.aspect} natal ${a.natal_planet}${a.natal_house ? ` (${ordinal(a.natal_house)}H)` : ''} (orb ${a.orb.toFixed(1)}°)`).join('; ')
      : 'no major personal aspects';
    return `${ds.dayName} ${ds.date}: ${ds.moonPhase.emoji} Moon in ${ds.moonSign}. ${aspects}`;
  }).join('\n');

  const ingressText = allIngresses.length
    ? allIngresses.map(i => `${i.planet} ${i.exact ? 'ingresses' : 'approaching ingress'} into ${i.to_sign}${i.house ? ` — entering their ${ordinal(i.house)} house (${i.house_theme})` : ''}${i.duration ? `, staying ${i.duration}` : ''}`).join('\n')
    : 'No sign ingresses this week.';

  const stationText = allStations.length
    ? allStations.map(s => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`).join('\n')
    : 'No stations this week.';

  const natalBig3 = `Sun ${chart.sun_sign}, Moon ${chart.moon_sign}${unknownTime ? ' — birth time unknown, so the rising sign, angles, and houses CANNOT be determined' : `, Rising ${chart.ascendant_sign}`}`;
  const unknownRule = unknownTime
    ? `- BIRTH TIME UNKNOWN: Their birth time is unknown, so the Ascendant (rising), angles, and houses CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output. Interpret by planet, sign, and aspect only.`
    : '';
  const solarContext = getSolarReturnContext(raw, weekStart);

  // Knowledge Density — shapes the tone/depth of the weekly reading
  const knowledgeDepth = await fetchKnowledgeDepth(base44, targetUser.id);
  const densityLine = densityInstruction(knowledgeDepth);

  const prompt = `You are an expert, warm astrologer writing a weekly email digest for ${targetUser.full_name || 'a student of astrology'}.
Week of ${weekRange}.

${TONE_DIRECTIVE}

THEIR NATAL CHART: ${natalBig3}
${solarContext}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

DAY-BY-DAY TRANSITS:
${dayLines}

PLANETARY INGRESSES THIS WEEK:
${ingressText}

RETROGRADE STATIONS THIS WEEK:
${stationText}

Write all planets, signs, and aspects as full English WORDS (e.g. "Mercury in Cancer conjunction natal Chiron"). Do NOT include Unicode glyph symbols — the email inserts them automatically next to each word.

Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, stations, or lunar events that are not explicitly listed in the data provided. If a day has "no major personal aspects," do not invent any for that day.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there. For example, if the data says "Mars: Gemini 20°", you must write "Mars in Gemini" — never any other sign.
${unknownRule}
SHOW YOUR WORK — this app teaches astrology. Every transit mentioned MUST include the planet word + sign word + aspect word + natal planet word + house, all in WORDS (e.g. "Mercury in Cancer conjunction natal Chiron in your 8th house"). Do NOT use glyph symbols; the email inserts them automatically. Then explain the mechanic of WHY this configuration creates the effect. No generic horoscope language.

PERSONALIZATION LOCK: This digest must feel written for this one person, not a collective horoscope. Whenever a personal transit is interpreted, anchor it to their natal chart by naming the natal placement inside the prose — e.g. "Because your natal Mars in Scorpio sits in your 5th house, you may experience this transit Venus as..." or "With your Virgo Midheaven, you may experience this Virgo Moon as...". If a sentence could be true for anyone with any chart, rewrite it.

INVITING TONE: Warm possibility language — "you may experience," "you might notice," "for you, this can show up as." Never commands, guarantees, or collective phrasing ("everyone," "we all") outside the collective_theme field.

${densityLine}

Write JSON:
- greeting: one warm sentence opening the weekly email, setting the tone for the week ahead.
- week_overview: 2-3 sentences naming the specific transit configurations (with glyphs) shaping the week's arc — reference lunations, ingresses, and key aspects with their glyphs.
- key_themes: array of 3-4 short theme phrases for the week (e.g. "creative breakthroughs").
- daily_highlights: array of 7 objects, one per day, each with:
  - day: the day name (e.g. "Monday")
  - date: the date string (e.g. "Jun 30")
  - energy: 1-2 sentences. MUST begin with the transit label in WORDS (e.g. "Saturn in Pisces square natal Mars (5th house)") then explain the astrological mechanic of how it creates the day's energy. Do NOT use glyph symbols; the email inserts them.
  - best_for: a short 1-3 word tag for the best activity that day (e.g. "Deep conversations").
- maximize: array of 3-4 actionable things to lean into this week. Each starts with an emoji and is one sentence max 15 words.
- watch_out: array of 2-3 cautionary notes for the week. Each starts with an emoji and is one sentence max 15 words.
- topics: array of 3-4 life areas most supported this week (e.g. "Career", "Relationships", "Creative Projects").
- power_planet: the single most influential planet for them this week (name only).
- power_planet_glyph: its unicode glyph.
- collective_theme: 1-2 sentences on the collective/mundane energy everyone shares this week.
- planner_teaser: one intriguing sentence encouraging them to explore the full week view in the Planner.`;

  const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        greeting: { type: 'string' },
        week_overview: { type: 'string' },
        key_themes: { type: 'array', items: { type: 'string' } },
        daily_highlights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'string' },
              date: { type: 'string' },
              energy: { type: 'string' },
              best_for: { type: 'string' },
            },
            required: ['day', 'energy', 'best_for'],
          },
        },
        maximize: { type: 'array', items: { type: 'string' } },
        watch_out: { type: 'array', items: { type: 'string' } },
        topics: { type: 'array', items: { type: 'string' } },
        power_planet: { type: 'string' },
        power_planet_glyph: { type: 'string' },
        collective_theme: { type: 'string' },
        planner_teaser: { type: 'string' },
      },
      required: ['greeting', 'week_overview', 'key_themes', 'daily_highlights', 'maximize', 'watch_out', 'topics', 'power_planet', 'collective_theme', 'planner_teaser'],
    },
  });

  const featureHighlight = await getActiveEmailHighlight(base44);
  const html = renderWeeklyHtml({
    user: targetUser, weekRange, llm, allIngresses, allStations, daySummaries, appUrl, featureHighlight,
  });
  const subject = `✦ ${llm.power_planet_glyph || '✦'} Your week ahead · ${weekRange}`;
  return { html, subject };
}

// ── HTML renderer ─────────────────────────────────────────────────────────────
function renderWeeklyHtml({ user, weekRange, llm, allIngresses, allStations, daySummaries, appUrl, featureHighlight = null }) {
  const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355', BLUE = '#4E6E8E';
  const planner = appUrl ? `${appUrl}/planner?view=Week` : '#';
  const subscribe = appUrl ? `${appUrl}/subscribe` : '#';

  const ASTRO_RE = /([☉☽☿♀♂♃♄♅♆♇⚷⚸☌☍△□⚹☊☋♈♉♊♋♌♍♎♏♐♑♒♓])/g;
  const highlightAstro = (txt) => insertGlyphs(txt, GOLD2);

  const themeChips = (llm.key_themes || []).map(t =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${GOLD2};border:1px solid ${GOLD}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${t}</span>`
  ).join('');

  const topicChips = (llm.topics || []).map(t =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${BLUE};border:1px solid ${BLUE}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${t}</span>`
  ).join('');

  const dayRows = (llm.daily_highlights || []).map(dh => `
    <tr><td style="padding:10px 14px;background:${CARD};border-radius:8px;border-left:3px solid ${GOLD};">
      <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:4px;"><strong>${dh.day}</strong> <span style="color:${MUTED};font-size:11px;">${dh.date || ''}</span></div>
      <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};line-height:1.5;margin-bottom:4px;">${highlightAstro(dh.energy)}</div>
      <div style="display:inline-block;font-family:Georgia,serif;font-size:10px;color:#5E8A5E;border:1px solid #A8C8A844;border-radius:999px;padding:2px 8px;">✦ ${dh.best_for}</div>
    </td></tr><tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>`
  ).join('');

  const ingressRows = allIngresses.length ? allIngresses.map(i => `
    <tr><td style="padding:8px 14px;border-left:2px solid ${GOLD}33;background:${CARD};border-radius:6px;">
      <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};">${i.glyph || '✦'} <strong>${i.planet}</strong> ${i.exact ? 'enters' : 'approaching'} <span style="color:${GOLD2};">${i.sign_glyph || ''} ${i.to_sign}</span></div>
      ${i.house ? `<div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin-top:2px;">Your ${ordinal(i.house)} house — ${i.house_theme}${i.duration ? ` · ⏳ ${i.duration}` : ''}</div>` : ''}
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('') : '';

  const stationRows = allStations.length ? allStations.map(s => `
    <tr><td style="padding:8px 14px;border-left:2px solid ${GOLD}33;background:${CARD};border-radius:6px;">
      <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};">${s.glyph || '✦'} <strong>${s.planet}</strong> stations <strong style="color:${s.type === 'retrograde' ? '#A85D75' : '#5E8A5E'};">${s.type === 'retrograde' ? '↺ Retrograde' : '→ Direct'}</strong> in <span style="color:${GOLD2};">${s.sign_glyph || ''} ${s.sign}</span></div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('') : '';

  const maximizeItems = (llm.maximize || []).map(m =>
    `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid ${GOLD}22;">
      <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};line-height:1.4;">${highlightAstro(m)}</div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('');

  const watchItems = (llm.watch_out || []).map(w =>
    `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid #D8B4C233;">
      <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};line-height:1.4;">${highlightAstro(w)}</div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="text-align:center;padding:8px 24px 20px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta ✦ Weekly Digest</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin-top:6px;">${weekRange}</div>
  </td></tr>

  <!-- Feature Highlight — newest feature, shown for one week -->
  ${featureHighlight ? `
  <tr><td style="padding:14px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}55;border-radius:14px;">
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

  <!-- Power planet -->
  <tr><td style="text-align:center;padding:0 24px 18px;">
    <div style="display:inline-block;background:${CARD};border:1px solid ${GOLD}33;border-radius:999px;padding:8px 18px;">
      <span style="font-family:Georgia,serif;font-size:22px;color:${GOLD2};vertical-align:middle;">${llm.power_planet_glyph || '✦'}</span>
      <span style="font-family:Georgia,serif;font-size:13px;color:${TEXT};vertical-align:middle;margin-left:8px;">${llm.power_planet} shapes your week</span>
    </div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:0 28px 18px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0;">${highlightAstro(llm.greeting)}</p>
    <div style="margin-top:14px;">${themeChips}</div>
  </td></tr>

  <!-- Week Overview -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✨ Week Overview</div>
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${TEXT};margin:0 0 14px;">${highlightAstro(llm.week_overview)}</p>
    <div style="margin-bottom:6px;"><span style="font-family:Georgia,serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${BLUE};margin-right:6px;">Topics:</span>${topicChips}</div>
  </td></tr>

  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>

  <!-- Ingresses -->
  ${ingressRows ? `
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🔄 Planetary Ingresses</div>
  </td></tr>
  <tr><td style="padding:0 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ingressRows}</table>
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  ` : ''}

  <!-- Stations -->
  ${stationRows ? `
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">↺ Retrograde Stations</div>
  </td></tr>
  <tr><td style="padding:0 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stationRows}</table>
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  ` : ''}

  <!-- Daily Highlights -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">📅 Day-by-Day</div>
  </td></tr>
  <tr><td style="padding:0 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dayRows}</table>
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>

  <!-- Maximize -->
  ${maximizeItems ? `
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🎯 This Week's Edge</div>
  </td></tr>
  <tr><td style="padding:0 28px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${maximizeItems}</table>
  </td></tr>
  ` : ''}

  <!-- Watch Out -->
  ${watchItems ? `
  <tr><td style="padding:4px 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${watchItems}</table>
  </td></tr>
  ` : ''}

  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>

  <!-- Collective -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🌌 Collective Theme</div>
    <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${MUTED};margin:0;">${highlightAstro(llm.collective_theme)}</p>
  </td></tr>

  <!-- Planner CTA -->
  <tr><td style="padding:18px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}44;border-radius:14px;">
      <tr><td style="padding:18px 24px;text-align:center;">
        <p style="font-family:Georgia,serif;font-size:14px;color:${TEXT};margin:0 0 12px;line-height:1.5;">${highlightAstro(llm.planner_teaser)}</p>
        <a href="${planner}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:999px;">Explore your week in the Planner →</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:18px 28px 8px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.6;">
      You're receiving this weekly digest as a paid subscriber.<br>
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

    if (body.scheduled) {
      const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
      const userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
      let sent = 0, skipped = 0, optedOut = 0, failed = 0;
      for (const uid of userIds) {
        const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
        if (!target?.email) { skipped++; continue; }
        if (target.weekly_email_opt_in === false) { optedOut++; continue; }
        // BETA: all opted-in users receive the weekly digest (tier gate removed
        // to match sendDailyEmail's BETA_ALL_PAID policy). Re-add the paid-tier
        // check here once payments launch.
        // One bad recipient must not abort the whole run — everyone after it
        // would silently lose their digest.
        try {
          const built = await buildWeeklyEmailForUser(base44, target, appUrl);
          if (!built) { skipped++; continue; }
          await sendDigestEmail({ to: target.email, subject: built.subject, html: built.html });
          sent++;
        } catch (err) {
          failed++;
          console.error(`[weekly-digest] send failed for user ${uid}:`, err?.message || err);
        }
      }
      return json({ success: true, sent, skipped, optedOut, failed });
    }

    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    if (body.test) {
      const tier = getEffectiveTier(user);
      const built = await buildWeeklyEmailForUser(base44, user, appUrl);
      if (!built) return json({ error: 'No natal chart found for your account.' }, { status: 400 });
      await sendDigestEmail({ to: user.email, subject: built.subject, html: built.html });
      return json({ success: true, sent_to: user.email });
    }

    if (user.role !== 'admin') return json({ error: 'Forbidden: admin only' }, { status: 403 });
    const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
    const userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
    let sent = 0, skipped = 0, optedOut = 0;
    for (const uid of userIds) {
      const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
      if (!target?.email) { skipped++; continue; }
      if (target.weekly_email_opt_in === false) { optedOut++; continue; }
      const tier = getEffectiveTier(target);
      if (tier === 'free') { optedOut++; continue; }
      const built = await buildWeeklyEmailForUser(base44, target, appUrl);
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