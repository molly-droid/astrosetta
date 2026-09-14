import React from 'react';
import OrnamentDivider from '@/components/ui/OrnamentDivider';

function StatusBadge({ order, event }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-xs text-center';
  if (order.pickup_status === 'picked_up') {
    return <span className={`${base} bg-green-400/10 text-green-300 border border-green-400/25`}>✓ Picked up</span>;
  }
  if (order.remote) {
    return (
      <span className={`${base} bg-gold-primary/10 text-gold-accent border border-gold-primary/30`}>
        Mailing your gift — we'll email to confirm your address
      </span>
    );
  }
  if (order.sold_out) {
    return (
      <span className={`${base} bg-gold-primary/10 text-gold-accent border border-gold-primary/30`}>
        Sold out at pickup — we'll mail you one once more are made
      </span>
    );
  }
  if (order.pickup_status === 'pending') {
    return (
      <span className={`${base} bg-gold-primary/10 text-gold-accent border border-gold-primary/30`}>
        Being made — come back by {event?.pickup_deadline_note || 'the end of the event'}
      </span>
    );
  }
  return (
    <span className={`${base} bg-green-400/10 text-green-300 border border-green-400/25`}>
      Ready now — show this at the table
    </span>
  );
}

/**
 * The branded "My Astrosetta Moment" card — shown on the post-payment
 * confirmation page and saved retrievably under the user's profile.
 */
export default function EventMomentCard({ order, event, showPrompt = true }) {
  const item = [order.metal, order.item_type].filter(Boolean).join(' ') || 'founder gift';
  const isPremium = order.tier === 'premium';

  return (
    <div className="celestial-card p-5 space-y-4">
      <div className="text-center space-y-1">
        <div className="text-2xl text-gold-accent font-display">✦</div>
        <p className="font-display text-lg font-bold text-cream">
          {event?.event_name || 'Event'} Founding Moment
        </p>
        <p className="font-body text-xs text-brass/70">
          {isPremium ? 'Premium' : 'Core'} · {order.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'}
        </p>
      </div>

      <OrnamentDivider />

      <div className="flex justify-around text-center">
        {[
          { glyph: '☉', label: 'Sun', value: order.sun_sign },
          ...(isPremium
            ? [
                { glyph: '☽', label: 'Moon', value: order.moon_sign },
                { glyph: 'AC', label: 'Rising', value: order.rising_sign },
              ]
            : []),
        ].map(({ glyph, label, value }) => (
          <div key={label}>
            <div className="text-lg text-gold-accent font-display">{glyph}</div>
            <div className="text-[0.625rem] font-body uppercase tracking-widest text-brass">{label}</div>
            <div className="text-sm font-display font-bold text-cream">{value || '—'}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-3 flex items-center justify-between">
        <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Your gift</p>
        <p className="font-body text-sm text-cream capitalize">{item}</p>
      </div>

      <div className="flex justify-center">
        <StatusBadge order={order} event={event} />
      </div>

      {showPrompt && (
        <p className="text-center font-body text-[11px] text-brass/50">
          Screenshot this, or find it anytime under My Astrosetta Moment in your profile.
        </p>
      )}
    </div>
  );
}