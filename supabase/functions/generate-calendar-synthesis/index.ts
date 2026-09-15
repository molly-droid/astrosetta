/**
 * generateCalendarSynthesis — Scheduled job (runs every 10 minutes).
 *
 * Pre-generates week synthesis, month synthesis, and topic outlooks for the
 * ICS feed, stored in CalendarSynthesis.
 *
 * Processes ONE chart per invocation to stay inside the function timeout
 * (the previous all-users-per-run version timed out every week). The
 * scheduled automation runs frequently, so all charts cycle through within
 * a few hours; charts that already have the current cycle's records are
 * skipped, making re-runs free.
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { traditionPromptPreamble } from '../_shared/traditionFraming.ts';
import { TONE_DIRECTIVE } from '../_shared/toneDirective.ts';

// ── Constants ────────────────────────────────────────────────────────────────
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const PLANET_GLYPHS = {Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇',Chiron:'⚷','North Node':'☊','South Node':'☋',Ascendant:'Asc',Midheaven:'MC'};
const ASPECT_GLYPHS = {conjunction:'☌',opposition:'☍',square:'□',trine:'△',sextile:'⚹'};
const ASPECT_ABBREV = {conjunction:'cnj',opposition:'opp',square:'sq',trine:'tri',sextile:'sxt'};
const ASPECT_ANGLES = {conjunction:0,opposition:180,trine:120,square:90,sextile:60};
const TRANSIT_ORBS = {conjunction:2.0,opposition:2.0,trine:2.0,square:2.0,sextile:1.5};
const PERSONA = `You are a psychologically astute astrologer and educator — specific, warm, and grounded. You never use generic affirmations or vague spiritual language. You always show your work: you name the specific planetary configurations (planet, sign, aspect, natal planet, house) creating each interpretation and explain the astrological mechanic of how those elements interact to produce the effect. Your goal is to teach the reader how astrology works, not just deliver a horoscope.

${TONE_DIRECTIVE}`;
const SLOW_SET = new Set(['Jupiter','Saturn','Uranus','Neptune','Pluto']);
const ALL_TP = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const TOPICS = [
  {key:'love',fullLabel:'Love & Relationships',glyph:'♀'},
  {key:'career',fullLabel:'Career & Purpose',glyph:'♄'},
  {key:'money',fullLabel:'Money & Resources',glyph:'♃'},
  {key:'health',fullLabel:'Health & Vitality',glyph:'☀'},
  {key:'communication',fullLabel:'Communication',glyph:'☿'},
  {key:'creativity',fullLabel:'Creativity & Play',glyph:'☽'},
  {key:'spirituality',fullLabel:'Spirituality',glyph:'♆'},
  {key:'home',fullLabel:'Home & Family',glyph:'♋'},
];

// ── Orbital math (from calendarICSFeed + Moon approximation) ──────────────────
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

// ── Transit helpers ──────────────────────────────────────────────────────────
function checkAspect(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const [aspName, aspAngle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(diff - aspAngle);
    if (orb <= (TRANSIT_ORBS[aspName] || 2.0)) return { aspect: aspName, orb };
  }
  return null;
}

function formatTransitLabel(tp, np, aspect) {
  const tG = PLANET_GLYPHS[tp.name] || '';
  const aG = ASPECT_GLYPHS[aspect] || aspect;
  const nG = PLANET_GLYPHS[np.name] || '';
  const aAb = ASPECT_ABBREV[aspect] || aspect;
  const houseStr = np.house ? ` (${np.house}H)` : '';
  const aspAngle = ASPECT_ANGLES[aspect] ?? 0;
  const exact1 = (np.longitude + aspAngle) % 360;
  const exact2 = (np.longitude - aspAngle + 360) % 360;
  const fwd1 = ((exact1 - tp.longitude) + 360) % 360;
  const fwd2 = ((exact2 - tp.longitude) + 360) % 360;
  const fwdToExact = Math.min(fwd1, fwd2);
  const applying = tp.retrograde ? fwdToExact > 180 : fwdToExact < 180;
  const arrow = applying ? '▲' : '▽';
  return `${tG} ${aG} ${nG} — ${tp.name} ${aAb} ${np.name}${houseStr} ${arrow}`;
}

function getDayTransits(date, natalPlanets) {
  const jd = dateToJD(date);
  const tPlanets = ALL_TP.map(name => {
    const lon = planetLongitude(name, jd);
    return { name, longitude: lon, sign: longitudeToSign(lon), retrograde: isRetrograde(name, date) };
  });

  const moonSign = tPlanets.find(p => p.name === 'Moon')?.sign || '';

  const personalFmt = [];
  for (const tp of tPlanets) {
    if (!SLOW_SET.has(tp.name)) continue;
    for (const np of natalPlanets) {
      const result = checkAspect(tp.longitude, np.longitude);
      if (result) {
        personalFmt.push(formatTransitLabel(tp, np, result.aspect));
      }
    }
  }
  return { moonSign, personalFmt };
}

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function getWeekDays(startDay) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDay);
    d.setUTCDate(startDay.getUTCDate() + i);
    return d;
  });
}

// Re-assign natal planet houses using stored cusps — ensures correct house
// assignments even if the stored chart was calculated with a different
// house system than what's currently active.
function reassignHouses(raw) {
  const planets = [...(raw?.planets || [])];
  const houses = raw?.houses || [];
  const houseSystem = raw?.house_system || 'whole_sign';
  const ascSign = raw?.ascendant_sign;
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

// ── Synthesis generators ─────────────────────────────────────────────────────
async function generateWeekSynthesis(base44, raw, weekDays, tradition = 'modern') {
  const natalBig3 = `☉ ${raw.sun_sign || ''} · ☽ ${raw.moon_sign || ''} · ASC ${raw.ascendant_sign || ''}`;
  const natalPlanets = reassignHouses(raw);
  if (raw.angles?.ascendant) {
    natalPlanets.push({ name: 'Ascendant', longitude: raw.angles.ascendant.longitude, sign: raw.angles.ascendant.sign, house: 1 });
  }

  const results = weekDays.map(d => getDayTransits(d, natalPlanets));
  const dayLines = weekDays.map((d, i) => {
    const { moonSign, personalFmt } = results[i];
    const aspects = personalFmt.length ? personalFmt.join(', ') : 'no major personal aspects';
    return `${DOW[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1]} ${d.getUTCDate()}: ☽ in ${moonSign}. ${aspects}`;
  });

  const weekRange = `${weekDays[0].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${weekDays[6].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;

  const prompt = `${traditionPromptPreamble(tradition)}

${PERSONA}

Week: ${weekRange}
NATAL: ${natalBig3}

DAILY TRANSITS:
${dayLines.join('\n')}

Rules:
- Plain text only, no markdown
- Use ONLY the transit data listed above. Do NOT mention or reference any planetary aspects, ingresses, or lunar events that are not explicitly listed in the data provided. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Use only the signs and positions shown in the transit labels above.
- ▲ = applying, ▽ = separating — shape advice accordingly
- SHOW YOUR WORK — this app teaches astrology. Each transit label already includes glyphs (planet + aspect + planet). Your interpretation sentence MUST explain the astrological mechanic: WHY this transiting planet in its current sign making this aspect to that natal planet in that house creates the described effect. Name the sign and house in your interpretation. No generic horoscope language.
- Each day: label line + 1 interpretation sentence (max 25 words) explaining the mechanic
- For no-transit days: write Moon sign energy only

Return plain text:
[2 sentence week overview]

MONDAY · [date]
[transit glyph label or "Moon in Sign"]
[1-sentence interpretation]

TUESDAY · [date]
[...]

(continue for each day of the week)

———
Astrosetta`;

  const description = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

  return {
    period_type: 'week',
    period_key: `week-${toISODate(weekDays[0])}`,
    date_start: toISODate(weekDays[0]),
    date_end: toISODate(weekDays[6]),
    summary: `✦ Week Overview · ${weekRange}`,
    description,
  };
}

async function generateMonthSynthesis(base44, raw, baseDate, tradition = 'modern') {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const monthName = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const natalBig3 = `☉ ${raw.sun_sign || ''} · ☽ ${raw.moon_sign || ''} · ASC ${raw.ascendant_sign || ''}`;
  const natalPlanets = reassignHouses(raw);

  const getLunation = (date) => {
    const jd = dateToJD(date);
    const moonLon = planetLongitude('Moon', jd);
    const sunLon = planetLongitude('Sun', jd);
    const moonSign = longitudeToSign(moonLon);
    const diff = ((moonLon - sunLon) + 360) % 360;
    if (diff < 45) return `● New Moon in ${moonSign}`;
    if (diff >= 180 && diff < 225) return `○ Full Moon in ${moonSign}`;
    return null;
  };

  const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const midDay = new Date(Date.UTC(year, month, 15, 12, 0, 0));
  const lunations = [getLunation(firstDay), getLunation(midDay)].filter(Boolean);

  // Compute slow-planet positions and personal transits for 1st and 15th
  const transit1 = getDayTransits(firstDay, natalPlanets);
  const transit15 = getDayTransits(midDay, natalPlanets);
  const slowPositions = ALL_TP.filter(n => SLOW_SET.has(n)).map(n => {
    const lon = planetLongitude(n, dateToJD(firstDay));
    return `${n} in ${longitudeToSign(lon)}`;
  }).join(', ');
  const allPersonal = [...(transit1.personalFmt || []), ...(transit15.personalFmt || [])];
  const uniquePersonal = [...new Set(allPersonal)];
  const personalText = uniquePersonal.length ? uniquePersonal.join('; ') : 'none exact';

  const prompt = `${traditionPromptPreamble(tradition)}

${PERSONA}

Month: ${monthName}
NATAL: ${natalBig3}
Lunations: ${lunations.join(' · ') || 'none at sample dates'}
Slow planet positions: ${slowPositions}
Active personal transits (1st & 15th): ${personalText}

Rules:
- Use ONLY the transit data provided above. Do NOT mention or reference any planetary transits, aspects, or lunations that are not explicitly listed in the data provided.
- CRITICAL: Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Use only the signs and positions shown in the data above.
- Plain text only
- Reason from the Sun/Moon/Rising combination together — not each placement in isolation
- SHOW YOUR WORK — this app teaches astrology. When naming lunations and transits, use planet glyphs (☉☽☿♀♂♃♄♅♆♇). Explain the astrological mechanic: WHY the New or Full Moon in that sign aspecting that natal placement creates the described effect. Name the house involved. No generic horoscope language.
- Anchor collective_theme to the New and Full Moon signs
- personal_focus should reflect what this month's lunation axis activates for this Rising sign specifically
- No platitudes

Return plain text in exactly this structure:
[2-3 sentence overview]

PERSONAL FOCUS
[2-3 sentences grounded in Big 3 + lunation axis]

COLLECTIVE THEME
[1-2 sentences anchored to New/Full Moon signs]

THIS MONTH
Maximize: [1 sentence]
Watch: [1 sentence]
Best areas: [area1] · [area2]

———
Astrosetta`;

  const description = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });

  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  return {
    period_type: 'month',
    period_key: `month-${year}-${String(month + 1).padStart(2, '0')}`,
    date_start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    date_end: `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
    summary: `✦ Monthly Synthesis · ${monthName}`,
    description,
  };
}

// All 8 topic outlooks in a single LLM call (one call instead of eight —
// keeps the per-chart workload well inside the function timeout).
async function generateTopicOutlooks(base44, raw, baseDate, tradition = 'modern') {
  const monthName = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const planets = reassignHouses(raw).map(p => `${p.name} in ${p.sign} ${p.house ? `(house ${p.house})` : ''}`).join(', ');

  const firstDay = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 12, 0, 0));
  const natalPlanets = reassignHouses(raw);
  const transitData = getDayTransits(firstDay, natalPlanets);
  const slowPositions = ALL_TP.filter(n => SLOW_SET.has(n)).map(n => {
    const lon = planetLongitude(n, dateToJD(firstDay));
    return `${n} in ${longitudeToSign(lon)}`;
  }).join(', ');
  const personalAspects = (transitData.personalFmt || []).join('; ') || 'none exact';

  const topicList = TOPICS.map(t => `${t.key} — ${t.fullLabel}`).join('; ');

  const prompt = `${traditionPromptPreamble(tradition)}

${PERSONA}

Natal chart: ${planets}
Month: ${monthName}

Current slow planet positions (authoritative — use these exact signs): ${slowPositions}
Active personal transits: ${personalAspects}

Write a topic outlook for EACH of these topics: ${topicList}

Rules:
- CRITICAL: Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Use ONLY the signs and positions shown in "Current slow planet positions" above. Every time you mention a transiting planet, you MUST use the exact sign listed there.
- Use ONLY the transit data provided above. Do NOT invent planetary positions, aspects, or events not explicitly listed.
- Use ONLY the natal placements listed above. Do NOT invent natal positions, signs, or houses not listed.
- For each topic: 3-4 sentences covering the key planetary influence for that topic, what to lean into, and one practical suggestion. Plain text only, no headers, no markdown.

Return JSON with one key per topic, each containing that topic's outlook text.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: Object.fromEntries(TOPICS.map(t => [t.key, { type: 'string' }])),
      required: TOPICS.map(t => t.key),
    },
  });

  // A missing topic throws — the chart is retried whole on the next run
  // instead of leaving a permanent gap in the calendar feed.
  for (const t of TOPICS) {
    if (!result[t.key] || typeof result[t.key] !== 'string') {
      throw new Error(`Topic outlook missing for "${t.key}"`);
    }
  }
  return result;
}

function buildTopicRecord(raw, baseDate, topic, outlookText) {
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const monthName = baseDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  return {
    period_type: 'topic',
    period_key: `topic-${year}-${String(month + 1).padStart(2, '0')}-${topic.key}`,
    date_start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    date_end: `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
    summary: `${topic.glyph} ${topic.fullLabel} · ${monthName}`,
    description: outlookText + '\n\n— Astro Planner',
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
// Processes ONE chart per call to avoid timeouts. The scheduled automation
// runs every 10 minutes, so all charts cycle through within a few hours.
// Pass { chart_id: "xxx" } to target a specific chart.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch { /* no body — scheduled run */ }
    const { chart_id } = body;

    const charts = await base44.asServiceRole.entities.Chart.list();

    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    // Week starts on next Sunday (or today if Sunday)
    const weekStart = new Date(today);
    const dayOfWeek = today.getUTCDay();
    if (dayOfWeek !== 0) {
      weekStart.setUTCDate(today.getUTCDate() + (7 - dayOfWeek));
    }
    const weekDays = getWeekDays(weekStart);

    // Month = current month
    const baseDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const year = baseDate.getUTCFullYear();
    const mm = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const weekKey = `week-${toISODate(weekDays[0])}`;
    const monthKey = `month-${year}-${mm}`;
    const requiredKeys = [weekKey, monthKey, ...TOPICS.map(t => `topic-${year}-${mm}-${t.key}`)];

    // Pick the first chart missing any record from the current cycle
    let target = null;
    if (chart_id) {
      target = charts.find(c => c.id === chart_id);
    } else {
      for (const c of charts) {
        const raw = c.raw_data || {};
        if (!raw.birth_date || !raw.planets?.length) continue;
        const records = await base44.asServiceRole.entities.CalendarSynthesis.filter({ user_id: c.user_id });
        const keys = new Set(records.map(r => r.period_key));
        if (!requiredKeys.every(k => keys.has(k))) { target = c; break; }
      }
    }

    if (!target) {
      return json({ status: 'complete', message: 'All charts have the current cycle of synthesis records', remaining: 0 });
    }

    const raw = target.raw_data || {};
    if (!raw.birth_date || !raw.planets?.length) {
      return json({ chart_id: target.id, status: 'skipped', reason: 'missing data' });
    }

    // Read the user's active tradition so synthesis adopts the right lens
    let tradition = 'modern';
    try {
      const prog = await base44.asServiceRole.entities.UserProgress.filter({ user_id: target.user_id });
      if (prog[0]?.active_tradition) tradition = prog[0].active_tradition;
    } catch { /* default to modern */ }

    // Generate all synthesis in parallel (3 LLM calls)
    const [weekSynth, monthSynth, topicOutlooks] = await Promise.all([
      generateWeekSynthesis(base44, raw, weekDays, tradition),
      generateMonthSynthesis(base44, raw, baseDate, tradition),
      generateTopicOutlooks(base44, raw, baseDate, tradition),
    ]);

    // Upsert by period_key (never delete records first — a failure between
    // delete and create would leave the calendar feed empty)
    const upserts = [
      { user_id: target.user_id, ...weekSynth },
      { user_id: target.user_id, ...monthSynth },
      ...TOPICS.map(t => ({ user_id: target.user_id, ...buildTopicRecord(raw, baseDate, t, topicOutlooks[t.key]) })),
    ];

    const existing = await base44.asServiceRole.entities.CalendarSynthesis.filter({ user_id: target.user_id });
    const byKey = new Map(existing.map(r => [r.period_key, r]));
    const genAt = new Date().toISOString();

    for (const rec of upserts) {
      const payload = { ...rec, generated_at: genAt };
      const prev = byKey.get(rec.period_key);
      if (prev) {
        await base44.asServiceRole.entities.CalendarSynthesis.update(prev.id, payload);
      } else {
        await base44.asServiceRole.entities.CalendarSynthesis.create(payload);
      }
    }

    return json({ chart_id: target.id, user_id: target.user_id, status: 'ok', items: upserts.length });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});