import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, Lock } from 'lucide-react';
import { extractPlacementKeys } from '@/lib/chartUtils';
import { TRADITIONS, getTradition, traditionChangeSummary } from '@/lib/traditions';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PaywallModal from '@/components/paywall/PaywallModal';

export default function TraditionSelector({ userProgress, existingChart, onChartRegenerated }) {
  const { user } = useAuth();
  const current = userProgress?.active_tradition || 'modern';
  const { canSwitchTradition, tier } = usePermissions(user);
  const [pending, setPending] = useState(null);
  const [confirming, setConfirming] = useState(null); // the tradition key awaiting confirmation
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);

  const recalcOffset = (raw) => {
    let utcOffset = 0;
    try {
      const [y, mo, d] = raw.birth_date.split('-').map(Number);
      const bt = raw.birth_time || '12:00:00';
      const [h, mi] = bt.split(':').map(Number);
      const testDate = new Date(Date.UTC(y, mo - 1, d, h, mi));
      const tz = raw.birth_location?.timezone || 'UTC';
      const localParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(testDate);
      const get = (type) => parseInt(localParts.find(p => p.type === type)?.value);
      const localH = get('hour') % 24;
      const localMi = get('minute');
      utcOffset = (localH - testDate.getUTCHours()) + (localMi - testDate.getUTCMinutes()) / 60;
      if (utcOffset > 14) utcOffset -= 24;
      if (utcOffset < -12) utcOffset += 24;
    } catch { /* fall back to 0 */ }
    return utcOffset;
  };

  const handleActivate = async (traditionKey) => {
    if (pending || traditionKey === current) return;
    setConfirming(traditionKey);
  };

  const confirmActivation = async () => {
    const traditionKey = confirming;
    setConfirming(null);
    setPending(traditionKey);
    setError('');
    const t = getTradition(traditionKey);
    try {
      // 1. Persist active_tradition + canonical house_system to UserProgress
      if (userProgress?.id) {
        await base44.entities.UserProgress.update(userProgress.id, {
          active_tradition: traditionKey,
          house_system: t.houseSystem,
        });
      }

      // 2. Recalculate chart with the tradition's canonical settings
      const raw = existingChart?.raw_data;
      if (raw?.birth_date && raw?.birth_location?.latitude != null) {
        const utcOffset = recalcOffset(raw);
        const payload = {
          chart_type: 'natal',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time || '12:00:00',
          utc_offset: utcOffset,
          birth_location: raw.birth_location,
          house_system: t.houseSystem,
          tradition: traditionKey,
        };
        const res = await base44.functions.invoke('chartCalculator', payload);
        const chartData = res.data;
        if (chartData?.error) throw new Error(chartData.error);

        const enrichedChartData = { ...chartData, birth_location: raw.birth_location };
        const placementKeys = extractPlacementKeys(enrichedChartData);
        const sunPlanet = enrichedChartData.planets?.find(p => p.name === 'Sun');
        const moonPlanet = enrichedChartData.planets?.find(p => p.name === 'Moon');
        const ascSign = enrichedChartData.angles?.ascendant?.sign || '';

        await base44.entities.Chart.update(existingChart.id, {
          raw_data: enrichedChartData,
          placement_keys: placementKeys,
          ascendant_sign: ascSign,
          sun_sign: sunPlanet?.sign || '',
          moon_sign: moonPlanet?.sign || '',
          calculated_at: new Date().toISOString(),
        });
      }

      setPending(null);
      toast.success(`Chart updated to ${t.label}`);
      if (onChartRegenerated) onChartRegenerated();
    } catch (err) {
      setError(err.message || 'Failed to switch tradition');
      setPending(null);
    }
  };

  return (
    <div className="celestial-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-brass/60 text-[0.8125rem]">⊕</span>
        <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Tradition</p>
      </div>

      {/* Segmented pill control */}
      <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-0.5">
        {TRADITIONS.map(opt => {
          const active = current === opt.key;
          const isPending = pending === opt.key;
          const locked = !canSwitchTradition && !active;
          return (
            <button
              key={opt.key}
              onClick={() => (locked ? null : handleActivate(opt.key))}
              disabled={!!pending || locked}
              className={`flex-1 px-2 py-1.5 rounded-full font-body text-[0.6875rem] transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                active ? 'bg-gold-primary/20 text-white font-semibold' : 'text-white/30 hover:text-white/50'
              } ${locked ? 'opacity-50' : ''}`}
            >
              {isPending ? (
                <Loader2 size={11} className="animate-spin" />
              ) : active ? (
                <Check size={11} />
              ) : locked ? (
                <Lock size={9} />
              ) : null}
              <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{opt.glyph}</span>
              <span className="hidden sm:inline">{opt.short}</span>
            </button>
          );
        })}
      </div>

      <p className="font-body text-[0.625rem] text-brass/40 leading-relaxed">
        {getTradition(current).descriptor}
        {pending && ' · Recalculating chart…'}
      </p>

      {error && <p className="font-body text-[0.625rem] text-red-400/70">{error}</p>}

      {/* Locked helper for free users */}
      {!canSwitchTradition && (
        <div className="pt-1.5 space-y-2">
          <p className="font-body text-[0.625rem] text-white/70 leading-relaxed">
            Switching your live chart's tradition — recalculate with a sidereal zodiac, whole-sign houses, and classical rulerships — is part of Core.
          </p>
          <button
            onClick={() => setShowPaywall(true)}
            className="inline-flex items-center gap-1.5 bg-gold-primary hover:bg-gold-accent text-deep-blue font-body text-xs font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Unlock Core — $5.55/mo
          </button>
        </div>
      )}

      {showPaywall && (
        <PaywallModal variant="interpret" fromTier={tier} context="Tradition switcher" onClose={() => setShowPaywall(false)} />
      )}

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirming(null)}>
          <div
            className="celestial-card p-5 max-w-sm w-full space-y-3 animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl text-gold-accent" style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>
                {getTradition(confirming).glyph}
              </span>
              <h3 className="font-display text-base font-bold text-white">Switch to {getTradition(confirming).label}?</h3>
            </div>
            <p className="font-body text-xs text-brass leading-relaxed">
              Your chart will recalculate with{' '}
              <span className="text-cream">{traditionChangeSummary(confirming).zodiac}</span> and{' '}
              <span className="text-cream">{traditionChangeSummary(confirming).houses}</span>.{' '}
              {traditionChangeSummary(confirming).lens}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirming(null)}
                className="flex-1 px-3 py-2 rounded-md font-body text-xs text-brass border border-gold-primary/30 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmActivation}
                disabled={!!pending}
                className="flex-1 px-3 py-2 rounded-md font-body text-xs font-semibold text-paper bg-gold-primary hover:bg-gold-accent disabled:opacity-50"
              >
                {pending ? 'Recalculating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}