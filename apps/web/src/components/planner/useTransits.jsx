import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { getMoonPhaseName } from '@/lib/moonPhase';
import { detectEclipse } from '@/lib/eclipseUtils';
import { mergeNatalPoints } from '@/lib/transitUtils';
import { useAuth } from '@/lib/AuthContext';
import {
  getHiddenChartPoints,
  filterHiddenPlanets,
  filterHiddenAspects,
} from '@/lib/chartPointVisibility';

// Cache to avoid re-fetching the same date (keyed by dateKey + chartId)
// v21 — fix: use birth location's UTC offset, not browser timezone
const CACHE_VERSION = 'v23';
const cache = {};

// Persist the transit cache to sessionStorage so navigating away and back
// (or a hard refresh within the same day) skips the chartCalculator network
// call entirely. Entries expire when the stored date key no longer matches today.
function sessionGet(key, todayDateKey) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.dateKey !== todayDateKey) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}
function sessionSet(key, todayDateKey, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ dateKey: todayDateKey, data }));
  } catch { /* quota — non-critical */ }
}

export function useTransits(date, chart) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // Honor the user's Chart Display toggles so hidden asteroids/lots/nodes/
  // lilith drop out of the transit lists and wheel overlay everywhere the
  // planner consumes this hook's data.
  const { user } = useAuth();
  const hidden = getHiddenChartPoints(user);
  // Use local date string to avoid UTC offset shifting the date (e.g. CDT = UTC-5)
  const dateKey = date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA')
    : null;

  // Use the BIRTH LOCATION's stored UTC offset — NOT the browser's current timezone.
  // The browser timezone reflects where the user is NOW, which may differ from the
  // birth location. A 1-hour mismatch shifts natal angles (ASC/MC/DC/IC) by ~15°,
  // breaking all angle-based transit aspects.
  const utcOffset = chart?.raw_data?.utc_offset ?? (date ? -date.getTimezoneOffset() / 60 : 0);

  useEffect(() => {
    if (!dateKey || !chart?.raw_data) return;
    // The Moon moves ~0.55°/h, so for today's view we recompute it at the
    // current instant (passed to the backend via moon_instant) instead of
    // relying on the noon snapshot. Refresh hourly so the Moon stays within
    // ~0.5° of actual, and skip the session cache for today so a reload always
    // re-fetches the live Moon. Past/future dates keep the stable noon snapshot.
    const now = new Date();
    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('en-CA');
    const isToday = dateKey === todayKey;
    const hourKey = isToday ? `_h${now.getHours()}` : '';
    const cacheKey = `${CACHE_VERSION}_${dateKey}_${chart.id}_${utcOffset}${hourKey}`;
    const sessionKey = `transit_${cacheKey}`;
    if (cache[cacheKey]) { setData(cache[cacheKey]); return; }
    if (!isToday) {
      const sessionCached = sessionGet(sessionKey, dateKey);
      if (sessionCached) { cache[cacheKey] = sessionCached; setData(sessionCached); return; }
    }

    const raw = chart.raw_data;
    if (!raw.birth_date || raw.birth_location?.latitude == null) return;

    setLoading(true);
    const payload = {
      chart_type: 'transit',
      birth_date: raw.birth_date,
      birth_time: raw.birth_time,
      birth_location: raw.birth_location,
      transit_date: dateKey,
      transit_time: '12:00:00',
      utc_offset: utcOffset,
      natal_planets_override: raw.planets || [],
      house_system: raw.house_system || 'whole_sign',
    };
    if (isToday) payload.moon_instant = new Date().toISOString();
    base44.functions.invoke('chartCalculator', payload).then(res => {
      const processed = processTransits(res.data, raw, hidden);
      cache[cacheKey] = processed;
      if (!isToday) sessionSet(sessionKey, dateKey, processed);
      setData(processed);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [dateKey, chart?.id]);

  return { data, loading };
}

export function processTransits(result, natalRaw, hiddenPoints) {
  if (!result) return null;
  // Drop points the user has hidden via Chart Display preferences. Applied at
  // the source so every downstream list, label, and synthesis prompt built
  // from this transit data stays consistent with the natal wheel.
  const hidden = hiddenPoints?.size ? hiddenPoints : new Set();
  const transitPlanets = filterHiddenPlanets(result.transit_planets || [], hidden);
  const transitAspects = filterHiddenAspects(result.transit_aspects || [], hidden);
  // Use freshly calculated natal planets from the backend response — these have
  // correct house assignments for the current house system. The stored chart
  // (natalRaw) may have stale houses from a different house system.
  const natalPlanets = filterHiddenPlanets(mergeNatalPoints(result.natal || natalRaw), hidden);

  // Exact-transit orbs — only aspects perfecting within ~1 day
  const SLOW_PLANETS = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Black Moon Lilith']);
  // Mars moves ~0.5°/day, Sun ~1°/day, Mercury/Venus up to 1.2°/day
  // Use per-planet orbs so each gets a meaningful window
  const PLANET_ORBS = {
    Sun: 2.0, Moon: 99, // Moon handled separately
    Mercury: 2.0, Venus: 2.0, Mars: 2.0,
  };
  const SLOW_ORB = 2.0;   // outer planets — slightly wider to catch active transits
  const FAST_ORB = 2.0;   // fallback for any unlisted planet

  // Angles (ASC/DC/MC/IC) are sensitive — give them a wider orb
  const ANGLE_NAMES = new Set(['Ascendant', 'Descendant', 'Midheaven', 'IC']);
  const ANGLE_ORB_BOOST = 1.0;
  // Natal transits: transiting planet aspecting natal planet
  // Deduplicate: for the same (transit_planet, natal_planet) pair, keep only tightest orb
  const classifiedRaw = transitAspects
    .filter(a => {
      if (a.transit_planet === 'Moon') return false; // handled separately as lunar
      const isSlow = SLOW_PLANETS.has(a.transit_planet);
      let maxOrb = isSlow ? SLOW_ORB : (PLANET_ORBS[a.transit_planet] ?? FAST_ORB);
      if (ANGLE_NAMES.has(a.natal_planet)) maxOrb += ANGLE_ORB_BOOST;
      return (a.orb ?? 99) <= maxOrb;
    });
  const natalMap = new Map();
  for (const a of classifiedRaw) {
    const key = `${a.transit_planet}|${a.natal_planet}`;
    if (!natalMap.has(key) || a.orb < natalMap.get(key).orb) natalMap.set(key, a);
  }
  const classified = Array.from(natalMap.values()).map(a => ({ ...a, type: 'natal', exact: a.orb < 0.5 }));

  // Lunar: Moon to natal — Moon moves ~12°/day; conjunction uses 8° orb 
  // so sign-passage conjunctions show all day (backend handles wider orb)
  const LUNAR_ORB = 8.0;
  const lunarClassified = transitAspects
    .filter(a => a.transit_planet === 'Moon' && (a.orb ?? 99) <= LUNAR_ORB)
    .map(a => ({ ...a, type: 'lunar', exact: a.orb < 0.5 }));

  // Mundane: transiting planet-to-planet aspects (sky weather for everyone)
  // Use slightly wider orbs so slow outer-planet aspects don't vanish on exact day
  const MUNDANE_ORBS = { conjunction: 2.0, opposition: 2.0, trine: 2.0, square: 2.0, sextile: 1.5 };
  const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
  const mundaneAspects = [];
  for (let i = 0; i < transitPlanets.length; i++) {
    for (let j = i + 1; j < transitPlanets.length; j++) {
      const p1 = transitPlanets[i], p2 = transitPlanets[j];
      if (p1.name === 'Moon' || p2.name === 'Moon') continue; // Moon mundane handled in lunar
      let diff = Math.abs(p1.longitude - p2.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const [asp, targetOrb] of Object.entries(MUNDANE_ORBS)) {
        const orb = Math.abs(diff - ASPECT_ANGLES[asp]);
        if (orb <= targetOrb) {
          mundaneAspects.push({
            transit_planet: p1.name,
            natal_planet: p2.name,
            aspect: asp,
            orb: Math.round(orb * 100) / 100,
            type: 'mundane',
            isMundanePair: true,
          });
          break;
        }
      }
    }
  }

  const allAspects = [...classified, ...lunarClassified, ...mundaneAspects];

  // Moon sign & phase
  const moonPlanet = transitPlanets.find(p => p.name === 'Moon');
  const sunPlanet = transitPlanets.find(p => p.name === 'Sun');
  let moonPhase = null;
  if (moonPlanet && sunPlanet) {
    moonPhase = getMoonPhaseName(moonPlanet.longitude, sunPlanet.longitude);
  }

  // isExactNewMoon / isExactFullMoon — only true on the actual day of exactness
  // Moon moves ~12°/day; within 6° = within ~12 hours of exact = same calendar day
  const EXACT_PHASE_ORB = 6;
  let isExactNewMoon = false;
  let isExactFullMoon = false;
  if (moonPlanet && sunPlanet) {
    let diff = ((moonPlanet.longitude - sunPlanet.longitude) + 360) % 360;
    isExactNewMoon = diff <= EXACT_PHASE_ORB || diff >= (360 - EXACT_PHASE_ORB);
    isExactFullMoon = Math.abs(diff - 180) <= EXACT_PHASE_ORB;
  }

  // Eclipse detection — lunation aligns with the lunar nodes
  // Pass the UNFILTERED transit planets so eclipse detection still works even
  // when the user has hidden the lunar nodes from their chart — eclipses are
  // universal sky events, not a chart-point preference.
  const eclipse = detectEclipse({ sunPlanet, moonPlanet, transitPlanets: result.transit_planets || [], isExactNewMoon, isExactFullMoon });
  // An eclipse can perfect hours from the noon snapshot (often overnight), so
  // the exact-lunation flag may be false on the eclipse's own day. Force the
  // matching exact flag true so the lunation highlight + banner surface.
  if (eclipse?.type === 'solar') isExactNewMoon = true;
  if (eclipse?.type === 'lunar') isExactFullMoon = true;

  // Moon's natal house — which natal house does the transiting Moon fall in today?
  const natalHouses = natalRaw?.houses || [];
  let moonHouse = null;
  if (moonPlanet && natalHouses.length) {
    const norm = v => ((v % 360) + 360) % 360;
    const moonLon = norm(moonPlanet.longitude);
    for (let i = 0; i < natalHouses.length; i++) {
      const a = norm(natalHouses[i].longitude);
      const b = norm(natalHouses[(i + 1) % natalHouses.length].longitude);
      const inside = a <= b ? (moonLon >= a && moonLon < b) : (moonLon >= a || moonLon < b);
      if (inside) { moonHouse = natalHouses[i].number; break; }
    }
  }

  return {
    transitPlanets,
    natalPlanets,
    natalAspects: allAspects.filter(a => a.type === 'natal'),
    mundaneAspects: allAspects.filter(a => a.type === 'mundane'),
    lunarAspects: allAspects.filter(a => a.type === 'lunar'),
    moonSign: moonPlanet?.sign,
    moonPhase,
    moonDegree: moonPlanet?.degree,
    moonHouse,
    isExactNewMoon,
    isExactFullMoon,
    isEclipse: !!eclipse,
    eclipseType: eclipse?.type || null,
    eclipseMoonSign: eclipse?.moonSign || null,
    eclipseDegree: eclipse?.degree ?? null,
    eclipse,
    stations: (result.stations || []).filter((s) => !hidden.has(s.planet)),
    ingresses: (result.ingresses || []).filter((ing) => !hidden.has(ing.planet)),
    allAspects,
  };
}