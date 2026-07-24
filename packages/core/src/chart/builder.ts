/**
 * Chart builder - main entry point for generating birth charts
 */

import {
  ChartData,
  BirthData,
  ChartOptions,
  BodyPosition,
  HouseSystem,
  AstroBody,
} from '../types.js';
import { CHART_DATA_VERSION } from './version.js';
import { createAstronomyEngineAdapter } from '../ephemeris/index.js';
import { createPlacidusCalculator, createWholeSignCalculator } from '../houses/index.js';
import { calculateAspects } from '../aspects/index.js';
import { dateToJulian } from '../utils/julian.js';
import { longitudeToZodiac } from '../utils/zodiac.js';
import { getCalculationOrder } from '../utils/bodies.js';

/**
 * Build a complete natal chart from birth data
 */
export function buildChart(birthData: BirthData, options: ChartOptions = {}): ChartData {
  const {
    houseSystem = HouseSystem.Placidus,
    includeMinorAspects = false,
    zodiacMode = 'tropical',
    orbOverrides,
    luminariesOrbBonus = 2,
  } = options;

  const { utcDatetime, lat, lon, timeKnown = true } = birthData;

  // Convert to Julian Day
  const jd = dateToJulian(utcDatetime);

  // Initialize ephemeris
  const ephemeris = createAstronomyEngineAdapter();
  const obliquity = ephemeris.getObliquity(jd);

  // Calculate all body positions
  const bodies: BodyPosition[] = [];
  const calculationOrder = getCalculationOrder();

  for (const body of calculationOrder) {
    const position = ephemeris.getBodyPosition(body, jd);
    const zodiacInfo = longitudeToZodiac(position.longitude);

    bodies.push({
      body,
      longitude: position.longitude,
      latitude: position.latitude,
      distance: position.distance,
      speed: position.speed,
      retrograde: position.retrograde,
      sign: zodiacInfo.sign,
      degreeInSign: zodiacInfo.degreeInSign,
      house: null, // Will be assigned after house calculation
    });
  }

  // Add South Node (opposite North Node)
  const northNode = bodies.find((b) => b.body === AstroBody.NorthNode);
  if (northNode) {
    const southNodeLon = (northNode.longitude + 180) % 360;
    const southNodeZodiac = longitudeToZodiac(southNodeLon);

    bodies.push({
      body: AstroBody.SouthNode,
      longitude: southNodeLon,
      latitude: 0,
      distance: 0,
      speed: northNode.speed, // Same speed as North Node
      retrograde: true, // Nodes always retrograde
      sign: southNodeZodiac.sign,
      degreeInSign: southNodeZodiac.degreeInSign,
      house: null,
    });
  }

  // Calculate houses and angles (only if birth time is known)
  let houseCalculationResult = null;
  let houseSystemUsed: HouseSystem | 'none' = 'none';
  let angles = {
    ascendant: null,
    mc: null,
    descendant: null,
    ic: null,
  };
  let houseCusps = null;

  if (timeKnown) {
    if (houseSystem === HouseSystem.Placidus) {
      const placidusCalc = createPlacidusCalculator();
      houseCalculationResult = placidusCalc.calculateHouses(jd, lat, lon, obliquity);

      // Fallback to Whole Sign if Placidus fails (polar latitudes)
      if (!houseCalculationResult) {
        const wholeSignCalc = createWholeSignCalculator();
        houseCalculationResult = wholeSignCalc.calculateHouses(jd, lat, lon, obliquity);
      }
    } else {
      const wholeSignCalc = createWholeSignCalculator();
      houseCalculationResult = wholeSignCalc.calculateHouses(jd, lat, lon, obliquity);
    }

    if (houseCalculationResult) {
      houseSystemUsed =
        houseCalculationResult.systemUsed === 'Whole Sign'
          ? HouseSystem.WholeSign
          : HouseSystem.Placidus;
      angles = {
        ascendant: houseCalculationResult.ascendant,
        mc: houseCalculationResult.mc,
        descendant: houseCalculationResult.descendant,
        ic: houseCalculationResult.ic,
      };
      houseCusps = houseCalculationResult.cusps;

      // Assign houses to bodies
      assignHousesToBodies(bodies, houseCalculationResult.cusps);
    }
  }

  // Calculate aspects
  const aspects = calculateAspects(bodies, {
    includeMinorAspects,
    orbOverrides,
    luminariesOrbBonus,
  });

  // Build final ChartData
  const chartData: ChartData = {
    version: CHART_DATA_VERSION,
    birthData: {
      utcDatetime: utcDatetime.toISOString(),
      lat,
      lon,
      timeKnown,
    },
    bodies,
    angles,
    houseCusps,
    houseSystemUsed,
    aspects,
    metadata: {
      computedAt: new Date().toISOString(),
      houseSystemRequested: timeKnown ? houseSystem : 'none',
      includesMinorAspects: includeMinorAspects,
      zodiacMode,
    },
  };

  return chartData;
}

/**
 * Assign house placements to bodies based on house cusps
 */
function assignHousesToBodies(
  bodies: BodyPosition[],
  cusps: Array<{ house: number; longitude: number }>
): void {
  for (const body of bodies) {
    body.house = determineHouse(body.longitude, cusps);
  }
}

/**
 * Determine which house a longitude falls in
 */
function determineHouse(
  longitude: number,
  cusps: Array<{ house: number; longitude: number }>
): number {
  // Find which house the longitude falls into
  for (let i = 0; i < cusps.length; i++) {
    const currentCusp = cusps[i];
    const nextCusp = cusps[(i + 1) % cusps.length];

    const cuspLon = currentCusp.longitude;
    const nextCuspLon = nextCusp.longitude;

    // Handle wraparound at 0°/360°
    if (nextCuspLon > cuspLon) {
      // Normal case
      if (longitude >= cuspLon && longitude < nextCuspLon) {
        return currentCusp.house;
      }
    } else {
      // Wraparound case (e.g., cusp at 350°, next at 20°)
      if (longitude >= cuspLon || longitude < nextCuspLon) {
        return currentCusp.house;
      }
    }
  }

  // Fallback to house 1 (shouldn't happen)
  return 1;
}
