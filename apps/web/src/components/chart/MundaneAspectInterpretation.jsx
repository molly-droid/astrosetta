import { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { highlightSynthesisText } from '@/lib/transitUtils';
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

    invokeLLMTask('mundane-aspect-interpretation', {
      transitPlanet: item.transit_planet,
      otherPlanet: item.natal_planet,
      aspect: item.aspect,
      orb: item.orb,
      p1Sign,
      p2Sign,
    })
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