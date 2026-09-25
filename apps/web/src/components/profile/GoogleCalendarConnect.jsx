import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CalendarDays, Loader2, CheckCircle2, Copy, Check, ExternalLink, Info, RefreshCw, Apple } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GoogleCalendarConnect() {
  const [loading, setLoading] = useState(true);
  const [feedUrl, setFeedUrl] = useState('');
  const [webcalUrl, setWebcalUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.id) {
        const origin = window.location.origin;
        const https = `${origin}/functions/calendarICSFeed?uid=${user.id}`;
        setFeedUrl(https);
        setWebcalUrl(https.replace(/^https?:\/\//, 'webcal://'));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
          className="w-full bg-gold-primary/80 hover:bg-gold-primary text-deep-blue font-body text-xs h-9"
        >
          <Apple size={13} className="mr-1.5" />
          Add to Apple Calendar
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
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
            className="flex-1 font-body text-xs h-9 border-gold-primary/30 text-brass hover:text-white"
          >
            {copied ? <Check size={12} className="mr-1.5" /> : <Copy size={12} className="mr-1.5" />}
            {copied ? 'Copied!' : 'Copy URL'}
          </Button>
        </div>
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