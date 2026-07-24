/**
 * Whole Sign House System
 * Each house is exactly 30 degrees, starting from the Ascendant's sign
 */

import { HouseCalculator, HouseCalculationResult } from './types.js';
import { HouseCusp } from '../types.js';
import { longitudeToZodiac } from '../utils/zodiac.js';
import { localMeanSiderealTime } from '../utils/julian.js';
import { normalizeDegrees } from '../utils/coordinates.js';

export class WholeSignHouseCalculator implements HouseCalculator {
  getName(): string {
    return 'Whole Sign';
  }

  calculateHouses(
    jd: number,
    lat: number,
    lon: number,
    obliquity: number
  ): HouseCalculationResult {
    // Calculate Ascendant first
    const ascendant = this.calculateAscendant(jd, lat, lon, obliquity);

    // MC is calculated independently
    const mc = this.calculateMC(jd, lon, obliquity);

    // In Whole Sign, each house cusp starts at 0° of each sign
    // Starting from the Ascendant's sign
    const ascendantInfo = longitudeToZodiac(ascendant.longitude);

    // Find the start of the Ascendant's sign (0° of that sign)
    const firstHouseCusp = Math.floor(ascendant.longitude / 30) * 30;

    const cusps: HouseCusp[] = [];
    for (let i = 0; i < 12; i++) {
      const cuspLongitude = normalizeDegrees(firstHouseCusp + i * 30);
      const zodiacInfo = longitudeToZodiac(cuspLongitude);

      cusps.push({
        house: i + 1,
        longitude: cuspLongitude,
        sign: zodiacInfo.sign,
        degreeInSign: zodiacInfo.degreeInSign,
      });
    }

    // Descendant is opposite Ascendant
    const descendant: AnglePosition = {
      longitude: normalizeDegrees(ascendant.longitude + 180),
      ...longitudeToZodiac(normalizeDegrees(ascendant.longitude + 180)),
    };

    // IC is opposite MC
    const ic: AnglePosition = {
      longitude: normalizeDegrees(mc.longitude + 180),
      ...longitudeToZodiac(normalizeDegrees(mc.longitude + 180)),
    };

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
   * Calculate Ascendant (rising degree on the eastern horizon)
   */
  private calculateAscendant(jd: number, lat: number, lon: number, obliquity: number): AnglePosition {
    const lmst = localMeanSiderealTime(jd, lon);
    const latRad = (lat * Math.PI) / 180;
    const oblRad = (obliquity * Math.PI) / 180;

    // Convert LMST from degrees to radians
    const lmstRad = (lmst * Math.PI) / 180;

    // Calculate Ascendant using standard formula
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
   * Calculate MC (Medium Coeli - Midheaven)
   */
  private calculateMC(jd: number, lon: number, obliquity: number): AnglePosition {
    const lmst = localMeanSiderealTime(jd, lon);
    const oblRad = (obliquity * Math.PI) / 180;

    // MC is the ecliptic degree crossing the meridian
    // Convert RAMC (Right Ascension of MC) to ecliptic longitude
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
}

/**
 * Create a Whole Sign house calculator
 */
export function createWholeSignCalculator(): HouseCalculator {
  return new WholeSignHouseCalculator();
}
