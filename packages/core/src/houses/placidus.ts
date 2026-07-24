/**
 * Placidus House System
 * Time-based house system using semi-arcs
 */

import { HouseCalculator, HouseCalculationResult } from './types.js';
import { HouseCusp } from '../types.js';
import { longitudeToZodiac } from '../utils/zodiac.js';
import { localMeanSiderealTime } from '../utils/julian.js';
import { normalizeDegrees } from '../utils/coordinates.js';

const POLAR_LATITUDE_THRESHOLD = 66.5; // degrees

export class PlacidusHouseCalculator implements HouseCalculator {
  getName(): string {
    return 'Placidus';
  }

  calculateHouses(
    jd: number,
    lat: number,
    lon: number,
    obliquity: number
  ): HouseCalculationResult | null {
    // Check for polar latitudes where Placidus fails
    if (Math.abs(lat) > POLAR_LATITUDE_THRESHOLD) {
      return null; // Caller should fall back to Whole Sign
    }

    const lmst = localMeanSiderealTime(jd, lon);

    // Calculate MC and IC
    const mc = this.calculateMC(lmst, obliquity);
    const ic: typeof mc = {
      longitude: normalizeDegrees(mc.longitude + 180),
      ...longitudeToZodiac(normalizeDegrees(mc.longitude + 180)),
    };

    // Calculate Ascendant and Descendant
    const ascendant = this.calculateAscendant(lmst, lat, obliquity);
    const descendant: typeof ascendant = {
      longitude: normalizeDegrees(ascendant.longitude + 180),
      ...longitudeToZodiac(normalizeDegrees(ascendant.longitude + 180)),
    };

    // Calculate intermediate house cusps using Placidus method
    const cusps: HouseCusp[] = [];

    // Houses 1, 4, 7, 10 are the angles
    cusps[0] = this.createCusp(1, ascendant.longitude);
    cusps[3] = this.createCusp(4, ic.longitude);
    cusps[6] = this.createCusp(7, descendant.longitude);
    cusps[9] = this.createCusp(10, mc.longitude);

    // Calculate houses 11, 12, 2, 3 using semi-arc division
    try {
      cusps[10] = this.createCusp(11, this.calculateIntermediateCusp(mc.longitude, ascendant.longitude, 1, lat, obliquity));
      cusps[11] = this.createCusp(12, this.calculateIntermediateCusp(mc.longitude, ascendant.longitude, 2, lat, obliquity));
      cusps[1] = this.createCusp(2, this.calculateIntermediateCusp(ascendant.longitude, ic.longitude, 1, lat, obliquity));
      cusps[2] = this.createCusp(3, this.calculateIntermediateCusp(ascendant.longitude, ic.longitude, 2, lat, obliquity));

      // Houses 5, 6, 8, 9 are opposite to 11, 12, 2, 3
      cusps[4] = this.createCusp(5, normalizeDegrees(cusps[10].longitude + 180));
      cusps[5] = this.createCusp(6, normalizeDegrees(cusps[11].longitude + 180));
      cusps[7] = this.createCusp(8, normalizeDegrees(cusps[1].longitude + 180));
      cusps[8] = this.createCusp(9, normalizeDegrees(cusps[2].longitude + 180));
    } catch (error) {
      // If calculation fails, return null to trigger fallback
      return null;
    }

    return {
      cusps,
      ascendant,
      mc,
      descendant,
      ic,
      systemUsed: this.getName(),
    };
  }

  /**
   * Calculate intermediate house cusp using Placidus semi-arc method
   * @param startCusp Starting angle cusp longitude
   * @param endCusp Ending angle cusp longitude
   * @param division 1 for first intermediate, 2 for second
   * @param lat Geographic latitude
   * @param obliquity Obliquity of ecliptic
   */
  private calculateIntermediateCusp(
    startCusp: number,
    endCusp: number,
    division: number,
    lat: number,
    obliquity: number
  ): number {
    const latRad = (lat * Math.PI) / 180;
    const oblRad = (obliquity * Math.PI) / 180;

    // Calculate RA of start and end cusps
    const raStart = this.eclipticToRA(startCusp, obliquity);
    const raEnd = this.eclipticToRA(endCusp, obliquity);

    // Calculate intermediate RA (dividing the semi-arc)
    let raDiff = raEnd - raStart;
    if (raDiff < 0) raDiff += 360;

    const raIntermediate = normalizeDegrees(raStart + (raDiff / 3) * division);

    // Convert back to ecliptic longitude using iteration
    return this.raToEcliptic(raIntermediate, lat, obliquity);
  }

  /**
   * Convert ecliptic longitude to right ascension
   */
  private eclipticToRA(eclipticLon: number, obliquity: number): number {
    const lonRad = (eclipticLon * Math.PI) / 180;
    const oblRad = (obliquity * Math.PI) / 180;

    const y = Math.sin(lonRad) * Math.cos(oblRad);
    const x = Math.cos(lonRad);

    let ra = (Math.atan2(y, x) * 180) / Math.PI;
    return normalizeDegrees(ra);
  }

  /**
   * Convert right ascension to ecliptic longitude (requires iteration)
   */
  private raToEcliptic(ra: number, lat: number, obliquity: number): number {
    // Use iterative method to find ecliptic longitude
    let eclipticLon = ra; // Initial guess
    const maxIterations = 20;
    const tolerance = 0.0001;

    for (let i = 0; i < maxIterations; i++) {
      const calculatedRA = this.eclipticToRA(eclipticLon, obliquity);
      let error = ra - calculatedRA;

      // Handle wraparound
      if (error > 180) error -= 360;
      if (error < -180) error += 360;

      if (Math.abs(error) < tolerance) {
        break;
      }

      eclipticLon = normalizeDegrees(eclipticLon + error);
    }

    return eclipticLon;
  }

  /**
   * Calculate Ascendant
   */
  private calculateAscendant(lmst: number, lat: number, obliquity: number): typeof this.createCusp extends (...args: any) => infer R ? Omit<R, 'house'> : never {
    const latRad = (lat * Math.PI) / 180;
    const oblRad = (obliquity * Math.PI) / 180;
    const lmstRad = (lmst * Math.PI) / 180;

    const y = -Math.cos(lmstRad);
    const x = Math.sin(lmstRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);

    let ascendantLon = (Math.atan2(y, x) * 180) / Math.PI;
    ascendantLon = normalizeDegrees(ascendantLon);

    return {
      longitude: ascendantLon,
      ...longitudeToZodiac(ascendantLon),
    };
  }

  /**
   * Calculate MC
   */
  private calculateMC(lmst: number, obliquity: number): typeof this.createCusp extends (...args: any) => infer R ? Omit<R, 'house'> : never {
    const oblRad = (obliquity * Math.PI) / 180;
    const ramcRad = (lmst * Math.PI) / 180;

    const y = Math.sin(ramcRad);
    const x = Math.cos(ramcRad) * Math.cos(oblRad);

    let mcLon = (Math.atan2(y, x) * 180) / Math.PI;
    mcLon = normalizeDegrees(mcLon);

    return {
      longitude: mcLon,
      ...longitudeToZodiac(mcLon),
    };
  }

  /**
   * Helper to create a house cusp object
   */
  private createCusp(house: number, longitude: number): HouseCusp {
    const zodiacInfo = longitudeToZodiac(longitude);
    return {
      house,
      longitude,
      sign: zodiacInfo.sign,
      degreeInSign: zodiacInfo.degreeInSign,
    };
  }
}

/**
 * Create a Placidus house calculator
 */
export function createPlacidusCalculator(): HouseCalculator {
  return new PlacidusHouseCalculator();
}
