import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, Clock, Mail, PackageCheck } from 'lucide-react';

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function QueueCard({ order, onPickup }) {
  const item = [order.metal, order.item_type].filter(Boolean).join(' ') || 'founder gift';
  const big3 =
    order.tier === 'premium' && order.moon_sign
      ? `${order.sun_sign || '—'} ☉ · ${order.moon_sign || '—'} ☽ · ${order.rising_sign || '—'} AC`
      : `${order.sun_sign || '—'} ☉`;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-cream truncate">{order.first_name}</p>
          <p className="font-body text-[11px] text-brass/70">
            {order.tier === 'premium' ? 'Premium' : 'Core'} {order.billing_cycle} · {item}
          </p>
          <p className="font-body text-[11px] text-white/40">{big3}</p>
          {order.sold_out && (
            <p className="font-body text-[10px] text-red-300 mt-0.5">sold out — mail when restocked</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1.5">
          <p className="font-body text-[10px] text-brass/50">{fmtTime(order.created_date)}</p>
          <button
            onClick={() => onPickup(order)}
            className="px-2.5 py-1 rounded-lg font-body text-[11px] font-semibold flex items-center gap-1 mx-auto"
            style={{
              background: 'rgba(168,200,168,0.15)',
              color: '#A8C8A8',
              border: '1px solid rgba(168,200,168,0.3)',
            }}
          >
            <Check size={11} /> Picked Up
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteCard({ order }) {
  const item = [order.metal, order.item_type].filter(Boolean).join(' ') || 'keepsake gift';
  const a = order.shipping_address || {};
  return (
    <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/[0.04] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-cream truncate">{order.first_name}</p>
          <p className="font-body text-[11px] text-brass/70">
            {order.tier === 'premium' ? 'Premium' : 'Core'} {order.billing_cycle} · {item}
          </p>
          <p className="font-body text-[11px] text-white/40 mt-0.5">
            {[a.name, a.line1, a.line2, `${a.city || ''} ${a.state || ''} ${a.zip || ''}`.trim()]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <span
          className="font-body text-[10px] rounded-full px-2 py-0.5 border shrink-0 bg-gold-primary/10 text-gold-accent border-gold-primary/30"
        >
          MAIL
        </span>
      </div>
    </div>
  );
}

/**
 * Booth fulfillment queue — the live, sortable order list for the event
 * team. Premium (custom-build) orders surface above Core (premade) so the
 * harder-to-fulfill pieces never get lost in a busy room.
 */
export default function EventQueueTab() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PopupEvent
      .list('-created_date', 50)
      .then((evs) => {
        setEvents(evs || []);
        const active = (evs || []).find((e) => e.is_active) || evs?.[0];
        setEventId(active?.event_id || null);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return undefined;
    }
    const loadOrders = () =>
      base44.entities.EventOrder.filter({ event_id: eventId }).then((o) => setOrders(o || [])).catch(() => {});
    const loadSkus = () =>
      base44.entities.IncentiveSKU.filter({ event_id: eventId }).then((s) => setSkus(s || [])).catch(() => {});
    Promise.all([loadOrders(), loadSkus()]).then(() => setLoading(false));
    const unsubOrders = base44.entities.EventOrder.subscribe(() => loadOrders());
    const unsubSkus = base44.entities.IncentiveSKU.subscribe(() => loadSkus());
    return () => {
      unsubOrders();
      unsubSkus();
    };
  }, [eventId]);

  const markPickedUp = async (order) => {
    await base44.entities.EventOrder.update(order.id, {
      pickup_status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    });
  };

  const byOldest = (a, b) => String(a.created_date).localeCompare(String(b.created_date));
  const pending = orders.filter((o) => o.pickup_status === 'pending').sort(byOldest);
  const ready = orders.filter((o) => o.pickup_status === 'ready').sort(byOldest);
  const remote = orders.filter((o) => o.remote || o.pickup_status === 'remote_fulfillment').sort(byOldest);
  const pickedUp = orders.filter((o) => o.pickup_status === 'picked_up');
  const liveSkus = skus.filter((s) => !s.is_remote);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gold-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-body text-xs text-brass/60">Live queue — updates the moment an order lands.</p>
        <select
          value={eventId || ''}
          onChange={(e) => setEventId(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
        >
          {events.map((ev) => (
            <option key={ev.event_id} value={ev.event_id}>
              {ev.event_name}
            </option>
          ))}
        </select>
      </div>

      {liveSkus.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {liveSkus.map((s) => (
            <span
              key={s.sku_id}
              className={`font-body text-[10px] rounded-full px-2.5 py-1 border ${
                s.stock_remaining > 0
                  ? 'bg-white/[0.04] text-brass/80 border-white/10'
                  : 'bg-red-400/10 text-red-300 border-red-400/25'
              }`}
            >
              {[s.metal, s.item_type].filter(Boolean).join(' ')}: {s.stock_remaining} left
            </span>
          ))}
        </div>
      )}

      {!eventId ? (
        <p className="font-body text-xs text-brass/50 text-center py-8">No events configured yet.</p>
      ) : orders.length === 0 ? (
        <p className="font-body text-xs text-brass/50 text-center py-8">No orders yet for this event.</p>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-gold-accent" />
              <p className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">
                Being made — Premium ({pending.length})
              </p>
            </div>
            {pending.length ? (
              pending.map((o) => <QueueCard key={o.id} order={o} onPickup={markPickedUp} />)
            ) : (
              <p className="font-body text-[11px] text-brass/40 italic pl-4">None right now.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <PackageCheck size={12} className="text-green-400/80" />
              <p className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">
                Ready now — Core ({ready.length})
              </p>
            </div>
            {ready.length ? (
              ready.map((o) => <QueueCard key={o.id} order={o} onPickup={markPickedUp} />)
            ) : (
              <p className="font-body text-[11px] text-brass/40 italic pl-4">None right now.</p>
            )}
          </div>

          {remote.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Mail size={12} className="text-gold-accent" />
                <p className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">
                  Mail to buyer — promo code ({remote.length})
                </p>
              </div>
              {remote.map((o) => (
                <RemoteCard key={o.id} order={o} />
              ))}
            </div>
          )}

          {pickedUp.length > 0 && (
            <p className="text-center font-body text-[11px] text-brass/40">
              {pickedUp.length} picked up ✓
            </p>
          )}
        </div>
      )}
    </div>
  );
}