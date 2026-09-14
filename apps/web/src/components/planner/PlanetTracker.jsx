import React, { useState, useEffect } from 'react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { base44 } from '@/api/base44Client';
import { Loader2, X } from 'lucide-react';
import PlanetBreakdownPopover from './PlanetBreakdownPopover';

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const SIGN_GLYPHS = ['♈\uFE0E','♉\uFE0E','♊\uFE0E','♋\uFE0E','♌\uFE0E','♍\uFE0E','♎\uFE0E','♏\uFE0E','♐\uFE0E','♑\uFE0E','♒\uFE0E','♓\uFE0E'];
const ELEMENT_COLORS = {
  Aries:'#D4AF85',Leo:'#D4AF85',Sagittarius:'#D4AF85',
  Taurus:'#A8C8A8',Virgo:'#A8C8A8',Capricorn:'#A8C8A8',
  Gemini:'#9DB4C8',Libra:'#9DB4C8',Aquarius:'#9DB4C8',
  Cancer:'#A8D4D9',Scorpio:'#A8D4D9',Pisces:'#A8D4D9',
};

const TRACKED_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

// Fetch sky positions from real ephemeris for all days in parallel.
// We use chart_type='natal' with each day as the "birth date" at a neutral
// location (0,0) — this gives accurate planet longitudes for any calendar date
// without requiring a user's birth data.
async function fetchWeekPositions(dates) {
  const results = await Promise.all(
    dates.map(d => {
      const dateKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toLocaleDateString('en-CA');
      return base44.functions.invoke('chartCalculator', {
        chart_type: 'natal',
        birth_date: dateKey,
        birth_time: '12:00:00',
        birth_location: { latitude: 0, longitude: 0, timezone: 'UTC' },
      }).then(r => r.data).catch(() => null);
    })
  );
  return results;
}

function buildPlanetData(dates, rawResults) {
  return TRACKED_PLANETS.map(name => {
    const positions = dates.map((d, i) => {
      const res = rawResults[i];
      // natal call returns planets (not transit_planets)
      const planet = (res?.planets ?? res?.transit_planets ?? []).find(p => p.name === name);
      if (!planet) return { date: d, signIdx: 0, lon: 0, rx: false, missing: true };
      const signIdx = Math.floor(((planet.longitude % 360) + 360) % 360 / 30);
      return { date: d, signIdx, lon: planet.longitude, rx: !!planet.retrograde, missing: false };
    });

    // Build segments by sign + retrograde status
    const segments = [];
    let segStart = 0;
    for (let i = 1; i <= positions.length; i++) {
      const prev = positions[segStart];
      const curr = positions[i];
      if (i === positions.length || !curr || curr.signIdx !== prev.signIdx || curr.rx !== prev.rx) {
        // Detect ingress: did sign change from the day before this segment started?
        const hasIngress = segStart > 0 && positions[segStart - 1].signIdx !== prev.signIdx;
        segments.push({
          startIdx: segStart,
          endIdx: i - 1,
          signIdx: prev.signIdx,
          rx: prev.rx,
          hasIngress,
        });
        segStart = i;
      }
    }
    return { name, positions, segments };
  });
}

