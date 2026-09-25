import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

const EMPTY_EVENT = {
  event_id: '',
  event_name: '',
  promo_code: '',
  qr_src_param: '',
  start_date: '',
  end_date: '',
  promo_valid_until: '',
  pickup_deadline_note: '',
  notify_email: '',
  is_active: true,
};
const EMPTY_SKU = { tier: 'core', billing_cycle: 'monthly', item_type: 'keychain', metal: '', stock_total: 0, is_remote: false };

/** SKU ids are built from the event id so new events need no code changes. */
const skuIdFor = (eventId, s) =>
  s.is_remote
    ? `${eventId}_remote_gift`
    : s.billing_cycle === 'monthly'
      ? `${eventId}_${s.tier}_monthly_${s.item_type}`
      : `${eventId}_${s.tier}_yearly_${s.item_type}${s.metal ? '_' + s.metal : ''}`;

const inputCls =
  'w-full px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream placeholder:text-white/25 outline-none focus:border-gold-accent/50';

const EVENT_FIELDS = [
  { key: 'event_id', label: 'Event ID (slug)', placeholder: 'raven2026' },
  { key: 'event_name', label: 'Event name', placeholder: 'Raven Party' },
  { key: 'promo_code', label: 'Promo code', placeholder: 'RAVEN2026' },
  { key: 'qr_src_param', label: 'QR src param', placeholder: 'raven2026' },
  { key: 'start_date', label: 'Start date', type: 'date' },
  { key: 'end_date', label: 'End date', type: 'date' },
  { key: 'promo_valid_until', label: 'Promo valid until', type: 'date' },
  { key: 'pickup_deadline_note', label: 'Premium pickup deadline', placeholder: '9 PM tonight' },
  { key: 'notify_email', label: 'Booth notification email', placeholder: 'team@example.com' },
];

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [skusByEvent, setSkusByEvent] = useState({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [stockDrafts, setStockDrafts] = useState({});
  const [skuDraft, setSkuDraft] = useState({ eventId: null, ...EMPTY_SKU });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [evs, skus] = await Promise.all([
        base44.entities.PopupEvent.list('-created_date', 50),
        base44.entities.IncentiveSKU.list(null, 300),
      ]);
      setEvents(evs || []);
      const grouped = {};
      (skus || []).forEach((s) => {
        (grouped[s.event_id] = grouped[s.event_id] || []).push(s);
      });
      setSkusByEvent(grouped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveEvent = async () => {
    const d = draft;
    if (!d.event_id || !d.event_name || !d.promo_code || !d.qr_src_param || !d.start_date || !d.end_date || !d.promo_valid_until) return;
    setBusy(true);
    try {
      if (draftId) await base44.entities.PopupEvent.update(draftId, d);
      else await base44.entities.PopupEvent.create(d);
      setDraft(null);
      setDraftId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (ev) => {
    if (!window.confirm(`Delete ${ev.event_name}? Orders keep their records but the event config and SKUs go away.`)) return;
    setBusy(true);
    try {
      await base44.entities.PopupEvent.delete(ev.id);
      await base44.entities.IncentiveSKU.deleteMany({ event_id: ev.event_id });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (ev) => {
    await base44.entities.PopupEvent.update(ev.id, { is_active: !ev.is_active });
    await load();
  };

  const saveStock = async (sku) => {
    const d = stockDrafts[sku.id];
    if (!d) return;
    setBusy(true);
    try {
      await base44.entities.IncentiveSKU.update(sku.id, {
        stock_remaining: Math.max(0, Number(d.stock_remaining) || 0),
        stock_total: Math.max(Number(d.stock_total ?? sku.stock_total) || 0, Number(d.stock_remaining) || 0),
      });
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[sku.id];
        return next;
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const addSku = async (eventId) => {
    const s = skuDraft;
    if (!Number(s.stock_total)) return;
    setBusy(true);
    try {
      await base44.entities.IncentiveSKU.create({
        event_id: eventId,
        sku_id: skuIdFor(eventId, s),
        tier: s.tier,
        billing_cycle: s.billing_cycle,
        item_type: s.item_type,
        metal: s.metal || null,
        stock_total: Number(s.stock_total),
        stock_remaining: Number(s.stock_total),
        is_remote: s.is_remote,
      });
      setSkuDraft({ eventId: null, ...EMPTY_SKU });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const deleteSku = async (sku) => {
    await base44.entities.IncentiveSKU.delete(sku.id);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gold-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="px-5 py-4 max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs text-brass/60">
          Each pop-up is one event record — launching a new one needs no new code.
        </p>
        <button
          onClick={() => {
            setDraft({ ...EMPTY_EVENT });
            setDraftId(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs font-semibold shrink-0"
          style={{ background: 'rgba(201,169,97,0.15)', color: '#C9A961', border: '1px solid rgba(201,169,97,0.3)' }}
        >
          <Plus size={13} /> New event
        </button>
      </div>

      {draft && (
        <div className="rounded-xl border border-gold-primary/30 bg-white/[0.03] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EVENT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="font-label text-[9px] font-semibold uppercase tracking-[0.05em] text-brass/60">
                  {f.label}
                </label>
                <input
                  type={f.type || 'text'}
                  value={draft[f.key] || ''}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={`${inputCls} mt-1`}
                />
              </div>
            ))}
            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}
                className={`relative w-10 h-5 rounded-full transition-colors ${draft.is_active ? 'bg-gold-primary/60' : 'bg-white/10'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${draft.is_active ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
              <span className="font-body text-xs text-brass/70">Event is active (accepting QR signups)</span>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setDraft(null);
                setDraftId(null);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-body text-xs text-brass/70 hover:text-cream"
            >
              <X size={13} /> Cancel
            </button>
            <button
              onClick={saveEvent}
              disabled={busy}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg font-body text-xs font-semibold"
              style={{ background: 'linear-gradient(135deg, #C9A961, #D4AF85)', color: '#0f1a2e' }}
            >
              <Check size={13} /> {draftId ? 'Save changes' : 'Create event'}
            </button>
          </div>
        </div>
      )}

      {events.map((ev) => {
        const skus = skusByEvent[ev.event_id] || [];
        return (
          <div key={ev.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-sm font-bold text-cream">{ev.event_name}</p>
                  <span
                    className={`font-body text-[9px] rounded-full px-2 py-0.5 border ${
                      ev.is_active
                        ? 'bg-green-400/10 text-green-300 border-green-400/25'
                        : 'bg-white/[0.04] text-brass/60 border-white/10'
                    }`}
                  >
                    {ev.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="font-body text-[11px] text-brass/60 mt-0.5">
                  {ev.start_date} → {ev.end_date} · promo {ev.promo_code} (until {ev.promo_valid_until}) · src={ev.qr_src_param}
                </p>
                {ev.notify_email && <p className="font-body text-[11px] text-brass/40">notify: {ev.notify_email}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(ev)}
                  className="font-body text-[11px] text-gold-accent underline underline-offset-2"
                >
                  {ev.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => {
                    setDraft({ ...ev });
                    setDraftId(ev.id);
                  }}
                  className="text-brass/60 hover:text-cream"
                >
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteEvent(ev)} className="text-brass/60 hover:text-red-300">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-3 space-y-2">
              <p className="font-label text-[9px] font-semibold uppercase tracking-[0.05em] text-brass/60">
                Incentive stock ({skus.length} SKUs)
              </p>
              {skus.map((sku) => {
                const d = stockDrafts[sku.id];
                return (
                  <div key={sku.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-xs text-cream truncate">
                        {sku.is_remote ? '★ Remote keepsake' : `${sku.tier} ${sku.billing_cycle}${sku.metal ? ' · ' + sku.metal : ''} · ${sku.item_type}`}
                      </p>
                      <p className="font-body text-[10px] text-brass/40 truncate">{sku.sku_id}</p>
                    </div>
                    {d ? (
                      <>
                        <input
                          type="number"
                          value={d.stock_remaining}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({ ...prev, [sku.id]: { ...d, stock_remaining: e.target.value } }))
                          }
                          className="w-16 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                          title="Remaining"
                        />
                        <input
                          type="number"
                          value={d.stock_total}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({ ...prev, [sku.id]: { ...d, stock_total: e.target.value } }))
                          }
                          className="w-16 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                          title="Total"
                        />
                        <button onClick={() => saveStock(sku)} disabled={busy} className="text-green-400 hover:text-green-300">
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() =>
                            setStockDrafts((prev) => {
                              const next = { ...prev };
                              delete next[sku.id];
                              return next;
                            })
                          }
                          className="text-brass/60 hover:text-cream"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`font-body text-xs shrink-0 ${sku.stock_remaining > 0 ? 'text-gold-accent' : 'text-red-300'}`}
                        >
                          {sku.stock_remaining} / {sku.stock_total} left
                        </span>
                        <button
                          onClick={() =>
                            setStockDrafts((prev) => ({
                              ...prev,
                              [sku.id]: { stock_remaining: sku.stock_remaining, stock_total: sku.stock_total },
                            }))
                          }
                          className="text-brass/60 hover:text-cream"
                        >
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteSku(sku)} className="text-brass/60 hover:text-red-300">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {skuDraft.eventId === ev.event_id ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={skuDraft.tier}
                    onChange={(e) => setSkuDraft({ ...skuDraft, tier: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                  >
                    <option value="core">core</option>
                    <option value="premium">premium</option>
                  </select>
                  <select
                    value={skuDraft.billing_cycle}
                    onChange={(e) => setSkuDraft({ ...skuDraft, billing_cycle: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                  >
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                  <select
                    value={skuDraft.item_type}
                    onChange={(e) => setSkuDraft({ ...skuDraft, item_type: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                  >
                    <option value="keychain">keychain</option>
                    <option value="bracelet">bracelet</option>
                    <option value="necklace">necklace</option>
                    <option value="gift">gift</option>
                  </select>
                  <select
                    value={skuDraft.metal}
                    onChange={(e) => setSkuDraft({ ...skuDraft, metal: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                  >
                    <option value="">no metal</option>
                    <option value="silver">silver</option>
                    <option value="gold">gold</option>
                  </select>
                  <input
                    type="number"
                    value={skuDraft.stock_total}
                    onChange={(e) => setSkuDraft({ ...skuDraft, stock_total: e.target.value })}
                    placeholder="Qty"
                    className="w-16 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 font-body text-xs text-cream outline-none"
                  />
                  <label className="flex items-center gap-1 font-body text-[10px] text-brass/60">
                    <input
                      type="checkbox"
                      checked={skuDraft.is_remote}
                      onChange={(e) => setSkuDraft({ ...skuDraft, is_remote: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    remote
                  </label>
                  <button
                    onClick={() => addSku(ev.event_id)}
                    disabled={busy}
                    className="text-green-400 hover:text-green-300"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setSkuDraft({ eventId: null, ...EMPTY_SKU })}
                    className="text-brass/60 hover:text-cream"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSkuDraft({ eventId: ev.event_id, ...EMPTY_SKU })}
                  className="flex items-center gap-1 font-body text-[11px] text-gold-accent/80 underline underline-offset-2"
                >
                  <Plus size={11} /> Add SKU
                </button>
              )}
            </div>
          </div>
        );
      })}

      {!events.length && !draft && (
        <p className="font-body text-xs text-brass/50 text-center py-8">No events yet — create the first one.</p>
      )}
    </div>
  );
}