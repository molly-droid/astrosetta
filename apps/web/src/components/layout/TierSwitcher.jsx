import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getEffectiveTier } from '@/lib/permissions';
import { FlaskConical, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const TIERS = [
  { id: 'free',      label: '🆓 Free',    tier: 'free',      expires: null },
  { id: 'interpret', label: '🔭 $9',       tier: 'interpret', expires: () => new Date(Date.now() + 30 * 86400000).toISOString() },
  { id: 'calendar',  label: '📅 $14',      tier: 'calendar',  expires: () => new Date(Date.now() + 30 * 86400000).toISOString() },
  { id: 'expired',   label: '💀 Expired',  tier: 'calendar',  expires: '2024-01-01T00:00:00Z' },
];

const TIER_STYLE = {
  free:      'bg-muted border-brass/30 text-brass',
  interpret: 'bg-celestial-blue/20 border-celestial-blue/50 text-deep-blue',
  calendar:  'bg-gold-primary/20 border-gold-primary/60 text-gold-accent',
};

function deriveActiveId(user) {
  const effective = getEffectiveTier(user);
  const tier = user?.subscription_tier;
  if (tier && tier !== 'free' && effective === 'free') return 'expired';
  return tier || 'free';
}

export default function TierSwitcher({ onTierChange }) {
  const { realUser, impersonatedUser, impersonate } = useAuth();
  // When impersonating, control the impersonated user's tier; otherwise control own tier
  const targetUser = impersonatedUser || realUser;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(() => deriveActiveId(targetUser));
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync activeId when target user changes
  useEffect(() => {
    setActiveId(deriveActiveId(targetUser));
  }, [targetUser?.id, targetUser?.subscription_tier, targetUser?.subscription_expires]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!btnRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const apply = async (t) => {
    setSaving(true);
    setOpen(false);
    setActiveId(t.id);
    const expires = typeof t.expires === 'function' ? t.expires() : t.expires;

    if (impersonatedUser) {
      // Update the impersonated user's record via entity API
      const updated = await base44.entities.User.update(impersonatedUser.id, {
        subscription_tier: t.tier,
        subscription_expires: expires || null,
      });
      // Refresh impersonated user object in context
      impersonate({ ...impersonatedUser, subscription_tier: t.tier, subscription_expires: expires || null });
    } else {
      // Update own tier
      await base44.auth.updateMe({ subscription_tier: t.tier, subscription_expires: expires });
    }

    setSaving(false);
    onTierChange?.();
  };

  const styleKey = activeId === 'expired' ? 'free' : (TIER_STYLE[activeId] ? activeId : 'free');
  const styleClass = TIER_STYLE[styleKey];
  const activeLabel = TIERS.find(t => t.id === activeId)?.label || '🆓 Free';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border font-body text-[10px] font-semibold transition-all shadow-sm ${styleClass}`}
      >
        <FlaskConical size={11} />
        <span>{activeLabel}</span>
        {saving
          ? <RefreshCw size={10} className="animate-spin" />
          : open ? <ChevronUp size={10} /> : <ChevronDown size={10} />
        }
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full mb-2 left-0 z-[9999] bg-paper border border-gold-primary/30 rounded-xl shadow-xl overflow-hidden min-w-[176px]"
        >
          <p className="font-body text-[9px] uppercase tracking-widest text-brass/40 px-3 pt-2.5 pb-1">
            {impersonatedUser ? `Testing as ${impersonatedUser.full_name?.split(' ')[0] || 'user'}` : 'Test as tier'}
          </p>
          {TIERS.map(t => (
            <button
              key={t.id}
              onClick={() => apply(t)}
              className={`w-full text-left px-3 py-2 font-body text-xs transition-colors hover:bg-gold-primary/10 flex items-center justify-between ${
                activeId === t.id ? 'text-deep-blue font-semibold bg-gold-primary/10' : 'text-brass'
              }`}
            >
              <span>{t.label}</span>
              {activeId === t.id && <span className="text-[9px] text-gold-accent">✓</span>}
            </button>
          ))}
          <p className="font-body text-[8px] text-brass/30 px-3 pb-2 pt-1">
            {impersonatedUser ? 'Updates this user\'s tier instantly' : 'Page reloads after switching'}
          </p>
        </div>
      )}
    </div>
  );
}