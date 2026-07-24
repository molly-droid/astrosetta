/**
 * Astronomy Engine ephemeris adapter
 * Uses astronomy-engine library for planetary positions
 */

import * as Astronomy from 'astronomy-engine';
import { AstroBody } from '../types.js';
import { EphemerisAdapter, EphemerisPosition } from './types.js';
import { equatorialToEcliptic } from '../utils/coordinates.js';

/**
 * Map our AstroBody enum to astronomy-engine body names
 */
function mapBodyToAstronomyEngine(body: AstroBody): Astronomy.Body {
  const mapping: Record<AstroBody, Astronomy.Body> = {
    [AstroBody.Sun]: Astronomy.Body.Sun,
    [AstroBody.Moon]: Astronomy.Body.Moon,
    [AstroBody.Mercury]: Astronomy.Body.Mercury,
    [AstroBody.Venus]: Astronomy.Body.Venus,
    [AstroBody.Mars]: Astronomy.Body.Mars,
    [AstroBody.Jupiter]: Astronomy.Body.Jupiter,
    [AstroBody.Saturn]: Astronomy.Body.Saturn,
    [AstroBody.Uranus]: Astronomy.Body.Uranus,
    [AstroBody.Neptune]: Astronomy.Body.Neptune,
    [AstroBody.Pluto]: Astronomy.Body.Pluto,
    [AstroBody.NorthNode]: Astronomy.Body.Moon, // Special handling needed
    [AstroBody.SouthNode]: Astronomy.Body.Moon, // Derived from North Node
    [AstroBody.Chiron]: Astronomy.Body.Sun, // Not supported in v1
  };
  return mapping[body];
}

/**
 * Astronomy Engine ephemeris adapter implementation
 */
export class AstronomyEngineAdapter implements EphemerisAdapter {
  getName(): string {
    return 'astronomy-engine';
  }

  getObliquity(jd: number): number {
    const time = new Astronomy.AstroTime(jd);
    // Calculate mean obliquity of the ecliptic (Earth's axial tilt)
    // Formula from Astronomical Algorithms by Jean Meeus
    const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000.0

    const obliquity =
      23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;

    return obliquity;
  }

  getBodyPosition(body: AstroBody, jd: number): EphemerisPosition {
    // Special handling for Moon's nodes
    if (body === AstroBody.NorthNode || body === AstroBody.SouthNode) {
      return this.getMoonNodePosition(body, jd);
    }

    const time = new Astronomy.AstroTime(jd);
    const astronomyBody = mapBodyToAstronomyEngine(body);

    // Get equatorial coordinates from astronomy-engine
    const equatorial = Astronomy.Equator(astronomyBody, time, undefined, true, true);

    // Convert to ecliptic coordinates
    const obliquity = this.getObliquity(jd);
    const { lon, lat } = equatorialToEcliptic(equatorial.ra * 15, equatorial.dec, obliquity); // RA is in hours, convert to degrees

    // Calculate distance
    let distance = 0;
    if (body === AstroBody.Sun || body === AstroBody.Moon) {
      distance = equatorial.dist;
    } else {
      const helioVector = Astronomy.HelioVector(astronomyBody, time);
      const earthVector = Astronomy.HelioVector(Astronomy.Body.Earth, time);
      const dx = helioVector.x - earthVector.x;
      const dy = helioVector.y - earthVector.y;
      const dz = helioVector.z - earthVector.z;
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // Calculate speed (longitude change per day)
    const speed = this.calculateSpeed(body, jd);

    return {
      longitude: lon,
      latitude: lat,
      distance,
      speed,
      retrograde: speed < 0,
    };
  }

  /**
   * Calculate the longitudinal speed of a body (degrees per day)
   */
  private calculateSpeed(body: AstroBody, jd: number): number {
    const dt = 0.1; // 0.1 days = ~2.4 hours

    // Calculate positions at two nearby times without recursion
    const lon1 = this.getLongitudeOnly(body, jd - dt / 2);
    const lon2 = this.getLongitudeOnly(body, jd + dt / 2);

    let diff = lon2 - lon1;

    // Handle zero crossing (359° -> 0°)
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return diff / dt;
  }

  /**
   * Get only the longitude (for speed calculation)
   */
  private getLongitudeOnly(body: AstroBody, jd: number): number {
    if (body === AstroBody.NorthNode || body === AstroBody.SouthNode) {
      const time = new Astronomy.AstroTime(jd);
      const nodeInfo = Astronomy.MoonNode(time);
      let longitude = nodeInfo.ra * 15;
      if (body === AstroBody.SouthNode) {
        longitude = (longitude + 180) % 360;
      }
      return longitude;
    }

    const time = new Astronomy.AstroTime(jd);
    const astronomyBody = mapBodyToAstronomyEngine(body);
    const equatorial = Astronomy.Equator(astronomyBody, time, undefined, true, true);
    const obliquity = this.getObliquity(jd);
    const { lon } = equatorialToEcliptic(equatorial.ra * 15, equatorial.dec, obliquity);
    return lon;
  }

  /**
   * Calculate Moon's North or South Node position
   * The nodes are where the Moon's orbit crosses the ecliptic plane
   */
  private getMoonNodePosition(body: AstroBody, jd: number): EphemerisPosition {
    const time = new Astronomy.AstroTime(jd);

    // astronomy-engine provides MoonNode function
    const nodeInfo = Astronomy.MoonNode(time);

    let longitude = nodeInfo.ra * 15; // Convert hours to degrees

    // South Node is 180° opposite the North Node
    if (body === AstroBody.SouthNode) {
      longitude = (longitude + 180) % 360;
    }

    // Nodes move retrograde (westward) along the ecliptic
    // Average motion is about -0.053° per day
    const speed = -0.053;

    return {
      longitude,
      latitude: 0, // Nodes are by definition on the ecliptic plane
      distance: 0, // Nodes are not physical bodies
      speed,
      retrograde: true, // Nodes always move retrograde
    };
  }
}

/**
 * Create a new astronomy-engine ephemeris adapter
 */
export function createAstronomyEngineAdapter(): EphemerisAdapter {
  return new AstronomyEngineAdapter();
}
