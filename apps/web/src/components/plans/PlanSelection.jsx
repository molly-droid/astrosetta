import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { hasFoundingRate } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { getPlatform } from '@/lib/platform';
import { purchasesEnabled, purchaseTier, getNativePriceString } from '@/lib/purchases';
import { restorePurchases } from '@/lib/restorePurchases';
import { track, EVENTS } from '@/lib/analytics';
import { resolveSkuId } from '@/lib/eventTag';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Sparkles, CalendarDays, Zap, Lock } from 'lucide-react';

/**
 * PlanSelection — the one plan-choice surface (F-01). Used as the onboarding
 * plan slide AND as the Subscribe page body, so upgrades use one flow with
 * the same copy everywhere; only the checkout route changes by platform
 * (iOS → StoreKit, Android → Play Billing, web → Stripe Checkout).
 *
 * Copy is final per the client's F-01 spec. Prices: native shows the store's
 * localized price (authoritative — Apple/Google price points differ slightly
 * from web); web shows founding $5.55/$7.77 ($8/$10 once the founding window
 * closes), yearly $55/$77 everywhere.
 */

const FREE_FEATURES = [
  'Your natal chart',
  'Big Three interpretations',
  'Daily horoscope',
  "Today's transits (list)",
  'Full learning curriculum + daily quiz',
  'Journal',
];

const TIER_LABELS = { free: 'Free', interpret: 'Core', calendar: 'Premium' };
const switchDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const PLANS = [
  {
    tier: 'interpret',
    label: 'Core',
    badge: 'Most popular',
    tagline: 'Read your own sky.',
    description: "You'll understand how today's planets activate your chart, and why some days feel the way they do.",
    price: '$8',
    foundingPrice: '$5.55',
    yearlyPrice: '$55',
    icon: <Sparkles size={18} className="text-celestial-blue" />,
    color: 'border-celestial-blue/40',
    highlight: true,
    everythingIn: 'Free',
    features: [
      'Transit interpretations for your chart',
      'Quizzes built from your transits',
      'Synastry: compare charts with people in your life',
      'Your choice of house system',
      'Planner + calendar sync',
      'Navigator: ask questions about your chart',
      'Streak bonus content',
    ],
    cta: 'Start Core',
  },
  {
    tier: 'calendar',
    label: 'Premium',
    badge: null,
    tagline: "Go deeper and help shape what's next.",
    description: "You'll understand the subtler layers of your chart: shadow, partnership, craft, and fortune.",
    price: '$10',
    foundingPrice: '$7.77',
    yearlyPrice: '$77',
    icon: <CalendarDays size={18} className="text-gold-accent" />,
    color: 'border-gold-primary/60',
    highlight: false,
    everythingIn: 'Core',
    features: [
      'Black Moon Lilith',
      'Asteroid pack: Juno, Pallas, Vesta, Tyche',
      'Early access to new features',
      'Monthly feature vote + private community',
      'Founder line + founding patron recognition',
    ],
    cta: 'Start Premium',
  },
];

