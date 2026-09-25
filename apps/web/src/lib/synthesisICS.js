/**
 * Generates and downloads an ICS file for a synthesis (day/week/month).
 * For week/month, the event spans the full range.
 */

function escape(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function toDateStr(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
    .toLocaleDateString('en-CA')
    .replace(/-/g, '');
}

function buildICS(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Astro Planner//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Astro Planner'];
  events.forEach((evt, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:synth-${evt.dtstart}-${i}@astro-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${evt.dtstart}`,
      `DTEND;VALUE=DATE:${evt.dtend}`,
      `SUMMARY:${escape(evt.summary)}`,
      `DESCRIPTION:${escape(evt.description)}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Day synthesis — returns ICS event object */
export function buildDaySynthesisEvent(date, synthesis) {
  if (!synthesis) return null;
  const dtstart = toDateStr(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const dtend = toDateStr(nextDay);
  const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const toArr = v => Array.isArray(v) ? v : (v ? [v] : []);
  const bullets = [
    ...toArr(synthesis.personal_reading),
    ...toArr(synthesis.collective_reading),
    ...toArr(synthesis.maximize).map(s => `✦ ${s}`),
    ...toArr(synthesis.focus).map(s => `◎ ${s}`),
    ...toArr(synthesis.watch).map(s => `⚠ ${s}`),
  ].join('\n');
  return {
    dtstart, dtend,
    summary: `✦ Day Synthesis · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    description: `✦ Day Synthesis · ${label}\n\n${synthesis.overview}\n\n${bullets}\n\nPower Planet: ${synthesis.power_planet || '—'}\nBest Areas: ${(synthesis.best_areas || []).join(', ')}\n\nAdded by Astro Planner`,
  };
}

/** Week synthesis — returns ICS event object */
export function buildWeekSynthesisEvent(days, synthesis) {
  if (!synthesis || !days?.length) return null;
  const dtstart = toDateStr(days[0]);
  const lastDay = new Date(days[days.length - 1]);
  lastDay.setDate(lastDay.getDate() + 1);
  const dtend = toDateStr(lastDay);
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daySentences = days.map((d, i) => {
    const sentence = Array.isArray(synthesis.day_sentences)
      ? (synthesis.day_sentences[i] || '—')
      : (synthesis.day_sentences?.[String(i)] || '—');
    const isBest = synthesis.best_days?.includes(DAY_NAMES[d.getDay()]);
    return `${DOW[d.getDay()]} ${d.getDate()}${isBest ? ' ✦' : ''}: ${sentence}`;
  }).join('\n');
  const weekRange = `${days[0].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} – ${days[days.length - 1].toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
  return {
    dtstart, dtend,
    summary: `✦ Week Overview · ${weekRange}`,
    description: `✦ Week Synthesis · ${weekRange}\n\n${synthesis.overview}\n\nBest Days: ${(synthesis.best_days || []).join(' & ')}\nBest Areas: ${(synthesis.best_areas || []).join(', ')}\n\n${daySentences}\n\nAdded by Astro Planner`,
  };
}

/** Month synthesis — returns ICS event object */
export function buildMonthSynthesisEvent(date, synthesis) {
  if (!synthesis) return null;
  const year = date.getFullYear();
  const month = date.getMonth();
  const dtstart = `${year}${String(month + 1).padStart(2, '0')}01`;
  const nextMonth = new Date(year, month + 1, 1);
  const dtend = `${nextMonth.getFullYear()}${String(nextMonth.getMonth() + 1).padStart(2, '0')}01`;
  const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const opportunities = (synthesis.maximize || []).map(s => `✦ ${s}`).join('\n');
  const cautions = (synthesis.watch || []).map(s => `⚠ ${s}`).join('\n');
  return {
    dtstart, dtend,
    summary: `✦ Monthly Synthesis · ${monthName}`,
    description: `✦ Monthly Synthesis · ${monthName}\n\n${synthesis.overview}\n\nPersonal Focus: ${synthesis.personal_focus || '—'}\nCollective Theme: ${synthesis.collective_theme || '—'}\n\nOpportunities:\n${opportunities}\n\nWatch For:\n${cautions}\n\nBest Areas: ${(synthesis.best_areas || []).join(', ')}\n\nAdded by Astro Planner`,
  };
}

// ── Legacy download wrappers (kept for backward compat) ──────────────────────
export function downloadDaySynthesisICS(date, synthesis) {
  const evt = buildDaySynthesisEvent(date, synthesis);
  if (!evt) return;
  downloadICS(buildICS([evt]), `astro-synthesis-${evt.dtstart}.ics`);
}
export function downloadWeekSynthesisICS(days, synthesis) {
  const evt = buildWeekSynthesisEvent(days, synthesis);
  if (!evt) return;
  downloadICS(buildICS([evt]), `astro-week-synthesis-${evt.dtstart}.ics`);
}
export function downloadMonthSynthesisICS(date, synthesis) {
  const evt = buildMonthSynthesisEvent(date, synthesis);
  if (!evt) return;
  downloadICS(buildICS([evt]), `astro-month-synthesis-${evt.dtstart}.ics`);
}

/** Combined download — transit events + one or more synthesis events in one ICS file */
export function downloadCombinedICS(transitEvents, synthEvents, filename = 'astro-planner.ics') {
  // Transit events use { date, summary, description }; normalize to { dtstart, dtend, summary, description }
  const normalized = (transitEvents || []).map(evt => ({
    dtstart: evt.dtstart ?? evt.date,
    dtend: evt.dtend ?? evt.date,
    summary: evt.summary,
    description: evt.description,
  }));
  // synthEvents can be a single event object, an array, or null
  const synthArray = Array.isArray(synthEvents) ? synthEvents : (synthEvents ? [synthEvents] : []);
  const allEvents = [...normalized, ...synthArray];
  if (!allEvents.length) return;
  downloadICS(buildICS(allEvents), filename);
}