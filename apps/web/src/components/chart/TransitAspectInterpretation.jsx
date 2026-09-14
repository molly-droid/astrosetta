import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { HOUSE_THEMES, PERSONA, highlightSynthesisText } from '@/lib/transitUtils';
import { Loader2 } from 'lucide-react';
import Eli5Button from '@/components/ui/Eli5Button';

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Module-level cache — switching between selections won't re-fetch
const cache = {};

/**
 * Fetches a dynamic, planet-and-house-specific interpretation for a
 * transit-to-natal aspect via InvokeLLM, mirroring the TransitList approach.
 * Replaces the generic static aspect definition with content tailored to
 * the actual planets, signs, houses, and orb involved.
 */
export default function TransitAspectInterpretation({ item, natalPlanets, transitPlanets }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = item?.key;

  useEffect(() => {
    if (!cacheKey) return;

    // Already cached (resolved string)?
    if (cache[cacheKey]) {
      setText(cache[cacheKey]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setText(null);

    const tP = transitPlanets?.find(p => p.name === item.transit_planet);
    const nP = natalPlanets?.find(p => p.name === item.natal_planet);
    const houseTheme = nP?.house ? HOUSE_THEMES[nP.house] || '' : '';

    const label = `Transiting ${item.transit_planet}${tP?.sign ? ` in ${tP.sign}` : ''} ${item.aspect} natal ${item.natal_planet}${nP?.sign ? ` in ${nP.sign}` : ''}${nP?.house ? `, ${ordinal(nP.house)} house` : ''} (orb ${item.orb?.toFixed(1)}°)`;

    const prompt = `${PERSONA}

${label}
Natal ${item.natal_planet}: ${nP?.sign || ''}${nP?.house ? `, ${ordinal(nP.house)} house` : ''}${houseTheme ? ` (${houseTheme})` : ''}

Write 2 sentences. Be specific to the house themes. Name one concrete awareness or action. No clichés.

CRITICAL: Use ONLY the signs, houses, and aspects provided above. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. Do NOT invent additional aspects, signs, or planetary positions not listed in the data above.`;

    base44.integrations.Core.InvokeLLM({ prompt })
      .then(res => {
        if (!cancelled) {
          cache[cacheKey] = res;
          setText(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cacheKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <Loader2 size={11} className="animate-spin text-gold-primary" />
        <span className="font-body text-[10px] text-brass italic">Interpreting...</span>
      </div>
    );
  }

  if (!text) return null;

  const tP = transitPlanets?.find(p => p.name === item.transit_planet);
  const nP = natalPlanets?.find(p => p.name === item.natal_planet);
  const eli5Context = `Transiting ${item.transit_planet}${tP?.sign ? ` in ${tP.sign}` : ''} ${item.aspect} your natal ${item.natal_planet}${nP?.house ? ` in your ${ordinal(nP.house)} house` : ''}`;

  return (
    <div className="mt-1.5">
      <p className="font-body text-[11px] text-white/80 leading-snug">
        {highlightSynthesisText(text)}
      </p>
      <Eli5Button context={eli5Context} />
    </div>
  );
}