import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getEffectiveTier } from '@/lib/permissions';
import { base44 } from '@/api/base44Client';
import { getPlatform } from '@/lib/platform';
import { Sparkles, CalendarDays, Check, ArrowLeft, Loader2, Zap, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { track, EVENTS } from '@/lib/analytics';
import EventGiftPanel from '@/components/events/EventGiftPanel';
import { resolveSkuId } from '@/lib/eventTag';

// What each tier actually delivers (aligned with Landing + what's built)
// Internal keys `interpret` / `calendar` are retained for backend/Stripe compat.
const PLANS = [
  {
    tier: 'interpret',
    label: 'Core',
    price: '$5.55',
    foundingPrice: '$5.55',
    yearlyPrice: '$55',
    period: '/mo',
    foundingNote: 'Your founding rate · locked in forever',
    regularNote: 'Cancel anytime',
    icon: <Sparkles size={18} className="text-celestial-blue" />,
    color: 'border-celestial-blue/40',
    highlight: true,
    features: [
      { text: 'Everything in Free', ready: true },
      { text: 'Interactive chart wheel', ready: true },
      { text: 'Full natal chart interpretations (all planets)', ready: true },
      { text: 'Transit interpretations on demand', ready: true },
      { text: 'Personalized daily quiz (based on your natal chart)', ready: true },
      { text: 'Synastry & event charts', ready: true },
      { text: 'House system choice (Placidus + more coming)', ready: true },
      { text: 'Switch your chart\'s tradition — Modern, Hellenistic, or Vedic (sidereal + whole-sign)', ready: true },
      { text: 'Planner (month, week, and day views)', ready: true },
      { text: 'Calendar sync (ICS + Google Calendar)', ready: true },
      { text: 'Chart Navigator chatbot', ready: true },
      { text: 'Streak bonus content (unlocks at 7-day streak)', ready: true },
    ],
  },
  {
    tier: 'calendar',
    label: 'Premium',
    price: '$7.77',
    foundingPrice: '$7.77',
    yearlyPrice: '$77',
    period: '/mo',
    foundingNote: 'Your founding rate · locked in forever',
    regularNote: 'Cancel anytime',
    icon: <CalendarDays size={18} className="text-gold-accent" />,
    color: 'border-gold-primary/60',
    highlight: false,
    features: [
      { text: 'Everything in Core', ready: true },
      { text: 'Black Moon Lilith (placements, transits & interpretations)', ready: true },
      { text: 'Asteroid pack — Juno, Pallas, Vesta & Tyche (natal placements, transits & interpretations)', ready: true },
      { text: 'Early access to new features', ready: false },
      { text: 'Private community (Discord/Subreddit)', ready: false },
      { text: 'Founding patron recognition in-app', ready: false },
    ],
  },
];

export default function Subscribe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const effectiveTier = getEffectiveTier(user);
  const [loading, setLoading] = useState(null);
  const [purchaseAgeConfirmed, setPurchaseAgeConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'yearly'
  const [eventCtx, setEventCtx] = useState({ event: null, signup: null });
  const [stalled, setStalled] = useState(false);
  const stallTimer = useRef(null);
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';
  const storeLabel = platform === 'ios' ? 'via App Store' : platform === 'android' ? 'via Google Play' : '';
  const settingsLabel = platform === 'ios' ? 'App Store' : platform === 'android' ? 'Google Play' : "the app's Stripe billing portal (Profile → Manage billing)";
  // All current beta users are founding members — at launch, new signups
  // within 30 days of launch date will also qualify; after that window closes,
  // is_founding_member will be false for new users.
  const isFoundingMember = !!user?.is_founding_member;

  useEffect(() => {
    track(EVENTS.SUBSCRIBE_VIEWED, { current_tier: effectiveTier, is_founding_member: isFoundingMember });
  }, []);

  const handleSelect = async (tier) => {
    if (!purchaseAgeConfirmed) return;
    track(EVENTS.SUBSCRIPTION_STARTED, { tier, founding: true, billing });
    setLoading(tier);
    setCheckoutError(null);
    setStalled(false);
    // Weak-connectivity fallback: surface the event promo code instead of a spinner
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => setStalled(true), 75000);
    try {
      let origin;
      try { origin = window.top.location.origin; } catch { origin = window.location.origin; }
      const signup = eventCtx.signup;
      const res = await base44.functions.invoke('createCheckoutSession', {
        tier,
        period: billing,
        successUrl: signup ? `${origin}/moment?success=true` : `${origin}/profile?success=true&tier=${tier}`,
        cancelUrl: `${origin}/subscribe`,
        ...(signup ? {
          eventSignup: {
            ...signup,
            sku_id: resolveSkuId(signup.event_id, tier, billing, signup.metal, signup.jewelry, signup.signup_channel),
          },
        } : {}),
      });
      const url = res.data?.url;
      if (!url) throw new Error('No checkout URL returned');
      window.top.location.href = url;
    } catch (err) {
      console.error('Checkout session error:', err);
      setCheckoutError('We couldn\'t start checkout. Please try again in a moment.');
      if (stallTimer.current) clearTimeout(stallTimer.current);
      setStalled(false);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="border-b border-white/[0.08] px-4 pt-12 pb-6" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-brass/60 hover:text-brass font-body text-xs mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="text-center space-y-1.5">
          <div className="text-2xl text-gold-accent font-display">✦</div>
          <h1 className="font-display text-2xl font-bold text-cream">Unlock Astrosetta</h1>
          <p className="font-body text-sm text-brass/70">Choose the plan that fits your practice</p>
          {isFoundingMember && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full font-body text-xs" style={{ background: 'rgba(201,169,97,0.12)', border: '1px solid rgba(201,169,97,0.3)', color: '#C9A961' }}>
              <Lock size={10} /> Founding member pricing applied below
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-7 space-y-4">

        {/* Founding member / beta notice */}
        {isFoundingMember ? (
          <div className="rounded-xl border border-gold-accent/30 bg-gold-accent/8 p-3 flex items-start gap-2.5">
            <Lock size={13} className="text-gold-accent shrink-0 mt-0.5" />
            <p className="font-body text-xs text-white/70 leading-relaxed">
              <span className="text-gold-accent font-semibold">You're a founding member. </span>
              Your rate is locked in forever — choose a plan below to subscribe and keep it for life.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 p-3 flex items-start gap-2.5">
            <Clock size={13} className="text-gold-accent shrink-0 mt-0.5" />
            <p className="font-body text-xs text-white/70 leading-relaxed">
              <span className="text-gold-accent font-semibold">Start free, upgrade anytime. </span>
              Founding members lock in the rates shown below forever.
            </p>
          </div>
        )}

        {/* Event gift panel — pop-up signups (QR tag, in-event tap, or promo code) */}
        <EventGiftPanel billing={billing} user={user} onEventContext={setEventCtx} />

        {/* Free plan */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold text-cream">Free <span className="font-body text-xs text-brass/50 font-normal ml-1">Free forever</span></p>
              <ul className="mt-1.5 space-y-1">
                {['Natal chart placements', 'Big Three interpretations (Sun, Moon, Rising)', 'Arabic Lots (Fortune, Spirit, Eros & Necessity) & lunar nodes', 'Knowledge Density slider (Essential → Technical)', 'Daily horoscope', 'Transit list (no interpretations)', 'Full learning curriculum', 'Daily quiz', 'Journal'].map(f => (
                  <li key={f} className="flex items-center gap-1.5 font-body text-xs text-white/60">
                    <Check size={10} className="text-brass/50 shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            {effectiveTier === 'free' && (
              <span className="font-body text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5 shrink-0 ml-3">Current</span>
            )}
          </div>
        </div>

        <OrnamentDivider />

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-full bg-white/[0.04] border border-white/[0.08] max-w-xs mx-auto">
          {['monthly', 'yearly'].map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`flex-1 py-1.5 rounded-full font-body text-xs transition-all flex items-center justify-center gap-1.5 ${
                billing === b ? 'bg-gold-primary/20 text-cream font-semibold' : 'text-brass/50'
              }`}
            >
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
              {b === 'yearly' && <span className="text-[9px] text-green-400">2 months free</span>}
            </button>
          ))}
        </div>

        {/* Paid plans */}
        {PLANS.map((plan) => {
          const isCurrent = effectiveTier === plan.tier;
          const isLoading = loading === plan.tier;
          const displayPrice = billing === 'yearly'
            ? plan.yearlyPrice
            : (isFoundingMember ? plan.foundingPrice : plan.price);
          const displayPeriod = billing === 'yearly' ? '/yr' : plan.period;

          return (
            <div
              key={plan.tier}
              className={`rounded-xl border-2 p-5 bg-white/[0.04] backdrop-blur-sm transition-all ${
                plan.highlight ? plan.color + ' shadow-md' : plan.color
              } ${isCurrent ? 'opacity-70' : ''}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {plan.icon}
                  <h2 className="font-display text-lg font-bold text-cream">{plan.label}</h2>
                  {isCurrent && (
                    <span className="font-body text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">Current</span>
                  )}
                  {plan.highlight && !isCurrent && (
                    <span className="font-body text-[10px] text-gold-accent bg-gold-primary/10 border border-gold-primary/30 rounded-full px-2 py-0.5">Popular</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-cream">{displayPrice}</span>
                    <span className="font-body text-xs text-brass/60">{displayPeriod}</span>
                  </div>
                </div>
              </div>

              {/* Founding lock note */}
              {isFoundingMember ? (
                <div className="flex items-center gap-1 mb-4">
                  <Lock size={9} className="text-gold-accent" />
                  <p className="font-body text-[10px] text-gold-accent/70">
                    {billing === 'yearly' ? 'Yearly founding rate · locked in forever' : plan.foundingNote}
                  </p>
                </div>
              ) : (
                <p className="font-body text-[10px] text-brass/40 mb-4">
                  {billing === 'yearly' ? `billed yearly · 2 months free · ${plan.regularNote}` : plan.regularNote}
                </p>
              )}

              {/* Feature list */}
              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 font-body text-sm">
                    {f.ready ? (
                      <Check size={13} className="text-gold-accent shrink-0" />
                    ) : (
                      <Clock size={13} className="text-brass/30 shrink-0" />
                    )}
                    <span className={f.ready ? 'text-cream/80' : 'text-brass/35 italic'}>
                      {f.text}{!f.ready && ' (coming soon)'}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full text-center py-2 font-body text-sm text-brass/60">
                  You're on this plan
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-2.5 cursor-pointer mb-3">
                    <input type="checkbox" id={`purchase-age-${plan.tier}`}
                      className="mt-0.5 w-4 h-4 rounded border-white/20 bg-transparent text-gold-primary focus:ring-gold-accent shrink-0"
                      checked={purchaseAgeConfirmed}
                      onChange={(e) => setPurchaseAgeConfirmed(e.target.checked)} />
                    <span className="font-body text-[11px] text-brass/50 leading-relaxed">
                      I confirm I am at least <strong className="text-white/70">18 years old</strong> and authorized to make this purchase.
                    </span>
                  </label>
                  <Button
                    onClick={() => handleSelect(plan.tier)}
                    disabled={!!loading || !purchaseAgeConfirmed}
                    className={`w-full font-display font-bold text-base py-3 ${
                      plan.highlight
                        ? 'bg-gold-primary hover:bg-gold-accent text-cream'
                        : 'bg-deep-blue hover:bg-deep-blue/90 text-cream'
                    }`}
                  >
                    {isLoading ? (
                      <><Loader2 size={16} className="animate-spin mr-2" /> Redirecting...</>
                    ) : (
                      <><Zap size={15} className="mr-1.5" /> {isFoundingMember ? 'Lock In Founding Rate' : `Get ${plan.label}`}</>
                    )}
                  </Button>
                </>
              )}
            </div>
          );
        })}

        {stalled && (
          <div className="rounded-lg border border-gold-primary/30 bg-gold-primary/10 p-3 text-center">
            <p className="font-body text-xs text-white/70">
              {eventCtx?.event ? (
                <>Taking a while? Grab code <span className="text-gold-accent font-semibold">{eventCtx.event.promo_code}</span> and finish this at home — your founding spot is held until {new Date(eventCtx.event.promo_valid_until + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</>
              ) : (
                'Checkout is taking a while — check your connection and try again in a moment.'
              )}
            </p>
          </div>
        )}

        {checkoutError && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-center">
            <p className="font-body text-xs text-red-300">{checkoutError}</p>
          </div>
        )}

        <p className="font-body text-[11px] text-brass/40 text-center pt-2">
          {isNative
            ? `Payments processed securely ${storeLabel} · Cancel anytime`
            : 'Payments processed securely by Stripe · Cancel anytime'}
        </p>

        {/* Pre-purchase subscription disclosure (App Store required) */}
        <div className="rounded-xl border border-gold-primary/15 bg-gold-primary/[0.04] p-3.5 space-y-2">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">Subscription terms</p>
          <p className="font-body text-[11px] text-white/60 leading-relaxed">
            Core and Premium are auto-renewing subscriptions: $5.55/month or $55/year for Core, and $7.77/month or
            $77/year for Premium — yearly plans include two months free (a founding rate, when shown, is locked in for life). Payment is charged to your
            payment method at confirmation of purchase, and each subscription automatically renews until cancelled
            at least 24 hours before the current period ends. Cancel anytime in your {settingsLabel} subscription
            settings — cancelling stops future renewals and your access continues to the end of the paid period.
          </p>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
            <Link to="/terms" className="font-body text-[11px] text-gold-accent underline hover:text-gold-primary">Terms of Service</Link>
            <Link to="/privacy" className="font-body text-[11px] text-gold-accent underline hover:text-gold-primary">Privacy Policy</Link>
            <Link to="/refund-policy" className="font-body text-[11px] text-gold-accent underline hover:text-gold-primary">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}