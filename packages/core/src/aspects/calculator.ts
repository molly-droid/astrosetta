/**
 * Aspect calculator - finds aspects between celestial bodies
 */

import { Aspect, AspectType, AstroBody, BodyPosition } from '../types.js';
import { angularSeparation, normalizeDegrees } from '../utils/coordinates.js';
import { isLuminary } from '../utils/bodies.js';

/**
 * Aspect definitions with base orbs
 */
export interface AspectDefinition {
  type: AspectType;
  angle: number; // Exact angle in degrees
  baseOrb: number; // Base orb in degrees
  minor: boolean; // True for minor aspects
}

const ASPECT_DEFINITIONS: AspectDefinition[] = [
  { type: AspectType.Conjunction, angle: 0, baseOrb: 8, minor: false },
  { type: AspectType.Opposition, angle: 180, baseOrb: 8, minor: false },
  { type: AspectType.Trine, angle: 120, baseOrb: 7, minor: false },
  { type: AspectType.Square, angle: 90, baseOrb: 7, minor: false },
  { type: AspectType.Sextile, angle: 60, baseOrb: 5, minor: false },
  { type: AspectType.Quincunx, angle: 150, baseOrb: 3, minor: true },
  { type: AspectType.Semisextile, angle: 30, baseOrb: 3, minor: true },
];

export interface AspectCalculatorOptions {
  includeMinorAspects?: boolean;
  orbOverrides?: Partial<Record<AspectType, number>>;
  luminariesOrbBonus?: number;
}

/**
 * Calculate all aspects between bodies
 */
export function calculateAspects(
  bodies: BodyPosition[],
  options: AspectCalculatorOptions = {}
): Aspect[] {
  const {
    includeMinorAspects = false,
    orbOverrides = {},
    luminariesOrbBonus = 2,
  } = options;

  const aspects: Aspect[] = [];

  // Get aspect definitions to use
  const definitions = includeMinorAspects
    ? ASPECT_DEFINITIONS
    : ASPECT_DEFINITIONS.filter((def) => !def.minor);

  // Check all pairs of bodies
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const body1 = bodies[i];
      const body2 = bodies[j];

      // Check each aspect type
      for (const aspectDef of definitions) {
        const aspect = checkAspect(body1, body2, aspectDef, orbOverrides, luminariesOrbBonus);
        if (aspect) {
          aspects.push(aspect);
        }
      }
    }
  }

  // Sort by orb tightness (exact aspects first)
  aspects.sort((a, b) => a.exactOrb - b.exactOrb);

  return aspects;
}

/**
 * Check if two bodies form a specific aspect
 */
function checkAspect(
  body1: BodyPosition,
  body2: BodyPosition,
  aspectDef: AspectDefinition,
  orbOverrides: Partial<Record<AspectType, number>>,
  luminariesOrbBonus: number
): Aspect | null {
  const separation = angularSeparation(body1.longitude, body2.longitude);

  // Calculate exact orb (distance from the exact aspect angle)
  let exactOrb = Math.abs(separation - aspectDef.angle);

  // Handle conjunction (0°) wraparound
  if (aspectDef.angle === 0) {
    exactOrb = Math.min(separation, 360 - separation);
  }

  // Determine allowed orb
  let allowedOrb = orbOverrides[aspectDef.type] ?? aspectDef.baseOrb;

  // Add bonus for luminaries
  if (isLuminary(body1.body) || isLuminary(body2.body)) {
    allowedOrb += luminariesOrbBonus;
  }

  // Check if within orb
  if (exactOrb > allowedOrb) {
    return null;
  }

  // Determine if applying or separating
  const applying = isApplying(body1, body2, aspectDef.angle);

  return {
    body1: body1.body,
    body2: body2.body,
    type: aspectDef.type,
    exactOrb,
    applying,
  };
}

/**
 * Determine if an aspect is applying or separating
 * Applying: faster body is moving toward exact aspect
 * Separating: faster body is moving away from exact aspect
 */
function isApplying(body1: BodyPosition, body2: BodyPosition, aspectAngle: number): boolean {
  // Determine which body is faster
  const faster = Math.abs(body1.speed) > Math.abs(body2.speed) ? body1 : body2;
  const slower = faster === body1 ? body2 : body1;

  // Calculate current angular separation
  const currentSep = normalizeDegrees(slower.longitude - faster.longitude);

  // Calculate separation a small time in the future
  const futureFasterLon = normalizeDegrees(faster.longitude + faster.speed * 0.1); // 0.1 days ahead
  const futureSlowerLon = normalizeDegrees(slower.longitude + slower.speed * 0.1);
  const futureSep = normalizeDegrees(futureSlowerLon - futureFasterLon);

  // Calculate current and future orbs
  const currentOrb = Math.min(
    Math.abs(currentSep - aspectAngle),
    Math.abs(currentSep - aspectAngle + 360),
    Math.abs(currentSep - aspectAngle - 360)
  );

  const futureOrb = Math.min(
    Math.abs(futureSep - aspectAngle),
    Math.abs(futureSep - aspectAngle + 360),
    Math.abs(futureSep - aspectAngle - 360)
  );

  // If future orb is smaller, aspect is applying
  return futureOrb < currentOrb;
}

/**
 * Get aspect color (for UI rendering)
 */
export function getAspectColor(aspectType: AspectType): string {
  const harmonious = [AspectType.Trine, AspectType.Sextile];
  const challenging = [AspectType.Square, AspectType.Opposition];

  if (harmonious.includes(aspectType)) return 'blue';
  if (challenging.includes(aspectType)) return 'red';
  return 'gray';
}

/**
 * Get aspect quality description
 */
export function getAspectQuality(aspectType: AspectType): 'harmonious' | 'challenging' | 'neutral' {
  const harmonious = [AspectType.Trine, AspectType.Sextile];
  const challenging = [AspectType.Square, AspectType.Opposition];

  if (harmonious.includes(aspectType)) return 'harmonious';
  if (challenging.includes(aspectType)) return 'challenging';
  return 'neutral';
}