// Popover for planet-in-sign interpretation
function SignInterpPopover({ planet, sign, rx, onClose }) {
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const rxNote = rx ? ' (currently retrograde)' : '';
    const prompt = `You are a concise astrologer. In 2 sentences, describe the energy of ${planet} transiting through ${sign}${rxNote} for the collective. Be specific and practical, no clichés.`;
    base44.integrations.Core.InvokeLLM({ prompt }).then(result => {
      if (!cancelled) { setText(result); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [planet, sign, rx]);

  return (
    <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(7,16,30,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-4 space-y-3" style={{ background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.25)' }}>
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-white">
            {PLANET_GLYPHS[planet] || planet} {planet} in {sign}
            {rx && <span className="ml-1.5 font-body text-[10px] text-celestial-purple">℞ Retrograde</span>}
          </p>
          <button onClick={onClose} className="text-brass/50 hover:text-white"><X size={14} /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 size={13} className="animate-spin text-gold-accent" />
            <span className="font-body text-xs text-brass italic">Interpreting...</span>
          </div>
        ) : (
          <p className="font-body text-xs text-white/80 leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

// Cache keyed by week start date — bump version to bust stale entries
const CACHE_VERSION = 'v3';
const positionCache = {};

export default function PlanetTracker({ dates, chart }) {
  const [planetData, setPlanetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popover, setPopover] = useState(null);

  const weekKey = dates?.[0]?.toLocaleDateString('en-CA');

  useEffect(() => {
    if (!dates?.length) return;
    const cacheKey = `${CACHE_VERSION}_${weekKey}`;
    if (positionCache[cacheKey]) {
      setPlanetData(positionCache[cacheKey]);
      return;
    }
    setLoading(true);
    setPlanetData(null);
    fetchWeekPositions(dates).then(rawResults => {
      const data = buildPlanetData(dates, rawResults);
      positionCache[cacheKey] = data;
      setPlanetData(data);
      setLoading(false);
    });
  }, [weekKey]);

  const n = dates?.length || 7;

  if (loading || !planetData) {
    return (
      <div className="flex items-center justify-center py-6 gap-2">
        <Loader2 size={14} className="animate-spin text-gold-primary/60" />
        <span className="font-body text-xs text-brass/50 italic">Loading planet positions...</span>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 space-y-1.5">
        <p className="font-body text-[10px] uppercase tracking-widest text-brass/50 mb-2">Planet Positions</p>
        {planetData.map(({ name, segments }) => {
          const glyph = PLANET_GLYPHS[name] || name[0];
          return (
            <div key={name} className="flex items-center gap-2">
              {/* Planet glyph */}
              <span className="font-body text-sm text-gold-accent w-5 text-center shrink-0" style={{ fontVariantEmoji: 'text' }}>
                {glyph}
              </span>
              {/* Timeline bar */}
              <div className="flex-1 flex rounded overflow-hidden h-6 relative">
                {segments.map((seg, si) => {
                  const width = ((seg.endIdx - seg.startIdx + 1) / n) * 100;
                  const sign = SIGN_NAMES[seg.signIdx];
                  const baseColor = ELEMENT_COLORS[sign] || '#D4AF85';
                  const color = seg.rx ? '#B8A5C8' : baseColor;
                  const bgOpacity = seg.rx ? '2a' : '1a';
                  const borderOpacity = seg.rx ? '55' : '44';
                  const showLabel = width > 18;
                  const title = `${name} in ${sign}${seg.rx ? ' ℞ (retrograde)' : ''}${seg.hasIngress ? ' — enters ' + sign + ' this week' : ''} — click to interpret`;
                  return (
                    <button
                      key={si}
                      onClick={() => setPopover({ planet: name, sign, rx: seg.rx })}
                      title={title}
                      style={{
                        width: `${width}%`,
                        background: `${color}${bgOpacity}`,
                        border: `1px solid ${color}${borderOpacity}`,
                        borderLeft: seg.hasIngress ? `2px solid ${color}cc` : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${color}33`}
                      onMouseLeave={e => e.currentTarget.style.background = `${color}${bgOpacity}`}
                    >
                      {/* Ingress marker — bright left edge pip */}
                      {seg.hasIngress && (
                        <span
                          style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: 3, background: `${color}bb`, flexShrink: 0,
                          }}
                        />
                      )}
                      <span style={{ fontFamily: 'serif', fontSize: '10px', color, fontVariantEmoji: 'text', opacity: 0.9, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                        {seg.hasIngress && <span style={{ fontSize: '8px', marginRight: '2px', opacity: 0.8 }}>→</span>}
                        {SIGN_GLYPHS[seg.signIdx]}
                        {seg.rx && <span style={{ fontSize: '8px', marginLeft: '1px' }}>℞</span>}
                        {showLabel && <span style={{ fontSize: '8px', marginLeft: '2px', opacity: 0.7 }}>{sign.slice(0, 3)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Legend */}
        <div className="flex gap-3 mt-2 ml-7 flex-wrap">
          <span className="font-body text-[8px] text-brass/40 flex items-center gap-1">
            <span style={{display:'inline-block',width:8,height:8,background:'#B8A5C822',border:'1px solid #B8A5C855',borderRadius:2}}/>℞ retrograde
          </span>
          <span className="font-body text-[8px] text-brass/40 flex items-center gap-1">
            <span style={{display:'inline-block',width:8,height:8,background:'#D4AF8522',borderLeft:'2px solid #D4AF85bb',borderRadius:2}}/>→ ingress (sign change)
          </span>
        </div>
        {/* Date axis */}
        <div className="relative h-4 mt-0.5 ml-7">
          {dates.map((d, i) => {
            const pct = n <= 1 ? 0 : (i / (n - 1)) * 100;
            const dayNum = d.getDate();
            const showLabel = n <= 7 || dayNum % 5 === 0 || dayNum === 1;
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-1.5 bg-brass/20" />
                {showLabel && (
                  <span className="font-body text-[7px] text-brass/35 leading-none mt-0.5 whitespace-nowrap">
                    {dayNum === 1 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : dayNum}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {popover && (
        chart ? (
          <PlanetBreakdownPopover
            planet={popover.planet}
            sign={popover.sign}
            rx={popover.rx}
            chart={chart}
            onClose={() => setPopover(null)}
          />
        ) : (
          <SignInterpPopover
            planet={popover.planet}
            sign={popover.sign}
            rx={popover.rx}
            onClose={() => setPopover(null)}
          />
        )
      )}
    </>
  );
}