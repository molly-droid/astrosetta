import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getEffectiveTier, hasFoundingRate } from '@/lib/permissions';
import { getPlatform } from '@/lib/platform';
import { ArrowLeft, Lock, Clock } from 'lucide-react';
import { track, EVENTS } from '@/lib/analytics';
import EventGiftPanel from '@/components/events/EventGiftPanel';
import PlanSelection from '@/components/plans/PlanSelection';

// The plan cards, checkout routing, and purchase handling live in
// components/plans/PlanSelection.jsx — the same component the onboarding
// plan slide uses, so upgrades and first-signup purchases are one flow (F-01).
export default function Subscribe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const effectiveTier = getEffectiveTier(user);
  const [eventCtx, setEventCtx] = useState({ event: null, signup: null });
  const [billing, setBilling] = useState('monthly');
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';
  const storeLabel = platform === 'ios' ? 'via App Store' : platform === 'android' ? 'via Google Play' : '';
  const settingsLabel = platform === 'ios' ? 'App Store' : platform === 'android' ? 'Google Play' : "the app's Stripe billing portal (Profile → Manage billing)";
  // All current beta users are founding members — at launch, new signups
  // within 30 days of launch date will also qualify; after that window closes,
  // is_founding_member will be false for new users.
  const isFoundingMember = hasFoundingRate(user);

  useEffect(() => {
    track(EVENTS.SUBSCRIBE_VIEWED, { current_tier: effectiveTier, is_founding_member: isFoundingMember });
  }, []);

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
          <h1 className="font-display text-2xl font-bold text-cream">Choose how deep you want to go</h1>
          <p className="font-body text-sm text-brass/70">Start free and learn the language of your chart. Upgrade anytime.</p>
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
              Your rate is held for as long as your subscription stays active, so choose a plan below and keep it.
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

        <PlanSelection
          variant="page"
          eventCtx={eventCtx}
          billing={billing}
          onBillingChange={setBilling}
          onPurchased={(tier) => navigate(`/profile?success=true&tier=${tier}`)}
          onRestored={() => navigate('/profile?success=true')}
        />

        <p className="font-body text-[0.6875rem] text-brass/40 text-center pt-2">
          {isNative
            ? `Payments processed securely ${storeLabel} · Cancel anytime`
            : 'Payments processed securely by Stripe · Cancel anytime'}
        </p>

        {/* Pre-purchase subscription disclosure (App Store required) */}
        <div className="rounded-xl border border-gold-primary/15 bg-gold-primary/[0.04] p-3.5 space-y-2">
          <p className="font-label text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-brass/60">Subscription terms</p>
          <p className="font-body text-[0.6875rem] text-white/60 leading-relaxed">
            Core and Premium are auto-renewing subscriptions at the price shown above and confirmed at checkout.
            Founding pricing applies where eligible. Confirm your price at checkout. Payment is charged to your
            payment method at confirmation of purchase, and each subscription automatically renews until cancelled
            at least 24 hours before the current period ends. Cancel anytime in your {settingsLabel} subscription
            settings — cancelling stops future renewals and your access continues to the end of the paid period.
          </p>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
            <Link to="/terms" className="font-body text-[0.6875rem] text-gold-accent underline hover:text-gold-primary">Terms of Service</Link>
            <Link to="/privacy" className="font-body text-[0.6875rem] text-gold-accent underline hover:text-gold-primary">Privacy Policy</Link>
            <Link to="/refund-policy" className="font-body text-[0.6875rem] text-gold-accent underline hover:text-gold-primary">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
