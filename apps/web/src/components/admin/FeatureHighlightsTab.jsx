import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Rocket, Archive, ArchiveRestore, Loader2, Sparkles, Eye, Mail, Bell } from 'lucide-react';
import { FEATURE_ANNOUNCEMENTS, ANNOUNCEMENT_ICONS } from '@/lib/featureAnnouncements';

function parseDate(d) { return new Date((d || '').slice(0, 10)); }
function fmtDate(d) { return d ? parseDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function plusDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function statusOf(r) {
  if (r.is_archived) return 'Archived';
  if (!r.go_live_date) return 'Draft';
  const now = Date.now();
  if (parseDate(r.go_live_date).getTime() > now) return 'Scheduled';
  if (r.end_date && parseDate(r.end_date).getTime() < now) return 'Expired';
  return 'Live';
}

const STATUS_STYLES = {
  Live: { bg: 'rgba(168,200,168,0.15)', border: 'rgba(168,200,168,0.4)', color: '#A8C8A8' },
  Scheduled: { bg: 'rgba(201,169,97,0.15)', border: 'rgba(201,169,97,0.4)', color: '#C9A961' },
  Expired: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)' },
  Draft: { bg: 'rgba(196,168,130,0.12)', border: 'rgba(196,168,130,0.3)', color: '#C4A882' },
  Archived: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' },
};

const EMPTY_FORM = {
  spotlight_key: '',
  title: '',
  subtitle: '',
  description: '',
  deep_link: '/home',
  icon: 'Sparkles',
  go_live_date: todayStr(),
  end_date: '',
  show_on_homepage: true,
  show_in_email: true,
  show_in_notification: true,
  is_archived: false,
};

