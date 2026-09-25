import React from 'react';
import { getHouseName } from '@/lib/houseUtils';
import NatalInterpretation from '@/components/chart/NatalInterpretation';
import TransitAspectInterpretation from '@/components/chart/TransitAspectInterpretation';
import SynastryAspectInterpretation from '@/components/chart/SynastryAspectInterpretation';
import MundaneAspectInterpretation from '@/components/chart/MundaneAspectInterpretation';
import { PLANET_DEFS, SIGN_DEFS, ASPECT_DEFS } from '@/components/chart/chartWheelDefs';

// Extracted from ChartWheel so the wheel file stays under the line guideline.
// Color/symbol maps are passed in as props (they live in ChartWheel) to avoid
// duplicating the aspect-symbol glyphs and to prevent a circular import.
const ANGLE_NAMES = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
const TRANSIT_OC = { primary: '#7dd49a', label: 'transiting', note: 'Transiting your chart — aspect lines to natal placements are shown above.' };
const MAJOR_ASPECTS = ['conjunction', 'opposition', 'trine', 'square', 'sextile'];

function PillShell({ children, borderColor = 'rgba(212,175,133,0.25)', onClose, onInterpret }) {
  return (
    <div className="w-full mt-2 animate-fade-up">
      <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(15,26,46,0.96)', borderColor }}>
        <div className="px-3 py-2.5 flex items-start justify-between gap-3">
          {children}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {onInterpret && <button onClick={() => onInterpret(children)} className="font-body text-[10px] text-gold-accent hover:text-gold-primary transition-colors">✦ Interpret</button>}
            <button onClick={onClose} className="font-body text-[9px] text-brass/30 hover:text-brass transition-colors">✕</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChartSelectionInfo({
  item, onClose, onInterpret,
  natalPlanets, partnerPlanets = [], transitPlanets,
  natalHouses = null, transitHouses = null,
  chartData = null, skyMode = false,
  transitData = null, partnerData = null,
  mundaneAspects = [],
  onSelectItem = null,
  aspectSymbols, planetColors, aspectColors, signColors, partnerColor,
  overlayName = '', relationship = '', deceased = false, dateOfDeath = '', partnerPronouns = '',
}) {
  if (!item) return null;

  if (item.type === 'planet') {
    const def = PLANET_DEFS[item.name] || {};
    const incoming = (transitData?.transit_aspects || []).filter(ta => ta.natal_planet === item.name && MAJOR_ASPECTS.includes(ta.aspect));
    const partnerIncoming = (partnerData?.aspects || []).filter(pa => pa.natal_planet === item.name && MAJOR_ASPECTS.includes(pa.aspect));
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] text-gold-accent font-semibold">{def.glyph} {item.name}</span>
            <span className="font-body text-[10px] text-white/50">in {item.sign}</span>
            <span className="font-body text-[9px] text-brass/50">{item.degree?.toFixed(1)}° · {getHouseName(item.house)}</span>
            {item.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞ retrograde</span>}
          </div>
          {def.keywords && <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">{def.keywords}</p>}
          <NatalInterpretation item={item} chartData={chartData} skyMode={skyMode} />
          {incoming.length > 0 && (
            <div className="mt-2">
              <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-1">Active Transits</p>
              <div className="flex flex-wrap gap-1">
                {incoming.map((ta, i) => {
                  const transitDef = PLANET_DEFS[ta.transit_planet] || {};
                  const aspSym = aspectSymbols[ta.aspect] || ta.aspect;
                  const taspKey = `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}`;
                  return (
                    <button key={i} onClick={() => onSelectItem?.({ ...ta, key: taspKey, type: 'transit_aspect' })}
                      className="font-body text-[10px] px-1.5 py-0.5 rounded border border-gold-primary/20 hover:border-gold-accent hover:bg-gold-primary/10 transition-all"
                      style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {transitDef.glyph} {aspSym} {def.glyph}<span className="text-brass/40 ml-1">{ta.orb?.toFixed(1)}°</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {partnerIncoming.length > 0 && (
            <div className="mt-2">
              <p className="font-body text-[9px] uppercase tracking-wide mb-1" style={{ color: partnerColor }}>From {overlayName || 'Partner'}</p>
              <div className="flex flex-wrap gap-1">
                {partnerIncoming.map((pa, i) => {
                  const partnerDef = PLANET_DEFS[pa.transit_planet] || {};
                  const aspSym = aspectSymbols[pa.aspect] || pa.aspect;
                  const paspKey = `pasp_${pa.transit_planet}_${pa.aspect}_${pa.natal_planet}`;
                  return (
                    <button key={i} onClick={() => onSelectItem?.({ ...pa, key: paspKey, type: 'partner_aspect' })}
                      className="font-body text-[10px] px-1.5 py-0.5 rounded border transition-all"
                      style={{ color: partnerColor, borderColor: 'rgba(127,179,224,0.3)' }}>
                      {partnerDef.glyph} {aspSym} {def.glyph}<span className="opacity-50 ml-1">{pa.orb?.toFixed(1)}°</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PillShell>
    );
  }

  if (item.type === 'partner_planet') {
    const def = PLANET_DEFS[item.name] || {};
    const partnerAspects = (partnerData?.aspects || []).filter(pa => pa.transit_planet === item.name && MAJOR_ASPECTS.includes(pa.aspect));
    return (
      <PillShell onClose={onClose} borderColor="rgba(127,179,224,0.3)">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold" style={{ color: partnerColor }}>{def.glyph} {item.name}</span>
            <span className="font-body text-[10px] text-white/50">{overlayName || 'Partner'} · in {item.sign}</span>
            <span className="font-body text-[9px] text-brass/50">{item.degree?.toFixed(1)}°</span>
            {item.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞</span>}
          </div>
          {def.keywords && <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">{def.keywords}</p>}
          {partnerAspects.length > 0 ? (
            <div className="mt-2">
              <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-1">Aspects to Your Chart</p>
              <div className="flex flex-wrap gap-1">
                {partnerAspects.map((pa, i) => {
                  const natalDef = PLANET_DEFS[pa.natal_planet] || {};
                  const aspSym = aspectSymbols[pa.aspect] || pa.aspect;
                  const paspKey = `pasp_${pa.transit_planet}_${pa.aspect}_${pa.natal_planet}`;
                  return (
                    <button key={i} onClick={() => onSelectItem?.({ ...pa, key: paspKey, type: 'partner_aspect' })}
                      className="font-body text-[10px] px-1.5 py-0.5 rounded border transition-all"
                      style={{ color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(127,179,224,0.3)' }}>
                      {def.glyph} {aspSym} {natalDef.glyph}<span className="text-brass/40 ml-1">{pa.orb?.toFixed(1)}°</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="font-body text-[10px] mt-1.5 italic" style={{ color: partnerColor, opacity: 0.6 }}>{overlayName || 'Their'} {item.name} makes no major aspects to your chart.</p>
          )}
        </div>
      </PillShell>
    );
  }

  if (item.type === 'sign') {
    const def = SIGN_DEFS[item.sign] || {};
    const col = (signColors || {})[item.element] || '#D4AF85';
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold" style={{ color: col }}>{item.glyph} {item.sign}</span>
            <span className="font-body text-[9px] text-brass/50">{def.modality}</span>
          </div>
          {def.keywords && <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">{def.keywords}</p>}
          <NatalInterpretation item={item} chartData={chartData} skyMode={skyMode} />
        </div>
      </PillShell>
    );
  }

  if (item.type === 'house') {
    const houseName = getHouseName(item.number);
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] text-white font-semibold">{houseName}</span>
            <span className="font-body text-[10px] text-gold-accent">{item.sign}</span>
            <span className="font-body text-[9px] text-brass/50">{item.degree?.toFixed(0)}° cusp</span>
          </div>
          <NatalInterpretation item={item} chartData={chartData} skyMode={skyMode} />
        </div>
      </PillShell>
    );
  }

  if (item.type === 'aspect') {
    const def = ASPECT_DEFS[item.aspect] || {};
    const col = (aspectColors || {})[item.aspect] || '#8B7355';
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold text-white">{item.planet1}</span>
            <span className="font-body text-sm font-display" style={{ color: col }}>{def.sym || item.aspect}</span>
            <span className="font-body text-[11px] font-semibold text-white">{item.planet2}</span>
            <span className="font-body text-[9px] text-brass/50">{def.angle} · {item.orb?.toFixed(1)}° orb</span>
          </div>
          <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide capitalize">{def.verb || item.aspect}</p>
          <NatalInterpretation item={item} chartData={chartData} skyMode={skyMode} />
        </div>
      </PillShell>
    );
  }

  if (item.type === 'partner_aspect') {
    const def = ASPECT_DEFS[item.aspect] || {};
    const col = (aspectColors || {})[item.aspect] || '#8B7355';
    const partnerDef = PLANET_DEFS[item.transit_planet] || {};
    const natalDef = PLANET_DEFS[item.natal_planet] || {};
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold" style={{ color: partnerColor }}>{partnerDef.glyph} {item.transit_planet}</span>
            <span className="font-body text-sm font-display" style={{ color: col }}>{def.sym || item.aspect}</span>
            <span className="font-body text-[11px] font-semibold text-white">{natalDef.glyph} {item.natal_planet}</span>
            <span className="font-body text-[9px] text-brass/50">{def.angle} · {item.orb?.toFixed(1)}° orb</span>
            {item.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞</span>}
          </div>
          <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">{overlayName || 'Their'} {def.verb || item.aspect} yours</p>
          <SynastryAspectInterpretation item={item} natalPlanets={natalPlanets} transitPlanets={partnerPlanets} natalHouses={natalHouses} transitHouses={transitHouses} overlayName={overlayName} relationship={relationship} deceased={deceased} dateOfDeath={dateOfDeath} partnerPronouns={partnerPronouns} />
        </div>
      </PillShell>
    );
  }

  if (item.type === 'transit_planet') {
    const def = PLANET_DEFS[item.name] || {};
    const transitAspectsForPlanet = (transitData?.transit_aspects || []).filter(ta => ta.transit_planet === item.name && MAJOR_ASPECTS.includes(ta.aspect));
    const mundaneForSelected = mundaneAspects.filter(ma => ma.planet1 === item.name || ma.planet2 === item.name);
    return (
      <PillShell onClose={onClose}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold" style={{ color: (planetColors || {})[item.name] || TRANSIT_OC.primary }}>{def.glyph} {item.name}</span>
            <span className="font-body text-[10px] text-white/50">transiting {item.sign}</span>
            <span className="font-body text-[9px] text-brass/50">{item.degree?.toFixed(1)}°</span>
            {item.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞</span>}
          </div>
          {def.keywords && <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">{def.keywords}</p>}
          <NatalInterpretation item={item} chartData={chartData} skyMode={skyMode} transitAspects={transitAspectsForPlanet} />
          {transitAspectsForPlanet.length === 0 && mundaneForSelected.length === 0 ? (
            <p className="font-body text-[10px] mt-1.5 italic" style={{ color: TRANSIT_OC.primary, opacity: 0.5 }}>{TRANSIT_OC.note}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {transitAspectsForPlanet.length > 0 && (
                <div>
                  <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-1">Aspects to Your Chart</p>
                  <div className="flex flex-wrap gap-1">
                    {transitAspectsForPlanet.map((ta, i) => {
                      const natalDef = PLANET_DEFS[ta.natal_planet] || {};
                      const aspSym = aspectSymbols[ta.aspect] || ta.aspect;
                      const taspKey = `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}`;
                      return (
                        <button key={i} onClick={() => onSelectItem?.({ ...ta, key: taspKey, type: 'transit_aspect' })}
                          className="font-body text-[10px] px-1.5 py-0.5 rounded border border-gold-primary/20 hover:border-gold-accent hover:bg-gold-primary/10 transition-all"
                          style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {def.glyph} {aspSym} {natalDef.glyph}<span className="text-brass/40 ml-1">{ta.orb?.toFixed(1)}°</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {mundaneForSelected.length > 0 && (
                <div>
                  <p className="font-body text-[9px] text-brass/50 uppercase tracking-wide mb-1">Sky Aspects (Collective)</p>
                  <div className="flex flex-wrap gap-1">
                    {mundaneForSelected.map((ma, i) => {
                      const otherPlanet = ma.planet1 === item.name ? ma.planet2 : ma.planet1;
                      const otherDef = PLANET_DEFS[otherPlanet] || {};
                      const aspSym = aspectSymbols[ma.aspect] || ma.aspect;
                      const mKey = `mundane_${ma.planet1}_${ma.aspect}_${ma.planet2}`;
                      return (
                        <button key={i} onClick={() => onSelectItem?.({ ...ma, key: mKey, type: 'mundane_aspect', transit_planet: ma.planet1, natal_planet: ma.planet2 })}
                          className="font-body text-[10px] px-1.5 py-0.5 rounded border border-celestial-purple/30 hover:border-celestial-purple/60 hover:bg-celestial-purple/10 transition-all"
                          style={{ color: 'rgba(184,165,200,0.8)' }}>
                          {def.glyph} {aspSym} {otherDef.glyph}<span className="text-brass/40 ml-1">{ma.orb?.toFixed(1)}°</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PillShell>
    );
  }

  if (item.type === 'transit_aspect') {
    const def = ASPECT_DEFS[item.aspect] || {};
    const col = (aspectColors || {})[item.aspect] || '#8B7355';
    const transitDef = PLANET_DEFS[item.transit_planet] || {};
    const natalDef = PLANET_DEFS[item.natal_planet] || {};
    return (
      <PillShell onClose={onClose} onInterpret={item}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[11px] font-semibold" style={{ color: (planetColors || {})[item.transit_planet] || TRANSIT_OC.primary }}>{transitDef.glyph} {item.transit_planet}</span>
            <span className="font-body text-sm font-display" style={{ color: col }}>{def.sym || item.aspect}</span>
            <span className="font-body text-[11px] font-semibold text-white">{natalDef.glyph} {item.natal_planet}</span>
            <span className="font-body text-[9px] text-brass/50">{def.angle} · {item.orb?.toFixed(1)}° orb</span>
            {item.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞</span>}
          </div>
          <p className="font-body text-[10px] text-brass/60 mt-0.5 uppercase tracking-wide">Transit {def.verb || item.aspect} natal</p>
          <TransitAspectInterpretation item={item} natalPlanets={natalPlanets} transitPlanets={transitPlanets} />
        </div>
      </PillShell>
    );
  }

  if (item.type === 'mundane_aspect') {
    const def = ASPECT_DEFS[item.aspect] || {};
    const col = (aspectColors || {})[item.aspect] || '#8B7355';
    const p1Def = PLANET_DEFS[item.transit_planet] || {};
    const p2Def = PLANET_DEFS[item.natal_planet] || {};
    return (
      <PillShell onClose={onClose}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[9px] text-brass/50 uppercase tracking-wide">Collective Sky</span>
            <span className="font-body text-[11px] font-semibold" style={{ color: '#B8A5C8' }}>{p1Def.glyph} {item.transit_planet}</span>
            <span className="font-body text-sm font-display" style={{ color: col }}>{def.sym || item.aspect}</span>
            <span className="font-body text-[11px] font-semibold" style={{ color: '#B8A5C8' }}>{p2Def.glyph} {item.natal_planet}</span>
            <span className="font-body text-[9px] text-brass/50">{def.angle} · {item.orb?.toFixed(1)}° orb</span>
          </div>
          <MundaneAspectInterpretation item={item} transitPlanets={transitPlanets} />
        </div>
      </PillShell>
    );
  }

  return null;
}