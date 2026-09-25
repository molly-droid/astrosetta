import React, { useState } from 'react';
import { getTransitNatalFormations } from '@/lib/transitNatalFormations';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { useDynamicsInterpretation } from './useDynamicsInterpretation';
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import CollapsibleCardHeader from '@/components/ui/CollapsibleCardHeader';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '♹\uFE0E',
};

const SOURCE_STYLE = {
  transit: { color: '#7dd49a', label: 'transiting' },
  natal:   { color: '#D4AF85', label: 'natal' },
};

// Hallucination safeguard: drop any sentence that names a celestial body
// not actually present in the formation, so every claim stays grounded in data.
const ALL_PLANET_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Ascendant', 'Descendant', 'Midheaven', 'Lilith'];

function sanitizeField(text, allowedSet) {
  if (!text || typeof text !== 'string') return text;
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text];
  const kept = sentences.filter(s => {
    for (const name of ALL_PLANET_NAMES) {
      if (allowedSet.has(name)) continue;
      if (new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`, 'i').test(s)) return false;
    }
    return true;
  });
  return kept.join(' ').trim() || text;
}

function sanitizeReading(reading, formation) {
  if (!reading || !formation) return reading;
  const allowed = new Set(formation.planets);
  const out = {};
  for (const [k, v] of Object.entries(reading)) out[k] = typeof v === 'string' ? sanitizeField(v, allowed) : v;
  return out;
}

/**
 * Planner banner surfacing aspect patterns that span BOTH the current
 * transiting planets and the user's natal placements — i.e. a transiting
 * body completing or triggering a configuration against the natal chart.
 * Pure computation — no LLM call. Instant.
 */
// Assembles the fact block for the 'transit-formation' server task — the
// grounding rules and JSON schema live with the task in
// supabase/functions/_shared/llm_tasks/tasks_dynamics.ts.
function buildFormationFacts(p) {
  const planetLines = (p.planetDetails || [])
    .map(pd => {
      const house = pd.source === 'natal' && pd.house ? ` · ${pd.house}H` : '';
      return `- ${pd.name} ${pd.source === 'transit' ? '(transiting)' : '(natal)'} in ${pd.sign}${house} at ${pd.degree?.toFixed(1)}°${pd.retrograde ? ' retrograde' : ''}`;
    })
    .join('\n');
  const aspectLines = (p.aspects || [])
    .map(a => `- ${a.planet1} ${a.aspect} ${a.planet2} (${a.orb?.toFixed(1)}° orb${a.transitInvolved ? ', transit-involved' : ''})`)
    .join('\n');
  return `Pattern type: ${p.type}
Planets involved (transiting vs natal tagged):
${planetLines}
${p.apex ? `Apex planet: ${p.apex}` : ''}
${p.element ? `Elemental theme: ${p.element}` : ''}
Aspect web:
${aspectLines}`;
}

const READING_ORDER = [
  ['overview', 'Overview'],
  ['dynamics', 'Dynamics'],
  ['opportunity', 'Opportunity'],
  ['challenge', 'Caution'],
  ['today_focus', "Today's Focus"],
];

function FormationReading({ reading }) {
  return (
    <div className="space-y-1.5">
      {READING_ORDER.map(([k, label]) => reading[k] ? (
        <div key={k} className="space-y-0.5">
          <p className="font-body text-[9px] uppercase tracking-widest text-gold-accent/70">{label}</p>
          <p className="font-body text-xs text-white/85 leading-relaxed">{highlightSynthesisText(reading[k], null, 'text-gold-accent')}</p>
        </div>
      ) : null)}
    </div>
  );
}

function FormationInterpretation({ chart, dateKey, formation, expanded }) {
  const sectionKey = `tnf_${dateKey || 'today'}_${formation.type}_${[...formation.planets].sort().join('_')}`;
  const facts = buildFormationFacts(formation);
  const { reading, loading } = useDynamicsInterpretation(chart, sectionKey, 'transit-formation', { facts }, expanded);
  if (!expanded) return null;
  return (
    <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Sparkles size={10} className="text-gold-accent" />
        <span className="font-body text-[9px] uppercase tracking-widest text-brass/50">Interpretation</span>
        {loading && <Loader2 size={10} className="animate-spin text-gold-primary ml-1" />}
      </div>
      {loading && !reading ? (
        <p className="font-body text-[10px] text-brass/50 italic">Reading the pattern…</p>
      ) : reading ? (
        <FormationReading reading={sanitizeReading(reading, formation)} />
      ) : null}
    </div>
  );
}

export default function TransitNatalFormationsBanner({ transits, chart, dateKey }) {
  const [cardOpen, setCardOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(-1);
  const formations = getTransitNatalFormations(transits?.transitPlanets, transits?.natalPlanets);

  if (formations.length === 0) return null;

  const handleCardToggle = () => {
    const newOpen = !cardOpen;
    setCardOpen(newOpen);
    if (!newOpen) setExpandedIdx(-1);
  };

  const handleItemToggle = (i) => {
    setExpandedIdx(expandedIdx === i ? -1 : i);
  };

  return (
    <div className="celestial-card overflow-hidden">
      {/* Header */}
      <CollapsibleCardHeader
        icon={<Sparkles size={14} />}
        title="Transit‑Natal Formations"
        subtitle={`${formations.length} pattern${formations.length !== 1 ? 's' : ''} activated between the sky & your chart`}
        expanded={cardOpen}
        onToggle={handleCardToggle}
      />

      {cardOpen && (
        <div className="border-t border-gold-primary/15 px-4 py-3 space-y-2">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SOURCE_STYLE.transit.color }} />
              <span className="font-body text-[9px] text-brass/60 uppercase tracking-wide">Transiting</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: SOURCE_STYLE.natal.color }} />
              <span className="font-body text-[9px] text-brass/60 uppercase tracking-wide">Natal</span>
            </div>
          </div>

          {formations.map((p, i) => {
            const isExpanded = expandedIdx === i;
            const cardColor = '#9DB4C8';
            const cardBg = 'rgba(157,180,200,0.12)';
            const cardBorder = 'rgba(157,180,200,0.35)';
            return (
              <div
                key={i}
                className="rounded-lg overflow-hidden border"
                style={{ borderColor: cardBorder, background: cardBg }}
              >
                <button
                  onClick={() => handleItemToggle(i)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={{ fontVariantEmoji: 'text', fontVariant: 'normal', color: cardColor }}>{'△\uFE0E'}</span>
                    <div className="text-left">
                      <p className="font-body text-xs font-semibold text-white">{p.type}</p>
                      <p className="font-body text-[10px] text-brass/60">
                        {p.planets.join(' · ')}
                        {p.apex && <span className="text-brass/40"> · apex {p.apex}</span>}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={12} className="text-brass/40" /> : <ChevronRight size={12} className="text-brass/40" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 space-y-2.5">
                    <p className="font-body text-xs text-white/85 leading-relaxed">{p.description}</p>

                    {/* Planet chips — colored by source */}
                    <div className="flex flex-wrap gap-1.5">
                      {(p.planetDetails || []).map((pd, j) => {
                        const st = SOURCE_STYLE[pd.source] || SOURCE_STYLE.natal;
                        return (
                          <span
                            key={j}
                            className="font-body text-[10px] px-2 py-0.5 rounded-full border"
                            style={{ background: `${st.color}14`, borderColor: `${st.color}59`, color: st.color }}
                            title={st.label}
                          >
                            <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>
                              {PLANET_GLYPHS[pd.name] || '✦'}
                            </span>{' '}{pd.name} {pd.sign} {pd.degree?.toFixed(0)}°{pd.retrograde ? ' ℞' : ''}
                          </span>
                        );
                      })}
                    </div>

                    {/* Aspect web */}
                    {p.aspects && p.aspects.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-body text-[9px] uppercase tracking-widest text-brass/40">Aspect Web</p>
                        {p.aspects.map((a, j) => {
                          const legColor = a.transitInvolved ? '#7dd49a' : 'rgba(212,175,133,0.7)';
                          return (
                            <div key={j} className="font-body text-[10px] text-brass/70 flex items-center gap-1.5">
                              <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{PLANET_GLYPHS[a.planet1] || '✦'}</span>
                              <span className="text-white/60">{a.planet1}</span>
                              <span style={{ fontVariantEmoji: 'text', color: legColor }}>{ASPECT_SYMBOLS[a.aspect] || a.aspect}</span>
                              <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{PLANET_GLYPHS[a.planet2] || '✦'}</span>
                              <span className="text-white/60">{a.planet2}</span>
                              <span className="text-brass/40 text-[9px]">{a.orb?.toFixed(1)}°{a.transitInvolved ? ' ●' : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(p.element) && (
                      <div className="flex flex-wrap gap-3 text-[10px] font-body text-brass/50">
                        {p.element && <span>{p.element} trine</span>}
                      </div>
                    )}

                    <FormationInterpretation chart={chart} dateKey={dateKey} formation={p} expanded={isExpanded} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}