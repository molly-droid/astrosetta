import React, { useState } from 'react';
import { Eye, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const OPTIONS = [
  { value: 'free',      label: 'Free',    hint: 'No paid features' },
  { value: 'interpret', label: 'Core',    hint: '$5.55/mo tier' },
  { value: 'calendar',  label: 'Premium', hint: '$7.77/mo tier' },
];

const EXPIRES_IN_30_DAYS = () => new Date(Date.now() + 30 * 86400000).toISOString();

/**
 * Admin-only tier preview — sets the admin's own subscription_tier so the
 * whole app (including components that read subscription_tier directly) renders
 * as the chosen tier. Reloads after switching so AuthContext re-fetches.
 */
export default function SettingsTab() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(null);

  const current = user?.subscription_tier && user.subscription_tier !== 'free'
    ? user.subscription_tier
    : 'free';

  const handleSelect = async (opt) => {
    setSaving(opt.value);
    try {
      await base44.auth.updateMe({
        subscription_tier: opt.value,
        subscription_expires: opt.value === 'free' ? null : EXPIRES_IN_30_DAYS(),
      });
      setTimeout(() => window.location.reload(), 150);
    } catch {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gold-primary/20 bg-white/[0.025] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 w-9 h-9 rounded-full bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center">
            <Eye size={16} className="text-gold-accent" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-white">Preview as tier</p>
            <p className="font-body text-xs text-white/60 leading-relaxed mt-1">
              Sets your admin account's subscription tier so the whole app renders as a Free, Core, or Premium member. Your current tier is{' '}
              <span className="text-gold-accent font-semibold">
                {current === 'interpret' ? 'Core' : current === 'calendar' ? 'Premium' : 'Free'}
              </span>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {OPTIONS.map((opt) => {
            const selected = current === opt.value;
            const isSaving = saving === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt)}
                disabled={!!saving}
                className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-3 text-left transition-all disabled:opacity-50 ${
                  selected
                    ? 'border-gold-primary bg-gold-primary/15'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-gold-primary/40'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span className={`font-display text-sm font-semibold ${selected ? 'text-gold-accent' : 'text-white'}`}>
                    {opt.label}
                  </span>
                  {isSaving
                    ? <Loader2 size={13} className="text-gold-accent ml-auto animate-spin" />
                    : selected
                      ? <Check size={13} className="text-gold-accent ml-auto" />
                      : null}
                </div>
                <span className="font-body text-[10px] text-white/45">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}