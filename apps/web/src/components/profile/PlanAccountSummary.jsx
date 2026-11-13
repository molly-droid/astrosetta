import React from 'react';
import { getEffectiveTier } from '@/lib/permissions';
import { chartSigns } from '@/lib/chartSigns';

export default function PlanAccountSummary({ user, chart }) {
  const tier = getEffectiveTier(user);
  const paid = ['interpret', 'calendar'].includes(tier);
  const expired = !paid && ['interpret', 'calendar'].includes(user?.subscription_tier);
  const signs = chartSigns(chart);
  const period = user?.subscription_billing_period;
  const periodLabel = !paid || !['stripe', 'apple', 'google'].includes(user?.subscription_source) ? 'No billing'
    : period === 'monthly' ? 'Monthly' : period === 'yearly' ? 'Yearly' : 'Billing period unavailable';

  return (
    <section aria-label="Your plan and chart" className="rounded-xl border border-gold-primary/25 bg-white/[0.03] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-white">Your membership</h2>
        <div className="flex flex-wrap items-center gap-2">
          {expired && <span className="rounded-full border border-red-300/40 px-3 py-1 font-body text-xs text-red-300">Expired</span>}
          <span className="rounded-full border border-gold-primary/40 bg-gold-primary/10 px-3 py-1 font-body text-xs text-gold-accent">
            {tier === 'calendar' ? 'Premium' : tier === 'interpret' ? 'Core' : 'Free'}
          </span>
          <span className="rounded-full border border-white/20 px-3 py-1 font-body text-xs text-white/80">{periodLabel}</span>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {[{ key: 'sun', label: 'Sun', glyph: '☉' }, { key: 'moon', label: 'Moon', glyph: '☽' }, { key: 'rising', label: 'Rising', glyph: 'AC' }].map(item => (
          <div key={item.key} className="min-w-0 text-center">
            <dt className="font-body text-xs text-brass"><span aria-hidden="true" className="mr-1 text-gold-accent">{item.glyph}</span>{item.label}</dt>
            <dd className="mt-1 font-display text-sm text-white break-words">{signs[item.key] || 'Not available'}</dd>
          </div>
        ))}
      </dl>
      {!signs.rising && <p className="font-body text-xs leading-relaxed text-white/60">Add your birth time in My Info to calculate your rising sign.</p>}
    </section>
  );
}
