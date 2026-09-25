import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/AuthContext';
import { getPermissions } from '@/lib/permissions';

const STORAGE_KEY = 'astrosetta_full_tour_step';

/**
 * Builds the tour for the current user. Every bullet matches what their
 * subscription tier actually unlocks, and the tour ends with a short
 * upgrade teaser (skipped entirely for Premium subscribers).
 */
function buildTourSteps(user) {
  const { isCore, isPremium } = getPermissions(user);

  const pageSteps = [
    {
      page: '/home',
      title: 'Home Dashboard',
      description: 'Your daily celestial briefing — everything at a glance.',
      bullets: [
        "Today tab — your daily reading, sky highlights, and what the day's transits are up to",
        'Transits tab — active personal and collective aspects, planetary highlights, and sky formations',
        'Chart modes — switch between your natal chart, a live transit overlay, and the live sky',
        'Learn tab — the daily quiz to build your streak and earn XP',
        ...(isCore ? ['Transit interpretations on demand — what each aspect means for your chart'] : []),
      ],
    },
    {
      page: '/chart',
      title: 'Your Birth Chart',
      description: 'The map of your cosmic blueprint — explore every placement.',
      bullets: [
        'Interactive chart wheel — tap any planet, aspect line, or house',
        isCore
          ? 'Full interpretations for every planet and point in your chart'
          : 'Deep dives for your Big Three — Sun, Moon, and Rising',
        'Transit overlay and movement arcs — see where each planet is headed',
        ...(isCore ? ['Synastry & event charts — compare charts with partners, family, or pivotal moments'] : []),
        ...(isCore ? ["Switch traditions — Modern, Hellenistic, or Vedic recalibrates your chart's zodiac, houses, and rulerships"] : []),
        ...(isPremium ? ['Black Moon Lilith and the asteroid pack — Juno, Pallas, Vesta & Tyche'] : []),
      ],
    },
    {
      page: '/planner',
      title: 'The Planner',
      description: 'Plan your days, weeks, and months in harmony with the cosmos.',
      bullets: [
        'Day, Week, and Month views of what is happening in your sky',
        "Stations, ingresses, and lunations — the sky's big moments, called out",
        ...(isCore ? ['Personalized week and month synthesis — the story of the period ahead'] : []),
        ...(isCore ? ['Journal — capture notes alongside the sky that inspired them'] : []),
        ...(isCore ? ['Calendar sync — push your transits to Google Calendar or subscribe via ICS'] : []),
      ],
    },
    {
      page: '/learn',
      title: 'Learn',
      description: 'Your personal astrology school — master the craft at your own pace.',
      bullets: [
        'Full curriculum — foundations, planets, signs, houses, aspects, dynamics, classical techniques, and traditions',
        'Daily quiz tailored to your chart and the live sky — build your streak',
        'XP and levels — every module and quiz adds to the same meter, from Apprentice to Sage',
        "Practitioner's Lens — case-study challenges that unlock at 500 XP",
      ],
    },
    {
      page: '/profile',
      title: 'Profile & Settings',
      description: 'Personalize your experience and manage your account.',
      bullets: [
        'Birth data — update your info and regenerate your chart anytime',
        'Knowledge Density — scale every reading from plain-language Essential to full Technical',
        'Timezone, font size, and daily email digest preferences',
        'Plan — manage or upgrade your subscription',
      ],
    },
  ];
  pageSteps.forEach((s, i) => { s.badge = `Step ${i + 1} of ${pageSteps.length}`; });

  const steps = [
    {
      page: null,
      badge: 'Welcome',
      title: 'Welcome to Astrosetta',
      description:
        "Let's take a quick tour of everything your astrology companion can do — from your birth chart to daily transits, learning, and more. This takes about two minutes.",
    },
    ...pageSteps,
  ];

  if (!isPremium) {
    steps.push({
      page: null,
      badge: 'One more thing',
      title: isCore ? 'Go Premium' : 'Unlock the full sky',
      description: isCore ? 'Premium takes your practice deeper:' : 'Core unlocks the deeper tools:',
      bullets: isCore
        ? [
            'Black Moon Lilith — placements, transits, and interpretations',
            'Asteroid pack — Juno, Pallas, Vesta & Tyche',
            'Early access to new features',
            'Private community (coming soon) and founding patron recognition',
          ]
        : [
            'Interactive chart wheel with full natal interpretations',
            'The Planner — week and month synthesis, journal, and calendar sync',
            'Chart Navigator — ask anything about your chart',
            'Synastry & event charts, plus the three traditions',
            '…and Premium adds Black Moon Lilith, the asteroid pack, and early access',
          ],
      cta: { label: isCore ? 'Upgrade to Premium' : 'See Plans', to: '/subscribe' },
    });
  }

  steps.push({
    page: null,
    badge: 'Complete',
    title: "You're All Set!",
    description: `That's your tour! The bell icon shows what's new.${
      isCore ? " The floating compass is your Chart Navigator — ask it anything about astrology or your chart, anytime." : ''
    } Explore at your own pace, and welcome to Astrosetta.`,
  });

  return steps;
}

