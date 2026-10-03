/**
 * Astrology-API.io position engine for chart-calculator.
 *
 * The ported Base44 calculator is a hand-rolled ephemeris with known accuracy
 * issues. This module replaces ONLY its position layer: planetary longitudes,
 * retrograde flags, angles, and house cusps come from Astrology-API.io's
 * Swiss-Ephemeris-backed /charts/natal endpoint, and everything downstream
 * (lots arithmetic, aspects, strengths, stations, ingresses, distributions)
 * keeps using the existing in-function math — so the response shape the app
 * depends on is unchanged.
 *
 * Selection: CHART_ENGINE secret = 'astrology-api' (plus ASTROLOGY_API_KEY),
 * or a per-request `engine` override (test/ops hook). Any remote failure
 * falls back to the builtin engine — chart calculation must never hard-fail
 * on a vendor outage.
 *
 * Credits: 1/call, amortized by a permanent ephemeris_cache row per moment —
 * sky positions for a date are fetched once EVER across all users (the
 * fetch uses a fixed location when cusps aren't needed).
 */
import { serviceClient } from './edge.ts';

const BASE = 'https://api.astrology-api.io/api/v3';

// Their point vocabulary → the calculator's names. Models match the builtin
// engine: MEAN Black Moon Lilith, TRUE lunar node.
const POINT_MAP: Record<string, string> = {
  Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars',
  Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune',
  Pluto: 'Pluto', Chiron: 'Chiron',
  Mean_Lilith: 'Black Moon Lilith',
  True_Node: 'North Node',
  Pallas: 'Pallas', Juno: 'Juno', Vesta: 'Vesta',
};
const ACTIVE_POINTS = [...Object.keys(POINT_MAP), 'Ascendant', 'Medium_Coeli'];
// Tyche (MPC 258) is NOT served by their deployment — it stays on the builtin
// engine (recent JPL osculating elements), via buildChart's per-point fallback.

const HOUSE_SYSTEM_CODE: Record<string, string> = {
  whole_sign: 'W',
  placidus: 'P',
};

export interface RemoteMoment {
  /** name (calculator vocabulary) → ecliptic longitude + retrograde flag */
  positions: Record<string, { longitude: number; retrograde: boolean }>;
  asc: number | null;
  mc: number | null;
  /** 12 house-cusp longitudes (null for sky-only fetches) */
  cusps: number[] | null;
}

export function remoteEngineConfigured(): boolean {
  return !!Deno.env.get('ASTROLOGY_API_KEY');
}

export function remoteEngineEnabled(requestOverride?: unknown): boolean {
  if (!remoteEngineConfigured()) return false;
  if (requestOverride === 'astrology-api') return true;
  if (requestOverride === 'builtin') return false;
  return (Deno.env.get('CHART_ENGINE') || 'builtin') === 'astrology-api';
}

/** Civil UTC components for a local date/time + fixed utc offset (hours). */
export function toUtcParts(dateStr: string, timeStr: string | undefined, tzHours: number) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h = 12, mi = 0, s = 0] = (timeStr || '12:00:00').split(':').map((n) => parseInt(n) || 0);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s) - tzHours * 3600 * 1000;
  const dt = new Date(ms);
  return {
    year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(),
    hour: dt.getUTCHours(), minute: dt.getUTCMinutes(), second: dt.getUTCSeconds(),
  };
}

interface FetchOpts {
  utc: ReturnType<typeof toUtcParts>;
  latitude: number;
  longitude: number;
  houseSystem: string; // calculator vocabulary ('whole_sign' | 'placidus')
  /** true when only planet longitudes matter (transit sky) — fetched at a
   *  fixed location so the cache row is shared by every user/date pair. */
  skyOnly?: boolean;
}

function cacheKey(o: FetchOpts): string {
  const t = o.utc;
  const stamp = `${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}:${t.second}`;
  return o.skyOnly
    ? `v1:sky:${stamp}`
    : `v1:natal:${stamp}:${o.latitude.toFixed(4)},${o.longitude.toFixed(4)}:${o.houseSystem}`;
}

function mapResponse(data: unknown, skyOnly: boolean): RemoteMoment | null {
  // deno-lint-ignore no-explicit-any
  const cd = (data as any)?.chart_data;
  const pp = cd?.planetary_positions;
  if (!Array.isArray(pp) || pp.length === 0) return null;
  const positions: RemoteMoment['positions'] = {};
  let asc: number | null = null;
  let mc: number | null = null;
  for (const p of pp) {
    const lon = typeof p.absolute_longitude === 'number' ? p.absolute_longitude : null;
    if (lon == null) continue;
    if (p.name === 'Ascendant') { asc = lon; continue; }
    if (p.name === 'Medium_Coeli') { mc = lon; continue; }
    const ours = POINT_MAP[p.name];
    if (ours) positions[ours] = { longitude: lon, retrograde: !!p.is_retrograde };
  }
  // Every point the downstream pipeline consumes must be present — a partial
  // moment would silently mix engines, so treat it as a miss (builtin fallback).
  for (const ours of Object.values(POINT_MAP)) {
    if (!positions[ours]) return null;
  }
  let cusps: number[] | null = null;
  if (!skyOnly) {
    const hc = cd?.house_cusps;
    if (Array.isArray(hc) && hc.length === 12 && hc.every((c: { absolute_longitude?: number }) => typeof c.absolute_longitude === 'number')) {
      cusps = hc.map((c: { absolute_longitude: number }) => c.absolute_longitude);
    }
    if (!cusps || asc == null || mc == null) return null;
  }
  return { positions, asc, mc, cusps };
}

/**
 * Fetch positions for one moment, via the permanent cache. Returns null on
 * ANY failure (missing key, HTTP error, unexpected shape) so callers fall
 * back to the builtin engine.
 */
export async function fetchRemoteMoment(o: FetchOpts): Promise<RemoteMoment | null> {
  const apiKey = Deno.env.get('ASTROLOGY_API_KEY');
  if (!apiKey) return null;
  const key = cacheKey(o);
  let db = null;
  try { db = serviceClient(); } catch { /* no service key (shouldn't happen in functions) */ }

  if (db) {
    try {
      const { data } = await db.from('ephemeris_cache').select('payload').eq('key', key).maybeSingle();
      if (data?.payload) return data.payload as RemoteMoment;
    } catch { /* cache table missing or unreachable — proceed uncached */ }
  }

  try {
    const res = await fetch(`${BASE}/charts/natal`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: {
          name: 'astrosetta',
          birth_data: {
            ...o.utc,
            timezone: 'UTC',
            latitude: o.skyOnly ? 0 : o.latitude,
            longitude: o.skyOnly ? 0 : o.longitude,
          },
        },
        options: {
          house_system: HOUSE_SYSTEM_CODE[o.houseSystem] ?? 'W',
          zodiac_type: 'Tropic',
          active_points: ACTIVE_POINTS,
          precision: 4,
        },
      }),
    });
    if (!res.ok) {
      console.warn(`astrology-api engine: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const moment = mapResponse(await res.json(), !!o.skyOnly);
    if (!moment) {
      console.warn('astrology-api engine: response missing required points — builtin fallback');
      return null;
    }
    if (db) {
      try { await db.from('ephemeris_cache').insert({ key, payload: moment }); } catch { /* duplicate or offline — fine */ }
    }
    return moment;
  } catch (err) {
    console.warn('astrology-api engine fetch failed:', (err as Error)?.message);
    return null;
  }
}
