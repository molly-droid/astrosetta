import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { insertGlyphs } from '../../shared/emailGlyphs.ts';
import { getActiveEmailHighlight } from '../../shared/featureSchedule.ts';
import { TONE_DIRECTIVE } from '../../shared/toneDirective.ts';
import { sendDigestEmail } from '../../shared/resendEmail.ts';

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

function getLunation(planets) {
  const moon = planets?.find(p => p.name === 'Moon');
  const sun = planets?.find(p => p.name === 'Sun');
  if (!moon || !sun) return null;
  const diff = ((moon.longitude - sun.longitude) + 360) % 360;
  const sg = SIGN_GLYPHS[moon.sign] || '';
  if (diff < 45) return { type: 'New Moon', sign: moon.sign, glyph: '●', emoji: '🌑' };
  if (diff >= 180 && diff < 225) return { type: 'Full Moon', sign: moon.sign, glyph: '○', emoji: '🌕' };
  return null;
}

// ── Build monthly email for one user ─────────────────────────────────────────
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

async function buildMonthlyEmailForUser(base44, targetUser, appUrl) {
  const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: targetUser.id }, '-created_date');
  const chart = charts[0];
  if (!chart?.raw_data) return null;
  const raw = chart.raw_data;
  if (!raw.birth_date || !raw.birth_location?.latitude) return null;

  const unknownTime = !!raw.unknown_time;
  const ANGLE_TARGETS = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
  const natalPlanets = (raw.planets || []).map(p => unknownTime ? { ...p, house: null } : p);
  const natalHouses = unknownTime ? [] : (raw.houses || []);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute transits at the 1st and 15th of the month
  const midMonth = new Date(year, month, 15);
  const dateKey1 = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const dateKey15 = `${year}-${String(month + 1).padStart(2, '0')}-15`;

  const [res1, res15] = await Promise.all([
    base44.asServiceRole.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time || '12:00:00',
      birth_location: raw.birth_location,
      utc_offset: typeof raw.utc_offset === 'number' ? raw.utc_offset : undefined,
      natal_planets_override: natalPlanets,
      house_system: raw.house_system || 'whole_sign',
      transit_date: dateKey1,
      transit_time: '12:00:00',
    }),
    base44.asServiceRole.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time || '12:00:00',
      birth_location: raw.birth_location,
      utc_offset: typeof raw.utc_offset === 'number' ? raw.utc_offset : undefined,
      natal_planets_override: natalPlanets,
      house_system: raw.house_system || 'whole_sign',
      transit_date: dateKey15,
      transit_time: '12:00:00',
    }),
  ]);

  const t1 = res1.data || res1;
  const t15 = res15.data || res15;
  const tp1 = t1.transit_planets || [];
  const tp15 = t15.transit_planets || [];
  // Use freshly calculated natal planets (correct houses) from the response
  // Include angles and nodes so transit aspects to them resolve correctly
  const freshNatal = t1.natal ? mergeNatalPoints(t1.natal, !unknownTime) : natalPlanets;
  const freshHouses = unknownTime ? [] : (t1.natal?.houses || natalHouses);

  // Lunations
  const lunations = [getLunation(tp1), getLunation(tp15)].filter(Boolean);

  // Collect ingresses and stations from both snapshots
  const allIngresses = [];
  const allStations = [];
  const seenIngressKeys = new Set();
  const seenStationKeys = new Set();

  for (const tData of [t1, t15]) {
    for (const ing of (tData.ingresses || [])) {
      const key = `${ing.planet}-${ing.to_sign}`;
      if (!seenIngressKeys.has(key)) {
        seenIngressKeys.add(key);
        const signIdx = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'].indexOf(ing.to_sign);
        const signStartLon = signIdx >= 0 ? signIdx * 30 : 0;
        const freshAscSign = unknownTime ? null : (t1.natal?.angles?.ascendant?.sign || raw.ascendant_sign);
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
  }

  // Personal transits from both snapshots (top aspects)
  const personal1 = (t1.transit_aspects || [])
    .filter(a => a.natal_planet !== a.transit_planet)
    .filter(a => !unknownTime || !ANGLE_TARGETS.has(a.natal_planet))
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 5)
    .map(a => {
      const nP = freshNatal.find(p => p.name === a.natal_planet);
      return { ...a, natal_sign: nP?.sign, natal_house: unknownTime ? null : nP?.house };
    });

  const personal15 = (t15.transit_aspects || [])
    .filter(a => a.natal_planet !== a.transit_planet)
    .filter(a => !unknownTime || !ANGLE_TARGETS.has(a.natal_planet))
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 5)
    .map(a => {
      const nP = freshNatal.find(p => p.name === a.natal_planet);
      return { ...a, natal_sign: nP?.sign, natal_house: unknownTime ? null : nP?.house };
    });

  const collective1 = collectiveAspects(tp1);
  const collective15 = collectiveAspects(tp15);

  // Build text for LLM
  const personalText = [...personal1, ...personal15]
    .filter((v, i, a) => a.findIndex(x => x.transit_planet === v.transit_planet && x.natal_planet === v.natal_planet && x.aspect === v.aspect) === i)
    .map(a => `${a.transit_planet}${a.transit_sign ? ` in ${a.transit_sign}` : ''} ${a.aspect} natal ${a.natal_planet}${a.natal_sign ? ` in ${a.natal_sign}` : ''}${a.natal_house ? ` (${ordinal(a.natal_house)}H)` : ''} — orb ${a.orb.toFixed(1)}°`)
    .join('\n') || 'No major personal transits this month.';

  const collectiveText = [...collective1, ...collective15]
    .filter((v, i, a) => a.findIndex(x => x.p1 === v.p1 && x.p2 === v.p2 && x.aspect === v.aspect) === i)
    .map(a => `${a.p1} in ${a.s1} ${a.aspect} ${a.p2} in ${a.s2} (orb ${a.orb.toFixed(1)}°)`)
    .join('\n') || 'Quiet collective sky.';

  // Authoritative transit positions — the LLM must use THESE signs, never its own knowledge
  const transitPositions = tp1
    .filter(p => !['North Node', 'South Node', 'Black Moon Lilith'].includes(p.name))
    .map(p => `${p.name}: ${p.sign} ${p.degree?.toFixed(0)}°${p.retrograde ? ' Rx' : ''}`)
    .join(', ');

  const lunationText = lunations.length
    ? lunations.map(l => `${l.emoji} ${l.type} in ${l.sign}`).join(' · ')
    : 'No major lunations at sample dates.';

  const ingressText = allIngresses.length
    ? allIngresses.map(i => `${i.planet} ${i.exact ? 'ingresses' : 'approaching ingress'} into ${i.to_sign}${i.house ? ` — entering their ${ordinal(i.house)} house (${i.house_theme})` : ''}${i.duration ? `, staying ${i.duration}` : ''}`).join('\n')
    : 'No sign ingresses this month.';

  const stationText = allStations.length
    ? allStations.map(s => `${s.planet} stations ${s.type === 'retrograde' ? 'retrograde' : 'direct'} in ${s.sign}`).join('\n')
    : 'No stations this month.';

  const natalBig3 = `Sun ${chart.sun_sign}, Moon ${chart.moon_sign}${unknownTime ? ' — birth time unknown, so the rising sign, angles, and houses CANNOT be determined' : `, Rising ${chart.ascendant_sign}`}`;
  const unknownRule = unknownTime
    ? `- BIRTH TIME UNKNOWN: Their birth time is unknown, so the Ascendant (rising), angles, and houses CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output. Interpret by planet, sign, and aspect only.`
    : '';

  const prompt = `You are an expert, warm astrologer writing a monthly email digest for ${targetUser.full_name || 'a student of astrology'}.
Month: ${monthName}

${TONE_DIRECTIVE}

THEIR NATAL CHART: ${natalBig3}

AUTHORITATIVE TRANSIT POSITIONS (use these exact signs — do NOT use your own knowledge of where planets are):
${transitPositions || 'Data unavailable.'}

LUNATIONS:
${lunationText}

KEY PERSONAL TRANSITS (from month's beginning and midpoint snapshots):
${personalText}

COLLECTIVE SKY:
${collectiveText}

PLANETARY INGRESSES:
${ingressText}

RETROGRADE STATIONS:
${stationText}

Write all planets, signs, and aspects as full English WORDS (e.g. "Mercury in Cancer conjunction natal Chiron"). Do NOT include Unicode glyph symbols — the email inserts them automatically next to each word.

Use ONLY the transit data listed above. Do NOT mention or reference any planetary transits, aspects, ingresses, stations, or lunations that are not explicitly listed in the data provided. If a section says "none" or "quiet," do not invent configurations for it.
- CRITICAL: Use ONLY the signs from AUTHORITATIVE TRANSIT POSITIONS above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Every time you mention a transiting planet, you MUST use the exact sign listed there. For example, if the data says "Mars: Gemini 20°", you must write "Mars in Gemini" — never any other sign.
${unknownRule}
SHOW YOUR WORK — this app teaches astrology. Every transit mentioned MUST include the planet word + sign word + aspect word + natal planet word + house, all in WORDS (e.g. "Jupiter in Gemini trine natal Mercury in your 10th house"). Do NOT use glyph symbols; the email inserts them automatically. Then explain the mechanic of WHY this configuration creates the effect. No generic horoscope language.

PERSONALIZATION LOCK: This digest must feel written for this one person, not a collective horoscope. Whenever a personal transit is interpreted (personal_focus, month_overview, weekly_arc), anchor it to their natal chart by naming the natal placement inside the prose — e.g. "Because your natal Mars in Scorpio sits in your 5th house, you may experience this transit Venus as..." or "With your Virgo Midheaven, you may experience this Virgo Moon as...". If a sentence could be true for anyone with any chart, rewrite it.

INVITING TONE: Warm possibility language — "you may experience," "you might notice," "for you, this can show up as." Never commands, guarantees, or collective phrasing ("everyone," "we all") outside the collective_theme field.

Write JSON:
- greeting: one warm sentence opening the monthly email, setting the tone for the month ahead.
- month_overview: 2-3 sentences naming the specific transit configurations (with glyphs) shaping the month's arc — reference lunations, ingresses, and key aspects with their glyphs.
- key_themes: array of 4-5 short theme phrases for the month (e.g. "structural change", "creative rebirth").
- personal_focus: 2-3 sentences. Each transit mentioned MUST name each planet, sign, and aspect in WORDS (e.g. "Venus in Leo conjunction natal Sun in your 1st house") then explain the astrological mechanic of how this activates their chart specifically. Do NOT use glyph symbols; the email inserts them.
- collective_theme: 1-2 sentences on the mundane energy everyone shares this month, anchored to lunation signs and ingresses.
- weekly_arc: array of 4 objects (one per week of the month), each with:
  - week: "Week 1", "Week 2", etc.
  - focus: 1-2 sentences on the dominant energy and what to prioritize that week.
  - best_for: a short 1-3 word tag (e.g. "Planning and strategy").
- maximize: array of 3-4 actionable things to lean into this month. Each starts with an emoji and is one sentence max 15 words.
- watch_out: array of 2-3 cautionary notes for the month. Each starts with an emoji and is one sentence max 15 words.
- topics: array of 4-5 life areas most supported this month (e.g. "Career", "Relationships").
- power_planet: the single most influential planet for them this month (name only).
- power_planet_glyph: its unicode glyph.
- best_windows: array of 2-3 short date range descriptions for optimal timing (e.g. "After the 15th when Mars energizes your 10th house").
- planner_teaser: one intriguing sentence encouraging them to explore the full month view in the Planner.`;

  const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        greeting: { type: 'string' },
        month_overview: { type: 'string' },
        key_themes: { type: 'array', items: { type: 'string' } },
        personal_focus: { type: 'string' },
        collective_theme: { type: 'string' },
        weekly_arc: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week: { type: 'string' },
              focus: { type: 'string' },
              best_for: { type: 'string' },
            },
            required: ['week', 'focus', 'best_for'],
          },
        },
        maximize: { type: 'array', items: { type: 'string' } },
        watch_out: { type: 'array', items: { type: 'string' } },
        topics: { type: 'array', items: { type: 'string' } },
        power_planet: { type: 'string' },
        power_planet_glyph: { type: 'string' },
        best_windows: { type: 'array', items: { type: 'string' } },
        planner_teaser: { type: 'string' },
      },
      required: ['greeting', 'month_overview', 'key_themes', 'personal_focus', 'collective_theme', 'weekly_arc', 'maximize', 'watch_out', 'topics', 'power_planet', 'planner_teaser'],
    },
  });

  const featureHighlight = await getActiveEmailHighlight(base44);
  const html = renderMonthlyHtml({
    user: targetUser, monthName, llm, allIngresses, allStations, lunations, appUrl, featureHighlight,
  });
  const subject = `✦ ${llm.power_planet_glyph || '✦'} Your month ahead · ${monthName}`;
  return { html, subject };
}

