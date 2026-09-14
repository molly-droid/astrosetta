import React, { useState } from 'react';
import { PLANET_GLYPHS, ASPECT_GLYPHS } from '@/lib/transitUtils';
import { useAuth } from '@/lib/AuthContext';
import ManageChartViewLink from '@/components/chart/ManageChartViewLink';

const ASTEROIDS = new Set(['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Hygiea', 'Eris', 'Tyche']);

const SIGN_GLYPHS_ARR = ['♈\uFE0E','♉\uFE0E','♊\uFE0E','♋\uFE0E','♌\uFE0E','♍\uFE0E','♎\uFE0E','♏\uFE0E','♐\uFE0E','♑\uFE0E','♒\uFE0E','♓\uFE0E'];
const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const ELEMENT_MAP = {
  Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',
  Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',
  Gemini:'Air',Libra:'Air',Aquarius:'Air',
  Cancer:'Water',Scorpio:'Water',Pisces:'Water',
};
const ELEMENT_COLORS = { Fire:'#D4AF85', Earth:'#A8C8A8', Air:'#9DB4C8', Water:'#A8D4D9' };
const ASPECT_COLORS = {
  conjunction:'#C9A961', opposition:'#c0392b', trine:'#2980b9',
  square:'#c0392b', sextile:'#27ae60',
};
const MUNDANE_ORBS = { conjunction:2, opposition:2, trine:2, square:2, sextile:1.5 };
const ASPECT_ANGLES_MAP = { conjunction:0, opposition:180, trine:120, square:90, sextile:60 };
const PLANET_COLORS = {
  Sun:'#F1C40F', Moon:'#C8D0DA', Mercury:'#AAB7B8', Venus:'#E8A0BF', Mars:'#E74C3C',
  Jupiter:'#E67E22', Saturn:'#7F8C8D', Uranus:'#48C9B0', Neptune:'#6C7BE8', Pluto:'#9B59B6',
  Chiron:'#1ABC9C', 'North Node':'#7dd49a', 'South Node':'#C0392B',
};

// Sky chart: Aries always at 9 o'clock (ascLon = 0)
const ASC_LON = 0;

function polarToXY(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function lonToAngle(lon) {
  return -(lon - ASC_LON) + 270;
}

function spreadPlanets(pts) {
  const MIN_SEP = 11;
  const withAngles = pts.map(pt => ({ ...pt, trueAngle: lonToAngle(pt.longitude) }));
  withAngles.sort((a, b) => a.longitude - b.longitude);
  const clusters = [];
  for (const pt of withAngles) {
    const last = clusters[clusters.length - 1];
    let diff = last ? Math.abs(pt.trueAngle - last[last.length - 1].trueAngle) % 360 : 999;
    if (diff > 180) diff = 360 - diff;
    if (last && diff < MIN_SEP) last.push(pt);
    else clusters.push([pt]);
  }
  const placed = [];
  for (const cluster of clusters) {
    const n = cluster.length;
    const center = cluster[Math.floor(n / 2)].trueAngle;
    const halfSpan = ((n - 1) / 2) * MIN_SEP;
    cluster.forEach((pt, i) => {
      placed.push({ ...pt, displayAngle: center + halfSpan - i * MIN_SEP });
    });
  }
  return placed;
}

function getMundaneAspects(planets) {
  const results = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i], p2 = planets[j];
      if (p1.name === 'Moon' || p2.name === 'Moon') continue;
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const [asp, targetOrb] of Object.entries(MUNDANE_ORBS)) {
        const orb = Math.abs(diff - ASPECT_ANGLES_MAP[asp]);
        if (orb <= targetOrb) {
          results.push({ p1: p1.name, p2: p2.name, asp, orb });
          break;
        }
      }
    }
  }
  return results;
}

