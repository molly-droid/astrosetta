import React, { useState } from 'react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import MovementReading from '@/components/chart/MovementReading';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import PaywallModal from '@/components/paywall/PaywallModal';
import ChartSelectionInfo from '@/components/chart/ChartSelectionInfo';

const SIGN_GLYPHS = ['♈\uFE0E','♉\uFE0E','♊\uFE0E','♋\uFE0E','♌\uFE0E','♍\uFE0E','♎\uFE0E','♏\uFE0E','♐\uFE0E','♑\uFE0E','♒\uFE0E','♓\uFE0E'];
const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const SIGN_COLORS = {
  Fire: '#D4AF85', Earth: '#A8C8A8', Air: '#9DB4C8', Water: '#A8D4D9'
};
const ELEMENT_MAP = {
  Aries:'Fire',Leo:'Fire',Sagittarius:'Fire',
  Taurus:'Earth',Virgo:'Earth',Capricorn:'Earth',
  Gemini:'Air',Libra:'Air',Aquarius:'Air',
  Cancer:'Water',Scorpio:'Water',Pisces:'Water'
};

const ASPECT_COLORS = {
  conjunction: '#C9A961', opposition: '#c0392b', trine: '#2980b9',
  square: '#c0392b', sextile: '#27ae60', quincunx: '#8e44ad',
  semisextile: '#27ae60', semisquare: '#c0392b', sesquisquare: '#c0392b'
};

const ASPECT_SYMBOLS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E', square: '□\uFE0E',
  sextile: '⚹', quincunx: '\u26BB', semisextile: '\u26BA', semisquare: '∠', sesquisquare: '\u26BC'
};

const HIGHLIGHT_COLORS = {
  cradle: '#B8A5C8',
  conjunction: '#D4AF85',
  pattern: '#9DB4C8',
  stellium: '#C9A961',
};

const PLANET_COLORS = {
  Sun: '#F1C40F',
  Moon: '#C8D0DA',
  Mercury: '#AAB7B8',
  Venus: '#E8A0BF',
  Mars: '#E74C3C',
  Jupiter: '#E67E22',
  Saturn: '#7F8C8D',
  Uranus: '#48C9B0',
  Neptune: '#6C7BE8',
  Pluto: '#9B59B6',
  Chiron: '#1ABC9C',
  'North Node': '#7dd49a',
  'South Node': '#C0392B',
  'Part of Fortune': '#D4AF85',
  'Part of Spirit': '#9DB4C8',
  'Part of Eros': '#D8B4C2',
  'Part of Necessity': '#8B7B6B',
  Tyche: '#B8A5C8',
  Juno: '#C8A2C8',
  Pallas: '#A8C8C8',
  Vesta: '#E8C8A0',
};

// Font stack that reliably includes the lunar-node glyphs (☊ ☋), which many
// serif fonts omit and can fail to paint on first load.
const SYMBOL_FONT = "'Apple Symbols', 'Segoe UI Symbol', 'Noto Sans Symbols 2', 'Noto Sans Symbols', Symbola, serif";

const PREMIUM_POINTS = new Set(['Tyche', 'Juno', 'Pallas', 'Vesta']);
const ASTEROIDS = new Set(['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Hygiea', 'Eris', 'Tyche']);
const LOTS = new Set(['Part of Fortune', 'Part of Spirit', 'Part of Eros', 'Part of Necessity']);
const EMPTY_SET = new Set();

const ANGLE_NAMES = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);

// Partner (synastry) planets render on the natal ring in a distinct blue so
// the three sets — natal (gold), partner (blue), transits (green) — read
// clearly at a glance.
const PARTNER_COLOR = '#7FB3E0';

function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function lonToAngle(lon, ascLon) {
  return -(lon - ascLon) + 270;
}

function LockBadge({ x, y, color = '#C9A961' }) {
  return (
    <g pointerEvents="none">
      <path d={`M ${x - 1.3} ${y - 0.5} A 1.3 1.3 0 0 1 ${x + 1.3} ${y - 0.5}`} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
      <rect x={x - 2} y={y - 0.5} width={4} height={3.2} rx="0.6" fill={color} />
    </g>
  );
}

