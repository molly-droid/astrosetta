// v3 — engine-backed positions (B-14): the embedded "simplified VSOP-like"
// ephemeris this surface shipped with from Base44 was a sign off for slow
// planets (Pluto in Capricorn). Every date now comes from chart-calculator —
// the same Swiss-Ephemeris pipeline as the rest of the app (ephemeris_cache
// keeps the per-day fetches cheap and shared across users).
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import { googleAccessToken, calendarAllowed } from '../_shared/googleCalendar.ts';
import { getLunationsBetween } from '../_shared/lunations.ts';
import { fetchCalendarDays, natalParamsFromRaw } from '../_shared/calendarDays.ts';

const SLOW_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const TRANSIT_ORB = 2.0; // degrees — same threshold the old in-file math used

const ASPECT_EMOJIS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };

// The v3 engine rewrite started titling events with glyphs but never carried
// this map over from calendar-icsfeed, so the first in-orb transit or station
// threw a ReferenceError and the whole sync aborted before posting anything.
const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Jupiter: '♃', Saturn: '♄', Uranus: '♅',
  Neptune: '♆', Pluto: '♇', Mars: '♂', Venus: '♀', Mercury: '☿',
  Chiron: '⚷', 'North Node': '☊',
};

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

async function checkConnection(userId) {
  try {
    const accessToken = await googleAccessToken(serviceClient(), userId);
    if (!accessToken) return json({ connected: false });
    const test = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return json({ connected: test.ok });
  } catch {
    return json({ connected: false });
  }
}

