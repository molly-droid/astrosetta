/**
 * Core astrological types and enums
 */

export enum AstroBody {
  Sun = 'Sun',
  Moon = 'Moon',
  Mercury = 'Mercury',
  Venus = 'Venus',
  Mars = 'Mars',
  Jupiter = 'Jupiter',
  Saturn = 'Saturn',
  Uranus = 'Uranus',
  Neptune = 'Neptune',
  Pluto = 'Pluto',
  NorthNode = 'NorthNode',
  SouthNode = 'SouthNode',
  Chiron = 'Chiron',
}

export enum ZodiacSign {
  Aries = 'Aries',
  Taurus = 'Taurus',
  Gemini = 'Gemini',
  Cancer = 'Cancer',
  Leo = 'Leo',
  Virgo = 'Virgo',
  Libra = 'Libra',
  Scorpio = 'Scorpio',
  Sagittarius = 'Sagittarius',
  Capricorn = 'Capricorn',
  Aquarius = 'Aquarius',
  Pisces = 'Pisces',
}

export enum AspectType {
  Conjunction = 'Conjunction',
  Opposition = 'Opposition',
  Trine = 'Trine',
  Square = 'Square',
  Sextile = 'Sextile',
  Quincunx = 'Quincunx',
  Semisextile = 'Semisextile',
}

export enum HouseSystem {
  Placidus = 'Placidus',
  WholeSign = 'WholeSign',
}

export type ZodiacMode = 'tropical' | 'sidereal';

/**
 * Celestial body position in ecliptic coordinates
 */
export interface BodyPosition {
  body: AstroBody;
  longitude: number; // Ecliptic longitude in degrees (0-360)
  latitude: number; // Ecliptic latitude in degrees
  distance: number; // Distance from Earth in AU
  speed: number; // Degrees per day
  retrograde: boolean;
  sign: ZodiacSign;
  degreeInSign: number; // 0-30
  house: number | null; // 1-12, null if time unknown
}

/**
 * House cusp position
 */
export interface HouseCusp {
  house: number; // 1-12
  longitude: number; // Ecliptic longitude
  sign: ZodiacSign;
  degreeInSign: number;
}

/**
 * Angle position (Ascendant, MC, etc.)
 */
export interface AnglePosition {
  longitude: number;
  sign: ZodiacSign;
  degreeInSign: number;
}

/**
 * Aspect between two bodies
 */
export interface Aspect {
  body1: AstroBody;
  body2: AstroBody;
  type: AspectType;
  exactOrb: number; // Distance from exact aspect in degrees
  applying: boolean; // True if aspect is applying, false if separating
}

/**
 * Complete chart data
 */
export interface ChartData {
  version: string; // Chart data format version
  birthData: {
    utcDatetime: string; // ISO 8601
    lat: number;
    lon: number;
    timeKnown: boolean;
  };
  bodies: BodyPosition[];
  angles: {
    ascendant: AnglePosition | null;
    mc: AnglePosition | null;
    descendant?: AnglePosition | null;
    ic?: AnglePosition | null;
  };
  houseCusps: HouseCusp[] | null;
  houseSystemUsed: HouseSystem | 'none';
  aspects: Aspect[];
  metadata: {
    computedAt: string; // ISO 8601
    houseSystemRequested: HouseSystem | 'none';
    includesMinorAspects: boolean;
    zodiacMode: ZodiacMode;
  };
}

/**
 * Birth data input
 */
export interface BirthData {
  utcDatetime: Date;
  lat: number;
  lon: number;
  timeKnown?: boolean;
}

/**
 * Chart calculation options
 */
export interface ChartOptions {
  houseSystem?: HouseSystem;
  includeMinorAspects?: boolean;
  zodiacMode?: ZodiacMode;
  orbOverrides?: Partial<Record<AspectType, number>>;
  luminariesOrbBonus?: number;
}
