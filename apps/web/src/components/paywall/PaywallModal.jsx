import React, { useState } from 'react';
import { X, Sparkles, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getPlatform } from '@/lib/platform';
import { getProductId } from '@/lib/entitlements';
import { useAuth } from '@/lib/AuthContext';
import { restorePurchases } from '@/lib/restorePurchases';

/**
 * PaywallModal
 * variant: "interpret" | "calendar"
 * fromTier: the user's current effective tier ("free" | "interpret")
 *
 * On mobile (iOS/Android): shows IAP purchase flow via validateIapReceipt.
 * On web: uses Stripe checkout.
 */
export default function PaywallModal({ variant = 'interpret', fromTier = 'free', context = '', onClose }) {
  const [loading, setLoading] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);
  const { reloadUser } = useAuth();
  const isCalendarUpgrade = variant === 'calendar';
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';

  const handleCheckout = async (tier) => {
    setLoading(tier);

    if (isNative) {
      await handleIapPurchase(tier, platform);
    } else {
      await handleStripeCheckout(tier);
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

  const handleIapPurchase = async (tier, platform) => {
    const productId = getProductId(tier, platform);
    if (!productId) {
      console.error('No IAP product ID configured for', tier, platform);
      setLoading(null);
      return;
    }

    // When running inside Capacitor with IAP plugin:
    if (window.Capacitor?.Plugins?.InAppPurchases) {
      try {
        const purchase = await window.Capacitor.Plugins.InAppPurchases.purchase({
          productId,
        });
        if (purchase?.receipt) {
          const res = await base44.functions.invoke('validateIapReceipt', {
            platform,
            receipt: purchase.receipt,
            productId,
            tier,
          });
          if (res.data?.success) {
            onClose();
          } else {
            console.error('IAP validation failed:', res.data);
            setLoading(null);
          }
          return;
        }
      } catch (err) {
        console.error('IAP purchase error:', err);
        setLoading(null);
        return;
      }
    }

    // Fallback: if Capacitor IAP plugin isn't available, redirect to Subscribe page
    // where the user can complete via Stripe on mobile web
    window.location.href = '/subscribe';
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

  const config = isCalendarUpgrade ? {
    icon: <CalendarDays size={22} className="text-gold-accent" />,
    title: 'Become a Premium member',
    price: '$7.77/mo',
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
      ? `Subscribe${nativeSuffix} — $7.77/mo`
      : fromTier === 'interpret' ? 'Upgrade to Premium — $7.77/mo' : 'Become a Premium member — $7.77/mo',
    secondaryLabel: fromTier === 'interpret' ? 'Keep Exploring' : 'Maybe Later',
  } : {
    icon: <Sparkles size={22} className="text-celestial-blue" />,
    title: 'Unlock Core',
    price: '$5.55/mo',
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
      ? `Subscribe${nativeSuffix} — $5.55/mo`
      : 'Unlock Core — $5.55/mo',
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
                <strong className="text-gold-accent">Premium — $7.77/mo</strong><br/>
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
                {config.tierName} — {isCalendarUpgrade ? '$7.77' : '$5.55'} per month. Payment is charged to your {storeLabel} account and automatically renews until cancelled. Cancel anytime in your {storeLabel} subscription settings at least 24 hours before the period ends.
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

          {/* CTAs */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={() => handleCheckout(isCalendarUpgrade ? 'calendar' : 'interpret')}
              disabled={!!loading}
              className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-sm h-10 font-semibold"
            >
              {loading === (isCalendarUpgrade ? 'calendar' : 'interpret')
                ? <><Loader2 size={15} className="animate-spin mr-2" /> Redirecting...</>
                : config.primaryLabel}
            </Button>
            {!isCalendarUpgrade && fromTier === 'free' && (
              <Button
                variant="outline"
                onClick={() => handleCheckout('calendar')}
                disabled={!!loading}
                className="w-full font-body text-sm h-9 border-gold-primary/30 text-brass"
              >
                {loading === 'calendar'
                  ? <><Loader2 size={15} className="animate-spin mr-2" /> Redirecting...</>
                  : 'Become a Premium member — $7.77/mo'}
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