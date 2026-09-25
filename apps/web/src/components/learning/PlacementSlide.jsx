import React from 'react';
import { PLANET_GLYPHS, SIGN_GLYPHS } from '@/lib/chartUtils';
import SignName from '@/components/ui/SignName';

const ELEMENT_MAP = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
};

const MODALITY_MAP = {
  Aries: 'Cardinal', Cancer: 'Cardinal', Libra: 'Cardinal', Capricorn: 'Cardinal',
  Taurus: 'Fixed', Leo: 'Fixed', Scorpio: 'Fixed', Aquarius: 'Fixed',
  Gemini: 'Mutable', Virgo: 'Mutable', Sagittarius: 'Mutable', Pisces: 'Mutable',
};

const ELEMENT_COLORS = {
  Fire: '#D4AF85', Earth: '#A8C8A8', Air: '#9DB4C8', Water: '#A8D4D9',
};

const ASPECT_SYMBOLS = {
  conjunction: '☌', opposition: '☍', trine: '△', square: '□',
  sextile: '⚹', quincunx: '⚻',
};

function getOrdinalSuffix(n) {
  const num = parseInt(n);
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
}

/**
 * Extract placement data from the user's natal chart for a given module subject key.
 * Returns a structured object for visual rendering, or null if no match.
 */
export function extractPlacementData(chart, subjectKey) {
  if (!chart?.raw_data) return null;
  const raw = chart.raw_data;
  const planets = raw.planets || [];
  const houses = raw.houses || [];
  const aspects = raw.aspects || [];

  // Retrograde module — list the user's natal retrograde planets
  if (subjectKey === 'retrograde_planets') {
    const retroPlanets = planets
      .filter(p => p.retrograde && PLANET_GLYPHS[p.name])
      .map(p => ({
        name: p.name,
        glyph: PLANET_GLYPHS[p.name] || '✦',
        sign: p.sign,
        signGlyph: SIGN_GLYPHS[p.sign] || '',
        house: p.house,
      }));
    return { type: 'retrograde', planets: retroPlanets };
  }

  // Planet module (e.g. subjectKey = 'sun')
  const planetName = subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1);
  const planet = planets.find(p => p.name === planetName);
  if (planet) {
    const sign = planet.sign;
    const element = ELEMENT_MAP[sign];
    const planetAspects = aspects
      .filter(a => ['exact', 'strong'].includes(a.strength) && (a.planet1 === planetName || a.planet2 === planetName))
      .slice(0, 3)
      .map(a => ({
        other: a.planet1 === planetName ? a.planet2 : a.planet1,
        aspect: a.aspect,
        orb: a.orb,
      }));
    return {
      type: 'planet',
      planet: planetName,
      glyph: PLANET_GLYPHS[planetName] || '✦',
      sign,
      signGlyph: SIGN_GLYPHS[sign] || '',
      house: planet.house,
      element,
      modality: MODALITY_MAP[sign],
      retrograde: planet.retrograde,
      aspects: planetAspects,
    };
  }

  // House module (e.g. subjectKey = 'house_3')
  const houseMatch = subjectKey.match(/^house_(\d+)$/);
  if (houseMatch) {
    const houseNum = parseInt(houseMatch[1]);
    const houseData = houses.find(h => h.number === houseNum);
    const cuspSign = houseData?.sign;
    const planetsInHouse = planets.filter(p => parseInt(p.house) === houseNum);
    return {
      type: 'house',
      house: houseNum,
      cuspSign,
      cuspSignGlyph: cuspSign ? SIGN_GLYPHS[cuspSign] : '',
      element: cuspSign ? ELEMENT_MAP[cuspSign] : null,
      planetsInHouse: planetsInHouse.map(p => ({
        name: p.name,
        glyph: PLANET_GLYPHS[p.name] || '✦',
        retrograde: p.retrograde,
      })),
    };
  }

  // Sign module (e.g. subjectKey = 'aries')
  const signName = subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1);
  if (ELEMENT_MAP[signName]) {
    const planetsInSign = planets.filter(p => p.sign === signName);
    const houseWithSign = houses.find(h => h.sign === signName);
    return {
      type: 'sign',
      sign: signName,
      glyph: SIGN_GLYPHS[signName] || '',
      element: ELEMENT_MAP[signName],
      modality: MODALITY_MAP[signName],
      planetsInSign: planetsInSign.map(p => ({
        name: p.name,
        glyph: PLANET_GLYPHS[p.name] || '✦',
        house: p.house,
        retrograde: p.retrograde,
      })),
      houseWithSign: houseWithSign?.number,
    };
  }

  // Lot modules — Part of Fortune & Tyche (render as a planet-style placement card)
  const LOT_SUBJECTS = { part_of_fortune: 'Part of Fortune', tyche: 'Tyche' };
  const lotName = LOT_SUBJECTS[subjectKey];
  if (lotName) {
    const lot = planets.find(p => p.name === lotName);
    if (lot) {
      const sign = lot.sign;
      const lotAspects = aspects
        .filter(a => ['exact', 'strong', 'moderate'].includes(a.strength) && (a.planet1 === lotName || a.planet2 === lotName))
        .slice(0, 3)
        .map(a => ({ other: a.planet1 === lotName ? a.planet2 : a.planet1, aspect: a.aspect, orb: a.orb }));
      return {
        type: 'planet',
        planet: lotName,
        glyph: PLANET_GLYPHS[lotName] || '⊕',
        sign,
        signGlyph: SIGN_GLYPHS[sign] || '',
        house: lot.house,
        element: ELEMENT_MAP[sign],
        modality: MODALITY_MAP[sign],
        retrograde: false,
        aspects: lotAspects,
      };
    }
  }

  // Generic fallback — show the Big Three as a chart anchor for any other module
  const sun = planets.find(p => p.name === 'Sun');
  const moon = planets.find(p => p.name === 'Moon');
  if (sun || moon || raw.ascendant_sign) {
    return {
      type: 'big3',
      sun: sun ? { sign: sun.sign, signGlyph: SIGN_GLYPHS[sun.sign] || '', house: sun.house } : null,
      moon: moon ? { sign: moon.sign, signGlyph: SIGN_GLYPHS[moon.sign] || '', house: moon.house } : null,
      ascendant: raw.ascendant_sign || null,
    };
  }

  return null;
}

