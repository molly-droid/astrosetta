import React, { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, Users, Sparkles } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';
import { highlightSynthesisText, PLANET_GLYPHS } from '@/lib/transitUtils';
import SignName from '@/components/ui/SignName';

const ASPECT_SYMBOLS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };
const ASPECT_COLORS = { conjunction: '#C9A961', opposition: '#c0392b', trine: '#2980b9', square: '#c0392b', sextile: '#27ae60', quincunx: '#8e44ad', semisextile: '#27ae60', semisquare: '#c0392b', sesquisquare: '#c0392b' };

/**
 * Composite view for the chart-reading page. The composite wheel itself now
 * renders at the top of the page (in the PageHeader slot) when Composite is
 * selected, so this component shows only the relationship's content: a
 * Big-3 strip for the relationship, the LLM composite reading, and a grounded
 * "Built-in Dynamics" list of the composite chart's tightest internal aspects
 * (the relationship's wired-in chemistry and tension points).
 */
export default function CompositeView({ userChart, partnerChart, user, composite }) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [aspectsExpanded, setAspectsExpanded] = useState(false);

  useEffect(() => {
    if (!composite) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const raw = composite.raw_data;
        const userName = userChart?.name || user?.display_name || user?.full_name || 'You';
        const partnerName = partnerChart?.name || 'your partner';
        const planetsLine = (raw.planets || [])
          .map((p) => `${p.name} in ${p.sign}${p.house ? ` (${p.house}H)` : ''}`)
          .join(', ');
        const aspectsLine = (raw.aspects || [])
          .slice(0, 16)
          .map((a) => `${a.planet1} ${a.aspect} ${a.planet2} (orb ${a.orb?.toFixed(1)}°)`)
          .join('; ');
        const res = await invokeLLMTask('composite-overview', {
          userName,
          partnerName,
          big3: `☉ ${raw.sun_sign || '?'} · ☽ ${raw.moon_sign || '?'} · ASC ${raw.ascendant_sign || '?'}`,
          planetsLine,
          aspectsLine,
        });
        if (!cancelled) { setReading(res); setLoading(false); }
      } catch {
        if (!cancelled) { setError('Could not generate the composite reading.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [composite]);

  if (!composite) {
    return (
      <div className="text-center py-8">
        <p className="font-body text-sm text-brass">Composite chart unavailable for this pairing.</p>
      </div>
    );
  }

  const raw = composite.raw_data;
  const big3 = [
    { glyph: '☉', label: 'Sun', value: raw.sun_sign },
    { glyph: '☽', label: 'Moon', value: raw.moon_sign },
    { glyph: 'AC', label: 'Rising', value: raw.ascendant_sign },
  ];
  const topAspects = (raw.aspects || [])
    .filter(a => ['conjunction', 'opposition', 'trine', 'square', 'sextile'].includes(a.aspect))
    .sort((a, b) => (a.orb ?? 9) - (b.orb ?? 9))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      {/* The relationship's Big 3 */}
      <div className="flex justify-center gap-8 py-1">
        {big3.map(({ glyph, label, value }) => (
          <div key={label} className="text-center">
            <div className="text-xl text-gold-accent font-display">{glyph}</div>
            <div className="text-[10px] font-body uppercase tracking-widest text-brass">{label}</div>
            <div className="text-sm font-display font-bold text-cream"><SignName sign={value} /></div>
          </div>
        ))}
      </div>

      {/* Reading */}
      <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025]">
        <CollapsibleCardHeader
          icon={<Users size={14} />}
          title="The Relationship"
          subtitle={`☉ ${raw.sun_sign || '?'} · ☽ ${raw.moon_sign || '?'} · ASC ${raw.ascendant_sign || '?'}`}
          expanded={expanded}
          loading={loading}
          onToggle={() => setExpanded(!expanded)}
        />
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
            {loading && (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={16} className="animate-spin text-gold-primary" />
                <span className="font-body text-xs text-brass/50 italic">Reading the composite…</span>
              </div>
            )}
            {error && <p className="font-body text-xs text-gold-accent/70 italic">{error}</p>}
            {reading && (
              <div className="space-y-3">
                <p className="font-body text-sm text-white/85 leading-relaxed">{highlightSynthesisText(reading.essence, undefined, 'text-gold-accent')}</p>
                {reading.strengths?.length > 0 && (
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Gifts of the Bond</p>
                    <ul className="space-y-1">
                      {reading.strengths.map((s, i) => (
                        <li key={i} className="font-body text-xs text-white/80 leading-relaxed">✦ {highlightSynthesisText(s, undefined, 'text-gold-accent')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {reading.tensions?.length > 0 && (
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-1">Friction to Navigate</p>
                    <ul className="space-y-1">
                      {reading.tensions.map((t, i) => (
                        <li key={i} className="font-body text-xs text-white/80 leading-relaxed">· {highlightSynthesisText(t, undefined, 'text-gold-accent')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {reading.north_star && (
                  <p className="font-body text-sm text-gold-accent italic leading-relaxed">{highlightSynthesisText(reading.north_star, undefined, 'text-gold-accent')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Built-in dynamics — the composite chart's tightest internal aspects,
          grounded in the calculated midpoint chart (no LLM, no hallucination). */}
      {topAspects.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-white/[0.025]">
          <CollapsibleCardHeader
            icon={<Sparkles size={14} />}
            title="Built-in Dynamics"
            subtitle="The relationship's wired-in aspects"
            expanded={aspectsExpanded}
            onToggle={() => setAspectsExpanded(!aspectsExpanded)}
          />
          {aspectsExpanded && (
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.05] space-y-2">
              {topAspects.map((a, i) => {
                const sym = ASPECT_SYMBOLS[a.aspect] || '◆';
                const color = ASPECT_COLORS[a.aspect] || 'var(--gold-accent)';
                const g1 = PLANET_GLYPHS[a.planet1] || a.planet1[0];
                const g2 = PLANET_GLYPHS[a.planet2] || a.planet2[0];
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-sm w-5 text-center" style={{ color: 'var(--gold-accent)' }}>{g1}</span>
                    <span className="text-sm w-5 text-center" style={{ color }}>{sym}</span>
                    <span className="text-sm w-5 text-center" style={{ color: 'var(--gold-accent)' }}>{g2}</span>
                    <span className="font-body text-xs text-white/80 flex-1">{a.planet1} {a.aspect} {a.planet2}</span>
                    <span className="font-body text-[10px] text-brass/50">{a.orb?.toFixed(1)}°</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}