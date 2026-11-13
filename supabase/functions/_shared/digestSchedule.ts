export function digestSlot(kind: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const localDay = new Date(`${date}T12:00:00Z`);
  const weekday = localDay.getUTCDay();
  const monday = new Date(localDay);
  monday.setUTCDate(monday.getUTCDate() - ((weekday + 6) % 7));
  const period = kind === 'monthly' ? date.slice(0, 7)
    : kind === 'weekly' || kind === 'feedback' ? monday.toISOString().slice(0, 10) : date;
  const hour = Number(parts.hour);
  const due = kind === 'feedback' ? weekday === 1 && hour === 8
    : hour >= 7 && hour < 9 && (kind === 'daily' || kind === 'weekly' && weekday === 1 || kind === 'monthly' && parts.day === '01');
  return { period, due };
}
