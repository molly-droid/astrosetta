import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLatestEventOrder } from '@/hooks/useLatestEventOrder';
import EventMomentCard from '@/components/events/EventMomentCard';
import { Loader2, ArrowLeft } from 'lucide-react';

/**
 * Post-payment confirmation page for event-sourced signups — reached via the
 * Stripe success redirect, and linked from the profile's My Moment tab.
 */
export default function EventMoment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuccess = new URLSearchParams(window.location.search).get('success') === 'true';
  const { order, event, loading, refresh } = useLatestEventOrder(user?.id);

  // The webhook creates the order seconds after payment — poll briefly when
  // returning from a successful checkout so the card never flashes empty.
  useEffect(() => {
    if (!isSuccess || order) return undefined;
    const poll = setInterval(refresh, 4000);
    const stop = setTimeout(() => clearInterval(poll), 40000);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [isSuccess, order, refresh]);

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto px-4 pt-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-brass/60 hover:text-brass font-body text-xs mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {isSuccess && !loading && (
        <div className="text-center mb-5 space-y-1">
          <div className="text-3xl text-gold-accent font-display">✦</div>
          <h1 className="font-display text-2xl font-bold text-cream">You're in!</h1>
          <p className="font-body text-sm text-brass/70">Your founding moment is saved.</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-gold-primary" size={28} />
        </div>
      ) : order ? (
        <EventMomentCard order={order} event={event} />
      ) : (
        <div className="text-center py-16 space-y-3">
          <p className="font-body text-sm text-brass italic">No event moment yet.</p>
          <Link to="/" className="font-body text-xs text-gold-accent underline underline-offset-2">
            Explore Astrosetta
          </Link>
        </div>
      )}
    </div>
  );
}