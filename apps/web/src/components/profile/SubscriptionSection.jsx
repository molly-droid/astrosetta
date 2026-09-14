import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getEffectiveTier } from '@/lib/permissions';
import { Sparkles, CalendarDays, Check, Zap, Scroll, ArrowRight, Lock, AlertCircle, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import PaywallModal from '@/components/paywall/PaywallModal';
import DowngradeSurveyModal from '@/components/profile/DowngradeSurveyModal';
import { isNativePlatform } from '@/lib/platform';
import { restorePurchases } from '@/lib/restorePurchases';

const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: null,
    icon: null,
    tier: 'free',
    features: [
      'Natal chart placements',
      'Big Three interpretations (Sun, Moon, Rising)',
      'Arabic Lots (Fortune, Spirit, Eros & Necessity) & lunar nodes',
      'Knowledge Density slider (Essential → Technical)',
      'Daily horoscope',
      'Transit list (no interpretations)',
      'Full learning curriculum',
      'Daily quiz',
      'Journal',
    ],
  },
  {
    id: 'interpret',
    label: 'Core',
    price: '$5.55/mo',
    icon: <Sparkles size={14} className="text-celestial-blue" />,
    tier: 'interpret',
    highlight: true,
    features: [
      'Everything in Free',
      'Interactive chart wheel',
      'Full natal chart interpretations (all planets)',
      'Transit interpretations on demand',
      'Personalized daily quiz',
      'Synastry & event charts',
      'House system choice (Placidus + more coming)',
      "Switch your chart's tradition — Modern, Hellenistic, or Vedic",
      'Planner (month, week, day views)',
      'Calendar sync (ICS + Google Calendar)',
      'Chart Navigator chatbot',
    ],
  },
  {
    id: 'calendar',
    label: 'Premium',
    price: '$7.77/mo',
    icon: <CalendarDays size={14} className="text-gold-accent" />,
    tier: 'calendar',
    highlight: false,
    features: [
      'Everything in Core',
      'Black Moon Lilith (placements, transits & interpretations)',
      'Asteroid pack — Juno, Pallas, Vesta & Tyche',
      'Early access to new features',
      'Private community (Discord/Subreddit) — coming soon',
      'Founding patron recognition in-app',
    ],
  },
];

const TIER_ORDER = ['free', 'interpret', 'calendar'];

const FOUNDING_PRICE = { interpret: '$5.55/mo', calendar: '$7.77/mo' };

// Stored landing-page preference → plan label, used to nudge founding members
// toward the tier they already picked.
const PREFERENCE_MAP = {
  core: { tier: 'interpret', label: 'Core' },
  pro: { tier: 'calendar', label: 'Premium' },
};

// What a lapsed paid subscriber keeps vs loses when they drop back to Free.
const LAPSED_COPY = {
  interpret: {
    label: 'Core',
    keeps: ['Natal chart placements', 'Big Three interpretations', 'Daily horoscope', 'Transit list', 'Full curriculum', 'Daily quiz', 'Journal'],
    loses: ['Full natal interpretations', 'Transit interpretations', 'Interactive chart wheel', 'Synastry & event charts', 'Planner & calendar sync', 'Chart Navigator'],
  },
  calendar: {
    label: 'Premium',
    keeps: ['Natal chart placements', 'Big Three interpretations', 'Daily horoscope', 'Transit list', 'Full curriculum', 'Daily quiz', 'Journal'],
    loses: ['Everything in Core', 'Black Moon Lilith', 'Asteroid pack', 'Monthly feature vote', 'Early access', 'Private community'],
  },
};

