/**
 * Coordinate conversion and normalization utilities
 */

/**
 * Normalize degrees to 0-360 range
 */
export function normalizeDegrees(degrees: number): number {
  let normalized = degrees % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Convert degrees to degrees, minutes, seconds format
 */
export function degreesToDMS(degrees: number): { deg: number; min: number; sec: number } {
  const absDegrees = Math.abs(degrees);
  const deg = Math.floor(absDegrees);
  const minFloat = (absDegrees - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;

  return {
    deg: degrees < 0 ? -deg : deg,
    min,
    sec,
  };
}

/**
 * Format degrees as DMS string
 */
export function formatDMS(degrees: number, includeSign = false): string {
  const { deg, min, sec } = degreesToDMS(degrees);
  const sign = includeSign && degrees >= 0 ? '+' : '';
  return `${sign}${deg}°${min.toString().padStart(2, '0')}'${sec.toFixed(2).padStart(5, '0')}"`;
}

/**
 * Convert ecliptic longitude to equatorial coordinates
 * @param eclipticLon Ecliptic longitude in degrees
 * @param eclipticLat Ecliptic latitude in degrees
 * @param obliquity Obliquity of the ecliptic in degrees
 * @returns Right Ascension (degrees) and Declination (degrees)
 */
export function eclipticToEquatorial(
  eclipticLon: number,
  eclipticLat: number,
  obliquity: number
): { ra: number; dec: number } {
  const lonRad = (eclipticLon * Math.PI) / 180;
  const latRad = (eclipticLat * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;

  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinObl = Math.sin(oblRad);
  const cosObl = Math.cos(oblRad);

  const x = cosLon * cosLat;
  const y = sinLon * cosLat;
  const z = sinLat;

  const xEq = x;
  const yEq = y * cosObl - z * sinObl;
  const zEq = y * sinObl + z * cosObl;

  const ra = normalizeDegrees((Math.atan2(yEq, xEq) * 180) / Math.PI);
  const dec = (Math.asin(zEq) * 180) / Math.PI;

  return { ra, dec };
}

/**
 * Convert equatorial coordinates to ecliptic
 * @param ra Right Ascension in degrees
 * @param dec Declination in degrees
 * @param obliquity Obliquity of the ecliptic in degrees
 * @returns Ecliptic longitude and latitude in degrees
 */
export function equatorialToEcliptic(
  ra: number,
  dec: number,
  obliquity: number
): { lon: number; lat: number } {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;

  const cosRa = Math.cos(raRad);
  const sinRa = Math.sin(raRad);
  const cosDec = Math.cos(decRad);
  const sinDec = Math.sin(decRad);
  const cosObl = Math.cos(oblRad);
  const sinObl = Math.sin(oblRad);

  const x = cosRa * cosDec;
  const y = sinRa * cosDec;
  const z = sinDec;

  const xEcl = x;
  const yEcl = y * cosObl + z * sinObl;
  const zEcl = -y * sinObl + z * cosObl;

  const lon = normalizeDegrees((Math.atan2(yEcl, xEcl) * 180) / Math.PI);
  const lat = (Math.asin(zEcl) * 180) / Math.PI;

  return { lon, lat };
}

/**
 * Calculate angular separation between two longitudes
 * Always returns the smallest angle (0-180 degrees)
 */
export function angularSeparation(lon1: number, lon2: number): number {
  const diff = Math.abs(normalizeDegrees(lon1) - normalizeDegrees(lon2));
  return diff > 180 ? 360 - diff : diff;
}