export default function ChartWheel({ chartData, transitData = null, transitEndData = null, partnerData = null, periodLabel = '', className = '', onSelect, skyMode = false, highlightPattern = null, highlightKey = null, mode = 'transit', overlayName = '', relationship = '', deceased = false, dateOfDeath = '', partnerHouses = [], partnerPronouns = '', showAsteroids, showLots, showNodes, showLilith }) {
  const [selected, setSelected] = useState(null);
  const { user } = useAuth();
  const { canViewAsteroids, tier } = usePermissions(user);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const lockedAsteroidNames = canViewAsteroids ? EMPTY_SET : PREMIUM_POINTS;
  // Each show* prop can be passed explicitly; otherwise fall back to the user's
  // saved Chart Display preferences. Hidden points drop from the wheel (natal +
  // transit) and any aspect involving one is dropped too.
  const showAst = showAsteroids ?? (user?.show_asteroids !== false);
  const showLotsEff = showLots ?? (user?.show_lots !== false);
  const showNodesEff = showNodes ?? (user?.show_nodes !== false);
  const showLilithEff = showLilith ?? (user?.show_lilith !== false);
  const hiddenPoints = new Set([
    ...(showAst ? [] : ASTEROIDS),
    ...(showLotsEff ? [] : LOTS),
    ...(showLilithEff ? [] : ['Black Moon Lilith']),
    ...(showNodesEff ? [] : ['North Node', 'South Node']),
  ]);
  // Transit-ring visibility: honor the user's Chart Display toggles so a
  // point hidden on the natal wheel is also hidden when it's transiting (or
  // overlaying, in synastry). Lots never transit (the calculator excludes
  // them by construction) but are listed for safety.
  const transitHiddenPoints = new Set([
    ...(showAst ? [] : ASTEROIDS),
    ...(showLotsEff ? [] : LOTS),
    ...(showLilithEff ? [] : ['Black Moon Lilith']),
    ...(showNodesEff ? [] : ['North Node', 'South Node']),
  ]);
  // Outer ring is always live transits (green); partner planets live on the
  // natal ring (blue) instead, so the overlay colour is transit-style only.
  const OC = { primary: '#7dd49a', secondary: '#5aaa70', faint: 'rgba(125,212,154,0.6)', label: 'transiting', note: 'Transiting your chart — aspect lines to natal placements are shown above.' };

  if (!chartData) return null;

  const { houses = [], angles = {}, nodes = {} } = chartData;
  const planets = (chartData.planets || []).filter(p => !hiddenPoints.has(p.name));
  const aspects = (canViewAsteroids ? (chartData.aspects || []) : (chartData.aspects || []).filter(a => !PREMIUM_POINTS.has(a.planet1) && !PREMIUM_POINTS.has(a.planet2))).filter(a => !hiddenPoints.has(a.planet1) && !hiddenPoints.has(a.planet2));
  const ascLon = angles?.ascendant?.longitude ?? 0;
  const mcLon = angles?.midheaven?.longitude ?? 0;
  const icLon = angles?.ic?.longitude ?? (mcLon + 180) % 360;

  const hasTransits = transitData && transitData.planets?.length > 0;

  const cx = 200, cy = 200, size = 400;
  const hasPartner = !!partnerData && (partnerData.planets?.length > 0);
  // Synastry glyph shrink applies in both the Planner's nested-ring synastry
  // (hasPartner) and MyChart's transit-overlay synastry (mode === 'synastry'),
  // so natal glyphs stay compact in either rendering model.
  const synastryActive = hasPartner || mode === 'synastry';
  const partnerPlanetList = hasPartner
    ? (partnerData.planets || []).map(p => ({ ...p, _partner: true })).filter(p => !hiddenPoints.has(p.name) && !lockedAsteroidNames.has(p.name))
    : [];

  // Radii — synastry mode nests a partner house ring inside a wider natal
  // house ring (natal + partner planets each within their own ring); transit
  // mode keeps the single house ring with planets inside it.
  const R_OUTER      = 172;
  const R_ZODIAC_IN  = 145;
  const R_TR_PLANET  = 204;
  const R_HOUSE_OUT  = hasPartner ? 143 : 138;
  const R_HOUSE_IN   = hasPartner ? 128 : 122;
  const R_PLANET     = hasPartner ? 121 : 102;
  const R_PHOUSE_OUT = 108;
  const R_PHOUSE_IN  = 90;
  const R_PPLANET    = 83;
  const R_ASPECT     = hasPartner ? 70 : 78;

  const allPoints = [
    ...planets,
    ...partnerPlanetList,
    ...(showNodesEff && nodes.north_node ? [{ name: 'North Node', ...nodes.north_node }] : []),
    ...(showNodesEff && nodes.south_node ? [{ name: 'South Node', ...nodes.south_node }] : []),
    // Include natal angles as selectable points when overlay data is present
    // (synastry/transit mode) so cross-aspect lines can connect to them
    ...((hasTransits || hasPartner) && angles.ascendant ? [{ name: 'Ascendant', ...angles.ascendant, house: 1 }] : []),
    ...((hasTransits || hasPartner) && angles.descendant ? [{ name: 'Descendant', ...angles.descendant, house: 7 }] : []),
    ...((hasTransits || hasPartner) && angles.midheaven ? [{ name: 'Midheaven', ...angles.midheaven, house: 10 }] : []),
    ...((hasTransits || hasPartner) && angles.ic ? [{ name: 'IC', ...angles.ic, house: 4 }] : []),
  ];

  function spreadPlanets(pts) {
    const MIN_SEP = 10; // minimum degrees between glyphs in display space

    // lonToAngle is a decreasing function: higher longitude → lower display angle.
    // So sort by longitude ascending = sort by trueAngle DESCENDING.
    // We must fan clusters in DECREASING display-angle order to preserve visual order.
    const withAngles = pts.map(pt => ({
      ...pt,
      trueAngle: lonToAngle(pt.longitude, ascLon),
    }));

    // Sort by longitude ascending (= display angle descending = CCW order on wheel)
    withAngles.sort((a, b) => a.longitude - b.longitude);

    // Group into clusters: planets whose true display angles are within MIN_SEP of each other
    const clusters = [];
    for (const pt of withAngles) {
      const last = clusters[clusters.length - 1];
      let diff = last
        ? Math.abs(pt.trueAngle - last[last.length - 1].trueAngle) % 360
        : 999;
      if (diff > 180) diff = 360 - diff;
      if (last && diff < MIN_SEP) {
        last.push(pt);
      } else {
        clusters.push([pt]);
      }
    }

    // Fan each cluster.
    // Because longitude↑ → display angle↓, first member (lowest lon) gets the HIGHEST display angle.
    // So fan: first item = center + (n-1)/2 * MIN_SEP, last item = center - (n-1)/2 * MIN_SEP
    const placed = [];
    for (const cluster of clusters) {
      const n = cluster.length;
      // Center on the median planet's true angle
      const center = cluster[Math.floor(n / 2)].trueAngle;
      const halfSpan = ((n - 1) / 2) * MIN_SEP;
      cluster.forEach((pt, i) => {
        // i=0 (lowest lon) → highest display angle, i=n-1 → lowest display angle
        placed.push({
          ...pt,
          displayAngle: center + halfSpan - i * MIN_SEP,
        });
      });
    }
    return placed;
  }

  // Spread natal + partner together so the partner glyphs (blue) share the
  // natal ring without colliding; partner planets are tagged then split back
  // out so natal aspects/selection still resolve to natal planets only.
  const placedCombined = spreadPlanets(allPoints);
  const placedPlanets = placedCombined.filter(p => !p._partner);
  const placedPartnerPlanets = placedCombined.filter(p => p._partner);
  const strongAspects = aspects.filter(a => ['strong','exact','moderate'].includes(a.strength));

  // Transit planets spread (using same ascLon for consistent orientation)
  const transitPlanets = hasTransits ? (() => {
    const tPts = (transitData.planets || []).map(p => ({ ...p })).filter(p => !lockedAsteroidNames.has(p.name) && !transitHiddenPoints.has(p.name));
    return spreadPlanets(tPts);
  })() : [];

  // Mundane (transit-to-transit) aspects — collective sky weather
  const MUNDANE_ORBS = { conjunction: 2.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
  const MUNDANE_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
  const mundaneAspects = hasTransits ? (() => {
    const result = [];
    const tps = (transitData.planets || []).filter(p => !transitHiddenPoints.has(p.name));
    for (let i = 0; i < tps.length; i++) {
      for (let j = i + 1; j < tps.length; j++) {
        const p1 = tps[i], p2 = tps[j];
        if (p1.name === 'Moon' || p2.name === 'Moon') continue;
        let diff = Math.abs(p1.longitude - p2.longitude);
        if (diff > 180) diff = 360 - diff;
        for (const [asp, targetOrb] of Object.entries(MUNDANE_ORBS)) {
          const orb = Math.abs(diff - MUNDANE_ANGLES[asp]);
          if (orb <= targetOrb) {
            result.push({ planet1: p1.name, planet2: p2.name, aspect: asp, orb: Math.round(orb * 100) / 100 });
            break;
          }
        }
      }
    }
    return result;
  })() : [];

  // Transit-to-partner aspects (synastry + now): how today's transits land on
  // the partner's chart, computed client-side from the live transit planets
  // and the partner's natal points. Shown on selection alongside the
  // transit-to-natal aspects.
  const partnerTransitAspects = (hasPartner && hasTransits) ? (() => {
    const result = [];
    const tps = (transitData.planets || []).filter(p => !transitHiddenPoints.has(p.name));
    const MAJ = [['conjunction',0,3],['opposition',180,3],['trine',120,2.5],['square',90,2.5],['sextile',60,2]];
    for (const tp of tps) {
      if (tp.longitude == null) continue;
      for (const pp of partnerPlanetList) {
        if (pp.longitude == null) continue;
        let diff = Math.abs(tp.longitude - pp.longitude);
        if (diff > 180) diff = 360 - diff;
        for (const [asp, ang, orbMax] of MAJ) {
          const orb = Math.abs(diff - ang);
          if (orb <= orbMax) { result.push({ transit_planet: tp.name, partner_planet: pp.name, aspect: asp, orb: Math.round(orb * 100) / 100 }); break; }
        }
      }
    }
    return result;
  })() : [];

  function handleSelect(item) {
    setSelected(prev => prev?.key === item.key ? null : item);
    if (onSelect) onSelect(item);
  }

  // selKey must be a string — some highlight callers pass non-string values
  // (objects, numbers), and optional chaining alone doesn't guard those, so
  // normalize to null to keep every startsWith/=== comparison safe.
  const rawSelKey = selected?.key ?? highlightKey;
  const selKey = typeof rawSelKey === 'string' ? rawSelKey : null;
  const selectedTransitPlanet = selected?.type === 'transit_planet'
    ? selected.name
    : selected?.type === 'transit_aspect'
      ? selected.transit_planet
      : selKey?.startsWith('transit_planet_')
        ? selKey.slice('transit_planet_'.length)
        : selKey?.startsWith('tasp_')
          ? (transitData?.transit_aspects || []).find(ta => `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}` === selKey)?.transit_planet || null
          : null;

  const selectedNatalPlanet = selected?.type === 'planet' ? selected.name : null;

  const selectedPartnerPlanet = selected?.type === 'partner_planet'
    ? selected.name
    : selKey?.startsWith('pasp_')
      ? (partnerData?.aspects || []).find(pa => `pasp_${pa.transit_planet}_${pa.aspect}_${pa.natal_planet}` === selKey)?.transit_planet || null
      : null;

  // ── Focus dimming: when an item is selected, dim everything not related to it ──
  const DIM = 0.2;
  // Multi-planet group highlight (element/modality/stellium/pattern). Only the
  // natal chart dims — sky mode (mundane) keeps everything visible.
  const patternPlanets = (!skyMode && highlightPattern?.planets?.length) ? new Set(highlightPattern.planets) : null;
  const hasSelection = !!selKey || !!patternPlanets;
  const highlightedSigns = patternPlanets ? new Set(placedPlanets.filter(p => patternPlanets.has(p.name) && p.sign).map(p => p.sign)) : null;
  const highlightedHouses = patternPlanets ? new Set(placedPlanets.filter(p => patternPlanets.has(p.name) && p.house).map(p => p.house)) : null;

  function isSignDimmed(sign) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (patternPlanets) return !highlightedSigns.has(sign);
    return selKey !== `sign_${sign}`;
  }
  function isHouseDimmed(number) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (patternPlanets) return !highlightedHouses.has(number);
    return selKey !== `house_${number}`;
  }
  function isNatalPlanetDimmed(p) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (selKey === `planet_${p.name}`) return false;
    if (selKey?.startsWith('aspect_')) {
      const parts = selKey.split('_');
      if (parts[1] === p.name || parts[3] === p.name) return false;
    }
    if (selKey?.startsWith('tasp_')) {
      const parts = selKey.split('_');
      if (parts[3] === p.name) return false;
    }
    if (selKey?.startsWith('transit_planet_')) {
      const tpName = selKey.slice('transit_planet_'.length);
      const tasps = (transitData?.transit_aspects || []).filter(ta => ta.transit_planet === tpName);
      if (tasps.some(ta => ta.natal_planet === p.name)) return false;
    }
    if (selKey?.startsWith('partner_planet_')) {
      const ppName = selKey.slice('partner_planet_'.length);
      const pasps = (partnerData?.aspects || []).filter(pa => pa.transit_planet === ppName);
      if (pasps.some(pa => pa.natal_planet === p.name)) return false;
    }
    if (selKey?.startsWith('pasp_')) {
      const parts = selKey.split('_');
      if (parts[3] === p.name) return false;
    }
    if (patternPlanets) return !patternPlanets.has(p.name);
    return true;
  }
  function isPartnerPlanetDimmed(p) {
    if (!hasSelection) return false;
    if (selKey === `partner_planet_${p.name}`) return false;
    if (selKey?.startsWith('pasp_')) {
      const parts = selKey.split('_');
      if (parts[1] === p.name) return false;
    }
    if (selKey?.startsWith('tpasp_')) {
      const parts = selKey.split('_');
      if (parts[3] === p.name) return false;
    }
    if (selKey?.startsWith('planet_')) {
      const npName = selKey.slice('planet_'.length);
      const pasps = (partnerData?.aspects || []).filter(pa => pa.natal_planet === npName);
      if (pasps.some(pa => pa.transit_planet === p.name)) return false;
    }
    return true;
  }
  function isPartnerAspectDimmed(pa) {
    if (!hasSelection) return false;
    if (selKey === `pasp_${pa.transit_planet}_${pa.aspect}_${pa.natal_planet}`) return false;
    if (selKey === `partner_planet_${pa.transit_planet}`) return false;
    if (selKey === `planet_${pa.natal_planet}`) return false;
    return true;
  }
  function isTransitPartnerAspectDimmed(ta) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (selKey === `tpasp_${ta.transit_planet}_${ta.aspect}_${ta.partner_planet}`) return false;
    if (selKey === `transit_planet_${ta.transit_planet}`) return false;
    if (selKey === `partner_planet_${ta.partner_planet}`) return false;
    return true;
  }
  function isTransitPlanetDimmed(tp) {
    if (!hasSelection) return false;
    if (selKey === `movement_${tp.name}`) return false;
    if (selKey === `transit_planet_${tp.name}`) return false;
    if (selKey?.startsWith('tasp_')) {
      const parts = selKey.split('_');
      if (parts[1] === tp.name) return false;
    }
    if (selKey?.startsWith('tpasp_')) {
      const parts = selKey.split('_');
      if (parts[1] === tp.name) return false;
    }
    if (selKey?.startsWith('mundane_')) {
      const parts = selKey.split('_');
      if (parts[1] === tp.name || parts[3] === tp.name) return false;
    }
    if (selKey?.startsWith('planet_')) {
      const npName = selKey.slice('planet_'.length);
      const tasps = (transitData?.transit_aspects || []).filter(ta => ta.natal_planet === npName);
      if (tasps.some(ta => ta.transit_planet === tp.name)) return false;
    }
    return true;
  }
  function isNatalAspectDimmed(asp) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (selKey === `aspect_${asp.planet1}_${asp.aspect}_${asp.planet2}`) return false;
    if (selKey === `planet_${asp.planet1}` || selKey === `planet_${asp.planet2}`) return false;
    if (patternPlanets) return !(patternPlanets.has(asp.planet1) && patternPlanets.has(asp.planet2));
    return true;
  }
  function isTransitAspectDimmed(ta) {
    if (!hasSelection) return false;
    if (selKey?.startsWith('movement_')) return false;
    if (selKey === `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}`) return false;
    if (selKey === `transit_planet_${ta.transit_planet}`) return false;
    if (selKey === `planet_${ta.natal_planet}`) return false;
    return true;
  }
  function isMovementDimmed(tp) {
    if (!selKey || !selKey.startsWith('movement_')) return false;
    return selKey !== `movement_${tp.name}`;
  }

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <svg width="100%" viewBox="0 0 400 400" style={{ maxWidth: 440, overflow: 'visible' }}
        onClick={(e) => {
          // Walk up from click target — if no ancestor has cursor:pointer, it's empty space
          let el = e.target;
          while (el && el !== e.currentTarget) {
            if (el.style && el.style.cursor === 'pointer') return;
            el = el.parentElement;
          }
          setSelected(null);
          if (onSelect) onSelect(null);
        }}
      >
        {/* Background — removed fill & border, chart only */}
        <circle cx={cx} cy={cy} r={R_OUTER} fill="none" stroke="none" />

        {/* Zodiac band segments — clickable */}
        {SIGN_NAMES.map((sign, i) => {
          const startLon = i * 30;
          const endLon = startLon + 30;
          const a1 = lonToAngle(startLon, ascLon);
          const a2 = lonToAngle(endLon, ascLon);
          const r1 = R_ZODIAC_IN, r2 = R_OUTER;
          const p1 = polarToXY(cx, cy, r2, a1);
          const p2 = polarToXY(cx, cy, r2, a2);
          const p3 = polarToXY(cx, cy, r1, a2);
          const p4 = polarToXY(cx, cy, r1, a1);
          const col = SIGN_COLORS[ELEMENT_MAP[sign]] || '#D4AF85';
          const isSelected = selKey === `sign_${sign}`;
          return (
            <path
              key={sign}
              d={`M${p1.x},${p1.y} A${r2},${r2} 0 0,0 ${p2.x},${p2.y} L${p3.x},${p3.y} A${r1},${r1} 0 0,1 ${p4.x},${p4.y} Z`}
              fill={col}
              fillOpacity={isSelected ? 0.55 : i % 2 === 0 ? 0.22 : 0.10}
              stroke={isSelected ? '#C9A961' : '#D4AF85'}
              strokeWidth={isSelected ? '1.2' : '0.4'}
              style={{ cursor: 'pointer', opacity: isSignDimmed(sign) ? DIM : 1, transition: 'opacity 0.3s ease' }}
              onClick={() => handleSelect({ key: `sign_${sign}`, type: 'sign', sign, glyph: SIGN_GLYPHS[i], element: ELEMENT_MAP[sign] })}
            />
          );
        })}

        {/* Zodiac sign glyphs */}
        {SIGN_NAMES.map((sign, i) => {
          const midLon = i * 30 + 15;
          const a = lonToAngle(midLon, ascLon);
          const pos = polarToXY(cx, cy, (R_ZODIAC_IN + R_OUTER) / 2, a);
          const isSelected = selKey === `sign_${sign}`;
          return (
            <text key={sign} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              style={{fontFamily:'serif', fontSize: isSelected ? 'calc(20px * var(--app-font-scale, 1))' : 'calc(13px * var(--app-font-scale, 1))', fill: isSelected ? '#ffffff' : '#C9A961', opacity: isSignDimmed(sign) ? DIM : isSelected ? 1 : 0.9, cursor:'pointer', fontVariantEmoji: 'text', transition: 'opacity 0.3s ease'}}
              onClick={() => handleSelect({ key: `sign_${sign}`, type: 'sign', sign, glyph: SIGN_GLYPHS[i], element: ELEMENT_MAP[sign] })}>
              {SIGN_GLYPHS[i]}
            </text>
          );
        })}

        {/* House ring */}
        {!skyMode && <circle cx={cx} cy={cy} r={R_HOUSE_OUT} fill="none" stroke="#D4AF85" strokeWidth="0.5" strokeOpacity="0.4" />}
        <circle cx={cx} cy={cy} r={R_HOUSE_IN} fill="#0a1220" stroke="#D4AF85" strokeWidth="0.5" strokeOpacity="0.4" />

        {/* House segments — clickable hit areas */}
        {!skyMode && houses.map((h, i) => {
          const next = houses[(i + 1) % 12];
          const a1 = lonToAngle(h.longitude, ascLon);
          const a2 = lonToAngle(next.longitude, ascLon);
          const r1 = R_HOUSE_IN, r2 = R_HOUSE_OUT;
          const p1 = polarToXY(cx, cy, r2, a1);
          const p2 = polarToXY(cx, cy, r2, a2);
          const p3 = polarToXY(cx, cy, r1, a2);
          const p4 = polarToXY(cx, cy, r1, a1);
          const isSelected = selKey === `house_${i + 1}`;
          return (
            <path
              key={`hseg_${i}`}
              d={`M${p1.x},${p1.y} A${r2},${r2} 0 0,0 ${p2.x},${p2.y} L${p3.x},${p3.y} A${r1},${r1} 0 0,1 ${p4.x},${p4.y} Z`}
              fill={isSelected ? '#C9A961' : 'none'}
              fillOpacity={isSelected ? 0.18 : 0}
              stroke="none"
              pointerEvents={isSelected ? 'all' : 'none'}
              style={{ cursor: 'pointer', opacity: isHouseDimmed(i + 1) ? DIM : 1, transition: 'opacity 0.3s ease' }}
              onClick={() => handleSelect({ key: `house_${i + 1}`, type: 'house', number: i + 1, sign: h.sign, degree: h.degree })}
            />
          );
        })}

        {/* House cusp lines */}
        {!skyMode && houses.map((h, i) => {
          const a = lonToAngle(h.longitude, ascLon);
          const p1 = polarToXY(cx, cy, R_HOUSE_IN, a);
          const p2 = polarToXY(cx, cy, R_ZODIAC_IN, a);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#D4AF85"
              strokeWidth="0.5"
              strokeOpacity="0.5"
            />
          );
        })}

        {/* Partner house ring — nested INSIDE the natal house ring; partner
            planets sit just inside it. Cusps + numbers in purple to match the
            partner planet colour. */}
        {hasPartner && partnerHouses.length > 0 && (
          <>
            <circle cx={cx} cy={cy} r={R_PHOUSE_OUT} fill="none" stroke="#B8A5C8" strokeWidth="0.4" strokeOpacity="0.35" />
            <circle cx={cx} cy={cy} r={R_PHOUSE_IN} fill="none" stroke="#B8A5C8" strokeWidth="0.4" strokeOpacity="0.35" />
            {partnerHouses.map((h, i) => {
              const a = lonToAngle(h.longitude, ascLon);
              const p1 = polarToXY(cx, cy, R_PHOUSE_OUT, a);
              const p2 = polarToXY(cx, cy, R_PHOUSE_IN, a);
              return (
                <line key={`phc_${i}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="#B8A5C8" strokeWidth="0.9" strokeOpacity="0.6" strokeDasharray="4,3" />
              );
            })}
            {partnerHouses.map((h, i) => {
              const next = partnerHouses[(i + 1) % partnerHouses.length];
              let mid = (h.longitude + next.longitude) / 2;
              if (next.longitude < h.longitude) mid = ((h.longitude + next.longitude + 360) / 2) % 360;
              const a = lonToAngle(mid, ascLon);
              const pos = polarToXY(cx, cy, (R_PHOUSE_OUT + R_PHOUSE_IN) / 2, a);
              return (
                <text key={`phn_${i}`} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: 'sans-serif', fontSize: '7px', fill: '#B8A5C8', opacity: 0.7 }}>
                  {i + 1}
                </text>
              );
            })}
          </>
        )}

        {/* House numbers */}
        {!skyMode && houses.map((h, i) => {
          const next = houses[(i + 1) % 12];
          let mid = (h.longitude + next.longitude) / 2;
          if (next.longitude < h.longitude) mid = ((h.longitude + next.longitude + 360) / 2) % 360;
          const a = lonToAngle(mid, ascLon);
          const pos = polarToXY(cx, cy, (R_HOUSE_IN + R_HOUSE_OUT) / 2, a);
          const isSelected = selKey === `house_${i + 1}`;
          return (
            <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
              style={{fontFamily:'serif', fontSize: isSelected ? '14px' : '9px', fill: isSelected ? '#C9A961' : 'rgba(255,255,255,0.5)', opacity: isHouseDimmed(i + 1) ? DIM : isSelected ? 1 : 0.9, cursor:'pointer', transition: 'opacity 0.3s ease'}}
              onClick={() => handleSelect({ key: `house_${i + 1}`, type: 'house', number: i + 1, sign: h.sign, degree: h.degree })}>
              {i + 1}
            </text>
          );
        })}

        {/* Inner circle */}
        <circle cx={cx} cy={cy} r={R_ASPECT - 10} fill="rgba(255,255,255,0.02)" stroke="#D4AF85" strokeWidth="0.6" strokeOpacity="0.4" />

        {/* Planet glyphs — angles rendered as exterior labels, not here */}
        {placedPlanets.filter(p => !ANGLE_NAMES.has(p.name) && !lockedAsteroidNames.has(p.name)).map(p => {
          const pos = polarToXY(cx, cy, R_PLANET, p.displayAngle);
          // Short tick: from just inside zodiac band to a couple px inward
          const tickOuter = polarToXY(cx, cy, R_ZODIAC_IN - 1, p.trueAngle);
          const tickInner = polarToXY(cx, cy, R_ZODIAC_IN - 7, p.trueAngle);
          // Degree label sits just inside the tick
          const degPos = polarToXY(cx, cy, R_ZODIAC_IN - 14, p.trueAngle);
          const glyph = p.name === 'North Node' ? '☊' : p.name === 'South Node' ? '☋' : (PLANET_GLYPHS[p.name] || '✦');
          const isSelected = selKey === `planet_${p.name}`;
          const hasMoved = Math.abs(p.displayAngle - p.trueAngle) > 1.5;
          return (
            <g key={p.name}
              onClick={() => handleSelect({ key: `planet_${p.name}`, type: 'planet', ...p })}
              style={{ cursor: 'pointer', opacity: isNatalPlanetDimmed(p) ? DIM : 1, transition: 'opacity 0.3s ease' }}>
              {/* Short tick mark at true position on zodiac band */}
              <line x1={tickOuter.x} y1={tickOuter.y} x2={tickInner.x} y2={tickInner.y}
                stroke="#C9A961" strokeWidth="1" strokeOpacity="0.7" />
              {/* Thin connector only when glyph was moved */}
              {hasMoved && (
                <line x1={pos.x} y1={pos.y} x2={tickInner.x} y2={tickInner.y}
                  stroke="#D4AF85" strokeWidth="0.4" strokeOpacity="0.3" strokeDasharray="2,2" />
              )}
              {/* Planet glyph */}
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'serif', fontSize: isSelected ? `calc(${synastryActive ? 17 : 22}px * var(--app-font-scale, 1))` : `calc(${synastryActive ? 11 : 15}px * var(--app-font-scale, 1))`, fill: isSelected ? '#ffffff' : '#D4AF85', transition:'font-size 0.1s'}}>
                {glyph}
              </text>
              {/* Degree label below glyph */}
              <text x={pos.x} y={pos.y + 9} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'sans-serif', fontSize:'8px', fill: isSelected ? '#C9A961' : 'rgba(196,168,130,0.7)'}}>
                {p.degree?.toFixed(0)}°
              </text>
              {p.retrograde && (
                <text x={pos.x + 8} y={pos.y - 5} textAnchor="middle" dominantBaseline="central"
                  style={{fontFamily:'serif', fontSize:'calc(9px * var(--app-font-scale, 1))', fill:'#C9A961', fontStyle:'italic'}}>℞</text>
              )}
            </g>
          );
        })}
        {/* Locked premium lots — faint glyph + lock badge; tap to upgrade */}
        {placedPlanets.filter(p => !ANGLE_NAMES.has(p.name) && lockedAsteroidNames.has(p.name)).map(p => {
          const pos = polarToXY(cx, cy, R_PLANET, p.displayAngle);
          const glyph = PLANET_GLYPHS[p.name] || '✦';
          return (
            <g key={p.name} style={{ cursor: 'pointer' }} onClick={() => setPaywallOpen(true)}>
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'serif', fontSize:'calc(14px * var(--app-font-scale, 1))', fill:'rgba(196,168,130,0.4)'}}>
                {glyph}
              </text>
              <LockBadge x={pos.x + 8} y={pos.y - 5} />
            </g>
          );
        })}

        {/* Partner (synastry) planets — same ring as natal (R_PLANET) in blue,
            spread together with natal so they never overlap. Tap to see the
            cross-aspects to your chart. */}
        {hasPartner && placedPartnerPlanets.filter(p => !ANGLE_NAMES.has(p.name)).map(p => {
          const pos = polarToXY(cx, cy, R_PPLANET, p.displayAngle);
          const tickOuter = polarToXY(cx, cy, R_PHOUSE_OUT, p.trueAngle);
          const tickInner = polarToXY(cx, cy, R_PHOUSE_OUT - 6, p.trueAngle);
          const glyph = p.name === 'North Node' ? '☊' : p.name === 'South Node' ? '☋' : (PLANET_GLYPHS[p.name] || '✦');
          const isSelected = selKey === `partner_planet_${p.name}`;
          const hasMoved = Math.abs(p.displayAngle - p.trueAngle) > 1.5;
          return (
            <g key={`partner_${p.name}`}
              onClick={() => handleSelect({ key: `partner_planet_${p.name}`, type: 'partner_planet', ...p })}
              style={{ cursor: 'pointer', opacity: isPartnerPlanetDimmed(p) ? DIM : 1, transition: 'opacity 0.3s ease' }}>
              <line x1={tickOuter.x} y1={tickOuter.y} x2={tickInner.x} y2={tickInner.y}
                stroke={PARTNER_COLOR} strokeWidth="1" strokeOpacity="0.7" />
              {hasMoved && (
                <line x1={pos.x} y1={pos.y} x2={tickInner.x} y2={tickInner.y}
                  stroke={PARTNER_COLOR} strokeWidth="0.4" strokeOpacity="0.3" strokeDasharray="2,2" />
              )}
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'serif', fontSize: isSelected ? 'calc(15px * var(--app-font-scale, 1))' : 'calc(10px * var(--app-font-scale, 1))', fill: isSelected ? '#ffffff' : PARTNER_COLOR, transition:'font-size 0.1s'}}>
                {glyph}
              </text>
              <text x={pos.x} y={pos.y + 8} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'sans-serif', fontSize:'7px', fill: isSelected ? PARTNER_COLOR : 'rgba(127,179,224,0.7)'}}>
                {p.degree?.toFixed(0)}°
              </text>
              {p.retrograde && (
                <text x={pos.x + 7} y={pos.y - 4} textAnchor="middle" dominantBaseline="central"
                  style={{fontFamily:'serif', fontSize:'calc(8px * var(--app-font-scale, 1))', fill: PARTNER_COLOR, fontStyle:'italic'}}>℞</text>
              )}
            </g>
          );
        })}

        {/* ASC / DC / MC / IC exterior labels — at true position; hit area sized to not overlap transit planet circles (R=204, r=14 → starts at 190; angle at 183, r=7 → ends at 190) */}
        {!skyMode && [
          { label: 'AC', name: 'Ascendant', data: angles?.ascendant, house: 1 },
          { label: 'DC', name: 'Descendant', data: angles?.descendant, house: 7 },
          { label: 'MC', name: 'Midheaven', data: angles?.midheaven, house: 10 },
          { label: 'IC', name: 'IC', data: angles?.ic, house: 4 },
        ].map(({ label, name, data, house }) => {
          if (!data) return null;
          const a = lonToAngle(data.longitude, ascLon);
          const pos = polarToXY(cx, cy, R_OUTER + 11, a);
          const isSelected = selKey === `planet_${name}`;
          return (
            <g key={label} style={{ cursor: 'pointer', opacity: isNatalPlanetDimmed({ name }) ? DIM : 1, transition: 'opacity 0.3s ease' }}
              onClick={() => handleSelect({ key: `planet_${name}`, type: 'planet', name, ...data, house })}>
              <circle cx={pos.x} cy={pos.y} r="7" fill="transparent" />
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{fontFamily:'serif', fontSize: isSelected ? 'calc(14px * var(--app-font-scale, 1))' : 'calc(12px * var(--app-font-scale, 1))', fill: isSelected ? '#ffffff' : '#C9A961', fontWeight:'bold', transition: 'font-size 0.1s'}}>
                {label}
              </text>
              {data.degree != null && (
                <text x={pos.x} y={pos.y + 10} textAnchor="middle" dominantBaseline="central"
                  style={{fontFamily:'sans-serif', fontSize:'8px', fill: isSelected ? '#C9A961' : 'rgba(196,168,130,0.7)'}}>
                  {Math.round(data.degree)}°
                </text>
              )}
            </g>
          );
        })}

        {/* ── Transit glyphs — float just outside zodiac band, no border ring ── */}
        {hasTransits && transitPlanets.map(tp => {
          const pos  = polarToXY(cx, cy, R_TR_PLANET, tp.displayAngle);
          const tickInner = polarToXY(cx, cy, R_OUTER, tp.trueAngle);
          const tickOuter = polarToXY(cx, cy, R_OUTER + 7, tp.trueAngle);
          const glyph = tp.name === 'North Node' ? '☊' : tp.name === 'South Node' ? '☋' : (PLANET_GLYPHS[tp.name] || '✦');
          const tpSelected = selKey === `transit_planet_${tp.name}` || selKey === `movement_${tp.name}`;
          const tColor = PLANET_COLORS[tp.name] || OC.primary;
          const isNodeGlyph = tp.name === 'North Node' || tp.name === 'South Node';
          return (
            <g key={`tr_${tp.name}`} style={{ cursor: 'pointer', opacity: isTransitPlanetDimmed(tp) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ key: `transit_planet_${tp.name}`, type: 'transit_planet', ...tp })}>
              {/* wide invisible hit area */}
              <circle cx={pos.x} cy={pos.y} r="14" fill="transparent" />
              {/* color-coded tick on the zodiac ring at the true degree (matches the planet's movement-arc color) */}
              <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y}
                stroke={tColor} strokeWidth={tpSelected ? 3 : 2.5} strokeOpacity={tpSelected ? 1 : 0.85} strokeLinecap="round" />
              {/* selection ring around transit planet */}
              {tpSelected && (
                <circle cx={pos.x} cy={pos.y} r="14" fill="none" stroke={tColor} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
              )}
              <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                style={{ fontFamily: isNodeGlyph ? SYMBOL_FONT : 'serif', fontSize: tpSelected ? 'calc(17px * var(--app-font-scale, 1))' : 'calc(11px * var(--app-font-scale, 1))', fill: tColor, fontVariantEmoji: 'text', transition: 'font-size 0.1s' }}>
                {glyph}
              </text>
              {/* Degree label */}
              <text x={pos.x} y={pos.y + 8} textAnchor="middle" dominantBaseline="central"
                style={{ fontFamily: 'sans-serif', fontSize: '7px', fill: tColor, fillOpacity: tpSelected ? 1 : 0.7 }}>
                {tp.degree?.toFixed(0)}°
              </text>
              {tp.retrograde && (
                <text x={pos.x + 7} y={pos.y - 4} textAnchor="middle" dominantBaseline="central"
                  style={{ fontFamily: 'serif', fontSize: 'calc(8px * var(--app-font-scale, 1))', fill: tColor, fontStyle: 'italic' }}>℞</text>
              )}
            </g>
          );
        })}

        {/* ── Period movement arcs: start → end direction per transiting planet ── */}
        {/* Rings are tucked between the zodiac band and the transit glyphs so every
            arc stays inside the wheel's bounds on small screens. The longest-moving
            arcs (e.g. the Moon) hug the wheel on the inner rings; slow movers sit
            further out. Every arc gets its own concentric lane, so no two arcs can
            ever overlap. Each arc originates from the planet glyph (displayAngle)
            with a solid connector. */}
        {hasTransits && transitEndData && (() => {
          const endMap = new Map((transitEndData.planets || []).map(p => [p.name, p.longitude]));
          // Arc lanes are concentric radii between the zodiac band and the wheel's
          // edge (viewBox half-width is 200, so 198 keeps everything on-screen).
          const R_ARC_MIN = R_OUTER + 7;
          const R_ARC_MAX = 198;
          const MIN_LANE_SPACING = 2.75;

          // Build arc specs with the set of wheel-angles each arc sweeps through
          const arcs = transitPlanets.map(tp => {
            if (!endMap.has(tp.name)) return null;
            const startLon = tp.longitude;
            const endLon = endMap.get(tp.name);
            let dLon = endLon - startLon;
            while (dLon > 180) dLon -= 360;
            while (dLon < -180) dLon += 360;
            if (Math.abs(dLon) < 0.5) return null;
            const retrograde = dLon < 0;
            const aEnd = lonToAngle(endLon, ascLon);
            const aStartDisp = tp.displayAngle;
            let dArc = aEnd - aStartDisp;
            while (dArc > 180) dArc -= 360;
            while (dArc < -180) dArc += 360;
            return { tp, startLon, endLon, retrograde, aStartDisp, aEnd, dArc };
          }).filter(Boolean);

          // Lane assignment — one concentric lane per arc so arcs can never overlap.
          // Longest sweeps hug the wheel (innermost lanes), short movers sit further
          // out. If there are more arcs than fit at a comfortable spacing, the
          // shortest movers are dropped first (their stubs are nearly invisible).
          const maxLanes = Math.max(1, Math.floor((R_ARC_MAX - R_ARC_MIN) / MIN_LANE_SPACING) + 1);
          const lanes = [...arcs]
            .sort((a, b) => Math.abs(b.dArc) - Math.abs(a.dArc))
            .slice(0, maxLanes);
          const laneSpacing = lanes.length > 1 ? (R_ARC_MAX - R_ARC_MIN) / (lanes.length - 1) : 0;
          const laneFor = {};
          lanes.forEach((a, i) => { laneFor[a.tp.name] = i; });

          return arcs.map(({ tp, startLon, endLon, retrograde, aStartDisp, aEnd, dArc }) => {
            const lane = laneFor[tp.name];
            if (lane == null) return null; // dropped — not enough lanes to stay legible
            const R_ARC = R_ARC_MIN + lane * laneSpacing;
            const sweep = dArc > 0 ? 1 : 0;
            const largeArc = Math.abs(dArc) > 180 ? 1 : 0;
            const p1 = polarToXY(cx, cy, R_ARC, aStartDisp);
            const p2 = polarToXY(cx, cy, R_ARC, aEnd);
            const glyphPos = polarToXY(cx, cy, R_TR_PLANET, aStartDisp);
            const col = PLANET_COLORS[tp.name] || OC.primary;
            const mvKey = `movement_${tp.name}`;
            const isSelected = selKey === mvKey;
            const dimmed = isMovementDimmed(tp);
            const backAngle = aEnd - (dArc > 0 ? 6 : -6);
            const backPos = polarToXY(cx, cy, R_ARC, backAngle);
            const tx = p2.x - backPos.x, ty = p2.y - backPos.y;
            const tlen = Math.hypot(tx, ty) || 1;
            const ux = tx / tlen, uy = ty / tlen;
            const px = -uy, py = ux;
            const headLen = 6, headW = 3.5;
            const base = { x: p2.x - ux * headLen, y: p2.y - uy * headLen };
            const left = { x: base.x + px * headW, y: base.y + py * headW };
            const right = { x: base.x - px * headW, y: base.y - py * headW };
            return (
              <g key={`mv_${tp.name}`} style={{ cursor: 'pointer', opacity: dimmed ? DIM : 1, transition: 'opacity 0.3s ease' }}
                onClick={() => handleSelect({ key: mvKey, type: 'movement', planet: tp.name, startLon, endLon, retrograde })}>
                {/* solid connector from planet glyph to arc start */}
                <line x1={glyphPos.x} y1={glyphPos.y} x2={p1.x} y2={p1.y}
                  stroke={col} strokeWidth={isSelected ? 1.8 : 1.1} strokeOpacity={isSelected ? 0.85 : 0.5} />
                <path d={`M${p1.x},${p1.y} A${R_ARC},${R_ARC} 0 ${largeArc},${sweep} ${p2.x},${p2.y}`}
                  fill="none" stroke="transparent" strokeWidth={16} />
                <path
                  d={`M${p1.x},${p1.y} A${R_ARC},${R_ARC} 0 ${largeArc},${sweep} ${p2.x},${p2.y}`}
                  fill="none" stroke={col}
                  strokeWidth={isSelected ? 2.6 : 1.6}
                  strokeOpacity={isSelected ? 0.95 : 0.6}
                  strokeDasharray={retrograde ? '5,3' : 'none'}
                  strokeLinecap="round"
                />
                <circle cx={p1.x} cy={p1.y} r={isSelected ? 2.4 : 1.7} fill={col} fillOpacity={isSelected ? 0.95 : 0.75} />
                <polygon points={`${p2.x},${p2.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={col} fillOpacity={isSelected ? 1 : 0.85} />
              </g>
            );
          });
        })()}

        {/* Synastry cross-aspects — shown only in pure synastry (hidden once
            transits are revealed), tightened to the tighter major aspects so
            the wheel stays readable. */}
        {hasPartner && !hasTransits && (partnerData.aspects || [])
          .filter(pa => ['conjunction','opposition','trine','square','sextile'].includes(pa.aspect) && (pa.orb ?? 0) <= 2)
          .map((pa, i) => {
            const ppData = placedPartnerPlanets.find(p => p.name === pa.transit_planet);
            const npData = placedPlanets.find(p => p.name === pa.natal_planet);
            if (!ppData || !npData) return null;
            const pPos = polarToXY(cx, cy, R_ASPECT, ppData.displayAngle);
            const nAng = npData.displayAngle ?? npData.trueAngle;
            const nPos = polarToXY(cx, cy, R_ASPECT, nAng);
            const col = ASPECT_COLORS[pa.aspect] || '#8B7355';
            const paspKey = `pasp_${pa.transit_planet}_${pa.aspect}_${pa.natal_planet}`;
            const isSelected = selKey === paspKey;
            return (
              <g key={`pasp_${i}`} style={{ cursor: 'pointer', opacity: isPartnerAspectDimmed(pa) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ ...pa, key: paspKey, type: 'partner_aspect' })}>
                <line x1={pPos.x} y1={pPos.y} x2={nPos.x} y2={nPos.y} stroke="transparent" strokeWidth="18" pointerEvents="all" />
                {isSelected && (
                  <line x1={pPos.x} y1={pPos.y} x2={nPos.x} y2={nPos.y} stroke={col} strokeWidth="7" strokeOpacity="0.22" strokeLinecap="round" />
                )}
                <line x1={pPos.x} y1={pPos.y} x2={nPos.x} y2={nPos.y} stroke={col} strokeWidth={isSelected ? '2.4' : '1.1'} strokeOpacity={isSelected ? 0.9 : 0.4} strokeDasharray="3,3" pointerEvents="all" />
                {isSelected && (
                  <>
                    <circle cx={pPos.x} cy={pPos.y} r="10" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                    <circle cx={nPos.x} cy={nPos.y} r="10" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                  </>
                )}
              </g>
            );
          })}

        {/* Natal aspect lines — hidden in synastry (replaced by synastry cross-aspects below) */}
        {!hasPartner && strongAspects.map((asp, i) => {
          const p1Data = placedPlanets.find(p => p.name === asp.planet1);
          const p2Data = placedPlanets.find(p => p.name === asp.planet2);
          if (!p1Data || !p2Data) return null;
          const a1 = p1Data.displayAngle;
          const a2 = p2Data.displayAngle;
          const pt1 = polarToXY(cx, cy, R_ASPECT, a1);
          const pt2 = polarToXY(cx, cy, R_ASPECT, a2);
          const col = ASPECT_COLORS[asp.aspect] || '#8B7355';
          const aspKey = `aspect_${asp.planet1}_${asp.aspect}_${asp.planet2}`;
          const isSelected = selKey === aspKey;
          return (
            <g key={`asp_${i}`} style={{ cursor: 'pointer', opacity: isNatalAspectDimmed(asp) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ key: aspKey, type: 'aspect', ...asp })}>
              {/* wide invisible hit area */}
              <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                stroke="transparent" strokeWidth="20" />
              {/* glow halo behind selected aspect */}
              {isSelected && (
                <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                  stroke={col} strokeWidth="7" strokeOpacity="0.22" strokeLinecap="round" />
              )}
              <line x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                stroke={col}
                strokeWidth={isSelected ? '3' : '1'}
                strokeOpacity={isSelected ? 1 : 0.6}
                strokeDasharray={asp.aspect === 'sextile' || asp.aspect === 'trine' || asp.aspect === 'opposition' ? 'none' : '4,4'}
              />
              {/* dashed rings around endpoint planets when selected */}
              {isSelected && (() => {
                const r1Pos = polarToXY(cx, cy, R_PLANET, p1Data.displayAngle);
                const r2Pos = polarToXY(cx, cy, R_PLANET, p2Data.displayAngle);
                return (
                  <>
                    <circle cx={r1Pos.x} cy={r1Pos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                    <circle cx={r2Pos.x} cy={r2Pos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                  </>
                );
              })()}
            </g>
          );
        })}
        {/* Transit-to-natal aspect lines — only shown when a transit planet is selected */}
        {hasTransits && selectedTransitPlanet && (transitData.transit_aspects || [])
          .filter(ta => ta.transit_planet === selectedTransitPlanet && ['conjunction','opposition','trine','square','sextile'].includes(ta.aspect))
          .map((ta, i) => {
            const tpData = transitPlanets.find(p => p.name === ta.transit_planet);
            const npData = placedPlanets.find(p => p.name === ta.natal_planet);
            if (!tpData || !npData) return null;
            const tPos = polarToXY(cx, cy, R_OUTER + 24, tpData.trueAngle);
            const nIsAngle = ANGLE_NAMES.has(ta.natal_planet);
            const nPos = nIsAngle
              ? polarToXY(cx, cy, R_OUTER + 11, npData.trueAngle)
              : polarToXY(cx, cy, R_PLANET, npData.displayAngle);
            const col = ASPECT_COLORS[ta.aspect] || '#8B7355';
            const taspKey = `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}`;
            const isSelected = selKey === taspKey;
            return (
              <g key={`tasp_${i}`} style={{ cursor: 'pointer', opacity: isTransitAspectDimmed(ta) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ ...ta, key: taspKey, type: 'transit_aspect' })}>
                {/* wide invisible hit area */}
                <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y} stroke="transparent" strokeWidth="20" pointerEvents="all" />
                {/* glow halo behind selected transit aspect */}
                {isSelected && (
                  <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y} stroke={col} strokeWidth="7" strokeOpacity="0.22" strokeLinecap="round" />
                )}
                <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y}
                  stroke={col}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeOpacity={isSelected ? 0.9 : 0.5}
                  strokeDasharray="3,3"
                  pointerEvents="all"
                />
                {/* dashed rings around endpoint planets when selected */}
                {isSelected && (
                  <>
                    <circle cx={tPos.x} cy={tPos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                    <circle cx={nPos.x} cy={nPos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                  </>
                )}
              </g>
            );
          })}
        {/* Transit-to-natal aspect lines — shown when a natal point (planet/angle) is selected */}
        {hasTransits && selectedNatalPlanet && (transitData.transit_aspects || [])
          .filter(ta => ta.natal_planet === selectedNatalPlanet && ['conjunction','opposition','trine','square','sextile'].includes(ta.aspect))
          .map((ta, i) => {
            const tpData = transitPlanets.find(p => p.name === ta.transit_planet);
            const npData = placedPlanets.find(p => p.name === ta.natal_planet);
            if (!tpData || !npData) return null;
            const tPos = polarToXY(cx, cy, R_OUTER + 24, tpData.trueAngle);
            const nIsAngle = ANGLE_NAMES.has(ta.natal_planet);
            const nPos = nIsAngle
              ? polarToXY(cx, cy, R_OUTER + 11, npData.trueAngle)
              : polarToXY(cx, cy, R_PLANET, npData.displayAngle);
            const col = ASPECT_COLORS[ta.aspect] || '#8B7355';
            const taspKey = `tasp_${ta.transit_planet}_${ta.aspect}_${ta.natal_planet}`;
            const isSelected = selKey === taspKey;
            return (
              <g key={`ntasp_${i}`} style={{ cursor: 'pointer', opacity: isTransitAspectDimmed(ta) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ ...ta, key: taspKey, type: 'transit_aspect' })}>
                <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y} stroke="transparent" strokeWidth="20" pointerEvents="all" />
                {isSelected && (
                  <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y} stroke={col} strokeWidth="7" strokeOpacity="0.22" strokeLinecap="round" />
                )}
                <line x1={tPos.x} y1={tPos.y} x2={nPos.x} y2={nPos.y}
                  stroke={col}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  strokeOpacity={isSelected ? 0.9 : 0.5}
                  strokeDasharray="3,3"
                  pointerEvents="all"
                />
                {isSelected && (
                  <>
                    <circle cx={tPos.x} cy={tPos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                    <circle cx={nPos.x} cy={nPos.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                  </>
                )}
              </g>
            );
          })}
        {/* Transit-to-partner aspects — synastry + now: how today's transits
            land on the partner. Shown when a transit or partner planet (or one
            of these lines) is selected, alongside the transit-to-natal lines. */}
        {hasPartner && hasTransits && (() => {
          const tpaspTransit = selectedTransitPlanet || (selKey?.startsWith('tpasp_') ? selKey.split('_')[1] : null);
          const tpaspPartner = selectedPartnerPlanet || (selKey?.startsWith('tpasp_') ? selKey.split('_')[3] : null);
          if (!tpaspTransit && !tpaspPartner) return null;
          return partnerTransitAspects
            .filter(ta => ['conjunction','opposition','trine','square','sextile'].includes(ta.aspect) && (tpaspTransit ? ta.transit_planet === tpaspTransit : ta.partner_planet === tpaspPartner))
            .map((ta, i) => {
              const tpData = transitPlanets.find(p => p.name === ta.transit_planet);
              const ppData = placedPartnerPlanets.find(p => p.name === ta.partner_planet);
              if (!tpData || !ppData) return null;
              const tPos = polarToXY(cx, cy, R_OUTER + 24, tpData.trueAngle);
              const pPos = polarToXY(cx, cy, R_PPLANET, ppData.displayAngle);
              const col = ASPECT_COLORS[ta.aspect] || '#8B7355';
              const tpaspKey = `tpasp_${ta.transit_planet}_${ta.aspect}_${ta.partner_planet}`;
              const isSelected = selKey === tpaspKey;
              return (
                <g key={`tpasp_${i}`} style={{ cursor: 'pointer', opacity: isTransitPartnerAspectDimmed(ta) ? DIM : 1, transition: 'opacity 0.3s ease' }} onClick={() => handleSelect({ ...ta, key: tpaspKey, type: 'transit_partner_aspect' })}>
                  <line x1={tPos.x} y1={tPos.y} x2={pPos.x} y2={pPos.y} stroke="transparent" strokeWidth="18" pointerEvents="all" />
                  {isSelected && (
                    <line x1={tPos.x} y1={tPos.y} x2={pPos.x} y2={pPos.y} stroke={col} strokeWidth="7" strokeOpacity="0.22" strokeLinecap="round" />
                  )}
                  <line x1={tPos.x} y1={tPos.y} x2={pPos.x} y2={pPos.y} stroke={col} strokeWidth={isSelected ? '2.4' : '1.4'} strokeOpacity={isSelected ? 0.9 : 0.5} strokeDasharray="3,3" pointerEvents="all" />
                  {isSelected && (
                    <>
                      <circle cx={tPos.x} cy={tPos.y} r="10" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                      <circle cx={pPos.x} cy={pPos.y} r="10" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
                    </>
                  )}
                </g>
              );
            });
        })()}
        {/* Mundane (transit-to-transit) aspect line — drawn when a mundane aspect is selected */}
        {hasTransits && selKey?.startsWith('mundane_') && (() => {
          const parts = selKey.split('_');
          const p1Name = parts[1];
          const aspName = parts[2];
          const p2Name = parts[3];
          const tp1 = transitPlanets.find(p => p.name === p1Name);
          const tp2 = transitPlanets.find(p => p.name === p2Name);
          if (!tp1 || !tp2) return null;
          const pos1 = polarToXY(cx, cy, R_TR_PLANET, tp1.displayAngle);
          const pos2 = polarToXY(cx, cy, R_TR_PLANET, tp2.displayAngle);
          const col = ASPECT_COLORS[aspName] || '#8B7355';
          return (
            <g>
              <line x1={pos1.x} y1={pos1.y} x2={pos2.x} y2={pos2.y}
                stroke={col} strokeWidth="2.5" strokeOpacity="0.7" strokeDasharray="4,3" />
              <circle cx={pos1.x} cy={pos1.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
              <circle cx={pos2.x} cy={pos2.y} r="14" fill="none" stroke={col} strokeWidth="2" strokeOpacity="0.6" strokeDasharray="4,3" />
            </g>
          );
        })()}
        {/* Highlighted mundane pattern overlay — works in sky mode (natal positions) and overlay mode (transit positions) */}
        {highlightPattern && (() => {
          const sourcePlanets = skyMode ? placedPlanets : (hasTransits ? transitPlanets : placedPlanets);
          if (sourcePlanets.length === 0) return null;
          const tpMap = new Map(sourcePlanets.map(tp => [tp.name, tp]));
          const pts = highlightPattern.planets.map(name => tpMap.get(name)).filter(Boolean);
          if (pts.length < 2) return null;
          const color = highlightPattern.color || HIGHLIGHT_COLORS[highlightPattern.category] || '#C9A961';
          const ringRadius = hasTransits ? R_TR_PLANET : R_PLANET;
          // Tight conjunction — draw a ring around the cluster instead of a line
          if (pts.length === 2) {
            let diff = Math.abs(pts[0].displayAngle - pts[1].displayAngle);
            if (diff > 180) diff = 360 - diff;
            if (diff < 5) {
              const midA = (pts[0].displayAngle + pts[1].displayAngle) / 2;
              const ringPos = polarToXY(cx, cy, ringRadius, midA);
              return <circle cx={ringPos.x} cy={ringPos.y} r="14" fill="none" stroke={color} strokeWidth="2.5" strokeOpacity="0.7" strokeDasharray="4,3" />;
            }
          }
          const lines = [];
          for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
              const pt1 = polarToXY(cx, cy, R_ASPECT, pts[i].displayAngle);
              const pt2 = polarToXY(cx, cy, R_ASPECT, pts[j].displayAngle);
              lines.push(
                <line key={`hl_${i}_${j}`} x1={pt1.x} y1={pt1.y} x2={pt2.x} y2={pt2.y}
                  stroke={color} strokeWidth="2.5" strokeOpacity="0.7" strokeDasharray="6,4" />
              );
            }
          }
          return lines;
        })()}
      </svg>

      {/* Selection info pill */}
      {selected?.type === 'movement'
        ? <MovementReading item={selected} chart={chartData} periodLabel={periodLabel} onClose={() => setSelected(null)} />
        : selected && <ChartSelectionInfo item={selected} natalPlanets={placedPlanets} partnerPlanets={placedPartnerPlanets} transitPlanets={transitPlanets} natalHouses={chartData?.houses} transitHouses={partnerHouses} chartData={chartData} skyMode={skyMode} transitData={transitData} partnerData={partnerData} mundaneAspects={mundaneAspects} onSelectItem={handleSelect} aspectSymbols={ASPECT_SYMBOLS} planetColors={PLANET_COLORS} aspectColors={ASPECT_COLORS} signColors={SIGN_COLORS} partnerColor={PARTNER_COLOR} onClose={() => setSelected(null)} onInterpret={(item) => { if (onSelect) onSelect(item); }} overlayName={overlayName} relationship={relationship} deceased={deceased} dateOfDeath={dateOfDeath} partnerPronouns={partnerPronouns} />}
      {paywallOpen && <PaywallModal variant="calendar" fromTier={tier} context="asteroids" onClose={() => setPaywallOpen(false)} />}
    </div>
  );
}