import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Check, Lock } from 'lucide-react';
import { extractPlacementKeys } from '@/lib/chartUtils';
import { getTradition } from '@/lib/traditions';
import { usePermissions } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import PaywallModal from '@/components/paywall/PaywallModal';

/**
 * Zodiac + Houses settings (UX-01) — replaces the single unlabeled Tradition
 * selector with two independent, labeled settings. Zodiac decides where the
 * signs start; the house system decides how the chart divides into 12 life
 * areas. Any combination is valid.
 *
 * The stored data model is unchanged: UserProgress keeps active_tradition +
 * house_system, and the tradition key is derived from the pair (sidereal →
 * vedic; tropical+placidus → modern; tropical+whole_sign → hellenistic) so
 * the interpretive lens follows the canonical profile for each combination.
 */

// Pending client decision: her spec says "Tropical only at launch; Sidereal
// comes later", written before she knew the engine already supports sidereal.
// Flip to true to hide the Sidereal option if she chooses to hold it back.
const HIDE_SIDEREAL = false;

const ZODIACS = [
  { key: 'tropical', label: 'Tropical (Western)' },
  { key: 'sidereal', label: 'Sidereal (Vedic)' },
];
const HOUSES = [
  { key: 'whole_sign', label: 'Whole Sign' },
  { key: 'placidus', label: 'Placidus' },
];

function deriveTradition(zodiac, houseSystem) {
  if (zodiac === 'sidereal') return 'vedic';
  return houseSystem === 'placidus' ? 'modern' : 'hellenistic';
}

export default function ZodiacHousesSelector({ userProgress, existingChart, onChartRegenerated }) {
  const { user } = useAuth();
  const { canSwitchTradition, tier } = usePermissions(user);
  const currentTradition = getTradition(userProgress?.active_tradition || 'modern');
  const currentZodiac = currentTradition.zodiac;
  const currentHouses = userProgress?.house_system
    || existingChart?.raw_data?.house_system
    || currentTradition.houseSystem
    || 'whole_sign';

  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(null); // { zodiac, houses }
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

  const requestChange = (zodiac, houses) => {
    if (pending) return;
    if (zodiac === currentZodiac && houses === currentHouses) return;
    if (!canSwitchTradition) { setShowPaywall(true); return; }
    setConfirming({ zodiac, houses });
  };

  const confirmChange = async () => {
    const { zodiac, houses } = confirming;
    setConfirming(null);
    setPending(true);
    setError('');
    const traditionKey = deriveTradition(zodiac, houses);
    try {
      // 1. Persist the pair (tradition derived from it) to UserProgress
      if (userProgress?.id) {
        await base44.entities.UserProgress.update(userProgress.id, {
          active_tradition: traditionKey,
          house_system: houses,
        });
      }

      // 2. Recalculate the chart with the new settings
      const raw = existingChart?.raw_data;
      if (raw?.birth_date && raw?.birth_location?.latitude != null) {
        const utcOffset = recalcOffset(raw);
        const res = await base44.functions.invoke('chartCalculator', {
          chart_type: 'natal',
          birth_date: raw.birth_date,
          birth_time: raw.birth_time || '12:00:00',
          utc_offset: utcOffset,
          birth_location: raw.birth_location,
          house_system: houses,
          tradition: traditionKey,
        });
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

      setPending(false);
      toast.success('Chart updated');
      if (onChartRegenerated) onChartRegenerated();
    } catch (err) {
      setError(err.message || 'Failed to update chart settings');
      setPending(false);
    }
  };

  const SettingRow = ({ label, tooltip, options, value, onPick }) => (
    <div className="space-y-1.5">
      <p className="font-body text-xs text-brass/70 uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-0.5">
        {options.map(opt => {
          const active = value === opt.key;
          const locked = !canSwitchTradition && !active;
          return (
            <button
              key={opt.key}
              onClick={() => onPick(opt.key)}
              disabled={pending}
              className={`flex-1 px-2 py-1.5 rounded-full font-body text-[0.6875rem] transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
                active ? 'bg-gold-primary/20 text-white font-semibold' : 'text-white/30 hover:text-white/50'
              } ${locked ? 'opacity-50' : ''}`}
            >
              {active ? <Check size={11} /> : locked ? <Lock size={9} /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="font-body text-[0.625rem] text-brass/40 leading-relaxed">{tooltip}</p>
    </div>
  );

  const zodiacOptions = HIDE_SIDEREAL ? ZODIACS.filter(z => z.key === 'tropical') : ZODIACS;

  return (
    <div className="celestial-card p-3 space-y-3">
      <SettingRow
        label="Zodiac"
        tooltip="Tropical follows the seasons and is used in most Western astrology. Sidereal (Vedic) follows the constellations."
        options={zodiacOptions}
        value={currentZodiac}
        onPick={(z) => requestChange(z, currentHouses)}
      />
      <SettingRow
        label="Houses"
        tooltip="Whole Sign gives each house one full sign. Placidus divides houses by time and your exact birth location."
        options={HOUSES}
        value={currentHouses}
        onPick={(h) => requestChange(currentZodiac, h)}
      />

      {pending && (
        <p className="font-body text-[0.625rem] text-brass/50 flex items-center gap-1.5">
          <Loader2 size={10} className="animate-spin" /> Recalculating chart…
        </p>
      )}
      {error && <p className="font-body text-[0.625rem] text-red-400/70">{error}</p>}

      {/* Locked helper for free users */}
      {!canSwitchTradition && (
        <div className="pt-1.5 space-y-2">
          <p className="font-body text-[0.625rem] text-white/70 leading-relaxed">
            Choosing your zodiac and house system — and recalculating your live chart with them — is part of Core.
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
        <PaywallModal variant="interpret" fromTier={tier} context="Zodiac & Houses settings" onClose={() => setShowPaywall(false)} />
      )}

      {/* Confirmation dialog — portaled to <body>: an ancestor card's
          backdrop-filter creates a stacking context that otherwise traps this
          fixed overlay beneath the next card (B-02). */}
      {confirming && createPortal(
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirming(null)}>
          <div
            className="celestial-card p-5 max-w-sm w-full space-y-3 animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold text-white">Recalculate your chart?</h3>
            <p className="font-body text-xs text-brass leading-relaxed">
              Your chart will recalculate with the{' '}
              <span className="text-cream">{confirming.zodiac === 'sidereal' ? 'sidereal zodiac (Lahiri ayanamsa)' : 'tropical zodiac'}</span> and{' '}
              <span className="text-cream">{confirming.houses === 'placidus' ? 'Placidus houses' : 'Whole Sign houses'}</span>.
              {confirming.zodiac !== currentZodiac && confirming.zodiac === 'sidereal' && ' Sidereal shifts every placement back about 24°, so many planets land one sign earlier.'}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirming(null)}
                className="flex-1 px-3 py-2 rounded-md font-body text-xs text-brass border border-gold-primary/30 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={confirmChange}
                disabled={pending}
                className="flex-1 px-3 py-2 rounded-md font-body text-xs font-semibold text-paper bg-gold-primary hover:bg-gold-accent disabled:opacity-50"
              >
                {pending ? 'Recalculating…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
