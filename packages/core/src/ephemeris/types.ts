/**
 * Ephemeris types - abstraction layer for different ephemeris engines
 */

import { AstroBody } from '../types.js';

/**
 * Ecliptic position of a celestial body
 */
export interface EphemerisPosition {
  longitude: number; // Ecliptic longitude in degrees (0-360)
  latitude: number; // Ecliptic latitude in degrees
  distance: number; // Distance from Earth in AU
  speed: number; // Degrees per day (longitudinal motion)
  retrograde: boolean;
}

/**
 * Ephemeris adapter interface
 * Allows swapping between different ephemeris engines (e.g., astronomy-engine, Swiss Ephemeris)
 */
export interface EphemerisAdapter {
  /**
   * Get the position of a celestial body at a given Julian Day
   * @param body The celestial body
   * @param jd Julian Day Number
   * @returns Ecliptic position
   */
  getBodyPosition(body: AstroBody, jd: number): EphemerisPosition;

  /**
   * Get the obliquity of the ecliptic (tilt of Earth's axis) at a given Julian Day
   * @param jd Julian Day Number
   * @returns Obliquity in degrees
   */
  getObliquity(jd: number): number;

  /**
   * Get the name of the ephemeris engine
   */
  getName(): string;
}
