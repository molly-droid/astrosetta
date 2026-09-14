import React, { useState } from 'react';
import { Loader2, Heart, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import SignName from '@/components/ui/SignName';
import { base44 } from '@/api/base44Client';
import { PERSONA, highlightSynthesisText } from '@/lib/transitUtils';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { densityPromptSuffix } from '@/lib/knowledgeDensity';
import PaywallModal from '@/components/paywall/PaywallModal';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E', semisextile: '\u26BA\uFE0E', semisquare: '\u2220\uFE0E',
};

const PLANET_WEIGHTS = {
  Pluto: 10, Neptune: 9, Uranus: 8, Saturn: 7, Jupiter: 6,
  Mars: 5, Venus: 4, Mercury: 3, Sun: 2, Moon: 1,
  Ascendant: 9, Midheaven: 8, Chiron: 3, 'North Node': 4, 'South Node': 3,
};
const ASPECT_WEIGHTS = { conjunction: 10, opposition: 9, square: 7, trine: 5, sextile: 3, quincunx: 2 };

// Hallucination safeguard: drop any sentence naming a celestial body not
// actually involved in this shared transit, so every claim stays grounded in
// the real chart data. Mirrors TransitNatalFormationsBanner's sanitizer.
const ALL_PLANET_NAMES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Ascendant', 'Descendant', 'Midheaven', 'Lilith'];

