import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Mail, CalendarRange, Loader2, Send, Users, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

function appOrigin() {
  try { return window.top.location.origin; } catch { return window.location.origin; }
}

export default function EmailTab() {
  const [dailyTesting, setDailyTesting] = useState(false);
  const [dailySending, setDailySending] = useState(false);
  const [weeklyTesting, setWeeklyTesting] = useState(false);
  const [monthlyTesting, setMonthlyTesting] = useState(false);
  const [onboardingSending, setOnboardingSending] = useState(false);
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [result, setResult] = useState(null);

  const showResult = (ok, msg) => setResult({ ok, msg });

  const sendDailyTest = async () => {
    setDailyTesting(true); setResult(null);
    try {
      const res = await base44.functions.invoke('sendDailyEmail', { test: true, appUrl: appOrigin() });
      res.data?.success ? showResult(true, `Test email sent to ${res.data.sent_to}. Check your inbox.`) : showResult(false, res.data?.error || 'Something went wrong.');
    } catch (e) { showResult(false, e.response?.data?.error || e.message); }
    setDailyTesting(false);
  };

  const sendDailyAll = async () => {
    if (!window.confirm('Send today\'s email to ALL users with a natal chart? This sends real emails.')) return;
    setDailySending(true); setResult(null);
    try {
      const res = await base44.functions.invoke('sendDailyEmail', { appUrl: appOrigin() });
      res.data?.success ? showResult(true, `Sent ${res.data.sent} emails (${res.data.skipped} skipped).`) : showResult(false, res.data?.error || 'Something went wrong.');
    } catch (e) { showResult(false, e.response?.data?.error || e.message); }
    setDailySending(false);
  };

  const sendDigestTest = async (type) => {
    const fn = type === 'weekly' ? 'sendWeeklyEmail' : 'sendMonthlyEmail';
    if (type === 'weekly') setWeeklyTesting(true); else setMonthlyTesting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke(fn, { test: true, appUrl: appOrigin() });
      res.data?.success ? showResult(true, `Test ${type} digest sent to ${res.data.sent_to}. Check your inbox.`) : showResult(false, res.data?.error || 'Something went wrong.');
    } catch (e) { showResult(false, e.response?.data?.error || e.message); }
    if (type === 'weekly') setWeeklyTesting(false); else setMonthlyTesting(false);
  };

  const sendOnboarding = async () => {
    setOnboardingSending(true); setResult(null);
    try {
      const payload = { appUrl: appOrigin() };
      if (onboardingEmail.trim()) {
        const users = await base44.entities.User.filter({ email: onboardingEmail.trim() });
        if (!users?.length) { showResult(false, `No user found for "${onboardingEmail.trim()}".`); setOnboardingSending(false); return; }
        payload.user_id = users[0].id;
      } else {
        payload.test = true;
      }
      const res = await base44.functions.invoke('sendChartRecapEmail', payload);
      res.data?.success ? showResult(true, `Onboarding recap sent to ${res.data.sent_to}.`) : showResult(false, res.data?.error || res.data?.skipped || 'Something went wrong.');
    } catch (e) { showResult(false, e.response?.data?.error || e.message); }
    setOnboardingSending(false);
  };

  return (
    <div className="px-5 py-4 space-y-5 max-w-xl">

      {/* Daily Email */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
          <Mail size={16} className="text-gold-accent" />
          <h2 className="font-display text-base font-bold text-white">Daily Email</h2>
        </div>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          Personalized daily transits, planetary ingresses, AI synthesis, and a quiz link — sent every morning to users with a natal chart.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={sendDailyTest} disabled={dailyTesting} className="bg-gold-primary hover:bg-gold-accent text-deep-blue font-body font-semibold">
            {dailyTesting ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Sending...</> : <><Send size={14} className="mr-1.5" /> Send test to myself</>}
          </Button>
          <Button onClick={sendDailyAll} disabled={dailySending} variant="outline" className="border-gold-primary/40 text-white font-body">
            {dailySending ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Sending...</> : <><Users size={14} className="mr-1.5" /> Send to all users</>}
          </Button>
        </div>
      </div>

      {/* Weekly & Monthly Digests */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
          <CalendarRange size={16} className="text-gold-accent" />
          <h2 className="font-display text-base font-bold text-white">Weekly &amp; Monthly Digests</h2>
        </div>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          Weekly digest every Monday at 7am CT — 7-day breakdown, ingresses, stations, key themes. Monthly digest on the 1st — lunations, week-by-week arc, timing windows.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendDigestTest('weekly')} disabled={weeklyTesting} className="bg-gold-primary hover:bg-gold-accent text-deep-blue font-body font-semibold">
            {weeklyTesting ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Generating...</> : <><Send size={14} className="mr-1.5" /> Send weekly test</>}
          </Button>
          <Button onClick={() => sendDigestTest('monthly')} disabled={monthlyTesting} className="bg-gold-primary hover:bg-gold-accent text-deep-blue font-body font-semibold">
            {monthlyTesting ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Generating...</> : <><Send size={14} className="mr-1.5" /> Send monthly test</>}
          </Button>
        </div>
      </div>

      {/* Onboarding Recap */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
          <Sparkles size={16} className="text-gold-accent" />
          <h2 className="font-display text-base font-bold text-white">Onboarding Recap</h2>
        </div>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          The detailed birth-chart recap email sent to new users after onboarding. Leave the email blank to send a test to yourself, or enter a user's email to resend it to them.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={onboardingEmail}
            onChange={e => setOnboardingEmail(e.target.value)}
            placeholder="user email (optional)"
            className="flex-1 min-w-[200px] h-9 rounded-md px-3 font-body text-sm bg-white/5 border border-white/15 text-white placeholder:text-white/30 outline-none"
          />
          <Button onClick={sendOnboarding} disabled={onboardingSending} className="bg-gold-primary hover:bg-gold-accent text-deep-blue font-body font-semibold">
            {onboardingSending ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Sending...</> : <><Send size={14} className="mr-1.5" /> Send onboarding recap</>}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`celestial-card p-4 flex items-start gap-2 ${result.ok ? 'border border-green-500/30' : 'border border-red-500/30'}`}>
          {result.ok ? <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" /> : <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
          <p className="font-body text-sm text-white/80">{result.msg}</p>
        </div>
      )}
    </div>
  );
}