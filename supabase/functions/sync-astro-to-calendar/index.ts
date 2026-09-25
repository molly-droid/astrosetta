// v2 — redeployed 2026-06-02
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';
import { getLunationsBetween } from '../_shared/lunations.ts';

const CONNECTOR_ID = '6a1dcf26b051d2efbd301fbf';

// Approximate planet longitude using simplified VSOP-like formulas (good to ~1°)
// Epoch: J2000.0, all angles in degrees
function planetLongitude(name, jd) {
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000
  const deg = v => ((v % 360) + 360) % 360;

  switch (name) {
    case 'Jupiter': {
      const L = deg(34.351519 + 3034.905675 * T);
      return deg(L + 5.55 * Math.sin((357.529 + 35999.050 * T) * Math.PI / 180));
    }
    case 'Saturn': {
      return deg(50.077444 + 1222.113794 * T);
    }
    case 'Uranus': {
      return deg(314.055005 + 428.466998 * T);
    }
    case 'Neptune': {
      return deg(304.348665 + 218.459213 * T);
    }
    case 'Pluto': {
      return deg(238.929 + 145.2069 * T);
    }
    case 'Mars': {
      return deg(355.433 + 19140.299 * T);
    }
    case 'Venus': {
      return deg(181.979 + 58517.816 * T);
    }
    case 'Mercury': {
      return deg(252.251 + 149472.675 * T);
    }
    default: return 0;
  }
}

function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

const SLOW_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
const TRANSIT_ORB = 2.0; // degrees

// Check if a transiting planet is within orb of a natal planet longitude
function checkNatalAspects(transitLon, natalLon, planetName) {
  let diff = Math.abs(transitLon - natalLon);
  if (diff > 180) diff = 360 - diff;
  for (const [aspName, aspAngle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(diff - aspAngle);
    if (orb <= TRANSIT_ORB) {
      return { aspect: aspName, orb };
    }
  }
  return null;
}

// Detect retrograde station: planet changes direction between day i-1 and day i
// Returns 'retrograde_start' or 'retrograde_end' or null
function detectRetrograde(name, date) {
  const prevDate = new Date(date.getTime() - 2 * 86400000);
  const nextDate = new Date(date.getTime() + 2 * 86400000);
  const jd0 = dateToJD(prevDate);
  const jd1 = dateToJD(date);
  const jd2 = dateToJD(nextDate);
  const l0 = planetLongitude(name, jd0);
  const l1 = planetLongitude(name, jd1);
  const l2 = planetLongitude(name, jd2);

  // Motion: positive = direct, negative = retrograde
  function motion(la, lb) {
    let d = lb - la;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  const m1 = motion(l0, l1);
  const m2 = motion(l1, l2);
  if (m1 > 0 && m2 < 0) return 'retrograde_start'; // goes retrograde
  if (m1 < 0 && m2 > 0) return 'retrograde_end';   // goes direct
  return null;
}

const PLANET_GLYPHS = { Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Mars: '♂', Venus: '♀', Mercury: '☿' };
const ASPECT_EMOJIS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };

const DAILY_MOTIONS = {
  Sun: 1.0, Moon: 12.0, Mercury: 1.2, Venus: 1.0, Mars: 0.5,
  Jupiter: 0.08, Saturn: 0.03, Uranus: 0.01, Neptune: 0.006, Pluto: 0.004,
};

// Estimate local time a transit becomes exact, returns decimal hour (0-24)
function estimateTransitHour(orb, planetName) {
  const dailyMotion = DAILY_MOTIONS[planetName] || 0.5;
  const hours = (orb / dailyMotion) * 24;
  return 12 + hours; // noon ± offset; clamped later
}

// Format decimal hour as an ISO dateTime string with timezone offset
function formatDateTime(dateStr, decimalHour) {
  const clamped = ((decimalHour % 24) + 24) % 24;
  const h = Math.floor(clamped);
  let m = Math.round((clamped % 1) * 60);
  if (m === 60) { m = 0; }
  const pad = n => n.toString().padStart(2, '0');
  // Use the date as-is with computed time; Google Calendar interprets as local
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
}

async function checkConnection(base44) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
    if (!accessToken) return json({ connected: false });
    const test = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return json({ connected: test.ok });
  } catch {
    return json({ connected: false });
  }
}

