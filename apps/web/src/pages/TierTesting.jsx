import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getEffectiveTier, getPermissions, TIER_LABELS } from '@/lib/permissions';
import { CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Mail, UserPlus, Eye, EyeOff, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaywallModal from '@/components/paywall/PaywallModal';

const TEST_ACCOUNTS = [
  { label: 'Admin (You)',     email: 'molly@astrosetta.com',        tier: 'calendar',  note: 'Full access — your chart' },
  { label: 'Test Free 1',    email: 'test.free.1@astrosetta.com',   tier: 'free',      note: "Mom's chart — free tier workflow" },
  { label: 'Test Free 2',    email: 'test.free.2@astrosetta.com',   tier: 'free',      note: "Friend's chart — mobile PWA testing" },
  { label: 'Test $9',        email: 'test.interpret@astrosetta.com',tier: 'interpret', note: "Interpretations accuracy" },
  { label: 'Test $14',       email: 'test.calendar@astrosetta.com', tier: 'calendar',  note: "Calendar export + sync" },
  { label: 'Test Churn',     email: 'test.churn@astrosetta.com',    tier: 'calendar',  note: 'Expired subscription — should downgrade', expires: '2024-01-01T00:00:00Z' },
];

const TIER_BADGE = {
  free:      'bg-muted text-brass border border-brass/30',
  interpret: 'bg-celestial-blue/15 text-celestial-blue border border-celestial-blue/30',
  calendar:  'bg-gold-primary/20 text-gold-accent border border-gold-primary/40',
};

function PermCheck({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" /> : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
      <span className={`font-body text-xs ${ok ? 'text-deep-blue/80' : 'text-red-400/80'}`}>{label}</span>
    </div>
  );
}

function TierSimulator({ user }) {
  const [simTier, setSimTier] = useState(null);
  const [simExpires, setSimExpires] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const currentTier = user?.subscription_tier || 'free';
  const currentExpires = user?.subscription_expires || '';

  const applyTier = async (tier, expires) => {
    setSaving(true);
    await base44.auth.updateMe({
      subscription_tier: tier,
      subscription_expires: expires || null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const quickSet = async (tier, expired = false) => {
    const expires = expired
      ? '2024-01-01T00:00:00Z'
      : tier === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setSimTier(tier);
    setSimExpires(expires || '');
    await applyTier(tier, expires);
  };

  const effectiveTier = getEffectiveTier({ ...user, subscription_tier: simTier || currentTier, subscription_expires: simExpires || currentExpires });
  const perms = getPermissions({ ...user, subscription_tier: simTier || currentTier, subscription_expires: simExpires || currentExpires });

  return (
    <div className="celestial-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-deep-blue">Your Account Simulator</h3>
        <span className={`font-body text-[10px] px-2 py-0.5 rounded-full border font-semibold ${TIER_BADGE[effectiveTier]}`}>
          {TIER_LABELS[effectiveTier]?.split(' ·')[0]}
          {perms.isExpired ? ' (expired)' : ''}
        </span>
      </div>

      <p className="font-body text-xs text-brass/70">
        Quickly switch your account's tier to test permission gates. Reload the app after switching to see full effect.
      </p>

      {/* Quick-set buttons */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '🆓 Set Free',         action: () => quickSet('free') },
          { label: '🔭 Set $9 Interpret',  action: () => quickSet('interpret') },
          { label: '📅 Set $14 Calendar',  action: () => quickSet('calendar') },
          { label: '💀 Set Expired',       action: () => quickSet('calendar', true) },
        ].map(b => (
          <Button key={b.label} variant="outline" size="sm" onClick={b.action} disabled={saving}
            className="font-body text-xs border-gold-primary/30 text-deep-blue/70 h-8">
            {b.label}
          </Button>
        ))}
      </div>

      {saved && <p className="font-body text-xs text-green-600 text-center">✓ Tier updated — reload to see changes app-wide</p>}

      {/* Permission matrix */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
        <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-2">Current Effective Permissions</p>
        <PermCheck ok={perms.canViewTransits} label="View transit list" />
        <PermCheck ok={perms.canViewNatalInterpretations} label="View natal interpretations" />
        <PermCheck ok={perms.canViewTransitInterpretations} label="View transit interpretations ($9+)" />
        <PermCheck ok={perms.canExportCalendar} label="Export to calendar / .ics ($14)" />
      </div>
    </div>
  );
}

function PaywallPreview() {
  const [modal, setModal] = useState(null);
  return (
    <div className="celestial-card p-4 space-y-3">
      <h3 className="font-display text-sm font-bold text-deep-blue">Paywall Preview</h3>
      <p className="font-body text-xs text-brass/70">Preview each paywall modal as it appears to users.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setModal('interpret-free')}
          className="font-body text-xs border-gold-primary/30 text-deep-blue/70 h-8">
          🔒 Free → $9 paywall
        </Button>
        <Button variant="outline" size="sm" onClick={() => setModal('calendar-free')}
          className="font-body text-xs border-gold-primary/30 text-deep-blue/70 h-8">
          🔒 Free → $14 paywall
        </Button>
        <Button variant="outline" size="sm" onClick={() => setModal('calendar-interpret')}
          className="font-body text-xs border-gold-primary/30 text-deep-blue/70 h-8 col-span-2">
          🔒 $9 → $14 upgrade prompt
        </Button>
      </div>
      {modal === 'interpret-free' && <PaywallModal variant="interpret" fromTier="free" context="Saturn square your Moon" onClose={() => setModal(null)} />}
      {modal === 'calendar-free' && <PaywallModal variant="calendar" fromTier="free" onClose={() => setModal(null)} />}
      {modal === 'calendar-interpret' && <PaywallModal variant="calendar" fromTier="interpret" onClose={() => setModal(null)} />}
    </div>
  );
}

function ChecklistSection({ title, items }) {
  const [checked, setChecked] = useState({});
  const [open, setOpen] = useState(false);
  const done = Object.values(checked).filter(Boolean).length;
  return (
    <div className="celestial-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gold-primary/5 transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-deep-blue">{title}</span>
          <span className="font-body text-[10px] text-brass/60">{done}/{items.length}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-brass/50" /> : <ChevronDown size={14} className="text-brass/50" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gold-primary/20">
          {items.map((item, i) => (
            <label key={i} className="flex items-start gap-2.5 cursor-pointer group pt-2">
              <div
                onClick={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                  checked[i] ? 'bg-gold-primary border-gold-primary' : 'border-gold-primary/30'
                }`}
              >
                {checked[i] && <span className="text-deep-blue text-[9px] font-bold">✓</span>}
              </div>
              <span className={`font-body text-xs leading-snug transition-colors ${checked[i] ? 'text-brass/40 line-through' : 'text-deep-blue/80 group-hover:text-deep-blue'}`}>
                {item}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const CHECKLISTS = [
  {
    title: '🆓 Free Tier Testing',
    items: [
      'View natal chart — all planets visible',
      'Tap Sun/Moon/Rising interpretation → appears (natal interp allowed)',
      'Tap a non-Big-Three transit → paywall triggers ($9/$14 options)',
      'Click "Export to Calendar" button → paywall triggers ($14)',
      'Verify paywall shows correct copy and pricing',
      'All transit lists visible (no interpretations)',
    ],
  },
  {
    title: '🔭 $9 Interpret Tier Testing',
    items: [
      'Tap any transit → interpretation loads (LLM-generated)',
      'Verify personal + mundane + lunar transit interpretations all work',
      'Click "Export to Calendar" → upgrade CTA for $14 appears (not fully blocked, shows upgrade)',
      'Verify $9 paywall does NOT appear (already on this tier)',
      'Learning curriculum links in interpretations work',
    ],
  },
  {
    title: '📅 $14 Calendar Tier Testing',
    items: [
      'All transit interpretations work',
      '"Export to Calendar" button appears and works',
      '.ics file downloads successfully',
      'Downloaded .ics imports correctly into Apple Calendar / Google Calendar',
      'No paywall modals appear anywhere',
      'Retrograde + lunar + natal + mundane all have working interpretations',
    ],
  },
  {
    title: '💀 Churn / Expired Testing',
    items: [
      'Set tier to "calendar" with expiry date in the past',
      'Refresh app — effective tier shows as "free"',
      'Transit interpretation click → paywall triggers',
      'Calendar export → paywall triggers',
      'Free features (transit list, natal chart) still work',
      'Resubscribe flow shows correctly',
    ],
  },
  {
    title: '🔐 Permissions Matrix',
    items: [
      'Free users cannot access $9 features',
      'Free users cannot access $14 features',
      '$9 users cannot access $14 features (export, calendar)',
      '$14 users can access everything',
      'Expired subscriptions downgrade to free correctly',
      'Every paywall shows correct CTA matching user tier',
    ],
  },
];

function InviteTestUsers({ allUsers, setUserTier }) {
  const [statuses, setStatuses] = useState({});

  const existingEmails = new Set(allUsers.map(u => u.email?.toLowerCase()));

  const invite = async (acc) => {
    setStatuses(s => ({ ...s, [acc.email]: 'inviting' }));
    await base44.users.inviteUser(acc.email, 'user');
    setStatuses(s => ({ ...s, [acc.email]: 'invited' }));
  };

  const applyTier = async (acc) => {
    const u = allUsers.find(u => u.email?.toLowerCase() === acc.email.toLowerCase());
    if (!u) return;
    setStatuses(s => ({ ...s, [acc.email]: 'setting' }));
    const expires = acc.expires ?? (acc.tier === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    await setUserTier(u.id, acc.tier, expires);
    setStatuses(s => ({ ...s, [acc.email]: 'done' }));
    setTimeout(() => setStatuses(s => ({ ...s, [acc.email]: null })), 2000);
  };

  // Skip admin account (first entry)
  const testAccounts = TEST_ACCOUNTS.slice(1);

  return (
    <div className="celestial-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus size={14} className="text-gold-accent" />
        <h3 className="font-display text-sm font-bold text-deep-blue">Test Account Setup</h3>
      </div>
      <p className="font-body text-xs text-brass/70">
        Invite these pre-defined test accounts, then set their tier once they've joined.
      </p>
      <div className="space-y-2">
        {testAccounts.map(acc => {
          const joined = existingEmails.has(acc.email.toLowerCase());
          const status = statuses[acc.email];
          const joinedUser = allUsers.find(u => u.email?.toLowerCase() === acc.email.toLowerCase());
          const effective = joinedUser ? getEffectiveTier(joinedUser) : null;
          const tierMatch = effective === acc.tier && (acc.expires ? joinedUser?.subscription_expires === acc.expires : !joinedUser?.subscription_expires || new Date(joinedUser?.subscription_expires) > new Date());

          return (
            <div key={acc.email} className="rounded-lg border border-gold-primary/15 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-body text-[9px] px-1.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${TIER_BADGE[acc.tier]}`}>
                      {acc.tier}{acc.expires ? ' expired' : ''}
                    </span>
                    <p className="font-body text-xs font-semibold text-deep-blue">{acc.label}</p>
                  </div>
                  <p className="font-body text-[10px] text-brass/50 truncate mt-0.5">{acc.email}</p>
                  <p className="font-body text-[10px] text-brass/40 italic">{acc.note}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  {!joined ? (
                    <button
                      onClick={() => invite(acc)}
                      disabled={status === 'inviting'}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gold-primary/40 font-body text-[10px] text-deep-blue/70 hover:bg-gold-primary/10 transition-all disabled:opacity-50"
                    >
                      <Mail size={10} />
                      {status === 'inviting' ? 'Sending...' : status === 'invited' ? '✓ Sent' : 'Invite'}
                    </button>
                  ) : tierMatch ? (
                    <span className="font-body text-[10px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Ready
                    </span>
                  ) : (
                    <button
                      onClick={() => applyTier(acc)}
                      disabled={status === 'setting'}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-celestial-blue/40 font-body text-[10px] text-deep-blue/70 hover:bg-celestial-blue/10 transition-all disabled:opacity-50"
                    >
                      {status === 'setting' ? <RefreshCw size={10} className="animate-spin" /> : null}
                      {status === 'done' ? '✓ Set' : status === 'setting' ? 'Setting...' : 'Set Tier'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UserRow({ u, effective, perms, realUser, impersonatedUser, onSetTier, onImpersonate, onStopImpersonate, onRefresh }) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(u.display_name || '');
  const [savingName, setSavingName] = useState(false);

  const displayName = u.display_name || u.full_name || u.email;

  const saveDisplayName = async () => {
    setSavingName(true);
    await base44.entities.User.update(u.id, { display_name: nameVal.trim() || null });
    setSavingName(false);
    setEditingName(false);
    onRefresh();
  };

  return (
    <div className="rounded-lg border border-gold-primary/15 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                placeholder={u.full_name || 'Display name...'}
                className="font-body text-xs text-deep-blue bg-paper border border-gold-primary/30 rounded px-1.5 py-0.5 outline-none w-32"
              />
              <button onClick={saveDisplayName} disabled={savingName} className="text-green-600 disabled:opacity-50"><Check size={12} /></button>
              <button onClick={() => setEditingName(false)} className="text-brass/50"><span className="text-[10px]">✕</span></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="font-body text-xs font-semibold text-deep-blue truncate">{displayName}</p>
              <button onClick={() => { setNameVal(u.display_name || ''); setEditingName(true); }} className="text-brass/40 hover:text-brass flex-shrink-0">
                <Pencil size={10} />
              </button>
            </div>
          )}
          <p className="font-body text-[10px] text-brass/50 truncate">{u.email}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`font-body text-[9px] px-1.5 py-0.5 rounded-full border font-semibold ${TIER_BADGE[effective]}`}>
            {effective}{perms.isExpired ? ' ↓' : ''}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {['free', 'interpret', 'calendar'].map(tier => (
          <button key={tier}
            onClick={() => onSetTier(u.id, tier, tier === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())}
            className={`px-2 py-0.5 rounded border font-body text-[9px] transition-all ${
              effective === tier && !perms.isExpired
                ? 'bg-gold-primary/20 border-gold-accent text-deep-blue font-semibold'
                : 'border-gold-primary/20 text-brass/60 hover:border-gold-primary/50'
            }`}>
            {tier}
          </button>
        ))}
        <button
          onClick={() => onSetTier(u.id, 'calendar', '2024-01-01T00:00:00Z')}
          className="px-2 py-0.5 rounded border font-body text-[9px] border-red-300/40 text-red-400/70 hover:border-red-300/70 transition-all">
          expired
        </button>
        {u.id !== realUser?.id && (
          impersonatedUser?.id === u.id ? (
            <button onClick={onStopImpersonate}
              className="flex items-center gap-1 px-2 py-0.5 rounded border font-body text-[9px] border-celestial-blue/50 bg-celestial-blue/10 text-deep-blue transition-all ml-auto">
              <EyeOff size={9} /> Exit
            </button>
          ) : (
            <button onClick={onImpersonate}
              className="flex items-center gap-1 px-2 py-0.5 rounded border font-body text-[9px] border-gold-primary/30 text-brass/70 hover:border-gold-primary/60 hover:bg-gold-primary/10 transition-all ml-auto">
              <Eye size={9} /> View as
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function TierTesting() {
  const { user, realUser, impersonate, stopImpersonating, impersonatedUser } = useAuth();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (realUser?.role !== 'admin') return;
    base44.entities.User.list().then(users => {
      setAllUsers(users);
      setLoadingUsers(false);
    });
  }, [realUser]);

  if (realUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <p className="font-display text-lg text-deep-blue">Admin Only</p>
          <p className="font-body text-sm text-brass/70">This page is restricted to admin accounts.</p>
        </div>
      </div>
    );
  }

  const setUserTier = async (userId, tier, expires) => {
    await base44.entities.User.update(userId, {
      subscription_tier: tier,
      subscription_expires: expires || null,
    });
    const users = await base44.entities.User.list();
    setAllUsers(users);
  };

  return (
    <div className="min-h-screen bg-cream pb-24">
      <div className="bg-paper border-b border-gold-primary/30 px-4 pt-12 pb-5 text-center space-y-1">
        <p className="font-body text-xs text-brass uppercase tracking-widest">Admin · Internal</p>
        <h1 className="font-display text-2xl font-bold text-deep-blue">Tier Testing</h1>
        <p className="font-body text-xs text-brass/70">Test permissions, paywall flows, and tier gating</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Your account simulator */}
        <TierSimulator user={user} />

        {/* Paywall preview */}
        <PaywallPreview />

        {/* All users — tier management */}
        <div className="celestial-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-deep-blue">All Users · Tier Manager</h3>
            <button onClick={() => base44.entities.User.list().then(setAllUsers)} className="text-brass/40 hover:text-brass">
              <RefreshCw size={13} />
            </button>
          </div>
          {loadingUsers ? (
            <p className="font-body text-xs text-brass/50 italic">Loading users...</p>
          ) : (
            <div className="space-y-3">
              {allUsers.map(u => {
                const perms = getPermissions(u);
                const effective = getEffectiveTier(u);
                return (
                  <UserRow
                    key={u.id}
                    u={u}
                    effective={effective}
                    perms={perms}
                    realUser={realUser}
                    impersonatedUser={impersonatedUser}
                    onSetTier={setUserTier}
                    onImpersonate={() => { impersonate(u); navigate('/'); }}
                    onStopImpersonate={stopImpersonating}
                    onRefresh={() => base44.entities.User.list().then(setAllUsers)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Invite test users */}
        <InviteTestUsers allUsers={allUsers} setUserTier={setUserTier} />

        {/* Testing checklists */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-bold text-deep-blue px-1">Testing Checklists</h2>
          {CHECKLISTS.map(cl => (
            <ChecklistSection key={cl.title} title={cl.title} items={cl.items} />
          ))}
        </div>

      </div>
    </div>
  );
}