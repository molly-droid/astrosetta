/**
 * Celestial body utilities
 */

import { AstroBody } from '../types.js';

const BODY_GLYPHS: Record<AstroBody, string> = {
  [AstroBody.Sun]: '☉',
  [AstroBody.Moon]: '☽',
  [AstroBody.Mercury]: '☿',
  [AstroBody.Venus]: '♀',
  [AstroBody.Mars]: '♂',
  [AstroBody.Jupiter]: '♃',
  [AstroBody.Saturn]: '♄',
  [AstroBody.Uranus]: '♅',
  [AstroBody.Neptune]: '♆',
  [AstroBody.Pluto]: '♇',
  [AstroBody.NorthNode]: '☊',
  [AstroBody.SouthNode]: '☋',
  [AstroBody.Chiron]: '⚷',
};

/**
 * Get body glyph symbol
 */
export function bodyGlyph(body: AstroBody): string {
  return BODY_GLYPHS[body];
}

/**
 * Get body name
 */
export function bodyName(body: AstroBody): string {
  return body;
}

/**
 * Check if body is a luminary (Sun or Moon)
 */
export function isLuminary(body: AstroBody): boolean {
  return body === AstroBody.Sun || body === AstroBody.Moon;
}

/**
 * Check if body is a personal planet (Sun, Moon, Mercury, Venus, Mars)
 */
export function isPersonalPlanet(body: AstroBody): boolean {
  return [
    AstroBody.Sun,
    AstroBody.Moon,
    AstroBody.Mercury,
    AstroBody.Venus,
    AstroBody.Mars,
  ].includes(body);
}

/**
 * Check if body is an outer planet (Jupiter, Saturn, Uranus, Neptune, Pluto)
 */
export function isOuterPlanet(body: AstroBody): boolean {
  return [
    AstroBody.Jupiter,
    AstroBody.Saturn,
    AstroBody.Uranus,
    AstroBody.Neptune,
    AstroBody.Pluto,
  ].includes(body);
}

/**
 * Get orbital period in days (approximate)
 */
export function orbitalPeriod(body: AstroBody): number {
  const periods: Record<AstroBody, number> = {
    [AstroBody.Sun]: 365.25, // Earth's orbit
    [AstroBody.Moon]: 27.32,
    [AstroBody.Mercury]: 87.97,
    [AstroBody.Venus]: 224.70,
    [AstroBody.Mars]: 686.98,
    [AstroBody.Jupiter]: 4332.59,
    [AstroBody.Saturn]: 10759.22,
    [AstroBody.Uranus]: 30688.5,
    [AstroBody.Neptune]: 60182,
    [AstroBody.Pluto]: 90560,
    [AstroBody.NorthNode]: 6793.5, // Nodal period ~18.6 years
    [AstroBody.SouthNode]: 6793.5,
    [AstroBody.Chiron]: 18250, // ~50 years
  };
  return periods[body];
}

/**
 * Get bodies in the order they should be calculated
 */
export function getCalculationOrder(): AstroBody[] {
  return [
    AstroBody.Sun,
    AstroBody.Moon,
    AstroBody.Mercury,
    AstroBody.Venus,
    AstroBody.Mars,
    AstroBody.Jupiter,
    AstroBody.Saturn,
    AstroBody.Uranus,
    AstroBody.Neptune,
    AstroBody.Pluto,
    AstroBody.NorthNode,
    // SouthNode is derived from NorthNode
    // Chiron is v1.1 (not in v1)
  ];
}
