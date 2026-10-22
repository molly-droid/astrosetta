import { useEffect, useState } from 'react';

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const isSameCalendarDay = (a, b) => !!a && !!b && dayKey(a) === dayKey(b);

/**
 * The current calendar day as state (B-28). A plain `new Date()` captured at
 * mount goes stale on native: the webview lives for days across backgrounding
 * (the round-1 resume fix deliberately stops teardown on refocus), so "today"
 * froze at whenever the page last mounted and yesterday's reading kept
 * showing. This re-checks the calendar day on visibility/resume and at
 * midnight, and only changes identity when the DAY actually rolls over.
 */
export function useToday() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const rollIfNewDay = () => {
      const now = new Date();
      setToday((prev) => (isSameCalendarDay(prev, now) ? prev : now));
    };

    document.addEventListener('visibilitychange', rollIfNewDay);
    window.addEventListener('focus', rollIfNewDay);
    // Catch midnight while the app is in the foreground too.
    const msToMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      return next - now;
    };
    let timer = setTimeout(function tick() {
      rollIfNewDay();
      timer = setTimeout(tick, msToMidnight());
    }, msToMidnight());

    return () => {
      document.removeEventListener('visibilitychange', rollIfNewDay);
      window.removeEventListener('focus', rollIfNewDay);
      clearTimeout(timer);
    };
  }, []);

  return today;
}
