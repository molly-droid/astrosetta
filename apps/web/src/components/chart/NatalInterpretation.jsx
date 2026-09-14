import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getHouseName } from '@/lib/houseUtils';
import { mergeNatalPoints, PERSONA } from '@/lib/transitUtils';
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

function buildPrompt(item, chartData, skyMode, transitAspects) {
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
    return `You are an expert astrologer. The transiting ${item.name} is currently at ${item.degree?.toFixed(1)}° ${item.sign}${item.retrograde ? ', retrograde' : ''}.

CRITICAL: ${item.name} is in ${item.sign} — use ONLY this sign. Do NOT rely on your own knowledge of where planets currently are; your training data is outdated. Do NOT invent aspects, ingresses, or other planetary positions not provided in this prompt.

Write 3-4 sentences about what this transit brings — the collective energy it carries, what it activates or stirs up, and what to pay attention to while it moves through ${item.sign}. Be specific and insightful, not generic. No headers, no markdown, no greetings.`;
  }

  if (item.type === 'planet') {
    const houseName = getHouseName(item.house);
    const planetAspects = aspects.filter(a => a.planet1 === item.name || a.planet2 === item.name);
    const aspectList = planetAspects.map(a => {
      const other = a.planet1 === item.name ? a.planet2 : a.planet1;
      return `${a.aspect} ${other}`;
    }).join(', ');

    return `You are an expert astrologer writing for someone with ${ctx}.

Interpret ${item.name} in ${item.sign} in the ${houseName}${item.retrograde ? ', retrograde' : ''}${aspectList ? `, with aspects: ${aspectList}` : ''}.

Write 3-4 sentences. Cover: the core psychological drive of THIS specific placement (not generic ${item.name} descriptions), how it manifests practically in their daily life through the ${houseName} themes, and one growth edge or shadow potential to watch for. Be specific to ${item.sign} and the ${houseName}. No headers, no markdown, no greetings.`;
  }

  if (item.type === 'sign') {
    const planetsInSign = planets.filter(p => p.sign === item.sign);
    const planetList = planetsInSign.map(p => `${p.name} in the ${getHouseName(p.house)}`).join(', ');

    return `You are an expert astrologer writing for someone with ${ctx}.

Explain the ${item.sign} archetype${planetList ? ` — in their chart, they have ${planetList} in ${item.sign}` : ''}.

Write 3-4 sentences. Cover: the core motivation and style of ${item.sign}, how it specifically colors their chart given their placements, and one thing to be aware of about this sign's energy. Be insightful and specific, not generic. No headers, no markdown, no greetings.`;
  }

  if (item.type === 'house') {
    const houseName = getHouseName(item.number);
    const planetsInHouse = planets.filter(p => p.house === item.number);
    const planetList = planetsInHouse.map(p => `${p.name} in ${p.sign}`).join(', ');

    return `You are an expert astrologer writing for someone with ${ctx}.

Interpret the ${houseName} with ${item.sign} on the cusp${planetList ? `, containing ${planetList}` : ''}.

Write 3-4 sentences. Cover: the life themes and domains this house governs, how having ${item.sign} on the cusp specifically shapes these themes for them, and what to pay attention to in this area of life. Be specific to ${item.sign} and the ${houseName}. No headers, no markdown, no greetings.`;
  }

  if (item.type === 'aspect') {
    const p1 = planets.find(p => p.name === item.planet1);
    const p2 = planets.find(p => p.name === item.planet2);
    const p1Detail = p1 ? `${item.planet1} in ${p1.sign} (${getHouseName(p1.house)})` : item.planet1;
    const p2Detail = p2 ? `${item.planet2} in ${p2.sign} (${getHouseName(p2.house)})` : item.planet2;

    return `You are an expert astrologer writing for someone with ${ctx}.

Interpret the natal ${item.aspect} between ${p1Detail} and ${p2Detail} (orb ${item.orb?.toFixed(1)}°).

Write 3-4 sentences. Cover: the core psychological dynamic this aspect creates between these specific planets in these specific signs and houses, how it tends to play out in their life, and one way to work with it consciously. Be specific — not generic aspect descriptions. No headers, no markdown, no greetings.`;
  }

  if (item.type === 'transit_planet') {
    const allNatal = mergeNatalPoints(raw);
    const aspects = (transitAspects || []).map(ta => {
      const natalP = allNatal.find(p => p.name === ta.natal_planet);
      return `${ta.aspect} natal ${ta.natal_planet}${natalP?.sign ? ` in ${natalP.sign}` : ''}${natalP?.house ? ` (${getHouseName(natalP.house)})` : ''} (orb ${ta.orb?.toFixed(1)}°)`;
    }).join(', ');
    return `You are an expert astrologer. The transiting ${item.name} is at ${item.degree?.toFixed(1)}° ${item.sign}${item.retrograde ? ', retrograde' : ''}.${aspects ? `\n\nThis transit is currently making these aspects to your natal chart: ${aspects}.` : ''}

CRITICAL: ${item.name} is in ${item.sign} — use ONLY this sign. Do NOT rely on your own knowledge of where planets currently are; your training data is outdated. Use ONLY the aspects listed above — do NOT invent aspects, ingresses, or other planetary positions not provided in this prompt.

Write 3-4 sentences about what this transit activates${aspects ? ' — grounded in the specific aspects above. Reference the natal planets and houses it touches' : ' and how to work with it constructively'}. Be specific to ${item.sign} and the nature of ${item.name}. No headers, no markdown, no greetings.`;
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

    const prompt = buildPrompt(item, chartData, skyMode, transitAspects);
    if (!prompt) return;

    const fullPrompt = `${PERSONA}\n\n${prompt}`;

    let cancelled = false;
    setLoading(true);
    setText(null);

    base44.integrations.Core.InvokeLLM({ prompt: fullPrompt })
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