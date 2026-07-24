/**
 * @astro/core - Astrological chart calculation engine
 *
 * Pure TypeScript library for accurate natal chart calculations.
 * Zero dependencies on DOM/Node APIs - runs in any JavaScript environment.
 */

// Main exports
export { buildChart } from './chart/builder.js';
export { CHART_DATA_VERSION } from './chart/version.js';

// Types
export type {
  ChartData,
  BirthData,
  ChartOptions,
  BodyPosition,
  HouseCusp,
  AnglePosition,
  Aspect,
} from './types.js';

export {
  AstroBody,
  ZodiacSign,
  AspectType,
  HouseSystem,
} from './types.js';

// Utilities
export {
  zodiacSignName,
  zodiacSignGlyph,
  longitudeToZodiac,
  getElement,
  getModality,
  getPolarity,
} from './utils/zodiac.js';

export {
  bodyGlyph,
  bodyName,
  isLuminary,
  isPersonalPlanet,
  isOuterPlanet,
  orbitalPeriod,
} from './utils/bodies.js';

export {
  formatDMS,
  normalizeDegrees,
  angularSeparation,
} from './utils/coordinates.js';

export {
  dateToJulian,
  julianToDate,
  getCurrentJulian,
} from './utils/julian.js';

// Aspect utilities
export {
  getAspectColor,
  getAspectQuality,
} from './aspects/calculator.js';
