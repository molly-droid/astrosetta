/**
 * Zodiac sign utilities
 */

import { ZodiacSign } from '../types.js';

const ZODIAC_SIGNS = [
  ZodiacSign.Aries,
  ZodiacSign.Taurus,
  ZodiacSign.Gemini,
  ZodiacSign.Cancer,
  ZodiacSign.Leo,
  ZodiacSign.Virgo,
  ZodiacSign.Libra,
  ZodiacSign.Scorpio,
  ZodiacSign.Sagittarius,
  ZodiacSign.Capricorn,
  ZodiacSign.Aquarius,
  ZodiacSign.Pisces,
];

const ZODIAC_GLYPHS: Record<ZodiacSign, string> = {
  [ZodiacSign.Aries]: '♈',
  [ZodiacSign.Taurus]: '♉',
  [ZodiacSign.Gemini]: '♊',
  [ZodiacSign.Cancer]: '♋',
  [ZodiacSign.Leo]: '♌',
  [ZodiacSign.Virgo]: '♍',
  [ZodiacSign.Libra]: '♎',
  [ZodiacSign.Scorpio]: '♏',
  [ZodiacSign.Sagittarius]: '♐',
  [ZodiacSign.Capricorn]: '♑',
  [ZodiacSign.Aquarius]: '♒',
  [ZodiacSign.Pisces]: '♓',
};

/**
 * Convert ecliptic longitude to zodiac sign and degree within sign
 * @param longitude Ecliptic longitude in degrees (0-360)
 * @returns Zodiac sign and degree within that sign (0-30)
 */
export function longitudeToZodiac(longitude: number): {
  sign: ZodiacSign;
  degreeInSign: number;
} {
  // Normalize to 0-360
  let normalizedLon = longitude % 360;
  if (normalizedLon < 0) normalizedLon += 360;

  // Each sign is 30 degrees, starting at 0° Aries
  const signIndex = Math.floor(normalizedLon / 30);
  const degreeInSign = normalizedLon % 30;

  return {
    sign: ZODIAC_SIGNS[signIndex],
    degreeInSign,
  };
}

/**
 * Get the starting longitude for a zodiac sign
 * @param sign The zodiac sign
 * @returns The ecliptic longitude where the sign starts (0, 30, 60, etc.)
 */
export function signStartLongitude(sign: ZodiacSign): number {
  const index = ZODIAC_SIGNS.indexOf(sign);
  return index * 30;
}

/**
 * Get zodiac sign name
 */
export function zodiacSignName(sign: ZodiacSign): string {
  return sign;
}

/**
 * Get zodiac sign glyph
 */
export function zodiacSignGlyph(sign: ZodiacSign): string {
  return ZODIAC_GLYPHS[sign];
}

/**
 * Get all zodiac signs in order
 */
export function getAllSigns(): ZodiacSign[] {
  return [...ZODIAC_SIGNS];
}

/**
 * Get the element of a zodiac sign
 */
export function getElement(sign: ZodiacSign): 'Fire' | 'Earth' | 'Air' | 'Water' {
  const fireSign = [ZodiacSign.Aries, ZodiacSign.Leo, ZodiacSign.Sagittarius];
  const earthSigns = [ZodiacSign.Taurus, ZodiacSign.Virgo, ZodiacSign.Capricorn];
  const airSigns = [ZodiacSign.Gemini, ZodiacSign.Libra, ZodiacSign.Aquarius];
  const waterSigns = [ZodiacSign.Cancer, ZodiacSign.Scorpio, ZodiacSign.Pisces];

  if (fireSign.includes(sign)) return 'Fire';
  if (earthSigns.includes(sign)) return 'Earth';
  if (airSigns.includes(sign)) return 'Air';
  return 'Water';
}

/**
 * Get the modality of a zodiac sign
 */
export function getModality(sign: ZodiacSign): 'Cardinal' | 'Fixed' | 'Mutable' {
  const cardinalSigns = [ZodiacSign.Aries, ZodiacSign.Cancer, ZodiacSign.Libra, ZodiacSign.Capricorn];
  const fixedSigns = [ZodiacSign.Taurus, ZodiacSign.Leo, ZodiacSign.Scorpio, ZodiacSign.Aquarius];

  if (cardinalSigns.includes(sign)) return 'Cardinal';
  if (fixedSigns.includes(sign)) return 'Fixed';
  return 'Mutable';
}

/**
 * Get the polarity of a zodiac sign
 */
export function getPolarity(sign: ZodiacSign): 'Positive' | 'Negative' {
  const signIndex = ZODIAC_SIGNS.indexOf(sign);
  return signIndex % 2 === 0 ? 'Positive' : 'Negative';
}
