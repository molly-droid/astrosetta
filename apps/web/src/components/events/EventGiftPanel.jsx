import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getEventTag, setEventTag } from '@/lib/eventTag';
import { Gift, Mail } from 'lucide-react';
import GiftOptionPills from '@/components/events/GiftOptionPills';

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
const todayStr = () => new Date().toISOString().slice(0, 10);

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 font-body text-sm text-cream placeholder:text-white/25 outline-none focus:border-gold-accent/50';

/**
 * Event gift panel on the Subscribe page. Renders only for event-sourced
 * visitors (QR tag, "I'm at the event" tap, or a valid promo code) plus a
 * grace-window banner for anyone arriving after the event. Reports the signup
 * payload up to the parent so checkout can attach it to the Stripe session.
 */
export default function EventGiftPanel({ billing, user, onEventContext }) {
  const [event, setEvent] = useState(null);
  const [channel, setChannel] = useState('qr_link');
  const [skus, setSkus] = useState([]);
  const [ongoing, setOngoing] = useState(null);
  const [graceEvent, setGraceEvent] = useState(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [metal, setMetal] = useState(null);
  const [jewelry, setJewelry] = useState(null);
  const [shipping, setShipping] = useState({ name: '', line1: '', line2: '', city: '', state: '', zip: '' });

  // Resolve the stored event tag (landing page QR src param)
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src');
    const tag = getEventTag() || (src ? { event_id: src, channel: 'qr_link' } : null);
    if (!tag) return;
    setChannel(tag.channel || 'qr_link');
    base44.entities.PopupEvent
      .filter({ event_id: tag.event_id })
      .then((events) => events?.[0] && setEvent(events[0]))
      .catch(() => {});
  }, []);

  // When untagged, look for an ongoing or grace-window event
  useEffect(() => {
    if (getEventTag() || new URLSearchParams(window.location.search).get('src')) return;
    base44.entities.PopupEvent
      .list()
      .then((events) => {
        const today = todayStr();
        const live = (events || []).find((e) => e.is_active && e.start_date <= today && today <= e.end_date);
        const grace = (events || []).find((e) => e.promo_valid_until >= today && e.end_date < today);
        if (live) setOngoing(live);
        if (grace) {
          setGraceEvent(grace);
          setPromoOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  // Live stock for the resolved event
  useEffect(() => {
    if (!event?.event_id) return undefined;
    const load = () =>
      base44.entities.IncentiveSKU
        .filter({ event_id: event.event_id })
        .then((rows) => setSkus(rows || []))
        .catch(() => {});
    load();
    const unsubscribe = base44.entities.IncentiveSKU.subscribe(() => load());
    return unsubscribe;
  }, [event?.event_id]);

  // Default first name from the account name
  useEffect(() => {
    if (!firstName && user?.full_name) setFirstName(user.full_name.split(' ')[0]);
  }, [user?.full_name]);

  const yearly = skus.filter((s) => !s.is_remote && s.billing_cycle === 'yearly');

  // Keep selections pointing at in-stock SKUs
  useEffect(() => {
    if (billing !== 'yearly' || channel === 'promo_code' || !yearly.length) return;
    if (!metal || !yearly.some((s) => s.metal === metal && s.stock_remaining > 0)) {
      const inStock = yearly.find((s) => s.stock_remaining > 0);
      setMetal(inStock?.metal || 'silver');
    }
    if (!jewelry || !yearly.some((s) => s.item_type === jewelry && s.stock_remaining > 0)) {
      const inStock = yearly.find((s) => s.stock_remaining > 0);
      setJewelry(inStock?.item_type === 'bracelet' ? 'bracelet' : 'necklace');
    }
  }, [yearly, billing, channel]);

  // Report context up to the parent (Subscribe) for checkout
  useEffect(() => {
    if (!event) {
      onEventContext?.({ event: null, signup: null });
      return;
    }
    onEventContext?.({
      event,
      signup: {
        event_id: event.event_id,
        first_name: firstName.trim(),
        signup_channel: channel,
        metal,
        jewelry,
        shipping_address: channel === 'promo_code' ? shipping : null,
      },
    });
  }, [event, firstName, channel, metal, jewelry, shipping]);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError(null);
    try {
      const events = await base44.entities.PopupEvent.list();
      const today = todayStr();
      const ev = (events || []).find(
        (e) => String(e.promo_code || '').toUpperCase() === code && e.promo_valid_until >= today
      );
      if (!ev) {
        setPromoError("That code isn't valid right now.");
        return;
      }
      setChannel('promo_code');
      setEvent(ev);
    } catch {
      setPromoError('Something went wrong — please try again.');
    }
  };

  // ── No event context yet: ongoing tap / grace banner / promo entry ──
  if (!event) {
    return (
      <div className="space-y-3">
        {ongoing && (
          <div className="rounded-xl border border-gold-primary/30 bg-gold-primary/[0.06] p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Gift size={13} className="text-gold-accent" />
              <p className="font-body text-xs text-white/75">
                ✦ At the <span className="text-gold-accent">{ongoing.event_name}</span> right now?
              </p>
            </div>
            <p className="font-body text-[11px] text-white/50 mb-2.5">
              Tap below to tag your signup and claim your founding gift.
            </p>
            <button
              type="button"
              onClick={() => {
                setEventTag({ event_id: ongoing.event_id, channel: 'qr_link' });
                setChannel('qr_link');
                setEvent(ongoing);
              }}
              className="w-full py-2 rounded-lg font-body text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #C9A961, #D4AF85)', color: '#0f1a2e' }}
            >
              I'm at the event ✦
            </button>
          </div>
        )}
        {graceEvent && (
          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/[0.04] p-3.5">
            <p className="font-body text-xs text-white/75 leading-relaxed">
              Missed us at the <span className="text-gold-accent">{graceEvent.event_name}</span>? Your spot's still
              held — enter code <span className="text-gold-accent font-semibold">{graceEvent.promo_code}</span> by{' '}
              {fmtDate(graceEvent.promo_valid_until)} to claim your founding price and gift.
            </p>
          </div>
        )}
        {promoOpen ? (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Enter event code (e.g. RAVEN2026)"
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream placeholder:text-white/25 outline-none focus:border-gold-accent/50"
              />
              <button
                type="button"
                onClick={applyPromo}
                className="px-4 py-2 rounded-lg font-body text-xs font-semibold shrink-0"
                style={{ background: 'rgba(201,169,97,0.15)', color: '#C9A961', border: '1px solid rgba(201,169,97,0.3)' }}
              >
                Apply
              </button>
            </div>
            {promoError && <p className="font-body text-[11px] text-red-300">{promoError}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPromoOpen(true)}
            className="font-body text-[11px] text-gold-accent/80 underline underline-offset-2"
          >
            Have a promo code?
          </button>
        )}
      </div>
    );
  }

  // ── Full event panel ──
  const remote = channel === 'promo_code';
  const yearlyMetalStock = (m) => yearly.filter((s) => s.metal === m).reduce((t, s) => t + (s.stock_remaining || 0), 0);
  const jewelryStock = (j) =>
    yearly.filter((s) => s.item_type === j).reduce((t, s) => t + (s.stock_remaining || 0), 0);

  return (
    <div className="rounded-xl border border-gold-primary/40 bg-gold-primary/[0.06] p-4 space-y-3.5">
      <div className="flex items-center gap-2">
        <Gift size={14} className="text-gold-accent" />
        <p className="font-display text-sm font-bold text-cream">
          ✦ Your {event.event_name} founding gift
        </p>
      </div>

      <div>
        <label className="font-label text-[10px] font-semibold uppercase tracking-[0.05em] text-brass/60">
          First name
        </label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Shown to the booth team"
          className={`${inputCls} text-xs mt-1`}
        />
      </div>

      {remote ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-white/[0.04] p-2.5">
            <Mail size={13} className="text-gold-accent shrink-0 mt-0.5" />
            <p className="font-body text-[11px] text-white/60 leading-relaxed">
              Your founding gift will be mailed once the event wraps — a slightly smaller keepsake version, made just
              for remote members.
            </p>
          </div>
          {[
            { key: 'name', label: 'Recipient name' },
            { key: 'line1', label: 'Street address' },
            { key: 'line2', label: 'Apt / suite (optional)' },
            { key: 'city', label: 'City' },
            { key: 'state', label: 'State' },
            { key: 'zip', label: 'ZIP code' },
          ].map((f) => (
            <input
              key={f.key}
              type="text"
              value={shipping[f.key]}
              onChange={(e) => setShipping({ ...shipping, [f.key]: e.target.value })}
              placeholder={f.label}
              className={`${inputCls} text-xs`}
            />
          ))}
        </div>
      ) : billing === 'yearly' ? (
        <div className="space-y-3">
          <GiftOptionPills
            label="Metal"
            options={[
              { value: 'silver', label: 'Silver', stock: yearlyMetalStock('silver') },
              { value: 'gold', label: 'Gold', stock: yearlyMetalStock('gold') },
            ]}
            value={metal}
            onChange={setMetal}
          />
          <GiftOptionPills
            label="Jewelry type"
            hint="Core only — Premium yearly comes as a necklace"
            options={[
              { value: 'bracelet', label: 'Bracelet', stock: jewelryStock('bracelet') },
              { value: 'necklace', label: 'Necklace', stock: jewelryStock('necklace') },
            ]}
            value={jewelry}
            onChange={setJewelry}
          />
          <p className="font-body text-[10px] text-gold-accent/60 italic">
            While supplies last — if a piece sells out, your founding spot is still locked in and we'll mail you one
            once more are made.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-white/[0.04] p-2.5">
          <Gift size={13} className="text-gold-accent shrink-0 mt-0.5" />
          <p className="font-body text-[11px] text-white/60">
            Monthly signups receive the {event.event_name} keychain gift — show your confirmation at the table to pick
            it up.
          </p>
        </div>
      )}
    </div>
  );
}