export default function FeatureHighlightsTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const recs = await base44.entities.FeatureHighlight.list('-go_live_date', 100);
    setRecords(recs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, go_live_date: todayStr(), end_date: plusDays(7) });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      spotlight_key: r.spotlight_key || '',
      title: r.title || '',
      subtitle: r.subtitle || '',
      description: r.description || '',
      deep_link: r.deep_link || '/home',
      icon: r.icon || 'Sparkles',
      go_live_date: (r.go_live_date || '').slice(0, 10),
      end_date: (r.end_date || '').slice(0, 10),
      show_on_homepage: r.show_on_homepage !== false,
      show_in_email: r.show_in_email !== false,
      show_in_notification: r.show_in_notification !== false,
      is_archived: !!r.is_archived,
    });
    setModalOpen(true);
  };

  const prefillFromCatalog = (spotlightKey) => {
    const a = FEATURE_ANNOUNCEMENTS.find(x => x.spotlight_key === spotlightKey);
    if (!a) return;
    setForm(f => ({
      ...f,
      spotlight_key: a.spotlight_key,
      title: a.title || f.title,
      subtitle: a.subtitle || f.subtitle,
      description: a.description || f.description,
      deep_link: a.deep_link || f.deep_link,
      icon: a.icon || f.icon,
    }));
  };

  const save = async () => {
    if (!form.spotlight_key || !form.title || !form.go_live_date) return;
    setSaving(true);
    const payload = {
      spotlight_key: form.spotlight_key,
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      deep_link: form.deep_link,
      icon: form.icon,
      go_live_date: form.go_live_date,
      end_date: form.end_date || null,
      show_on_homepage: form.show_on_homepage,
      show_in_email: form.show_in_email,
      show_in_notification: form.show_in_notification,
      is_archived: form.is_archived,
    };
    try {
      if (editingId) {
        await base44.entities.FeatureHighlight.update(editingId, payload);
      } else {
        await base44.entities.FeatureHighlight.create(payload);
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      alert('Save failed: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const launchNow = async (r) => {
    await base44.entities.FeatureHighlight.update(r.id, {
      go_live_date: todayStr(),
      end_date: r.end_date || plusDays(7),
      is_archived: false,
    });
    await load();
  };

  const toggleArchive = async (r) => {
    await base44.entities.FeatureHighlight.update(r.id, { is_archived: !r.is_archived });
    await load();
  };

  const remove = async (r) => {
    await base44.entities.FeatureHighlight.delete(r.id);
    setConfirmDelete(null);
    await load();
  };

  const liveNow = records.find(r => statusOf(r) === 'Live');

  return (
    <div className="px-5 py-4 max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={18} className="text-gold-accent" /> Feature Highlights
          </h2>
          <p className="font-body text-xs text-brass/70 mt-0.5">Schedule which feature is featured on the homepage, email digests, and spotlight popups. Each live highlight gets its own time in the spotlight.</p>
        </div>
        <Button onClick={openNew} className="bg-gold-primary hover:bg-gold-accent text-paper">
          <Plus size={15} className="mr-1" /> New Highlight
        </Button>
      </div>

      {liveNow && (
        <div className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'rgba(168,200,168,0.08)', border: '1px solid rgba(168,200,168,0.3)' }}>
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#A8C8A8' }} />
          <div className="flex-1 min-w-0">
            <p className="font-body text-[10px] uppercase tracking-widest text-[#A8C8A8] font-semibold">Currently Live</p>
            <p className="font-display text-sm font-bold text-white truncate">{liveNow.title} <span className="font-body text-[11px] text-brass/60 font-normal">· {liveNow.spotlight_key}</span></p>
          </div>
          <span className="font-body text-[10px] text-brass/50 shrink-0">since {fmtDate(liveNow.go_live_date)}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-gold-primary" size={22} /></div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-white/10 p-8 text-center">
          <p className="font-body text-sm text-brass/70">No highlights scheduled yet.</p>
          <p className="font-body text-xs text-brass/40 mt-1">Create one to control which feature is featured and when.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {records.map(r => {
            const status = statusOf(r);
            const st = STATUS_STYLES[status];
            return (
              <div key={r.id} className="rounded-xl border border-white/10 p-3.5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-body text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>{status}</span>
                      <p className="font-display text-sm font-bold text-white truncate">{r.title}</p>
                    </div>
                    <p className="font-body text-[11px] text-brass/50 mb-1.5">{r.spotlight_key}</p>
                    <div className="flex items-center gap-3 flex-wrap font-body text-[10px] text-brass/60">
                      <span>📅 {fmtDate(r.go_live_date) || 'no date'}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ' → open'}</span>
                      {r.deep_link && <span>🔗 {r.deep_link}</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-2">
                      <ChannelChip on={r.show_on_homepage !== false} icon={Eye} label="Homepage" />
                      <ChannelChip on={r.show_in_email !== false} icon={Mail} label="Email" />
                      <ChannelChip on={r.show_in_notification !== false} icon={Bell} label="Notification" />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {status !== 'Live' && (
                      <button onClick={() => launchNow(r)} className="font-body text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-full transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg,#D4AF85,#C9A961)', color: '#0f1a2e' }}>
                        <Rocket size={10} /> Launch now
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <IconBtn onClick={() => openEdit(r)} title="Edit"><Pencil size={13} /></IconBtn>
                      <IconBtn onClick={() => toggleArchive(r)} title={r.is_archived ? 'Unarchive' : 'Archive'}>
                        {r.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      </IconBtn>
                      <IconBtn onClick={() => setConfirmDelete(r)} title="Delete" danger><Trash2 size={13} /></IconBtn>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.3)' }}>
          <DialogHeader>
            <DialogTitle className="font-display text-white">{editingId ? 'Edit highlight' : 'New feature highlight'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div>
              <Label className="text-brass text-xs mb-1 block">Prefill from catalog</Label>
              <select
                value=""
                onChange={e => e.target.value && prefillFromCatalog(e.target.value)}
                className="w-full h-9 rounded-md px-2 font-body text-xs bg-white/5 border border-white/15 text-white"
              >
                <option value="">— Select an existing feature to prefill —</option>
                {FEATURE_ANNOUNCEMENTS.map(a => (
                  <option key={a.spotlight_key} value={a.spotlight_key}>{a.title} ({a.spotlight_key})</option>
                ))}
              </select>
            </div>

            <Field label="Spotlight key *">
              <Input value={form.spotlight_key} onChange={e => setForm({ ...form, spotlight_key: e.target.value })} placeholder="traditions_v1" className="bg-white/5 border-white/15 text-white" />
            </Field>
            <Field label="Title *">
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-white/5 border-white/15 text-white" />
            </Field>
            <Field label="Subtitle (CTA label)">
              <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Modern, Hellenistic & Vedic" className="bg-white/5 border-white/15 text-white" />
            </Field>
            <Field label="Description (homepage + email copy)">
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="bg-white/5 border-white/15 text-white resize-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Deep link">
                <Input value={form.deep_link} onChange={e => setForm({ ...form, deep_link: e.target.value })} placeholder="/profile" className="bg-white/5 border-white/15 text-white" />
              </Field>
              <Field label="Icon">
                <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="w-full h-9 rounded-md px-2 font-body text-xs bg-white/5 border border-white/15 text-white">
                  {Object.keys(ANNOUNCEMENT_ICONS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Go-live date *">
                <Input type="date" value={form.go_live_date} onChange={e => setForm({ ...form, go_live_date: e.target.value })} className="bg-white/5 border-white/15 text-white" />
              </Field>
              <Field label="End date (optional)">
                <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="bg-white/5 border-white/15 text-white" />
              </Field>
            </div>

            <div className="space-y-2 pt-1">
              <ToggleRow label="Homepage (What's New)" checked={form.show_on_homepage} onChange={v => setForm({ ...form, show_on_homepage: v })} />
              <ToggleRow label="Email digests" checked={form.show_in_email} onChange={v => setForm({ ...form, show_in_email: v })} />
              <ToggleRow label="Spotlight popup (notification)" checked={form.show_in_notification} onChange={v => setForm({ ...form, show_in_notification: v })} />
              <ToggleRow label="Archived" checked={form.is_archived} onChange={v => setForm({ ...form, is_archived: v })} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving || !form.spotlight_key || !form.title || !form.go_live_date} className="flex-1 bg-gold-primary hover:bg-gold-accent text-paper">
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}{editingId ? 'Save changes' : 'Create highlight'}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)} className="border-white/15 text-white hover:bg-white/10">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm" style={{ background: '#0f1a2e', border: '1px solid rgba(216,180,194,0.3)' }}>
          <DialogHeader>
            <DialogTitle className="font-display text-white">Delete highlight?</DialogTitle>
          </DialogHeader>
          <p className="font-body text-sm text-brass/80 pt-2">Delete “{confirmDelete?.title}”. This cannot be undone.</p>
          <div className="flex gap-2 pt-4">
            <Button onClick={() => remove(confirmDelete)} className="flex-1 bg-destructive hover:bg-destructive/90 text-white">Delete</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} className="border-white/15 text-white hover:bg-white/10">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-brass text-xs mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="font-body text-xs text-white/80">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ChannelChip({ on, icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 font-body text-[10px] px-1.5 py-0.5 rounded-full border" style={{
      color: on ? '#D4AF85' : 'rgba(255,255,255,0.25)',
      background: on ? 'rgba(212,175,133,0.1)' : 'transparent',
      borderColor: on ? 'rgba(212,175,133,0.3)' : 'rgba(255,255,255,0.08)',
    }}>
      <Icon size={9} /> {label}
    </span>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 rounded-md transition-colors" style={{ color: danger ? 'rgba(216,180,194,0.7)' : 'rgba(255,255,255,0.6)' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {children}
    </button>
  );
}