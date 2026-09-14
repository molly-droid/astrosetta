import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { highlightSynthesisText, PERSONA } from '@/lib/transitUtils';
import { Loader2 } from 'lucide-react';
import Eli5Button from '@/components/ui/Eli5Button';

const cache = {};

export default function MundaneAspectInterpretation({ item, transitPlanets = null }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = item?.key;

  useEffect(() => {
    if (!cacheKey) return;
    if (cache[cacheKey]) { setText(cache[cacheKey]); return; }

    let cancelled = false;
    setLoading(true);
    setText(null);

    const p1 = transitPlanets?.find(p => p.name === item.transit_planet);
    const p2 = transitPlanets?.find(p => p.name === item.natal_planet);
    const p1Sign = p1?.sign || '';
    const p2Sign = p2?.sign || '';

    const prompt = `${PERSONA}

You are an expert astrologer. The transiting ${item.transit_planet}${p1Sign ? ` in ${p1Sign}` : ''} is in a ${item.aspect} with transiting ${item.natal_planet}${p2Sign ? ` in ${p2Sign}` : ''} (orb ${item.orb?.toFixed(1)}°). This is a mundane/collective aspect — it affects everyone, not just one person's chart.

Write 2-3 sentences about what this sky aspect means collectively — the energy it brings to the collective consciousness, what it tends to activate or surface in the world, and what to pay attention to while it's active. Be specific to these two planets in their current signs and this aspect type. No headers, no markdown, no greetings.

CRITICAL: Use ONLY the signs provided above for these planets. Do NOT rely on your own knowledge of where planets currently are — your training data is outdated. ${item.transit_planet} is in ${p1Sign} and ${item.natal_planet} is in ${p2Sign}. Do NOT invent additional aspects or planetary positions not listed above.`;

    base44.integrations.Core.InvokeLLM({ prompt })
      .then(res => {
        if (!cancelled) {
          cache[cacheKey] = res;
          setText(res);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });

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

  const p1 = transitPlanets?.find(p => p.name === item.transit_planet);
  const p2 = transitPlanets?.find(p => p.name === item.natal_planet);
  const eli5Context = `${item.transit_planet}${p1?.sign ? ` in ${p1.sign}` : ''} ${item.aspect} ${item.natal_planet}${p2?.sign ? ` in ${p2.sign}` : ''} in the sky right now`;

  return (
    <div className="mt-1.5">
      <p className="font-body text-[11px] text-white/80 leading-snug">
        {highlightSynthesisText(text)}
      </p>
      <Eli5Button context={eli5Context} />
    </div>
  );
}