export function startFullAppTour() {
  localStorage.setItem(STORAGE_KEY, '0');
  track('full_app_tour_started', {});
  window.dispatchEvent(new CustomEvent('full-app-tour-start'));
}

export default function FullAppTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(null);

  const TOUR_STEPS = useMemo(
    () => buildTourSteps(user),
    [user?.id, user?.subscription_tier]
  );

  useEffect(() => {
    const check = () => {
      const val = localStorage.getItem(STORAGE_KEY);
      setStep(val !== null ? parseInt(val, 10) : null);
    };
    check();
    window.addEventListener('full-app-tour-start', check);
    return () => window.removeEventListener('full-app-tour-start', check);
  }, []);

  // Navigate to the step's page when step changes
  useEffect(() => {
    if (step === null) return;
    const s = TOUR_STEPS[step];
    if (!s || !s.page) return;
    if (location.pathname !== s.page) {
      navigate(s.page);
    }
  }, [step]);

  const dismiss = () => {
    track('full_app_tour_dismissed', { step });
    localStorage.removeItem(STORAGE_KEY);
    setStep(null);
  };

  const next = () => {
    if (step >= TOUR_STEPS.length - 1) {
      track('full_app_tour_completed', {});
      localStorage.removeItem(STORAGE_KEY);
      setStep(null);
      return;
    }
    const newStep = step + 1;
    localStorage.setItem(STORAGE_KEY, String(newStep));
    setStep(newStep);
  };

  const back = () => {
    if (step <= 0) return;
    const newStep = step - 1;
    localStorage.setItem(STORAGE_KEY, String(newStep));
    setStep(newStep);
  };

  const takeCta = (s) => {
    track('full_app_tour_cta', { to: s.cta.to });
    localStorage.removeItem(STORAGE_KEY);
    setStep(null);
    navigate(s.cta.to);
  };

  if (step === null) return null;

  const s = TOUR_STEPS[step];
  if (!s) return null;

  const isModal = !s.page;
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-up"
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
              <div className="space-y-1.5 text-left">
                {s.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gold-accent text-[10px] mt-0.5">✦</span>
                    <p className="font-body text-xs text-brass/90 leading-snug">{b}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {s.cta ? (
                <>
                  <button
                    onClick={() => takeCta(s)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90"
                    style={{
                      background: 'linear-gradient(135deg, #D4AF85, #C9A961)',
                      color: '#0f1a2e',
                    }}
                  >
                    {s.cta.label}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={next}
                    className="w-full py-2 rounded-xl font-body text-xs text-brass/50 hover:text-brass transition-colors"
                  >
                    Maybe later
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={next}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90"
                    style={{
                      background: 'linear-gradient(135deg, #D4AF85, #C9A961)',
                      color: '#0f1a2e',
                    }}
                  >
                    {isLast ? "Let's Go" : isFirst ? 'Start Tour' : 'Continue'}
                    <ArrowRight size={14} />
                  </button>
                  {!isLast && (
                    <button
                      onClick={dismiss}
                      className="w-full py-2 rounded-xl font-body text-xs text-brass/50 hover:text-brass transition-colors"
                    >
                      Skip tour
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Page step — bottom card with backdrop
  return (
    <>
      <div
        className="fixed inset-0 z-[10000] pointer-events-none"
        style={{ background: 'rgba(7, 16, 30, 0.5)' }}
      />

      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[10002] w-[calc(100%-2rem)] max-w-md animate-fade-up">
        <div
          className="relative rounded-2xl border border-gold-primary/40 shadow-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a2847 0%, #0f1a2e 100%)' }}
        >
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={14} className="text-brass/60" />
          </button>

          <div className="px-5 pt-5 pb-4 space-y-3">
            <div className="space-y-1.5 pr-6">
              <span className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                {s.badge}
              </span>
              <h2 className="font-display text-lg font-bold text-cream leading-tight">{s.title}</h2>
              <p className="font-body text-xs text-brass/80 leading-snug">{s.description}</p>
            </div>

            {s.bullets?.length > 0 && (
              <div className="space-y-1.5">
                {s.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-gold-accent text-[10px] mt-0.5">✦</span>
                    <p className="font-body text-[11px] text-brass/80 leading-snug">{b}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <div className="flex gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? 'w-4 bg-gold-accent' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={back}
                    className="flex items-center gap-1 font-body text-xs text-brass/60 hover:text-brass transition-colors px-2 py-1.5"
                  >
                    <ArrowLeft size={12} />
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 font-body text-xs font-semibold text-gold-accent hover:text-gold-primary transition-colors px-3 py-1.5 rounded-lg border border-gold-accent/30 hover:border-gold-accent/60"
                >
                  Next
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}