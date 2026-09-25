import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLatestEventOrder } from '@/hooks/useLatestEventOrder';
import EventMomentCard from '@/components/events/EventMomentCard';
import { Loader2, Sparkles } from 'lucide-react';

/**
 * "My Astrosetta Moment" — the saved event confirmation, retrievable anytime
 * from the user's profile.
 */
export default function MyMomentSection() {
  const { user } = useAuth();
  const { order, event, loading } = useLatestEventOrder(user?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gold-primary" size={24} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="celestial-card p-6 text-center space-y-2">
        <Sparkles size={20} className="text-gold-accent mx-auto" />
        <p className="font-body text-sm text-brass leading-relaxed">
          No event moment yet — attend a pop-up or enter an event code when you subscribe to claim a founding gift.
        </p>
        <Link
          to="/subscribe"
          className="inline-block font-body text-xs text-gold-accent underline underline-offset-2"
        >
          View plans
        </Link>
      </div>
    );
  }

  return <EventMomentCard order={order} event={event} showPrompt={false} />;
}