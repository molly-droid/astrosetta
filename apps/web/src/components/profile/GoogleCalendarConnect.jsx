import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CalendarDays, Loader2, CheckCircle2, Copy, Check, ExternalLink, Info, RefreshCw, Apple } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isNativePlatform } from '@/lib/platform';
import { openExternalUrl } from '@/lib/appUrls';

export default function GoogleCalendarConnect() {
  const [loading, setLoading] = useState(true);
  const [feedUrl, setFeedUrl] = useState('');
  const [webcalUrl, setWebcalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFeedUrl('');
    setWebcalUrl('');
    Promise.all([
      base44.functions.invoke('calendarConnection', { action: 'feed' }),
      base44.functions.invoke('calendarConnection', { action: 'status' }),
    ]).then(([feed, status]) => {
      if (cancelled) return;
      setFeedUrl(feed.data.url);
      setWebcalUrl(feed.data.url.replace(/^https?:\/\//, 'webcal://'));
      setConnected(status.data.connected);
      setConfigured(status.data.configured);
      const result = new URLSearchParams(location.search).get('google_calendar');
      setNotice(result === 'connected' ? 'Google Calendar connected.'
        : result === 'failed' ? 'Google Calendar wasn’t connected. Try again and allow calendar access.' : '');
    }).catch(() => {
      if (!cancelled) setNotice('Unable to load calendar sync. Check your connection and Core or Premium access, then reopen your profile.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, location.search]);

  const manageConnection = async (action) => {
    setBusy(true);
    setNotice('');
    try {
      if (action === 'sync') {
        const { data } = await base44.functions.invoke('syncAstroToCalendar', { days_ahead: 28 });
        setNotice(`Calendar synced: ${data.events_created} events added.`);
      } else {
        const { data } = await base44.functions.invoke('calendarConnection', { action, native: isNativePlatform() });
        if (data.url) await openExternalUrl(data.url);
        else { setConnected(false); setNotice('Google Calendar disconnected. Existing events remain in your calendar.'); }
      }
    } catch {
      setNotice('Unable to update Google Calendar. Check your connection or reconnect your calendar, then try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
    } catch {
      const input = document.createElement('input');
      input.value = feedUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Loader2 size={14} className="animate-spin text-gold-primary" />
        <p className="font-body text-xs text-brass italic">Preparing calendar feed...</p>
      </div>
    );
  }

  return (
    <div className="bg-paper/60 border border-gold-primary/20 rounded-xl px-3 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-brass/70" />
        <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Calendar Sync</p>
      </div>

      <div className="space-y-1.5">
        <p role="status" className="font-body text-xs text-brass">{notice}</p>
        <p className="font-body text-xs text-brass/70 leading-relaxed">
          Subscribe to your personal astrology calendar feed. New Moons, Full Moons, natal transits (major &amp; minor), sky aspects, retrogrades, planner journal entries, and <strong className="text-gold-primary/80">weekly &amp; monthly synthesis plus topic outlooks</strong> — all auto-updated.
        </p>
        <p className="font-body text-[0.625rem] text-brass/50 leading-relaxed">
          Includes <strong className="text-gold-primary/80">personalized synthesis</strong> (weekly &amp; monthly readings + topic outlooks), refreshed every Sunday. For <strong className="text-gold-primary/80">on-demand</strong> readings for specific date ranges, use the <Link to="/planner" className="text-gold-accent underline underline-offset-2">Planner → Sync button</Link> to export a one-time .ics download.
        </p>
      </div>

      {/* One-tap subscribe buttons */}
      <div className="space-y-2">
        <Button
          size="sm"
          onClick={() => window.open(webcalUrl, '_self')}
          disabled={!feedUrl}
          className="w-full bg-gold-primary/80 hover:bg-gold-primary text-deep-blue font-body text-xs h-9"
        >
          <Apple size={13} className="mr-1.5" />
          Add to Apple Calendar
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!feedUrl}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(feedUrl);
              } catch {
                const input = document.createElement('input');
                input.value = feedUrl;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 3000);
              window.open('https://calendar.google.com/calendar/u/0/r/settings/addbyurl', '_blank');
            }}
            className="flex-1 font-body text-xs h-9 border-gold-primary/30 text-brass hover:text-white"
          >
            {copied ? <Check size={12} className="mr-1.5" /> : <ExternalLink size={12} className="mr-1.5" />}
            {copied ? 'Copied! Open Google' : 'Google Calendar'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            disabled={!feedUrl}
            className="flex-1 font-body text-xs h-9 border-gold-primary/30 text-brass hover:text-white"
          >
            {copied ? <Check size={12} className="mr-1.5" /> : <Copy size={12} className="mr-1.5" />}
            {copied ? 'Copied!' : 'Copy URL'}
          </Button>
        </div>
      </div>

      <p className="font-body text-xs text-brass/70">Keep your feed link private. Anyone with it can read the calendar content, including journal entries.</p>
      <div className="space-y-2 border-t border-gold-primary/10 pt-3">
        <p className="font-body text-xs text-brass">Or connect Google Calendar to add events directly.</p>
        {connected ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => manageConnection('sync')}>Sync Google Calendar</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => manageConnection('disconnect')}>Disconnect Google Calendar</Button>
          </div>
        ) : (
          <Button size="sm" disabled={busy || !configured} onClick={() => manageConnection('authorize')}>Connect Google Calendar</Button>
        )}
        {!configured && <p className="font-body text-xs text-brass/70">Direct Google sync isn’t configured yet. You can use the calendar feed above.</p>}
      </div>

      {/* Instructions */}
      <div className="bg-background/20 rounded-lg px-3 py-2.5 space-y-1.5">
        <p className="font-body text-[0.6875rem] text-gold-primary font-semibold flex items-center gap-1">
          <Info size={11} /> How it works:
        </p>
        <ul className="font-body text-[0.625rem] text-brass/60 space-y-1">
          <li><strong className="text-brass">Apple Calendar:</strong> Tap the button above — iOS/macOS will prompt you to subscribe automatically.</li>
          <li><strong className="text-brass">Google Calendar:</strong> Click "Google Calendar" → paste the copied URL under "From URL".</li>
          <li><strong className="text-brass">Outlook / other:</strong> Copy the URL and add it as an internet calendar subscription.</li>
        </ul>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-gold-primary/10">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-soft" />
          <p className="font-body text-[0.625rem] text-brass/50">No account connection needed — works with any calendar app that supports ICS feeds.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <RefreshCw size={11} className="text-gold-accent/60" />
          <p className="font-body text-[0.625rem] text-brass/50">Auto-updates every few hours — Google Calendar re-fetches ICS feeds automatically (typically every 8–24 hours). Apple Calendar updates within an hour. Synthesis readings refresh weekly on Sundays.</p>
        </div>
      </div>
    </div>
  );
}
