import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { invokeLLMTask } from '@/api/llmTasks';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { Loader2, ChevronDown, ChevronRight, Users, Calendar } from 'lucide-react';
import SignName from '@/components/ui/SignName';
import { PLANET_GLYPHS, findChartPoint, getHouseForLongitude } from '@/lib/chartUtils';
import { getHouseName } from '@/lib/houseUtils';
import { getHiddenChartPoints, filterHiddenPlanets } from '@/lib/chartPointVisibility';
import SynastrySynthesis from '@/components/chart/SynastrySynthesis';

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹\uFE0E', quincunx: '⚻\uFE0E', semisextile: '⚺\uFE0E',
};

const ASPECT_COLORS = {
  conjunction: '#C9A961', opposition: '#c0392b', trine: '#2980b9',
  square: '#c0392b', sextile: '#27ae60', quincunx: '#8e44ad', semisextile: '#27ae60',
};

const ASPECT_ORDER = ['conjunction', 'opposition', 'trine', 'square', 'sextile', 'quincunx'];
const ASPECT_LABELS = {
  conjunction: 'Conjunctions', opposition: 'Oppositions', trine: 'Trines',
  square: 'Squares', sextile: 'Sextiles', quincunx: 'Quincunxes',
};

const NODE_GLYPHS = { 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E' };
function getGlyph(name) {
  return PLANET_GLYPHS[name] || NODE_GLYPHS[name] || '✦';
}

function CrossAspectRow({ aspect, person1Name, person2Name, chart1Data, chart2Data, relationship, person2Pronouns, person2Deceased, person2DateOfDeath, isEvent }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(false);

  const p1 = findChartPoint(chart1Data, aspect.person1_planet);
  const p2 = findChartPoint(chart2Data, aspect.person2_planet);
  const sym = ASPECT_SYMBOLS[aspect.aspect] || aspect.aspect;
  const col = ASPECT_COLORS[aspect.aspect] || '#8B7355';

  const toggle = async () => {
    if (!open && !text) {
      setOpen(true);
      setLoading(true);
      const p1Info = p1 ? `${aspect.person1_planet} in ${p1.sign}${p1.degree != null ? ` at ${p1.degree.toFixed(1)}°` : ''}${p1.house ? ` (${getHouseName(p1.house)})` : ''}${p1.retrograde ? ' ℞' : ''}` : aspect.person1_planet;
      const p2Info = p2 ? `${aspect.person2_planet} in ${p2.sign}${p2.degree != null ? ` at ${p2.degree.toFixed(1)}°` : ''}${p2.house ? ` (${getHouseName(p2.house)})` : ''}${p2.retrograde ? ' ℞' : ''}` : aspect.person2_planet;
      // Cross-house overlays: where each placement falls in the OTHER person's houses
      const p2InC1 = p2 ? getHouseForLongitude(p2.longitude, chart1Data?.houses) : null;
      const p1InC2 = p1 ? getHouseForLongitude(p1.longitude, chart2Data?.houses) : null;
      const overlayInfo = p2InC1
        ? isEvent
          ? `At this moment, ${aspect.person2_planet} falls in ${person1Name}'s ${getHouseName(p2InC1)}`
          : `${person2Name}'s ${aspect.person2_planet} falls in ${person1Name}'s ${getHouseName(p2InC1)}${p1InC2 ? `; ${person1Name}'s ${aspect.person1_planet} falls in ${person2Name}'s ${getHouseName(p1InC2)}` : ''}`
        : '';
      const result = await invokeLLMTask('synastry-aspect-detail', {
        isEvent,
        person1Name,
        person2Name,
        relationship,
        person2Pronouns,
        person2Deceased,
        person2DateOfDeath,
        person1Planet: aspect.person1_planet,
        person2Planet: aspect.person2_planet,
        aspect: aspect.aspect,
        orb: aspect.orb,
        p1Info,
        p2Info,
        p1Sign: p1?.sign || '',
        p2Sign: p2?.sign || '',
        overlayInfo,
      });
      setText(result);
      setLoading(false);
    } else {
      setOpen(!open);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.06] overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between py-2 px-3 hover:bg-white/[0.04] transition-colors text-left">
        <span className="font-body text-xs text-white/80 leading-snug">
          <span className="opacity-60" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>{getGlyph(aspect.person1_planet)}</span> <strong>{aspect.person1_planet}</strong>
          {p1?.sign ? <> in <SignName sign={p1.sign} /></> : ''}
          {' '}<span style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>{sym}</span>{' '}
          <span className="opacity-60" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>{getGlyph(aspect.person2_planet)}</span> <strong>{aspect.person2_planet}</strong>
          {p2?.sign ? <> in <SignName sign={p2.sign} /></> : ''}
        </span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          <span className="font-body text-[10px] text-brass">{aspect.orb?.toFixed(1)}°</span>
          {loading ? <Loader2 size={11} className="animate-spin text-gold-primary" />
            : open ? <ChevronDown size={12} className="text-brass/40" /> : <ChevronRight size={12} className="text-brass/30" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1">
          {loading ? (
            <div className="flex items-center gap-1.5 py-1">
              <Loader2 size={11} className="animate-spin text-gold-primary" />
              <span className="font-body text-[11px] text-brass italic">Reading the synastry...</span>
            </div>
          ) : (
            <p className="font-body text-xs text-white/80 leading-relaxed">{highlightSynthesisText(text, undefined, 'text-gold-primary')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SynastryView({ userChart, savedChart, user, onSynastryData, onHighlight }) {
  const [synastryData, setSynastryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const natalRaw = userChart?.raw_data || {};
  const savedRaw = savedChart?.raw_data || {};
  // Points the user has hidden via Chart Display preferences — applied to the
  // partner overlay, the cross-aspect list, and the synthesis inputs so a
  // hidden asteroid/lot never surfaces in the synastry read.
  const hidden = getHiddenChartPoints(user);

  useEffect(() => {
    if (!natalRaw.birth_date || !savedRaw.birth_date) {
      setLoading(false);
      setError('Missing birth data for one or both charts.');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const chart1 = {
          birth_date: natalRaw.birth_date,
          birth_time: natalRaw.birth_time || '12:00:00',
          birth_location: natalRaw.birth_location,
          utc_offset: natalRaw.utc_offset ?? 0,
        };
        const chart2 = {
          birth_date: savedRaw.birth_date,
          birth_time: savedRaw.birth_time || '12:00:00',
          birth_location: savedRaw.birth_location,
          utc_offset: savedRaw.utc_offset ?? 0,
        };
        const res = await base44.functions.invoke('chartCalculator', {
          chart_type: 'synastry',
          chart1,
          chart2,
          house_system: natalRaw.house_system || 'whole_sign',
        });
        if (!cancelled) {
          setSynastryData(res.data);
          setLoading(false);
          // Lift overlay data to parent so the evergreen natal chart wheel can render the partner's planets
          // Include angles (ASC/DC/MC/IC) and nodes (NN/SN) so cross-aspects to them render on the wheel
          const c2 = res.data.chart2 || {};
          const overlayPlanets = filterHiddenPlanets([...(c2.planets || [])], hidden);
          if (c2.angles) {
            if (c2.angles.ascendant) overlayPlanets.push({ name: 'Ascendant', ...c2.angles.ascendant, house: 1 });
            if (c2.angles.descendant) overlayPlanets.push({ name: 'Descendant', ...c2.angles.descendant, house: 7 });
            if (c2.angles.midheaven) overlayPlanets.push({ name: 'Midheaven', ...c2.angles.midheaven, house: 10 });
            if (c2.angles.ic) overlayPlanets.push({ name: 'IC', ...c2.angles.ic, house: 4 });
          }
          if (c2.nodes && !hidden.has('North Node')) {
            if (c2.nodes.north_node) overlayPlanets.push({ name: 'North Node', ...c2.nodes.north_node });
            if (c2.nodes.south_node) overlayPlanets.push({ name: 'South Node', ...c2.nodes.south_node });
          }
          const overlay = {
            planets: overlayPlanets,
            partnerHouses: c2.houses || [],
            partnerAscSign: c2.angles?.ascendant?.sign || '',
            transit_aspects: (res.data.cross_aspects || []).map(a => ({
              transit_planet: a.person2_planet,
              natal_planet: a.person1_planet,
              aspect: a.aspect,
              orb: a.orb,
            })),
          };
          onSynastryData?.(overlay);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to calculate synastry chart.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; onSynastryData?.(null); };
  }, [savedChart?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gold-primary" size={24} />
        <span className="font-body text-sm text-brass ml-2">Calculating synastry...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 px-4">
        <p className="font-body text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!synastryData) return null;

  const { chart1: c1Data, chart2: c2Data } = synastryData;
  // Drop cross-aspects that touch a hidden point (e.g. asteroids/lots turned
  // off) so neither the list nor the synthesis mentions them.
  const visibleCrossAspects = (synastryData.cross_aspects || []).filter(
    (a) => !hidden.has(a.person1_planet) && !hidden.has(a.person2_planet),
  );
  const cross_aspects = visibleCrossAspects;
  // Primary chart name: when viewing a saved chart as the primary, use its name;
  // otherwise fall back to the logged-in user's name.
  const userName = userChart?.name || user?.display_name || user?.full_name || 'You';
  const partnerName = savedChart?.name || 'Partner';
  // The personal Chart entity has no `name`; a SavedChart always does.
  const isPersonalPrimary = !userChart?.name;
  // The partner's `relationship` is defined relative to the app user, not to
  // an arbitrary primary chart. When the primary is a saved chart we don't
  // know the relationship between the two charts, so we don't frame the
  // synastry through that user-relationship lens (event types are independent
  // of the primary and stay as-is).
  const effectiveRelationship = (isPersonalPrimary || savedChart?.chart_type === 'event')
    ? savedChart?.relationship
    : null;

  const grouped = {};
  for (const a of cross_aspects || []) {
    if (!grouped[a.aspect]) grouped[a.aspect] = [];
    grouped[a.aspect].push(a);
  }

  // Normalize aspect highlight keys from synthesis text/chips to ChartWheel format.
  // highlightSynthesisText generates keys like "tasp_Venus_trine_Mars" (text order),
  // but ChartWheel expects "tasp_${person2_planet}_${aspect}_${person1_planet}".
  // Normalize synthesis/chip highlight keys to ChartWheel's partner-aspect
  // key (pasp_<partner>_<aspect>_<you>), matching the nested-ring synastry
  // rendering. Accept either tasp_ (from highlightSynthesisText) or pasp_
  // (from makeAspectKey) on the way in.
  const handleAspectHighlight = (key) => {
    if (!key) { onHighlight?.(null); return; }
    const match = key.match(/^(?:tasp|pasp)_(.+?)_(.+?)_(.+)$/);
    if (match) {
      const [, p1, asp, p2] = match;
      const found = (cross_aspects || []).find(a =>
        (a.person1_planet === p1 && a.person2_planet === p2 && a.aspect === asp) ||
        (a.person1_planet === p2 && a.person2_planet === p1 && a.aspect === asp)
      );
      if (found) {
        onHighlight?.(`pasp_${found.person2_planet}_${found.aspect}_${found.person1_planet}`);
        return;
      }
    }
    onHighlight?.(key);
  };

  return (
    <div className="space-y-4">
      {/* Partner summary — natal chart wheel above is evergreen; partner planets overlay it */}
      <div className="celestial-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {savedChart?.chart_type === 'event' ? <Calendar size={14} className="text-celestial-purple shrink-0" /> : <Users size={14} className="text-gold-accent shrink-0" />}
          <div className="min-w-0">
            <span className="font-display text-sm text-cream block truncate">{userName} & {partnerName}</span>
            {savedChart?.relationship && (
              <span className="font-body text-[10px] text-brass/60 italic">{savedChart.chart_type === 'event' ? savedChart.relationship : isPersonalPrimary ? `Your ${savedChart.relationship}` : `${savedChart.relationship} (to you)`}</span>
            )}
            {savedChart?.deceased && (
              <span className="font-body text-[10px] text-purple-soft italic">✦ in memoriam{savedChart?.date_of_death ? ` · ${savedChart.date_of_death}` : ''}</span>
            )}
          </div>
        </div>
        {c2Data?.angles?.ascendant?.sign && (
          <div className="text-right">
            <div className="font-body text-[10px] uppercase tracking-widest text-brass/60">{partnerName} Rising</div>
            <div className="text-xs font-display font-bold" style={{ color: '#B8A5C8' }}>
              <SignName sign={c2Data.angles.ascendant.sign} />
            </div>
          </div>
        )}
      </div>

      {/* Insight-forward synthesis */}
      {/* Build combined points arrays including angles + nodes for aspect lookups */}
      <SynastrySynthesis
        userName={userName}
        partnerName={partnerName}
        relationship={effectiveRelationship}
        partnerPronouns={savedChart?.pronouns}
        deceased={savedChart?.deceased}
        dateOfDeath={savedChart?.date_of_death}
        isEvent={savedChart?.chart_type === 'event'}
        c1Data={c1Data}
        c2Data={c2Data}
        crossAspects={cross_aspects || []}
        onAspectHighlight={handleAspectHighlight}
        natalPlanets={[
          ...filterHiddenPlanets(c1Data?.planets || [], hidden),
          ...(c1Data?.angles?.ascendant ? [{ name: 'Ascendant', ...c1Data.angles.ascendant, house: 1 }] : []),
          ...(c1Data?.angles?.descendant ? [{ name: 'Descendant', ...c1Data.angles.descendant, house: 7 }] : []),
          ...(c1Data?.angles?.midheaven ? [{ name: 'Midheaven', ...c1Data.angles.midheaven, house: 10 }] : []),
          ...(c1Data?.angles?.ic ? [{ name: 'IC', ...c1Data.angles.ic, house: 4 }] : []),
          ...(!hidden.has('North Node') && c1Data?.nodes?.north_node ? [{ name: 'North Node', ...c1Data.nodes.north_node }] : []),
          ...(!hidden.has('North Node') && c1Data?.nodes?.south_node ? [{ name: 'South Node', ...c1Data.nodes.south_node }] : []),
        ]}
        transitPlanets={[
          ...filterHiddenPlanets(c2Data?.planets || [], hidden),
          ...(c2Data?.angles?.ascendant ? [{ name: 'Ascendant', ...c2Data.angles.ascendant, house: 1 }] : []),
          ...(c2Data?.angles?.descendant ? [{ name: 'Descendant', ...c2Data.angles.descendant, house: 7 }] : []),
          ...(c2Data?.angles?.midheaven ? [{ name: 'Midheaven', ...c2Data.angles.midheaven, house: 10 }] : []),
          ...(c2Data?.angles?.ic ? [{ name: 'IC', ...c2Data.angles.ic, house: 4 }] : []),
          ...(!hidden.has('North Node') && c2Data?.nodes?.north_node ? [{ name: 'North Node', ...c2Data.nodes.north_node }] : []),
          ...(!hidden.has('North Node') && c2Data?.nodes?.south_node ? [{ name: 'South Node', ...c2Data.nodes.south_node }] : []),
        ]}
        overlayName={partnerName}
      />

      {/* Cross-aspect list */}
      <div className="space-y-3">
        <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 px-1">Cross-Chart Aspects</p>
        {ASPECT_ORDER.filter(a => grouped[a]?.length).map(asp => (
          <div key={asp}>
            <p className="font-body text-[10px] text-white/40 uppercase tracking-wide mb-1">{ASPECT_LABELS[asp]}</p>
            <div className="space-y-1">
              {grouped[asp]
                .sort((a, b) => a.orb - b.orb)
                .map((a, i) => (
                  <CrossAspectRow
                    key={`${asp}_${i}`}
                    aspect={a}
                    person1Name={userName}
                    person2Name={partnerName}
                    chart1Data={c1Data}
                    chart2Data={c2Data}
                    relationship={effectiveRelationship}
                    person2Pronouns={savedChart?.pronouns}
                    person2Deceased={savedChart?.deceased}
                    person2DateOfDeath={savedChart?.date_of_death}
                    isEvent={savedChart?.chart_type === 'event'}
                  />
                ))}
            </div>
          </div>
        ))}
        {(!cross_aspects || cross_aspects.length === 0) && (
          <p className="font-body text-xs text-brass italic text-center py-3">No major cross-chart aspects found.</p>
        )}
      </div>
    </div>
  );
}