export default function PlanSelection({ variant = 'page', onFree, onPurchased, onRestored, eventCtx = null, billing: billingProp, onBillingChange }) {
  const { user, reloadUser } = useAuth();
  const isOnboarding = variant === 'onboarding';
  const realTier = user?.subscription_tier || 'free';
  // Founding RATE, not cohort membership: a founder who lapsed and came
  // back pays standard prices (Molly, 2026-10-16).
  const isFoundingMember = hasFoundingRate(user);
  // Billing period is controllable from the parent (the Subscribe page shares
  // it with the event gift panel); standalone it manages its own state.
  const [billingState, setBillingState] = useState('monthly');
  const billing = billingProp ?? billingState;
  const setBilling = (b) => { setBillingState(b); onBillingChange?.(b); };
  const [loading, setLoading] = useState(null); // tier being purchased | 'restore'
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [planNotice, setPlanNotice] = useState(null); // informational, not an error
  const [noticeTier, setNoticeTier] = useState(null); // render the notice under this plan's card
  // A scheduled web (Stripe) downgrade: { tier, effective_at }. Fetched on
  // mount so the state survives reloads, kept in sync by the actions below.
  const [pendingChange, setPendingChange] = useState(null);
  const showNotice = (text, tier = null) => { setPlanNotice(text); setNoticeTier(tier); };
  const [stalled, setStalled] = useState(false);
  const stallTimer = useRef(null);
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';
  const cancelLine = platform === 'ios' ? 'your App Store settings'
    : platform === 'android' ? 'your Google Play subscriptions'
    : 'Account → Plan';

  // Store-localized price strings on native — the store price is authoritative.
  const [nativePrices, setNativePrices] = useState(null);
  useEffect(() => {
    if (!isNative || !purchasesEnabled()) return;
    let alive = true;
    (async () => {
      const [im, iy, cm, cy] = await Promise.all([
        getNativePriceString('interpret', 'monthly'),
        getNativePriceString('interpret', 'yearly'),
        getNativePriceString('calendar', 'monthly'),
        getNativePriceString('calendar', 'yearly'),
      ]);
      if (alive && (im || iy || cm || cy)) {
        setNativePrices({
          interpret: { monthly: im, yearly: iy },
          calendar: { monthly: cm, yearly: cy },
        });
      }
    })();
    return () => { alive = false; };
  }, [isNative]);

  useEffect(() => {
    if (isNative || isOnboarding) return;
    if (realTier === 'free' || user?.subscription_source !== 'stripe') return;
    let alive = true;
    base44.functions.invoke('changeSubscription', { action: 'status' })
      .then((res) => { if (alive) setPendingChange(res.data?.pending || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isNative, isOnboarding, realTier, user?.subscription_source]);

  const handleIapSelect = async (tier) => {
    track(EVENTS.SUBSCRIPTION_STARTED, { tier, founding: isFoundingMember, billing, store: platform, source: variant });
    setLoading(tier);
    setCheckoutError(null);
    showNotice(null);
    const result = await purchaseTier(tier, billing);
    if (result.success) {
      // Deferred plan change: the store accepted it but the old plan runs to
      // the end of the paid period. Say so — the tier won't move until then.
      if (result.deferredUntil && result.tier !== tier) {
        showNotice(`Done — your plan switches to ${TIER_LABELS[tier]} on ${switchDate(result.deferredUntil)}. You keep ${TIER_LABELS[result.tier]} until then.`, tier);
        setLoading(null);
        return;
      }
      // The authoritative tier update lands via the revenuecat-webhook Edge
      // Function; give it a few beats to reflect on the users row.
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const updated = await reloadUser?.();
        if (updated?.subscription_tier === tier) break;
      }
      onPurchased?.(tier);
      return;
    }
    // Cancel or failure: back to the cards with the selection kept — no error
    // wall (F-01 behavior). Failures get one quiet line.
    if (!result.cancelled) {
      console.error('IAP purchase error:', result.error);
      setCheckoutError('The purchase could not be completed. You have not been charged — please try again.');
    }
    setLoading(null);
  };

  // Plan CHANGE for an active web (Stripe) subscriber — never a second
  // checkout, which would open a second subscription alongside the first.
  const handleStripeChange = async (tier) => {
    track(EVENTS.SUBSCRIPTION_STARTED, { tier, founding: isFoundingMember, billing, source: variant, change: true });
    setLoading(tier);
    setCheckoutError(null);
    showNotice(null);
    try {
      const res = await base44.functions.invoke('changeSubscription', { tier, period: billing });
      if (res.data?.unchanged || res.data?.reverted) {
        showNotice(res.data.reverted
          ? `Your scheduled plan change is canceled — you stay on ${TIER_LABELS[tier]}.`
          : `You're already on ${TIER_LABELS[tier]}.`, tier);
        if (res.data.reverted) setPendingChange(null);
        await reloadUser?.(); // the server just re-projected the tier from Stripe
      } else if (res.data?.deferred) {
        showNotice(`Done — your plan switches to ${TIER_LABELS[tier]} on ${switchDate(res.data.effective_at)}. You keep ${TIER_LABELS[realTier]} until then.`, tier);
        setPendingChange({ tier, effective_at: res.data.effective_at });
      } else {
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 1500));
          const updated = await reloadUser?.();
          if (updated?.subscription_tier === tier) break;
        }
        onPurchased?.(tier);
        return;
      }
    } catch (err) {
      console.error('Plan change error:', err);
      if (err?.status === 409) {
        // No live Stripe subscription after all (lapsed mid-session) — a fresh
        // checkout is the right flow; fall through to it.
        setLoading(null);
        await startCheckout(tier);
        return;
      }
      setCheckoutError("We couldn't change your plan. Please try again, or use Manage billing in your profile.");
    }
    setLoading(null);
  };

  const handleSelect = async (tier) => {
    if (!ageConfirmed) return;
    showNotice(null);
    const source = user?.subscription_source;
    const hasPaidPlan = realTier !== 'free';
    if (isNative && purchasesEnabled()) {
      // An active subscription from ANOTHER biller can't be replaced by this
      // store — buying here would stack a second subscription on top of it.
      if (hasPaidPlan && source === 'stripe') {
        showNotice('Your subscription is billed on the web. To change plans, open astrosetta.com → Profile → Membership.', tier);
        return;
      }
      if (hasPaidPlan && ((platform === 'ios' && source === 'google') || (platform === 'android' && source === 'apple'))) {
        showNotice(`Your subscription is billed through ${source === 'apple' ? 'the App Store' : 'Google Play'}. Change your plan on the device you subscribed on, or cancel it there first.`, tier);
        return;
      }
      await handleIapSelect(tier);
      return;
    }
    if (hasPaidPlan && (source === 'apple' || source === 'google')) {
      showNotice(`Your subscription is billed through ${source === 'apple' ? 'the App Store' : 'Google Play'}. Change your plan in the Astrosetta app on your phone, or in your ${source === 'apple' ? 'App Store' : 'Google Play'} subscription settings.`, tier);
      return;
    }
    if (hasPaidPlan && source === 'stripe') {
      await handleStripeChange(tier);
      return;
    }
    await startCheckout(tier);
  };

  const startCheckout = async (tier) => {
    track(EVENTS.SUBSCRIPTION_STARTED, { tier, founding: isFoundingMember, billing, source: variant });
    setLoading(tier);
    setCheckoutError(null);
    setStalled(false);
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => setStalled(true), 75000);
    try {
      let origin;
      try { origin = window.top.location.origin; } catch { origin = window.location.origin; }
      const signup = eventCtx?.signup;
      // Web checkout leaves the app; from onboarding the success return is
      // /home (the first-visit tour takes over there — same end state as the
      // confirmation slide), and cancel falls back to the Plan page.
      const successUrl = signup ? `${origin}/moment?success=true`
        : isOnboarding ? `${origin}/home?purchased=${tier}`
        : `${origin}/profile?success=true&tier=${tier}`;
      const res = await base44.functions.invoke('createCheckoutSession', {
        tier,
        period: billing,
        successUrl,
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
      setCheckoutError("We couldn't start checkout. Please try again in a moment.");
      if (stallTimer.current) clearTimeout(stallTimer.current);
      setStalled(false);
      setLoading(null);
    }
  };

  const handleRestore = async () => {
    setLoading('restore');
    setCheckoutError(null);
    const result = await restorePurchases();
    if (result.success) {
      await reloadUser?.();
      onRestored?.(result.tier);
    } else if (result.reason === 'none') {
      setCheckoutError('No previous purchases were found for this store account.');
    } else if (result.reason !== 'unavailable') {
      setCheckoutError('Restore did not complete — please try again.');
    }
    setLoading(null);
  };

  return (
    <div className="space-y-4">
      {/* Billing toggle — Monthly | Yearly (2 months free), default Monthly */}
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
            {b === 'yearly' && <span className="text-[0.5625rem] text-green-400">2 months free</span>}
          </button>
        ))}
      </div>

      {/* Free */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-cream">Free</h2>
            {!isOnboarding && realTier === 'free' && (
              <span className="font-body text-[0.625rem] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">Current</span>
            )}
          </div>
          <span className="font-display text-2xl font-bold text-cream">$0</span>
        </div>
        <p className="font-body text-xs text-white/75 mt-1 leading-relaxed">
          <em className="text-gold-accent not-italic font-semibold">Learn the language. </em>
          You'll understand the building blocks of astrology and what your Sun, Moon, and Rising say about you.
        </p>
        <ul className="mt-2.5 space-y-1">
          {FREE_FEATURES.map(f => (
            <li key={f} className="flex items-center gap-1.5 font-body text-xs text-white/60">
              <Check size={10} className="text-brass/50 shrink-0" />{f}
            </li>
          ))}
        </ul>
        {isOnboarding && (
          <Button
            onClick={() => onFree?.()}
            variant="outline"
            className="w-full mt-3 border-white/15 bg-transparent hover:bg-white/[0.06] text-cream font-display font-bold"
          >
            Start free
          </Button>
        )}
      </div>

      {/* Paid plans */}
      {PLANS.map((plan) => {
        const isCurrent = !isOnboarding && realTier === plan.tier;
        const isLoading = loading === plan.tier;
        const storePrice = nativePrices?.[plan.tier]?.[billing];
        const displayPrice = isNative ? storePrice || 'Price unavailable' : (billing === 'yearly'
          ? plan.yearlyPrice
          : (isFoundingMember ? plan.foundingPrice : plan.price));
        const displayPeriod = billing === 'yearly' ? '/yr' : '/mo';

        return (
          <div
            key={plan.tier}
            className={`rounded-xl border-2 p-5 bg-white/[0.04] backdrop-blur-sm transition-all ${plan.color} ${
              plan.highlight ? 'shadow-md' : ''
            } ${isCurrent ? 'opacity-70' : ''}`}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                {plan.icon}
                <h2 className="font-display text-lg font-bold text-cream">{plan.label}</h2>
                {isCurrent && (
                  <span className="font-body text-[0.625rem] text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">Current</span>
                )}
                {plan.badge && !isCurrent && (
                  <span className="font-body text-[0.625rem] text-gold-accent bg-gold-primary/10 border border-gold-primary/30 rounded-full px-2 py-0.5">{plan.badge}</span>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold text-cream">{displayPrice}</span>
                  <span className="font-body text-xs text-brass/60">{displayPeriod}</span>
                </div>
                {billing === 'yearly' && (
                  <p className="font-body text-[0.625rem] text-green-400/80">2 months free</p>
                )}
              </div>
            </div>

            <p className="font-body text-xs text-white/75 leading-relaxed mb-1">
              <em className="text-gold-accent not-italic font-semibold">{plan.tagline} </em>
              {plan.description}
            </p>

            {isFoundingMember && !isNative && (
              <div className="flex items-center gap-1 mb-3">
                <Lock size={9} className="text-gold-accent" />
                <p className="font-body text-[0.625rem] text-gold-accent/70">Your founding rate · yours while your subscription stays active</p>
              </div>
            )}

            <p className="font-body text-xs text-brass/70 mt-2 mb-1.5">Everything in {plan.everythingIn}, plus:</p>
            <ul className="space-y-1.5 mb-4">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 font-body text-sm">
                  <Check size={13} className="text-gold-accent shrink-0" />
                  <span className="text-cream/80">{f}</span>
                </li>
              ))}
            </ul>

            {isCurrent ? (
              pendingChange ? (
                <div className="w-full space-y-2">
                  <p className="text-center font-body text-xs text-white/80">
                    Switches to {TIER_LABELS[pendingChange.tier]} on {switchDate(pendingChange.effective_at)}
                  </p>
                  <Button
                    onClick={() => handleStripeChange(plan.tier)}
                    disabled={!!loading}
                    variant="outline"
                    className="w-full border-gold-primary/40 bg-transparent hover:bg-gold-primary/10 text-cream font-display font-bold"
                  >
                    {isLoading ? (
                      <><Loader2 size={16} className="animate-spin mr-2" /> Processing…</>
                    ) : (
                      <>Keep {plan.label}</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="w-full text-center py-2 font-body text-sm text-brass/60">
                  You're on this plan
                </div>
              )
            ) : (
              <>
                <label className="flex items-start gap-2.5 cursor-pointer mb-3">
                  <input type="checkbox"
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-transparent text-gold-primary focus:ring-gold-accent shrink-0"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)} />
                  <span className="font-body text-[0.6875rem] text-brass/50 leading-relaxed">
                    I confirm I am at least <strong className="text-white/70">18 years old</strong> and authorized to make this purchase.
                  </span>
                </label>
                <Button
                  onClick={() => handleSelect(plan.tier)}
                  disabled={!!loading || !ageConfirmed || (isNative && !storePrice)}
                  className={`w-full font-display font-bold text-base py-3 ${
                    plan.highlight
                      ? 'bg-gold-primary hover:bg-gold-accent text-cream'
                      : 'bg-deep-blue hover:bg-deep-blue/90 text-cream'
                  }`}
                >
                  {isLoading ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> {isNative ? 'Processing…' : 'Redirecting...'}</>
                  ) : (
                    <><Zap size={15} className="mr-1.5" /> {plan.cta}</>
                  )}
                </Button>
              </>
            )}

            {planNotice && noticeTier === plan.tier && (
              <div className="mt-3 rounded-lg border border-gold-primary/30 bg-gold-primary/10 p-3 text-center">
                <p className="font-body text-xs text-white/80">{planNotice}</p>
              </div>
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

      {planNotice && !noticeTier && (
        <div className="rounded-lg border border-gold-primary/30 bg-gold-primary/10 p-3 text-center">
          <p className="font-body text-xs text-white/80">{planNotice}</p>
        </div>
      )}

      {checkoutError && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-center">
          <p className="font-body text-xs text-red-300">{checkoutError}</p>
        </div>
      )}

      {/* Fine print (F-01 copy) */}
      <p className="font-body text-[0.6875rem] text-brass/40 text-center leading-relaxed">
        Subscriptions renew automatically at the price shown until canceled. Cancel anytime in {cancelLine}.
        {' · '}
        {isNative && (
          <>
            <button onClick={handleRestore} disabled={!!loading} className="text-gold-accent underline hover:text-gold-primary disabled:opacity-50">
              {loading === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </button>
            {' · '}
          </>
        )}
        <Link to="/terms" className="text-gold-accent underline hover:text-gold-primary">Terms</Link>
        {' · '}
        <Link to="/privacy" className="text-gold-accent underline hover:text-gold-primary">Privacy</Link>
      </p>
    </div>
  );
}
