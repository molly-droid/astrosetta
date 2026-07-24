/**
 * House system types
 */

import { HouseCusp, AnglePosition } from '../types.js';

/**
 * Result of house calculation
 */
export interface HouseCalculationResult {
  cusps: HouseCusp[]; // All 12 house cusps
  ascendant: AnglePosition;
  mc: AnglePosition;
  descendant: AnglePosition;
  ic: AnglePosition;
  systemUsed: string; // Name of house system actually used (may differ if fallback occurred)
}

/**
 * House calculator interface
 */
export interface HouseCalculator {
  /**
   * Calculate house cusps for a given time and location
   * @param jd Julian Day Number
   * @param lat Geographic latitude in degrees
   * @param lon Geographic longitude in degrees
   * @param obliquity Obliquity of the ecliptic in degrees
   * @returns House calculation result, or null if calculation failed
   */
  calculateHouses(
    jd: number,
    lat: number,
    lon: number,
    obliquity: number
  ): HouseCalculationResult | null;

  /**
   * Get the name of this house system
   */
  getName(): string;
}
