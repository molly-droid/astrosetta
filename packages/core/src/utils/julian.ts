/**
 * Julian date utilities
 * Julian Day Number (JD) is a continuous count of days since the beginning of
 * the Julian Period (January 1, 4713 BC Greenwich noon)
 */

import { DateTime } from 'luxon';

/**
 * Convert a Date to Julian Day Number
 * Uses Luxon for accurate conversion with timezone handling
 */
export function dateToJulian(date: Date): number {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' });
  return dt.toJulianDay();
}

/**
 * Convert Julian Day Number to Date
 */
export function julianToDate(jd: number): Date {
  const dt = DateTime.fromJulianDay(jd);
  return dt.toJSDate();
}

/**
 * Get current Julian Day Number
 */
export function getCurrentJulian(): number {
  return DateTime.utc().toJulianDay();
}

/**
 * Convert Julian Day to Julian centuries from J2000.0
 * J2000.0 = JD 2451545.0 (January 1, 2000, 12:00 TT)
 * This is commonly used in astronomical calculations
 */
export function julianCenturies(jd: number): number {
  const J2000 = 2451545.0;
  return (jd - J2000) / 36525.0;
}

/**
 * Calculate Greenwich Mean Sidereal Time in degrees
 * @param jd Julian Day Number
 * @returns GMST in degrees (0-360)
 */
export function greenwichMeanSiderealTime(jd: number): number {
  const T = julianCenturies(jd);

  // Formula from Astronomical Algorithms by Jean Meeus
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    T * T * (0.000387933 - T / 38710000.0);

  // Normalize to 0-360
  let normalized = gmst % 360;
  if (normalized < 0) normalized += 360;

  return normalized;
}

/**
 * Calculate Local Mean Sidereal Time in degrees
 * @param jd Julian Day Number
 * @param longitude Geographic longitude in degrees (positive east, negative west)
 * @returns LMST in degrees (0-360)
 */
export function localMeanSiderealTime(jd: number, longitude: number): number {
  const gmst = greenwichMeanSiderealTime(jd);
  let lmst = gmst + longitude;

  // Normalize to 0-360
  if (lmst < 0) lmst += 360;
  if (lmst >= 360) lmst -= 360;

  return lmst;
}

/**
 * Calculate the number of days between two Julian Day Numbers
 */
export function daysBetween(jd1: number, jd2: number): number {
  return Math.abs(jd2 - jd1);
}

/**
 * Add days to a Julian Day Number
 */
export function addDays(jd: number, days: number): number {
  return jd + days;
}