export default function DailyTransitWheel({ transits, bare = false }) {
  const [selected, setSelected] = useState(null);
  const { user } = useAuth();

  if (!transits?.transitPlanets?.length) return null;

  const hiddenPoints = new Set([
    ...(user?.show_asteroids === false ? [...ASTEROIDS] : []),
    ...(user?.show_lilith === false ? ['Black Moon Lilith'] : []),
    ...(user?.show_nodes === false ? ['North Node', 'South Node'] : []),
  ]);
  const planets = transits.transitPlanets.filter(p => !hiddenPoints.has(p.name));
  const placed = spreadPlanets(planets);
  const aspects = getMundaneAspects(planets);

  const cx = 180, cy = 180, size = 360;
  const R_OUTER = 165;
  const R_ZODIAC_IN = 140;
  const R_PLANET = 102;
  const R_ASPECT = 80;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const inner = (
    <div className="space-y-2">
      {!bare && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-bold text-white">Today's Sky</p>
            <p className="font-body text-xs text-white/40">{dateLabel} · Current planetary positions</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gold-accent/60 text-lg font-display" style={{ fontVariantEmoji: 'text' }}>☉</span>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 480 }}>
          {/* Outer ring */}
          <circle cx={cx} cy={cy} r={R_OUTER} fill="#0a1220" stroke="#D4AF85" strokeWidth="1" strokeOpacity="0.5" />

          {/* Zodiac band segments */}
          {SIGN_NAMES.map((sign, i) => {
            const startLon = i * 30;
            const endLon = startLon + 30;
            const a1 = lonToAngle(startLon);
            const a2 = lonToAngle(endLon);
            const p1 = polarToXY(cx, cy, R_OUTER, a1);
            const p2 = polarToXY(cx, cy, R_OUTER, a2);
            const p3 = polarToXY(cx, cy, R_ZODIAC_IN, a2);
            const p4 = polarToXY(cx, cy, R_ZODIAC_IN, a1);
            const col = ELEMENT_COLORS[ELEMENT_MAP[sign]] || '#D4AF85';
            const isSelected = selected === sign;
            return (
              <path key={sign}
                d={`M${p1.x},${p1.y} A${R_OUTER},${R_OUTER} 0 0,0 ${p2.x},${p2.y} L${p3.x},${p3.y} A${R_ZODIAC_IN},${R_ZODIAC_IN} 0 0,1 ${p4.x},${p4.y} Z`}
                fill={col}
                fillOpacity={isSelected ? 0.5 : i % 2 === 0 ? 0.2 : 0.08}
                stroke="#D4AF85" strokeWidth="0.3" strokeOpacity="0.4"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(selected === sign ? null : sign)}
              />
            );
          })}

          {/* Zodiac glyphs */}
          {SIGN_NAMES.map((sign, i) => {
            const midLon = i * 30 + 15;
            const pos = polarToXY(cx, cy, (R_ZODIAC_IN + R_OUTER) / 2, lonToAngle(midLon));
            return (
              <text key={sign} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{ fontFamily: 'serif', fontSize: 'calc(14px * var(--app-font-scale, 1))', fill: '#C9A961', opacity: 0.85, fontVariantEmoji: 'text' }}>
                {SIGN_GLYPHS_ARR[i]}
              </text>
            );
          })}

          {/* Inner circle */}
          <circle cx={cx} cy={cy} r={R_ZODIAC_IN} fill="#0a1220" stroke="#D4AF85" strokeWidth="0.4" strokeOpacity="0.3" />
          <circle cx={cx} cy={cy} r={R_ASPECT + 10} fill="rgba(255,255,255,0.01)" stroke="#D4AF85" strokeWidth="0.3" strokeOpacity="0.2" />

          {/* Mundane aspect lines — clickable */}
          {aspects.map((asp, i) => {
            const p1 = placed.find(p => p.name === asp.p1);
            const p2 = placed.find(p => p.name === asp.p2);
            if (!p1 || !p2) return null;
            const pt1 = polarToXY(cx, cy, R_ASPECT, p1.displayAngle);
            const pt2 = polarToXY(cx, cy, R_ASPECT, p2.displayAngle);
            const col = ASPECT_COLORS[asp.asp] || '#8B7355';
            const isSelected = selected === `asp_${asp.p1}_${asp.p2}`;
            return (
              <g key={i} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected === `asp_${asp.p1}_${asp.p2}` ? null : `asp_${asp.p1}_${asp.p2}`)}>
                {/* wider invisible hit area */}
                <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                  stroke="transparent" strokeWidth="8" />
                <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                  stroke={col}
                  strokeWidth={isSelected ? '1.4' : '0.7'}
                  strokeOpacity={isSelected ? 0.8 : 0.45}
                  strokeDasharray={asp.asp === 'trine' || asp.asp === 'sextile' ? '3,3' : 'none'}
                />
              </g>
            );
          })}

          {/* Planet glyphs */}
          {placed.map(p => {
            const pos = polarToXY(cx, cy, R_PLANET, p.displayAngle);
            const tickOuter = polarToXY(cx, cy, R_ZODIAC_IN, p.trueAngle);
            const tickInner = polarToXY(cx, cy, R_ZODIAC_IN - 7, p.trueAngle);
            const glyph = PLANET_GLYPHS[p.name] || '✦';
            const isSelected = selected === p.name;
            return (
              <g key={p.name} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected === p.name ? null : p.name)}>
                <line x1={tickOuter.x} y1={tickOuter.y} x2={tickInner.x} y2={tickInner.y}
                  stroke={PLANET_COLORS[p.name] || '#C9A961'} strokeWidth={isSelected ? 3 : 2.5} strokeOpacity={isSelected ? 1 : 0.85} strokeLinecap="round" />
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: 'serif', fontSize: isSelected ? 'calc(21px * var(--app-font-scale, 1))' : 'calc(16px * var(--app-font-scale, 1))', fill: isSelected ? '#ffffff' : (PLANET_COLORS[p.name] || '#D4AF85'), transition: 'font-size 0.1s' }}>
                  {glyph}
                </text>
                {p.retrograde && (
                  <text x={pos.x + 7} y={pos.y - 4} textAnchor="middle" dominantBaseline="central"
                    style={{ fontFamily: 'serif', fontSize: 'calc(9px * var(--app-font-scale, 1))', fill: PLANET_COLORS[p.name] || '#C9A961', fontStyle: 'italic' }}>℞</text>
                )}
                {/* Degree below */}
                <text x={pos.x} y={pos.y + 8} textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: 'sans-serif', fontSize: '8px', fill: PLANET_COLORS[p.name] || '#C9A961', fillOpacity: isSelected ? 1 : 0.7 }}>
                  {p.degree?.toFixed(0)}°
                </text>
              </g>
            );
          })}

          {/* Center label */}
          <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: 'serif', fontSize: '10px', fill: 'rgba(212,175,133,0.5)' }}>Sky</text>
          <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: 'sans-serif', fontSize: '7px', fill: 'rgba(212,175,133,0.3)' }}>
            {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        </svg>
      </div>

      <div className="flex justify-center pt-1">
        <ManageChartViewLink />
      </div>

      {/* Selected info: planet or aspect */}
      {selected && (() => {
        // Aspect selection
        if (selected.startsWith('asp_')) {
          const parts = selected.replace('asp_', '').split('_');
          const p1Name = parts[0];
          const p2Name = parts.slice(1).join('_');
          const asp = aspects.find(a =>
            (a.p1 === p1Name && a.p2 === p2Name) || (a.p1 === p2Name && a.p2 === p1Name)
          );
          if (!asp) return null;
          const p1 = planets.find(p => p.name === asp.p1);
          const p2 = planets.find(p => p.name === asp.p2);
          const col = ASPECT_COLORS[asp.asp] || '#8B7355';
          const sym = ASPECT_GLYPHS[asp.asp] || asp.asp;
          return (
            <div className="animate-fade-up bg-white/[0.04] rounded-xl px-4 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg" style={{ color: col }}>{sym}</span>
                <span className="font-body text-xs font-bold text-white capitalize">{asp.asp}</span>
                <span className="font-body text-xs text-white/40">{asp.orb?.toFixed(1)}° orb</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm text-gold-accent">{PLANET_GLYPHS[p1?.name]}</span>
                <span className="font-body text-xs text-white">{p1?.name}</span>
                <span className="font-body text-[10px] text-white/50">{p1?.sign} {p1?.degree?.toFixed(0)}°</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm text-gold-accent">{PLANET_GLYPHS[p2?.name]}</span>
                <span className="font-body text-xs text-white">{p2?.name}</span>
                <span className="font-body text-[10px] text-white/50">{p2?.sign} {p2?.degree?.toFixed(0)}°</span>
              </div>
            </div>
          );
        }
        // Planet selection
        const p = planets.find(pl => pl.name === selected);
        if (!p) return null;
        const aspForPlanet = aspects.filter(a => a.p1 === selected || a.p2 === selected);
        return (
          <div className="animate-fade-up bg-white/[0.04] rounded-xl px-4 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-gold-accent">{PLANET_GLYPHS[p.name]}</span>
              <span className="font-display text-sm font-bold text-white">{p.name}</span>
              <span className="font-body text-xs text-white/60">in {p.sign} {p.degree?.toFixed(1)}°</span>
              {p.retrograde && <span className="text-[10px] font-body text-gold-accent italic px-1.5 py-0.5 bg-gold-primary/10 rounded-full">℞ Retrograde</span>}
            </div>
            {aspForPlanet.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {aspForPlanet.map((a, i) => {
                  const other = a.p1 === selected ? a.p2 : a.p1;
                  const col = ASPECT_COLORS[a.asp] || '#8B7355';
                  return (
                    <span key={i} className="font-body text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: `${col}18`, color: col, border: `1px solid ${col}33` }}>
                      {ASPECT_GLYPHS[a.asp]} {other}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Retrograde summary */}
      {planets.filter(p => p.retrograde).length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {planets.filter(p => p.retrograde).map(p => (
            <span key={p.name} className="font-body text-[10px] text-gold-accent/70 px-2 py-0.5 bg-gold-primary/10 rounded-full">
              {PLANET_GLYPHS[p.name]} {p.name} ℞
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (bare) return inner;
  return <div className="celestial-card p-4">{inner}</div>;
}