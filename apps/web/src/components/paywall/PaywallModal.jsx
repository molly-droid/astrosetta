import React, { useState, useEffect } from 'react';
import { X, Sparkles, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPlatform } from '@/lib/platform';
import { useAuth } from '@/lib/AuthContext';
import { restorePurchases } from '@/lib/restorePurchases';
import { purchasesEnabled, purchaseTier, getNativePriceString } from '@/lib/purchases';

/**
 * PaywallModal
 * variant: "interpret" | "calendar"
 * fromTier: the user's current effective tier ("free" | "interpret")
 *
 * On mobile (iOS/Android): purchases through RevenueCat (App Store /
 * Google Play); prices shown come from the store so they always match
 * what the user is charged. On web: uses Stripe checkout.
 */
export default function PaywallModal({ variant = 'interpret', fromTier = 'free', context = '', onClose }) {
  const [loading, setLoading] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);
  const [purchaseError, setPurchaseError] = useState(null);
  // Store-localized monthly price strings (native only); fall back to web copy
  const [nativePrices, setNativePrices] = useState({ interpret: null, calendar: null });
  const { user, reloadUser } = useAuth();
  const isCalendarUpgrade = variant === 'calendar';
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';

  useEffect(() => {
    if (!isNative || !purchasesEnabled()) return;
    let alive = true;
    (async () => {
      const [interpret, calendar] = await Promise.all([
        getNativePriceString('interpret', 'monthly'),
        getNativePriceString('calendar', 'monthly'),
      ]);
      if (alive) setNativePrices({ interpret, calendar });
    })();
    return () => { alive = false; };
  }, [isNative]);

  const handleCheckout = async (tier) => {
    setLoading(tier);
    setPurchaseError(null);

    try {
      if (isNative) {
        await handleIapPurchase(tier);
      } else {
        await handleStripeCheckout(tier);
      }
    } catch {
      setPurchaseError('Unable to open checkout. Check your connection and try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleStripeCheckout = async (tier) => {
    let origin;
    try { origin = window.top.location.origin; } catch { origin = window.location.origin; }
    const res = await base44.functions.invoke('createCheckoutSession', {
      tier,
      successUrl: `${origin}/profile?success=true&tier=${tier}`,
      cancelUrl: `${origin}/subscribe`,
    });
    const { url } = res.data;
    window.location.href = url;
  };

  const handleIapPurchase = async (tier) => {
    if (!purchasesEnabled()) {
      // No store billing available (web preview / missing key): the Subscribe
      // page can complete via Stripe on mobile web
      window.location.href = '/subscribe';
      return;
    }

    const result = await purchaseTier(tier, 'monthly');
    if (result.success) {
      // The authoritative tier update lands via the revenuecat-webhook Edge
      // Function; give it a few beats to reflect on the users row.
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const updated = await reloadUser?.();
        if (updated?.subscription_tier === tier) break;
      }
      onClose();
      return;
    }

    if (!result.cancelled) {
      console.error('IAP purchase error:', result.error);
      setPurchaseError('The purchase could not be completed. You have not been charged — please try again.');
    }
    setLoading(null);
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
      setRestoreMsg('No previous purchases were found for your account.');
    }
  };

  const storeLabel = platform === 'ios' ? 'App Store' : platform === 'android' ? 'Google Play' : null;
  const nativeSuffix = storeLabel ? ` (${storeLabel})` : '';

  // On native, the store's localized price is authoritative (Apple price
  // points differ slightly from the web's Stripe prices).
  const corePrice = isNative ? nativePrices.interpret || 'Price unavailable' : user?.is_founding_member ? '$5.55' : '$8';
  const premiumPrice = isNative ? nativePrices.calendar || 'Price unavailable' : user?.is_founding_member ? '$7.77' : '$10';

  const config = isCalendarUpgrade ? {
    icon: <CalendarDays size={22} className="text-gold-accent" />,
    title: 'Become a Premium member',
    price: isNative && !nativePrices.calendar ? 'Price unavailable' : `${premiumPrice}/mo`,
    tierName: 'Premium Plan',
    description: fromTier === 'interpret'
      ? 'The deepest layer of Astrosetta — Black Moon Lilith, the asteroid pack, early access to new features, and founding patron recognition.'
      : 'Go beyond the planets — Black Moon Lilith, the asteroid pack, early access to new features, and founding patron recognition.',
    features: [
      '💜 Everything in Core',
      '🌑 Black Moon Lilith (placements, transits & interpretations)',
      '🪨 Asteroid pack — Juno, Pallas, Vesta & Tyche',
      '🚀 Early access to new features',
      '🔐 Private community (coming soon)',
      '🏅 Founding patron recognition in-app',
    ],
    primaryLabel: isNative
      ? nativePrices.calendar ? `Subscribe${nativeSuffix} — ${premiumPrice}/mo` : 'Store price unavailable'
      : `Subscribe to Premium — ${premiumPrice}/mo`,
    secondaryLabel: fromTier === 'interpret' ? 'Keep Exploring' : 'Maybe Later',
  } : {
    icon: <Sparkles size={22} className="text-celestial-blue" />,
    title: 'Unlock Core',
    price: isNative && !nativePrices.interpret ? 'Price unavailable' : `${corePrice}/mo`,
    tierName: 'Core Plan',
    description: context
      ? `Learn what ${context} means for your life right now.`
      : 'Get full natal chart interpretations, transit readings on demand, interactive chart wheel, synastry, planner, calendar sync, and more.',
    features: [
      '🔭 Full natal chart interpretations (all planets)',
      '🌍 Transit interpretations on demand',
      '🎡 Interactive chart wheel',
      '💞 Synastry & event charts',
      '📅 Planner + calendar sync (ICS + Google)',
      '🤖 AI navigator chatbot',
    ],
    primaryLabel: isNative
      ? nativePrices.interpret ? `Subscribe${nativeSuffix} — ${corePrice}/mo` : 'Store price unavailable'
      : `Unlock Core — ${corePrice}/mo`,
    secondaryLabel: 'Maybe Later',
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/80 px-0 sm:px-4 py-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-sm max-h-[92vh] overflow-y-auto bg-paper rounded-2xl border border-gold-primary/30 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-deep-blue/90 to-deep-blue/70 px-5 pt-5 pb-4 relative">
          {isNative && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="absolute top-4 right-11 font-label text-xs font-medium uppercase tracking-[0.05em] text-gold-foil hover:text-starlight transition-colors disabled:opacity-50"
            >
              {restoring ? 'Restoring…' : 'Restore'}
            </button>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 text-cream/50 hover:text-cream transition-colors">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              {config.icon}
            </div>
            <div>
              <p className="font-body text-[10px] text-gold-primary/70 uppercase tracking-widest">{config.tierName}</p>
              <h2 className="font-display text-base font-bold text-cream leading-tight">{config.title}</h2>
            </div>
          </div>
          <p className="font-body text-xs text-gold-primary/80 leading-relaxed">{config.description}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Features */}
          <ul className="space-y-2">
            {config.features.map((f, i) => (
              <li key={i} className="font-body text-xs text-white/85 leading-snug">{f}</li>
            ))}
          </ul>

          {/* If free tier, also show the Navigator option */}
          {!isCalendarUpgrade && (
            <div className="rounded-lg border border-gold-primary/20 p-3 bg-gold-primary/5 space-y-2">
              <p className="font-body text-[10px] uppercase tracking-widest text-brass/50">Also available</p>
              <p className="font-body text-xs text-white/80">
                <strong className="text-gold-accent">Premium — {premiumPrice}/mo</strong><br/>
                Everything in Core + Black Moon Lilith, the asteroid pack, early access to new features, and founding patron recognition.
              </p>
            </div>
          )}

          {/* Apple-required subscription disclosure (native builds only) */}
          {isNative && (
            <div className="rounded-lg border border-gold-hairline bg-velvet-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gold-foil text-[8px] text-velvet font-bold">✦</span>
                <p className="font-label text-xs font-medium uppercase tracking-[0.05em] text-starlight-muted">Subscription disclosure</p>
              </div>
              <p className="font-body text-[13px] leading-snug text-starlight">
                {config.tierName} — {isCalendarUpgrade ? premiumPrice : corePrice} per month. Payment is charged to your {storeLabel} account and automatically renews until cancelled. Cancel anytime in your {storeLabel} subscription settings at least 24 hours before the period ends.
              </p>
              <div className="flex items-center gap-4 pt-0.5">
                <Link to="/terms" onClick={onClose} className="font-body text-[13px] text-gold-foil underline">Terms of Service</Link>
                <Link to="/privacy" onClick={onClose} className="font-body text-[13px] text-gold-foil underline">Privacy Policy</Link>
              </div>
            </div>
          )}

          {restoreMsg && (
            <p className="font-body text-[13px] text-starlight-muted text-center">{restoreMsg}</p>
          )}

          {purchaseError && (
            <p className="font-body text-[13px] text-red-300 text-center">{purchaseError}</p>
          )}

          {/* CTAs */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={() => handleCheckout(isCalendarUpgrade ? 'calendar' : 'interpret')}
              disabled={!!loading || (isNative && !nativePrices[isCalendarUpgrade ? 'calendar' : 'interpret'])}
              className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-sm h-10 font-semibold"
            >
              {loading === (isCalendarUpgrade ? 'calendar' : 'interpret')
                ? <><Loader2 size={15} className="animate-spin mr-2" /> {isNative ? 'Processing…' : 'Redirecting...'}</>
                : config.primaryLabel}
            </Button>
            {!isCalendarUpgrade && fromTier === 'free' && (
              <Button
                variant="outline"
                onClick={() => handleCheckout('calendar')}
                disabled={!!loading || (isNative && !nativePrices.calendar)}
                className="w-full font-body text-sm h-9 border-gold-primary/30 text-brass"
              >
                {loading === 'calendar'
                  ? <><Loader2 size={15} className="animate-spin mr-2" /> {isNative ? 'Processing…' : 'Redirecting...'}</>
                  : `Subscribe to Premium — ${premiumPrice}/mo`}
              </Button>
            )}
            <button onClick={onClose} className="w-full font-body text-xs text-brass/50 hover:text-brass transition-colors py-1">
              {config.secondaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
