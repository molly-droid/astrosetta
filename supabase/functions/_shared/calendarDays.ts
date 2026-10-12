/**
 * calendarDays — engine-backed daily transit data for the calendar surfaces
 * (Google Calendar sync + the ICS feed).
 *
 * Replaces the per-function "simplified VSOP-like" ephemerides those two
 * surfaces shipped with from Base44 (accurate to maybe a degree for inner
 * planets, a whole sign off for Pluto — Molly's B-14). Every date now comes
 * from the SAME chart-calculator pipeline as the rest of the app: Swiss
 * Ephemeris positions via the astrology API (ephemeris_cache makes repeat
 * dates cheap and shared across users), identical aspects/stations/ingresses.
 */

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  transit_planets: Array<{ name: string; sign: string; degree: number; longitude: number; retrograde?: boolean }>;
  transit_aspects: Array<{ transit_planet: string; natal_planet: string; aspect: string; orb: number }>;
  stations: Array<{ planet: string; type: string; sign: string; degree: number }>;
  ingresses: Array<{ planet: string; from_sign: string; to_sign: string; degree: number; exact?: boolean; recent?: boolean; approaching?: boolean; entered_date?: string; expected_date?: string }>;
}

interface NatalParams {
  birth_date: string;
  birth_time?: string;
  birth_location: { name?: string; latitude: number; longitude: number };
  utc_offset?: number;
  house_system?: string;
  tradition?: string;
  unknown_time?: boolean;
}

/** Natal request params out of a chart row's raw_data (import-shape tolerant). */
export function natalParamsFromRaw(raw: Record<string, unknown>): NatalParams | null {
  const loc = raw.birth_location as { latitude?: number; longitude?: number; name?: string } | undefined;
  if (!raw.birth_date || loc?.latitude == null || loc?.longitude == null) return null;
  return {
    birth_date: raw.birth_date as string,
    birth_time: (raw.birth_time as string) || '12:00',
    birth_location: { name: loc.name, latitude: loc.latitude, longitude: loc.longitude },
    utc_offset: (raw.utc_offset as number) ?? 0,
    house_system: (raw.house_system as string) || undefined,
    tradition: (raw.tradition as string) || undefined,
    unknown_time: !!raw.unknown_time,
  };
}

/**
 * Fetch engine transit data for each day in [start, start+days). Sequentially
 * batched (default 4 concurrent) — after the first run the ephemeris cache
 * makes this mostly round-trip latency.
 */
export async function fetchCalendarDays(
  base44: { asServiceRole: { functions: { invoke: (name: string, payload: unknown) => Promise<{ data: Record<string, unknown> }> } } },
  natal: NatalParams,
  start: Date,
  days: number,
  concurrency = 4,
): Promise<CalendarDay[]> {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const out: CalendarDay[] = new Array(dates.length);
  let next = 0;
  let rateLimited = false;
  async function fetchOne(transit_date: string) {
    const { data } = await base44.asServiceRole.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      transit_date,
      ...natal,
    });
    return data;
  }
  async function worker() {
    while (next < dates.length && !rateLimited) {
      const idx = next++;
      const transit_date = dates[idx];
      try {
        let data;
        try {
          data = await fetchOne(transit_date);
        } catch (err) {
          // One quiet retry for transient failures; a rate-limit response
          // stops further fetching — consumers tolerate missing days, so a
          // partial window beats a failed render.
          if (/rate limit/i.test((err as Error)?.message || '')) { rateLimited = true; break; }
          await new Promise((r) => setTimeout(r, 1200));
          data = await fetchOne(transit_date);
        }
        out[idx] = {
          date: transit_date,
          transit_planets: (data.transit_planets as CalendarDay['transit_planets']) || [],
          transit_aspects: (data.transit_aspects as CalendarDay['transit_aspects']) || [],
          stations: (data.stations as CalendarDay['stations']) || [],
          ingresses: (data.ingresses as CalendarDay['ingresses']) || [],
        };
      } catch (err) {
        console.warn(`calendarDays: ${transit_date} failed:`, (err as Error)?.message);
        if (/rate limit/i.test((err as Error)?.message || '')) rateLimited = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, dates.length) }, worker));
  if (rateLimited) console.warn('calendarDays: stopped early on rate limit — serving partial window');
  return out;
}

const MUNDANE_ANGLES: Record<string, number> = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };

/**
 * Transit-planet-to-transit-planet (mundane/collective) aspects from a day's
 * positions — same pairing the app's planner does client-side. Moon excluded
 * (handled as lunar), slow pairs only by default.
 */
export function mundaneAspectsFromPlanets(
  planets: CalendarDay['transit_planets'],
  maxOrb = 2.0,
  include: (name: string) => boolean = () => true,
): Array<{ planet_a: string; sign_a: string; planet_b: string; sign_b: string; aspect: string; orb: number }> {
  const res: Array<{ planet_a: string; sign_a: string; planet_b: string; sign_b: string; aspect: string; orb: number }> = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i], b = planets[j];
      if (a.name === 'Moon' || b.name === 'Moon') continue;
      if (!include(a.name) || !include(b.name)) continue;
      let diff = Math.abs(a.longitude - b.longitude);
      if (diff > 180) diff = 360 - diff;
      for (const [name, angle] of Object.entries(MUNDANE_ANGLES)) {
        const orb = Math.abs(diff - angle);
        if (orb <= maxOrb) {
          res.push({ planet_a: a.name, sign_a: a.sign, planet_b: b.name, sign_b: b.sign, aspect: name, orb });
          break;
        }
      }
    }
  }
  return res;
}