export default function SubscriptionSection() {
  const { user, reloadUser } = useAuth();
  const navigate = useNavigate();
  const effectiveTier = getEffectiveTier(user);
  // Real (stored) tier drives the management + lapsed surfaces so they stay
  // hidden during prep (when BETA_ALL_PAID forces effectiveTier to 'calendar'
  // but no one has actually paid). At launch these flip on automatically.
  const realTier = user?.subscription_tier || 'free';
  const isExpired = realTier !== 'free' && effectiveTier === 'free';
  const currentIndex = TIER_ORDER.indexOf(effectiveTier);
  const isFoundingMember = !!user?.is_founding_member;
  const preference = PREFERENCE_MAP[user?.founding_tier_preference];

  const [paywall, setPaywall] = useState(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      let origin;
      try { origin = window.top.location.origin; } catch { origin = window.location.origin; }
      const res = await base44.functions.invoke('createCustomerPortalSession', {
        returnUrl: `${origin}/profile`,
      });
      window.top.location.href = res.data.url;
    } catch (err) {
      setPortalError('Could not open the billing portal. Please try again or contact support.');
      setPortalLoading(false);
    }
  };

  // Apple-required restore action for auto-renewable subscriptions (native only)
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setRestoreMsg(null);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success) {
      setRestoreMsg(`Your ${result.tier === 'calendar' ? 'Premium' : 'Core'} subscription is restored.`);
      reloadUser?.();
    } else if (result.reason === 'unavailable') {
      setRestoreMsg('Purchases can only be restored in the installed app.');
    } else {
      setRestoreMsg('No previous purchases were found from the App Store or Google Play.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Founding member / start-free banner (replaces the old beta-unlock banner) */}
      {isFoundingMember ? (
        <div className="rounded-xl border border-gold-primary/40 bg-gold-primary/8 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-gold-accent" />
            <p className="font-display text-sm font-bold text-gold-accent">You're a founding member</p>
          </div>
          <p className="font-body text-xs text-white/70 leading-relaxed">
            Lock in your founding rate — {FOUNDING_PRICE.interpret} for Core or {FOUNDING_PRICE.calendar} for Premium — forever. Your rate stays with you for life.
          </p>
          {preference && (
            <button
              onClick={() => navigate('/subscribe')}
              className="inline-flex items-center gap-1 font-body text-xs text-gold-accent hover:text-cream transition-colors"
            >
              You picked {preference.label} — lock in your rate <ArrowRight size={11} />
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 p-3.5 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-gold-accent text-sm">✦</span>
            <p className="font-display text-sm font-bold text-gold-accent">Start free, upgrade anytime</p>
          </div>
          <p className="font-body text-xs text-white/70 leading-relaxed">
            Create your chart free. Subscribe when you're ready to unlock the full toolkit — cancel anytime.
          </p>
        </div>
      )}

      {/* Three Traditions callout */}
      <div className="rounded-xl border p-3.5 flex flex-row items-start gap-3" style={{ background: 'rgba(201,169,97,0.06)', border: '1px solid rgba(201,169,97,0.25)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,169,97,0.12)' }}>
          <Scroll size={16} className="text-gold-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[0.625rem] uppercase tracking-widest text-gold-accent font-semibold mb-0.5">New · Three Traditions</p>
          <p className="font-display text-sm font-bold text-white leading-tight">Modern, Hellenistic &amp; Vedic</p>
          <p className="font-body text-[0.6875rem] text-white/55 leading-relaxed mt-1">
            <span className="text-cream font-semibold">Free</span> — explore the Traditions curriculum in Learn.{' '}
            <span className="text-cream font-semibold">Core &amp; Premium</span> — switch your live chart's tradition above; the canonical zodiac and house system apply automatically.
          </p>
          <button
            onClick={() => navigate('/learn?section=traditions')}
            className="mt-2 inline-flex items-center gap-1 font-body text-[0.6875rem] text-gold-accent hover:text-cream transition-colors"
          >
            Explore the curriculum <ArrowRight size={11} />
          </button>
        </div>
      </div>

      {/* Lapsed-tier downgrade notice */}
      {isExpired && LAPSED_COPY[realTier] && (
        <div className="rounded-xl border border-red-300/30 bg-red-500/5 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" />
            <p className="font-display text-sm font-bold text-red-300">Your {LAPSED_COPY[realTier].label} subscription has lapsed</p>
          </div>
          <p className="font-body text-xs text-white/60 leading-relaxed">
            You're now on the Free plan. Here's what changed:
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest text-green-400/70 mb-1">You keep</p>
              <ul className="space-y-0.5">
                {LAPSED_COPY[realTier].keeps.map(f => (
                  <li key={f} className="font-body text-[11px] text-white/55 flex items-start gap-1">
                    <Check size={9} className="text-green-400/60 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-body text-[10px] uppercase tracking-widest text-red-400/70 mb-1">You lost</p>
              <ul className="space-y-0.5">
                {LAPSED_COPY[realTier].loses.map(f => (
                  <li key={f} className="font-body text-[11px] text-white/40 flex items-start gap-1">
                    <span className="mt-px shrink-0">✕</span><span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            onClick={() => setPaywall({ variant: realTier === 'calendar' ? 'calendar' : 'interpret', fromTier: 'free' })}
            className="w-full mt-1 bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-sm h-9 font-semibold"
          >
            <Zap size={13} className="mr-1.5" /> Re-subscribe to {LAPSED_COPY[realTier].label}
          </Button>
        </div>
      )}

      {/* Current plan badge */}
      <div className="flex items-center justify-between">
        <p className="font-body text-[0.625rem] uppercase tracking-widest text-brass/50">Membership</p>
        <div className="flex items-center gap-1.5">
          {isExpired && (
            <span className="font-body text-[0.625rem] text-red-500 border border-red-300/40 rounded-full px-2 py-0.5">Expired</span>
          )}
          <span className={`font-body text-[0.625rem] font-semibold px-2.5 py-0.5 rounded-full border ${
            effectiveTier === 'calendar' ? 'bg-gold-primary/20 border-gold-primary/50 text-gold-accent' :
            effectiveTier === 'interpret' ? 'bg-celestial-blue/20 border-celestial-blue/40 text-white' :
            'bg-muted border-brass/30 text-brass'
          }`}>
            {effectiveTier === 'calendar' ? 'Premium' : effectiveTier === 'interpret' ? 'Core' : 'Free'}
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="space-y-2">
        {PLANS.map((plan) => {
          const planIndex = TIER_ORDER.indexOf(plan.tier);
          const isCurrent = plan.tier === effectiveTier;
          const isUpgrade = planIndex > currentIndex;

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-3.5 bg-white/[0.03] transition-all ${
                plan.highlight ? 'border-gold-primary/40' : 'border-white/[0.08]'
              } ${isCurrent ? 'opacity-90' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {plan.icon}
                    <span className="font-display text-sm font-bold text-white">{plan.label}</span>
                    {isCurrent && (
                      <span className="font-body text-[0.5625rem] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-1.5 py-0.5">Current</span>
                    )}
                    {isFoundingMember && !isCurrent && (
                      <Lock size={10} className="text-gold-accent/60" />
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 font-body text-[0.6875rem] text-brass/80">
                        <Check size={10} className="text-gold-accent mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {plan.price && <span className="font-display text-base font-bold text-white whitespace-nowrap">{plan.price}</span>}
                  {!isCurrent && isUpgrade && (
                    <Button
                      size="sm"
                      onClick={() => navigate('/subscribe')}
                      className="h-8 px-3 font-body text-xs bg-gold-primary hover:bg-gold-accent text-paper"
                    >
                      <Zap size={11} className="mr-1" /> Upgrade
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscription management (real paid subscribers only) */}
      {realTier !== 'free' && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard size={13} className="text-brass/60 shrink-0" />
              <p className="font-body text-xs text-white/70">Manage your subscription</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSurvey(true)}
              disabled={portalLoading}
              className="h-8 px-3 font-body text-xs border-gold-primary/30 text-brass shrink-0"
            >
              {portalLoading ? <><Loader2 size={12} className="animate-spin mr-1" /> Opening…</> : 'Manage billing'}
            </Button>
          </div>
          {portalError && (
            <p className="font-body text-[11px] text-red-400">{portalError}</p>
          )}
          <p className="font-body text-[10px] text-brass/40">Update your card, switch plans, or cancel anytime through Stripe's secure billing portal.</p>
          {isNativePlatform() && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
              <p className="font-body text-xs text-white/70">Restore in-app purchases</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRestore}
                disabled={restoring}
                className="h-8 px-3 font-body text-xs border-gold-primary/30 text-brass shrink-0"
              >
                {restoring ? <><Loader2 size={12} className="animate-spin mr-1" /> Restoring…</> : 'Restore'}
              </Button>
            </div>
          )}
          {restoreMsg && (
            <p className="font-body text-[11px] text-starlight-muted">{restoreMsg}</p>
          )}
        </div>
      )}

      <p className="font-body text-[0.625rem] text-brass/40 text-center">
        Founding members lock in their rate forever when they subscribe. Cancel anytime.
      </p>

      {paywall && (
        <PaywallModal
          variant={paywall.variant}
          fromTier={paywall.fromTier}
          onClose={() => setPaywall(null)}
        />
      )}

      {showSurvey && (
        <DowngradeSurveyModal
          planLabel={realTier === 'calendar' ? 'Premium' : 'Core'}
          onClose={() => setShowSurvey(false)}
          onContinue={() => { setShowSurvey(false); handleManageBilling(); }}
        />
      )}
    </div>
  );
}