async function syncCalendar(base44, user, body) {
  const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);
  if (!accessToken) return json({ error: 'Not connected' }, { status: 400 });

  const filters = body.filters || {};
  const includeNewMoon = filters.new_moon !== false;
  const includeFullMoon = filters.full_moon !== false;
  const includeTransits = filters.major_transits !== false;
  const includeRetrogrades = filters.retrogrades !== false;
  const includeJournal = filters.journal !== false;
  const daysAhead = body.days_ahead || 28;

  let natalPlanets = [];
  if (includeTransits) {
    const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: user.id });
    const raw = charts[0]?.raw_data || {};
    natalPlanets = (raw.planets || [])
      .filter(p => SLOW_PLANETS.includes(p.name) || ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Ascendant'].includes(p.name))
      .map(p => ({ name: p.name, longitude: parseFloat(p.longitude) || 0 }));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + daysAhead);

  // Lunations — one exact new/full moon per local date, in the user's
  // timezone (falls back to UTC), matching the Planner's attribution.
  const [progress] = await base44.asServiceRole.entities.UserProgress.filter({ user_id: user.id });
  const userTz = progress?.timezone || 'UTC';
  const lunationByDate = new Map(
    getLunationsBetween(today.getTime() - 86400000, endDate.getTime() + 86400000, userTz)
      .map(l => [l.dateKey, l])
  );

  // Fetch existing events for dedup (idempotency — prevents duplicates on re-sync)
  const existingRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${today.toISOString()}&timeMax=${endDate.toISOString()}&maxResults=250`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const existingData = await existingRes.json();
  const existingKeys = new Set();
  // Stale moon events from earlier syncs — the old version could place a new
  // moon across several days, so remove them before writing the corrected one.
  const staleMoonEventIds = [];
  for (const evt of (existingData.items || [])) {
    const evtDate = (evt.start?.dateTime || evt.start?.date || '').slice(0, 10);
    existingKeys.add(`${evtDate}|${evt.summary}`);
    if (/^[🌑🌕]/.test(evt.summary || '') && evt.id) staleMoonEventIds.push(evt.id);
  }
  for (const id of staleMoonEventIds) {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  const eventsToCreate = [];

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const jd = dateToJD(d);

    if (includeNewMoon || includeFullMoon) {
      const lunation = lunationByDate.get(dateStr);
      if (lunation) {
        const decimalHour = lunation.hour + lunation.minute / 60;
        if (lunation.type === 'new' && includeNewMoon) {
          eventsToCreate.push({ dateTime: formatDateTime(dateStr, decimalHour), summary: `🌑 New Moon in ${lunation.sign}`, description: 'New Moon — set intentions, plant seeds, begin fresh.\n\nAdded by Astro Planner', colorId: '9' });
        }
        if (lunation.type === 'full' && includeFullMoon) {
          eventsToCreate.push({ dateTime: formatDateTime(dateStr, decimalHour), summary: `🌕 Full Moon in ${lunation.sign}`, description: 'Full Moon — culmination, release, illumination.\n\nAdded by Astro Planner', colorId: '5' });
        }
      }
    }

    if (includeTransits && natalPlanets.length) {
      const seen = new Set();
      for (const tPlanet of SLOW_PLANETS) {
        const transitLon = planetLongitude(tPlanet, jd);
        for (const nPlanet of natalPlanets) {
          const result = checkNatalAspects(transitLon, nPlanet.longitude, tPlanet);
          if (result) {
            const key = `${tPlanet}_${result.aspect}_${nPlanet.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              const g = PLANET_GLYPHS[tPlanet] || '';
              const aspSym = ASPECT_EMOJIS[result.aspect] || result.aspect;
              const estHour = estimateTransitHour(result.orb, tPlanet);
              eventsToCreate.push({ dateTime: formatDateTime(dateStr, estHour), summary: `${g} ${tPlanet} ${aspSym} natal ${nPlanet.name}`, description: `Major transit: ${tPlanet} ${result.aspect} your natal ${nPlanet.name} (orb ~${result.orb.toFixed(1)}°).\n\nAdded by Astro Planner`, colorId: '1' });
            }
          }
        }
      }
    }

    if (includeRetrogrades) {
      for (const planet of [...SLOW_PLANETS, 'Mercury', 'Venus', 'Mars']) {
        const station = detectRetrograde(planet, d);
        if (station) {
          const g = PLANET_GLYPHS[planet] || '';
          const isRx = station === 'retrograde_start';
          eventsToCreate.push({ dateTime: formatDateTime(dateStr, 12), summary: `${g} ${planet} ${isRx ? 'Retrograde ℞ begins' : 'Direct ☌ resumes'}`, description: `${planet} stations ${isRx ? 'retrograde' : 'direct'} today.\n\nAdded by Astro Planner`, colorId: isRx ? '11' : '2' });
        }
      }
    }
  }

  // Sync planner journal entries as calendar events
  if (includeJournal) {
    const journals = await base44.asServiceRole.entities.PlannerJournalEntry.filter({ user_id: user.id });
    for (const entry of journals) {
      if (!entry.date_key || !entry.notes) continue;
      const entryDate = new Date(entry.date_key + 'T00:00:00');
      if (entryDate < today || entryDate > endDate) continue;
      eventsToCreate.push({
        dateTime: formatDateTime(entry.date_key, 9),
        summary: '✦ Planner Journal',
        description: `${entry.notes}\n\nAdded by Astro Planner`,
        colorId: '6',
      });
    }
  }

  let events_created = 0;
  for (const evt of eventsToCreate) {
    const evtDate = evt.dateTime.slice(0, 10);
    const dedupKey = `${evtDate}|${evt.summary}`;
    if (existingKeys.has(dedupKey)) continue;
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: evt.summary, description: evt.description, start: { dateTime: evt.dateTime }, end: { dateTime: evt.dateTime }, colorId: evt.colorId }),
    });
    if (res.ok) events_created++;
  }

  return json({ events_created, total_checked: daysAhead });
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body.check_only) return checkConnection(base44);
    return syncCalendar(base44, user, body);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});