export default function PlacementSlide({ chart, subjectKey }) {
  const data = extractPlacementData(chart, subjectKey);
  if (!data) return null;

  // ── Retrograde placement ──
  if (data.type === 'retrograde') {
    return (
      <div className="celestial-card p-5 border-gold-accent/40 bg-gold-primary/10">
        <div className="text-center mb-4">
          <div className="text-3xl text-gold-accent italic" style={{ fontVariantEmoji: 'text' }}>℞</div>
          <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest mt-1">Your Natal Retrogrades</p>
        </div>
        {data.planets.length > 0 ? (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {data.planets.map((p, i) => {
              const elColor = ELEMENT_COLORS[ELEMENT_MAP[p.sign]] || '#D4AF85';
              return (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.06] border border-gold-primary/15">
                  <span className="text-lg text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{p.glyph}</span>
                  <span className="font-body text-[10px] text-white/80">{p.name}</span>
                  <span className="text-base" style={{ fontVariantEmoji: 'text', color: elColor }}>{p.signGlyph}</span>
                  {p.house && <span className="font-body text-[9px] text-brass/40">H{p.house}</span>}
                  <span className="text-gold-accent italic text-xs">℞</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-body text-[11px] text-brass/60 italic text-center">
            You have no natal retrogrades — each planet moves forward in your birth chart.
          </p>
        )}
      </div>
    );
  }

  // ── Big Three anchor (generic fallback for any module) ──
  if (data.type === 'big3') {
    return (
      <div className="celestial-card p-5 border-gold-accent/40 bg-gold-primary/10">
        <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest text-center mb-4">Your Big Three</p>
        <div className="flex items-center justify-center gap-6">
          {[
            { label: 'Sun', glyph: '☉', data: data.sun },
            { label: 'Moon', glyph: '☽', data: data.moon },
            { label: 'Rising', glyph: 'AC', data: data.ascendant ? { sign: data.ascendant, signGlyph: SIGN_GLYPHS[data.ascendant] || '' } : null },
          ].map(({ label, glyph, data: d }) => {
            const elColor = d?.sign ? (ELEMENT_COLORS[ELEMENT_MAP[d.sign]] || '#D4AF85') : '#D4AF85';
            return (
              <div key={label} className="text-center">
                <div className="text-lg text-gold-accent font-display">{glyph}</div>
                <div className="text-[9px] font-body uppercase tracking-widest text-brass">{label}</div>
                {d ? (
                  <>
                    <div className="text-2xl mt-0.5" style={{ fontVariantEmoji: 'text', color: elColor }}>{d.signGlyph || SIGN_GLYPHS[d.sign] || ''}</div>
                    <div className="font-body text-[10px] text-white/80"><SignName sign={d.sign} /></div>
                    {d.house ? <div className="font-body text-[9px] text-brass/40">H{d.house}</div> : null}
                  </>
                ) : (
                  <div className="text-2xl mt-0.5 text-brass/30">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Planet placement ──
  if (data.type === 'planet') {
    const elColor = ELEMENT_COLORS[data.element] || '#D4AF85';
    return (
      <div className="celestial-card p-5 border-gold-accent/40 bg-gold-primary/10">
        {/* Planet in Sign — main visual */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <div className="text-4xl text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{data.glyph}</div>
            <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest mt-1">{data.planet}</p>
          </div>
          <div className="text-xl text-brass/30 font-body italic">in</div>
          <div className="text-center">
            <div className="text-4xl" style={{ fontVariantEmoji: 'text', color: elColor }}>{data.signGlyph}</div>
            <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest mt-1"><SignName sign={data.sign} /></p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {data.house && (
            <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
              {data.house}{getOrdinalSuffix(data.house)} House
            </span>
          )}
          {data.element && (
            <span className="font-body text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${elColor}22`, color: elColor }}>
              {data.element}
            </span>
          )}
          {data.modality && (
            <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              {data.modality}
            </span>
          )}
          {data.retrograde && (
            <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-gold-accent/20 text-gold-accent italic">
              ℞ Retrograde
            </span>
          )}
        </div>

        {/* Key aspects */}
        {data.aspects.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gold-primary/15">
            <p className="font-body text-[10px] text-brass/50 uppercase tracking-widest text-center mb-2">Key Aspects in Your Chart</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {data.aspects.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-lg text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{data.glyph}</span>
                  <span className="text-sm text-gold-accent">{ASPECT_SYMBOLS[a.aspect] || a.aspect}</span>
                  <span className="text-lg" style={{ fontVariantEmoji: 'text' }}>{PLANET_GLYPHS[a.other] || '✦'}</span>
                  <span className="font-body text-[9px] text-brass/40">{a.orb?.toFixed(1)}°</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── House placement ──
  if (data.type === 'house') {
    const elColor = data.element ? ELEMENT_COLORS[data.element] : '#D4AF85';
    return (
      <div className="celestial-card p-5 border-gold-accent/40 bg-gold-primary/10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <div className="font-display text-4xl font-bold text-gold-accent">{data.house}</div>
            <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest mt-1">House</p>
          </div>
          {data.cuspSign && (
            <>
              <div className="text-xl text-brass/30">·</div>
              <div className="text-center">
                <div className="text-4xl" style={{ fontVariantEmoji: 'text', color: elColor }}>{data.cuspSignGlyph}</div>
                <p className="font-body text-[10px] text-brass/60 uppercase tracking-widest mt-1"><SignName sign={data.cuspSign} /> cusp</p>
              </div>
            </>
          )}
        </div>

        {data.planetsInHouse.length > 0 ? (
          <div className="mt-2 pt-3 border-t border-gold-primary/15">
            <p className="font-body text-[10px] text-brass/50 uppercase tracking-widest text-center mb-2">Planets in This House</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {data.planetsInHouse.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-xl text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{p.glyph}</span>
                  <span className="font-body text-[10px] text-white/70">{p.name}{p.retrograde ? ' ℞' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="font-body text-[11px] text-brass/50 italic text-center mt-2">
            No planets here — this house flows through its sign's ruler.
          </p>
        )}
      </div>
    );
  }

  // ── Sign placement ──
  if (data.type === 'sign') {
    const elColor = ELEMENT_COLORS[data.element] || '#D4AF85';
    return (
      <div className="celestial-card p-5 border-gold-accent/40 bg-gold-primary/10">
        <div className="text-center mb-4">
          <div className="text-5xl" style={{ fontVariantEmoji: 'text', color: elColor }}>{data.glyph}</div>
          <p className="font-display text-sm font-bold text-white mt-2"><SignName sign={data.sign} /></p>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
          <span className="font-body text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${elColor}22`, color: elColor }}>{data.element}</span>
          <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{data.modality}</span>
        </div>

        {data.planetsInSign.length > 0 ? (
          <div className="pt-3 border-t border-gold-primary/15">
            <p className="font-body text-[10px] text-brass/50 uppercase tracking-widest text-center mb-2">Your Planets in {data.sign}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {data.planetsInSign.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-xl text-gold-accent" style={{ fontVariantEmoji: 'text' }}>{p.glyph}</span>
                  <span className="font-body text-[10px] text-white/70">{p.name}{p.retrograde ? ' ℞' : ''}</span>
                  {p.house && <span className="font-body text-[9px] text-brass/40">H{p.house}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : data.houseWithSign ? (
          <p className="font-body text-[11px] text-brass/50 italic text-center pt-2">
            No planets here, but your {data.houseWithSign}{getOrdinalSuffix(data.houseWithSign)} house cusp falls in this sign.
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}