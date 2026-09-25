import { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { getHouseName } from '@/lib/houseUtils';
import { mergeNatalPoints } from '@/lib/transitUtils';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { Loader2 } from 'lucide-react';
import Eli5Button from '@/components/ui/Eli5Button';

/** Plain-English description of an interpretation item, for the ELI5 button. */
function buildEli5Context(item, skyMode) {
  if (!item) return '';
  if (skyMode && item.type === 'planet') {
    return `${item.name} is moving through ${item.sign} in the sky right now`;
  }
  if (item.type === 'planet') {
    return `${item.name} in ${item.sign} in your ${getHouseName(item.house)}`;
  }
  if (item.type === 'sign') return `${item.sign}`;
  if (item.type === 'house') return `your ${getHouseName(item.number)} with ${item.sign} on the cusp`;
  if (item.type === 'aspect') return `the ${item.aspect} between your ${item.planet1} and your ${item.planet2}`;
  if (item.type === 'transit_planet') {
    return `transiting ${item.name} in ${item.sign} right now`;
  }
  return '';
}

const cache = {};

// Assembles the astrological facts for the 'natal-interpretation' server
// task — the prompt template itself lives in
// supabase/functions/_shared/llm_tasks/tasks_chart.ts.
function buildTaskParams(item, chartData, skyMode, transitAspects) {
  const raw = chartData || {};
  const sun = raw.sun_sign || '';
  const moon = raw.moon_sign || '';
  const asc = raw.ascendant_sign || '';
  const ctx = `Sun in ${sun}, Moon in ${moon}, Rising ${asc}`;
  const planets = raw.planets || [];
  const aspects = (raw.aspects || []).filter(a =>
    ['strong', 'exact', 'moderate'].includes(a.strength)
  );

  // Sky mode: planets are transit positions
  if (skyMode && item.type === 'planet') {
    return { kind: 'sky_planet', name: item.name, degree: item.degree, sign: item.sign, retrograde: !!item.retrograde };
  }

  if (item.type === 'planet') {
    const houseName = getHouseName(item.house);
    const planetAspects = aspects.filter(a => a.planet1 === item.name || a.planet2 === item.name);
    const aspectList = planetAspects.map(a => {
      const other = a.planet1 === item.name ? a.planet2 : a.planet1;
      return `${a.aspect} ${other}`;
    }).join(', ');
    return { kind: 'planet', ctx, name: item.name, sign: item.sign, houseName, retrograde: !!item.retrograde, aspectList };
  }

  if (item.type === 'sign') {
    const planetsInSign = planets.filter(p => p.sign === item.sign);
    const planetList = planetsInSign.map(p => `${p.name} in the ${getHouseName(p.house)}`).join(', ');
    return { kind: 'sign', ctx, sign: item.sign, planetList };
  }

  if (item.type === 'house') {
    const houseName = getHouseName(item.number);
    const planetsInHouse = planets.filter(p => p.house === item.number);
    const planetList = planetsInHouse.map(p => `${p.name} in ${p.sign}`).join(', ');
    return { kind: 'house', ctx, houseName, sign: item.sign, planetList };
  }

  if (item.type === 'aspect') {
    const p1 = planets.find(p => p.name === item.planet1);
    const p2 = planets.find(p => p.name === item.planet2);
    const p1Detail = p1 ? `${item.planet1} in ${p1.sign} (${getHouseName(p1.house)})` : item.planet1;
    const p2Detail = p2 ? `${item.planet2} in ${p2.sign} (${getHouseName(p2.house)})` : item.planet2;
    return { kind: 'aspect', ctx, aspect: item.aspect, orb: item.orb, p1Detail, p2Detail };
  }

  if (item.type === 'transit_planet') {
    const allNatal = mergeNatalPoints(raw);
    const aspectsStr = (transitAspects || []).map(ta => {
      const natalP = allNatal.find(p => p.name === ta.natal_planet);
      return `${ta.aspect} natal ${ta.natal_planet}${natalP?.sign ? ` in ${natalP.sign}` : ''}${natalP?.house ? ` (${getHouseName(natalP.house)})` : ''} (orb ${ta.orb?.toFixed(1)}°)`;
    }).join(', ');
    return { kind: 'transit_planet', name: item.name, degree: item.degree, sign: item.sign, retrograde: !!item.retrograde, aspects: aspectsStr };
  }

  return null;
}

export default function NatalInterpretation({ item, chartData, skyMode = false, transitAspects = null }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = `${item?.key}_${skyMode}`;

  useEffect(() => {
    if (!cacheKey) return;
    if (cache[cacheKey]) { setText(cache[cacheKey]); return; }

    const params = buildTaskParams(item, chartData, skyMode, transitAspects);
    if (!params) return;

    let cancelled = false;
    setLoading(true);
    setText(null);

    invokeLLMTask('natal-interpretation', params)
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

  return (
    <div className="mt-1.5">
      <p className="font-body text-[11px] text-white/80 leading-snug">
        {highlightSynthesisText(text)}
      </p>
      <Eli5Button context={buildEli5Context(item, skyMode)} />
    </div>
  );
}