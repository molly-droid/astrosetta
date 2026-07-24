/**
 * Utility functions for chart rendering
 */

import type { Point } from './types';

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate a point on a circle at a given angle and radius
 * Angle is in degrees, 0° is at the Ascendant (East/left)
 * In astrology, we count counter-clockwise from the Ascendant
 */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): Point {
  // Adjust angle: astrology charts start at 9 o'clock (180°) and go counter-clockwise
  // SVG coordinates start at 3 o'clock (0°) and go clockwise
  // So we need to transform: astrological angle -> SVG angle
  const svgAngle = 180 - angleDegrees;
  const angleRadians = degToRad(svgAngle);

  return {
    x: centerX + radius * Math.cos(angleRadians),
    y: centerY - radius * Math.sin(angleRadians), // Subtract because SVG y-axis is inverted
  };
}

/**
 * Create an SVG arc path
 */
export function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

/**
 * Get zodiac sign symbol
 */
export function getZodiacSymbol(signIndex: number): string {
  const symbols = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  return symbols[signIndex % 12];
}

/**
 * Get zodiac sign name
 */
export function getZodiacName(signIndex: number): string {
  const names = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ];
  return names[signIndex % 12];
}

/**
 * Get planet symbol
 */
export function getPlanetSymbol(planetName: string): string {
  const symbols: Record<string, string> = {
    Sun: '☉',
    Moon: '☽',
    Mercury: '☿',
    Venus: '♀',
    Mars: '♂',
    Jupiter: '♃',
    Saturn: '♄',
    Uranus: '♅',
    Neptune: '♆',
    Pluto: '♇',
    NorthNode: '☊',
    SouthNode: '☋',
    Chiron: '⚷',
  };
  return symbols[planetName] || planetName.charAt(0);
}

/**
 * Get element for zodiac sign
 */
export function getSignElement(signIndex: number): 'fire' | 'earth' | 'air' | 'water' {
  const elements = ['fire', 'earth', 'air', 'water'];
  return elements[signIndex % 4] as 'fire' | 'earth' | 'air' | 'water';
}