function sanitizeSharedText(text, allowedSet) {
  if (!text || typeof text !== 'string') return text;
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text];
  const kept = sentences.filter((s) => {
    for (const name of ALL_PLANET_NAMES) {
      if (allowedSet.has(name)) continue;
      if (new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`, 'i').test(s)) return false;
    }
    return true;
  });
  return kept.join(' ').trim() || text;
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Group one chart's transit-to-natal aspects by the transiting planet.
function groupByTransitPlanet(natalAspects) {
  const map = {};
  for (const a of natalAspects || []) {
    (map[a.transit_planet] ||= []).push(a);
  }
  return map;
}

// A transit "impacts both people" when the same transiting planet makes a
// natal aspect in BOTH charts. Build the shared set and rank by significance
// (planet weight + tightest orb + strongest aspect across both charts).
function computeSharedTransits(userTransits, partnerTransits) {
  if (!userTransits?.natalAspects || !partnerTransits?.natalAspects) return [];
  const userBy = groupByTransitPlanet(userTransits.natalAspects);
  const partnerBy = groupByTransitPlanet(partnerTransits.natalAspects);
  const sharedNames = Object.keys(userBy).filter((name) => partnerBy[name]);
  const items = sharedNames.map((name) => {
    const userAspects = userBy[name];
    const partnerAspects = partnerBy[name];
    const minOrb = Math.min(
      ...userAspects.map((a) => a.orb ?? 99),
      ...partnerAspects.map((a) => a.orb ?? 99),
    );
    const strongestAsp = Math.max(
      ...userAspects.map((a) => ASPECT_WEIGHTS[a.aspect] || 2),
      ...partnerAspects.map((a) => ASPECT_WEIGHTS[a.aspect] || 2),
    );
    const score = (PLANET_WEIGHTS[name] || 3) + strongestAsp + Math.max(0, 10 - minOrb * 1.25);
    return { transit_planet: name, userAspects, partnerAspects, minOrb, score };
  });
  return items.sort((a, b) => b.score - a.score);
}

function natalPlanetHouse(transits, chart, name) {
  const np = transits?.natalPlanets?.find((p) => p.name === name) || chart?.raw_data?.planets?.find((p) => p.name === name);
  return np?.house;
}

function AspectMini({ a, transits, chart }) {
  const sym = ASPECT_SYMBOLS[a.aspect] || a.aspect;
  const house = natalPlanetHouse(transits, chart, a.natal_planet);
  return (
    <span className="font-body text-[11px] text-white/85 leading-snug">
      {sym} <strong>{a.natal_planet}</strong>
      {house ? ` · ${ordinal(house)}H` : ''}
      <span className="text-brass/60 ml-1">{a.orb?.toFixed(1)}°</span>
    </span>
  );
}

function SharedTransitRow({ item, userTransits, partnerTransits, userChart, partnerChart, date, canViewInterpretations, partnerName }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const { knowledgeDepth } = useUserPrefs();
  const tP = userTransits?.transitPlanets?.find((p) => p.name === item.transit_planet);
  const glyph = PLANET_GLYPHS[item.transit_planet] || '✦';

  const toggle = async () => {
    if (!canViewInterpretations) { setShowPaywall(true); return; }
    if (!open && !text) {
      setOpen(true);
      setLoading(true);
      const userLines = item.userAspects
        .map((a) => `${a.transit_planet} ${a.aspect} your natal ${a.natal_planet}${natalPlanetHouse(userTransits, userChart, a.natal_planet) ? ` in ${ordinal(natalPlanetHouse(userTransits, userChart, a.natal_planet))}H` : ''} (orb ${a.orb?.toFixed(1)}°)`)
        .join('; ');
      const partnerLines = item.partnerAspects
        .map((a) => `${a.transit_planet} ${a.aspect} ${partnerName}'s natal ${a.natal_planet}${natalPlanetHouse(partnerTransits, partnerChart, a.natal_planet) ? ` in ${ordinal(natalPlanetHouse(partnerTransits, partnerChart, a.natal_planet))}H` : ''} (orb ${a.orb?.toFixed(1)}°)`)
        .join('; ');
      const prompt = `${PERSONA}

${densityPromptSuffix(knowledgeDepth)}

GROUNDING RULES:
- Use ONLY the transiting planet, signs, natal planets, houses, aspects, and orbs explicitly listed below.
- Do NOT introduce any additional planet, celestial body, aspect, sign, or house that is not listed.
- The transiting planet is ${item.transit_planet} in ${tP?.sign || '?'}${tP?.retrograde ? ' (retrograde)' : ''} — do not assign it a different sign or invent its retrograde status.
- Name each natal planet and house exactly as listed; do not invent houses for placements that have none listed.

Today's transiting ${item.transit_planet} in ${tP?.sign || '?'}${tP?.retrograde ? ' (retrograde)' : ''} is simultaneously:
- To you: ${userLines}
- To ${partnerName}: ${partnerLines}

This transit activates BOTH people's charts. Write 2-3 sentences on how this shared activation lands on the relationship dynamic — where it creates alignment, tension, or a shared theme. Frame it through the bond, not one person. Name signs and houses. No clichés, no generic horoscope language.`;
      try {
        const result = await base44.integrations.Core.InvokeLLM({ prompt });
        // Strip any sentence naming a planet not actually in this shared transit.
        const allowed = new Set([item.transit_planet, ...item.userAspects.map((a) => a.natal_planet), ...item.partnerAspects.map((a) => a.natal_planet)]);
        setText(sanitizeSharedText(result, allowed));
      } catch { /* non-critical */ }
      setLoading(false);
    } else {
      setOpen(!open);
    }
  };

  return (
    <div className="border-l-2 border-l-celestial-pink/50 rounded-r-lg overflow-hidden bg-white/[0.02]">
      {showPaywall && <PaywallModal variant="interpret" fromTier="free" context={`${item.transit_planet} transits impacting both charts`} onClose={() => setShowPaywall(false)} />}
      <button onClick={toggle} className="w-full flex items-center justify-between py-2.5 px-3 hover:bg-celestial-pink/5 transition-colors text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="opacity-70 text-sm">{glyph}</span>
          <strong className="font-body text-xs text-white">{item.transit_planet}</strong>
          {tP?.sign && <SignName sign={tP.sign} className="font-body text-[11px] text-brass" />}
          {tP?.retrograde && <span className="font-body text-[10px] text-gold-accent italic">℞</span>}
          <span className="font-body text-[10px] text-celestial-pink/80 ml-1">· both charts</span>
        </span>
        <span className="flex items-center gap-1.5 ml-2 shrink-0">
          <span className="font-body text-[10px] text-brass">{item.minOrb.toFixed(1)}°</span>
          {!canViewInterpretations
            ? <Lock size={11} className="text-brass/30" />
            : loading ? <Loader2 size={11} className="animate-spin text-gold-primary" />
            : open ? <ChevronDown size={12} className="text-brass/40" /> : <ChevronRight size={12} className="text-brass/30" />}
        </span>
      </button>

      <div className="px-3 pb-2.5 pt-0.5 space-y-1 border-t border-white/[0.04]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
          <span className="font-body text-[9px] uppercase tracking-widest text-celestial-blue/70">You:</span>
          {item.userAspects.map((a, i) => (
            <AspectMini key={`u${i}`} a={a} transits={userTransits} chart={userChart} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
          <span className="font-body text-[9px] uppercase tracking-widest text-celestial-purple/70">{partnerName}:</span>
          {item.partnerAspects.map((a, i) => (
            <AspectMini key={`p${i}`} a={a} transits={partnerTransits} chart={partnerChart} />
          ))}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1">
          {loading ? (
            <div className="flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-gold-primary" />
              <span className="font-body text-[11px] text-brass italic">Reading the shared activation…</span>
            </div>
          ) : text && (
            <p className="font-body text-xs text-white/90 leading-snug">{highlightSynthesisText(text, null, 'text-gold-primary')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SharedTransitsList({ userTransits, partnerTransits, userChart, partnerChart, date, loading }) {
  const { user } = useAuth();
  const { canViewTransitInterpretations } = usePermissions(user);
  const partnerName = partnerChart?.name || 'your partner';

  if (loading) {
    return (
      <div className="celestial-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Loader2 size={14} className="animate-spin text-gold-primary" />
          <p className="font-body text-xs text-brass italic">Finding transits impacting both charts…</p>
        </div>
      </div>
    );
  }

  if (!userTransits || !partnerTransits) {
    return (
      <div className="celestial-card overflow-hidden px-4 py-4">
        <p className="font-body text-xs text-brass italic text-center">Transit data for one of the charts is unavailable.</p>
      </div>
    );
  }

  const shared = computeSharedTransits(userTransits, partnerTransits);

  if (!shared.length) {
    return (
      <div className="celestial-card overflow-hidden px-4 py-4">
        <p className="font-body text-xs text-brass italic text-center">No transits are activating both charts today — the relationship sky is quiet.</p>
      </div>
    );
  }

  return (
    <div className="celestial-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gold-primary/20">
        <Heart size={13} className="text-celestial-pink" />
        <div>
          <p className="font-body text-xs text-white font-semibold">Shared Transits</p>
          <p className="font-body text-[10px] text-brass">Activating both charts · {shared.length} planet{shared.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {shared.map((item) => (
          <SharedTransitRow
            key={item.transit_planet}
            item={item}
            userTransits={userTransits}
            partnerTransits={partnerTransits}
            userChart={userChart}
            partnerChart={partnerChart}
            date={date}
            canViewInterpretations={canViewTransitInterpretations}
            partnerName={partnerName}
          />
        ))}
      </div>
    </div>
  );
}