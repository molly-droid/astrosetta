import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { track } from '@/lib/analytics';

const STEP_KEY = 'astrosetta_quick_tip_step';
const TYPE_KEY = 'astrosetta_quick_tip_type';

const TIPS = {
  sync_calendar: [
    {
      badge: 'Quick Tip',
      title: 'Sync Your Calendar',
      description:
        'See your astrological transits right alongside your real schedule — so you always know what cosmic energies are at play for your meetings, dates, and big events.',
      bullets: [
        'Open your Profile → Calendar Sync section',
        'Connect your Google Calendar with one click',
        'Your daily synthesis appears as calendar events automatically',
        'Works with Day, Week, and Month Planner views',
      ],
      cta_label: 'Go to Calendar Sync',
      cta_link: '/profile',
    },
  ],
  homescreen: [
    {
      badge: 'Quick Tip',
      title: 'Save to Your Home Screen',
      description:
        "Install Astrosetta as a native-style app on your phone — it launches full-screen, no browser needed. It feels like a real app, and it's free.",
      bullets: [
        'iPhone: tap the Share icon → "Add to Home Screen"',
        'Android: tap the browser menu → "Install app" or "Add to Home screen"',
        'Desktop: click the install icon in the address bar',
        'Launch it anytime from your home screen — full-screen, fast',
      ],
      cta_label: null,
      cta_link: null,
    },
  ],
};

export function startQuickTip(tipKey) {
  localStorage.setItem(TYPE_KEY, tipKey);
  localStorage.setItem(STEP_KEY, '0');
  track('quick_tip_started', { tip: tipKey });
  window.dispatchEvent(new CustomEvent('quick-tip-start'));
}

export default function QuickTipTour() {
  const navigate = useNavigate();
  const [tipKey, setTipKey] = useState(null);
  const [step, setStep] = useState(null);

  useEffect(() => {
    const check = () => {
      const key = localStorage.getItem(TYPE_KEY);
      const val = localStorage.getItem(STEP_KEY);
      if (key && val !== null) {
        setTipKey(key);
        setStep(parseInt(val, 10));
      } else {
        setTipKey(null);
        setStep(null);
      }
    };
    check();
    window.addEventListener('quick-tip-start', check);
    return () => window.removeEventListener('quick-tip-start', check);
  }, []);

  const dismiss = () => {
    if (tipKey) track('quick_tip_dismissed', { tip: tipKey, step });
    localStorage.removeItem(STEP_KEY);
    localStorage.removeItem(TYPE_KEY);
    setTipKey(null);
    setStep(null);
  };

  if (tipKey === null || step === null) return null;

  const steps = TIPS[tipKey];
  if (!steps) return null;
  const s = steps[step];
  if (!s) return null;

  const handleCta = () => {
    track('quick_tip_cta', { tip: tipKey });
    if (s.cta_link) {
      dismiss();
      navigate(s.cta_link);
    } else {
      dismiss();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10003] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gold-primary/40 shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a2847 0%, #0f1a2e 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={16} className="text-brass/60" />
        </button>

        <div className="relative px-6 pt-8 pb-6 space-y-4">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-primary/15 border border-gold-accent/30">
              <Sparkles size={11} className="text-gold-accent" />
              <span className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                {s.badge}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold text-cream leading-tight">{s.title}</h2>
            <p className="font-body text-sm text-brass leading-relaxed">{s.description}</p>
          </div>

          {s.bullets?.length > 0 && (
            <div className="space-y-2">
              {s.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-gold-accent text-[10px] mt-0.5">✦</span>
                  <p className="font-body text-[11px] text-brass/80 leading-snug">{b}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {s.cta_label && (
              <button
                onClick={handleCta}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #D4AF85, #C9A961)',
                  color: '#0f1a2e',
                }}
              >
                {s.cta_label}
                <ArrowRight size={14} />
              </button>
            )}
            <button
              onClick={dismiss}
              className="w-full py-2 rounded-xl font-body text-xs text-brass/50 hover:text-brass transition-colors"
            >
              {s.cta_label ? 'Maybe later' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}