// ── HTML renderer ─────────────────────────────────────────────────────────────
function renderMonthlyHtml({ user, monthName, llm, allIngresses, allStations, lunations, appUrl, featureHighlight = null }) {
  const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355', BLUE = '#4E6E8E';
  const planner = appUrl ? `${appUrl}/planner?view=Month` : '#';

  const ASTRO_RE = /([☉☽☿♀♂♃♄♅♆♇⚷⚸☌☍△□⚹☊☋♈♉♊♋♌♍♎♏♐♑♒♓])/g;
  const highlightAstro = (txt) => insertGlyphs(txt, GOLD2);

  const themeChips = (llm.key_themes || []).map(t =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${GOLD2};border:1px solid ${GOLD}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${t}</span>`
  ).join('');

  const topicChips = (llm.topics || []).map(t =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;color:${BLUE};border:1px solid ${BLUE}44;border-radius:999px;padding:3px 10px;margin:0 4px 4px 0;">${t}</span>`
  ).join('');

  const lunationChips = (lunations || []).map(l =>
    `<span style="display:inline-block;font-family:Georgia,serif;font-size:12px;color:${GOLD2};border:1px solid ${GOLD}55;border-radius:999px;padding:4px 12px;margin:0 4px 4px 0;">${l.emoji} ${l.type} in ${l.sign} ${SIGN_GLYPHS[l.sign] || ''}</span>`
  ).join('');

  const weekRows = (llm.weekly_arc || []).map(w => `
    <tr><td style="padding:10px 14px;background:${CARD};border-radius:8px;border-left:3px solid ${GOLD};">
      <div style="font-family:Georgia,serif;font-size:14px;color:${GOLD2};margin-bottom:4px;"><strong>${w.week}</strong></div>
      <div style="font-family:Georgia,serif;font-size:13px;color:${TEXT};line-height:1.5;margin-bottom:4px;">${highlightAstro(w.focus)}</div>
      <div style="display:inline-block;font-family:Georgia,serif;font-size:10px;color:#5E8A5E;border:1px solid #A8C8A844;border-radius:999px;padding:2px 8px;">✦ ${w.best_for}</div>
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

  const windowItems = (llm.best_windows || []).map(w =>
    `<tr><td style="padding:8px 14px;background:${CARD};border-radius:8px;border:1px solid ${BLUE}22;">
      <div style="font-family:Georgia,serif;font-size:13px;color:${BLUE};line-height:1.4;">✦ ${highlightAstro(w)}</div>
    </td></tr><tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="text-align:center;padding:8px 24px 20px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta ✦ Monthly Digest</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${MUTED};margin-top:6px;">${monthName}</div>
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
      <span style="font-family:Georgia,serif;font-size:13px;color:${TEXT};vertical-align:middle;margin-left:8px;">${llm.power_planet} defines your month</span>
    </div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:0 28px 18px;text-align:center;">
    <p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0;">${highlightAstro(llm.greeting)}</p>
    <div style="margin-top:14px;">${themeChips}</div>
  </td></tr>

  <!-- Lunations -->
  ${lunationChips ? `
  <tr><td style="padding:0 28px 18px;text-align:center;">${lunationChips}</td></tr>
  ` : ''}

  <!-- Month Overview -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✨ Month Overview</div>
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${TEXT};margin:0 0 14px;">${highlightAstro(llm.month_overview)}</p>
    <div style="margin-bottom:6px;"><span style="font-family:Georgia,serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${BLUE};margin-right:6px;">Topics:</span>${topicChips}</div>
  </td></tr>

  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>

  <!-- Personal Focus -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🔮 Personal Focus</div>
    <p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0 0 14px;border-left:2px solid ${GOLD}55;padding-left:14px;">${highlightAstro(llm.personal_focus)}</p>
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

  <!-- Weekly Arc -->
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">📅 Week-by-Week</div>
  </td></tr>
  <tr><td style="padding:0 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${weekRows}</table>
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>

  <!-- Best Windows -->
  ${windowItems ? `
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🌟 Best Windows</div>
  </td></tr>
  <tr><td style="padding:0 28px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${windowItems}</table>
  </td></tr>
  <tr><td style="padding:8px 28px;"><div style="height:1px;background:${GOLD}22;"></div></td></tr>
  ` : ''}

  <!-- Maximize -->
  ${maximizeItems ? `
  <tr><td style="padding:6px 28px 6px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">🎯 This Month's Edge</div>
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
        <a href="${planner}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 24px;border-radius:999px;">Explore your month in the Planner →</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:18px 28px 8px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.6;">
      You're receiving this monthly digest as a paid subscriber.<br>
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
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const appUrl = body.appUrl || 'https://astrosetta.com';

    if (body.scheduled) {
      const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
      const userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
      let sent = 0, skipped = 0, optedOut = 0, failed = 0;
      for (const uid of userIds) {
        const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
        if (!target?.email) { skipped++; continue; }
        if (target.monthly_email_opt_in === false) { optedOut++; continue; }
        // BETA: all opted-in users receive the monthly digest (tier gate removed
        // to match sendDailyEmail's BETA_ALL_PAID policy). Re-add the paid-tier
        // check here once payments launch.
        // One bad recipient must not abort the whole run — everyone after it
        // would silently lose their digest.
        try {
          const built = await buildMonthlyEmailForUser(base44, target, appUrl);
          if (!built) { skipped++; continue; }
          await sendDigestEmail({ to: target.email, subject: built.subject, html: built.html });
          sent++;
        } catch (err) {
          failed++;
          console.error(`[monthly-digest] send failed for user ${uid}:`, err?.message || err);
        }
      }
      return Response.json({ success: true, sent, skipped, optedOut, failed });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (body.test) {
      const built = await buildMonthlyEmailForUser(base44, user, appUrl);
      if (!built) return Response.json({ error: 'No natal chart found for your account.' }, { status: 400 });
      await sendDigestEmail({ to: user.email, subject: built.subject, html: built.html });
      return Response.json({ success: true, sent_to: user.email });
    }

    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    const charts = await base44.asServiceRole.entities.Chart.list('-created_date', 500);
    const userIds = [...new Set(charts.map(c => c.user_id).filter(Boolean))];
    let sent = 0, skipped = 0, optedOut = 0;
    for (const uid of userIds) {
      const target = await base44.asServiceRole.entities.User.filter({ id: uid }).then(r => r[0]).catch(() => null);
      if (!target?.email) { skipped++; continue; }
      if (target.monthly_email_opt_in === false) { optedOut++; continue; }
      const tier = getEffectiveTier(target);
      if (tier === 'free') { optedOut++; continue; }
      const built = await buildMonthlyEmailForUser(base44, target, appUrl);
      if (!built) { skipped++; continue; }
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: target.email, from_name: 'Astrosetta', subject: built.subject, body: built.html,
      });
      sent++;
    }
    return Response.json({ success: true, sent, skipped, optedOut });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});