async function syncCalendar(base44, user, body) {
  const accessToken = await googleAccessToken(serviceClient(), user.id);
  if (!accessToken) return json({ error: 'Not connected' }, { status: 400 });

  const filters = body.filters || {};
  const includeNewMoon = filters.new_moon !== false;
  const includeFullMoon = filters.full_moon !== false;
  const includeTransits = filters.major_transits !== false;
  const includeRetrogrades = filters.retrogrades !== false;
  const daysAhead = Math.min(90, Math.max(1, Number(body.days_ahead) || 28));

  // Newest chart first (B-15): editing birth data CREATES a new chart row, so
  // an unordered read could sync a pre-correction chart — wrong positions that
  // look like somebody else's data. Matches the app's own '-created_date'.
  const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: user.id }, '-created_date');
  const chartRaw = charts[0]?.raw_data || {};
  let natalPlanets = [];
  if (includeTransits) {
    const raw = chartRaw;
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
  const existingKeys = new Set();
  let pageToken = '';
  do {
    const query = new URLSearchParams({ timeMin: today.toISOString(), timeMax: endDate.toISOString(), maxResults: '250', ...(pageToken ? { pageToken } : {}) });
    const existingRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
    });
    if (!existingRes.ok) throw new Error('Unable to read Google Calendar. Reconnect and try again.');
    const existingData = await existingRes.json();
    for (const evt of existingData.items || []) {
      const evtDate = (evt.start?.dateTime || evt.start?.date || '').slice(0, 10);
      existingKeys.add(`${evtDate}|${evt.summary}`);
    }
    pageToken = existingData.nextPageToken || '';
  } while (pageToken);

  const eventsToCreate = [];

  // Engine data for every day in the window (B-14: accurate positions,
  // stations and aspects from chart-calculator instead of in-file formulas).
  const natalParams = natalParamsFromRaw(chartRaw);
  let engineDays = [];
  if (natalParams && (includeTransits || includeRetrogrades)) {
    engineDays = await fetchCalendarDays(base44, natalParams, today, daysAhead + 1);
  }

  // B-17: Google renders event descriptions as HTML — bare newlines collapse
  // into one run-on blob. Emit a bold title line, the body, and the footer as
  // separate <br>-joined lines so synced events read cleanly.
  const gcalDesc = (title: string, body: string) =>
    `<b>${title}</b><br><br>${body}<br><br><i>Added by Astrosetta</i>`;

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const day = engineDays[i];

    if (includeNewMoon || includeFullMoon) {
      const lunation = lunationByDate.get(dateStr);
      if (lunation) {
        const decimalHour = lunation.hour + lunation.minute / 60;
        if (lunation.type === 'new' && includeNewMoon) {
          eventsToCreate.push({ dateTime: formatDateTime(dateStr, decimalHour), summary: `🌑 New Moon in ${lunation.sign}`, description: gcalDesc(`New Moon in ${lunation.sign}`, 'Set intentions, plant seeds, begin fresh.'), colorId: '9' });
        }
        if (lunation.type === 'full' && includeFullMoon) {
          eventsToCreate.push({ dateTime: formatDateTime(dateStr, decimalHour), summary: `🌕 Full Moon in ${lunation.sign}`, description: gcalDesc(`Full Moon in ${lunation.sign}`, 'Culmination, release, illumination.'), colorId: '5' });
        }
      }
    }

    if (includeTransits && day) {
      const seen = new Set();
      const natalNames = new Set(natalPlanets.map((p) => p.name));
      for (const a of day.transit_aspects) {
        if (!SLOW_PLANETS.includes(a.transit_planet)) continue;
        if (!natalNames.has(a.natal_planet)) continue;
        if (a.orb > TRANSIT_ORB) continue;
        const key = `${a.transit_planet}_${a.aspect}_${a.natal_planet}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const g = PLANET_GLYPHS[a.transit_planet] || '';
        const aspSym = ASPECT_EMOJIS[a.aspect] || a.aspect;
        const estHour = estimateTransitHour(a.orb, a.transit_planet);
        eventsToCreate.push({ dateTime: formatDateTime(dateStr, estHour), summary: `${g} ${a.transit_planet} ${aspSym} natal ${a.natal_planet}`, description: gcalDesc('Major transit', `${a.transit_planet} ${a.aspect} your natal ${a.natal_planet} (orb ~${a.orb.toFixed(1)}°).`), colorId: '1' });
      }
    }

    if (includeRetrogrades && day) {
      for (const st of day.stations) {
        const g = PLANET_GLYPHS[st.planet] || '';
        const isRx = st.type === 'retrograde';
        eventsToCreate.push({ dateTime: formatDateTime(dateStr, 12), summary: `${g} ${st.planet} ${isRx ? 'Retrograde ℞ begins' : 'Direct ☌ resumes'}`, description: gcalDesc(`${st.planet} stations ${isRx ? 'retrograde' : 'direct'}`, `${st.planet} stations ${isRx ? 'retrograde' : 'direct'} today in ${st.sign}.`), colorId: isRx ? '11' : '2' });
      }
    }
  }

  // Journal entries are deliberately NOT synced (B-16): journal content is
  // private to the app; a journal in a Google Calendar leaks it to anyone
  // the calendar is shared with.

  let events_created = 0;
  for (const evt of eventsToCreate) {
    const evtDate = evt.dateTime.slice(0, 10);
    const dedupKey = `${evtDate}|${evt.summary}`;
    if (existingKeys.has(dedupKey)) continue;
    const endTime = new Date(Date.parse(`${evt.dateTime}Z`) + 30 * 60000).toISOString().slice(0, 19);
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      // extendedProperties.private is how the cleanup action finds these
      // again. The old marker was the "Added by Astrosetta" line in the
      // description, which is a free-text match on the user's whole calendar
      // and would happily delete an event of their own that mentions us.
      // Events written before this tag still fall back to that text check.
      body: JSON.stringify({ summary: evt.summary, description: evt.description, start: { dateTime: evt.dateTime, timeZone: userTz }, end: { dateTime: endTime, timeZone: userTz }, colorId: evt.colorId, extendedProperties: { private: { astrosetta: 'v1' } } }),
    });
    if (!res.ok) throw new Error('Google Calendar could not save every event. Reconnect and try again.');
    events_created++;
    existingKeys.add(dedupKey);
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

    if (!await calendarAllowed(serviceClient(), user.id)) return json({ error: 'Calendar sync requires Core or Premium' }, { status: 403 });
    if (body.check_only) return checkConnection(user.id);
    return syncCalendar(base44, user, body);
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
