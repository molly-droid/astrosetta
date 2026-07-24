/**
 * ChartWheel Component
 * Renders an astrological chart as an SVG wheel
 */

import React from 'react';
import type { ChartWheelProps } from './types';
import { DEFAULT_THEME } from './types';
import {
  polarToCartesian,
  describeArc,
  getZodiacSymbol,
  getPlanetSymbol,
  getSignElement,
  normalizeAngle,
} from './utils';

export function ChartWheel({
  chartData,
  size = 600,
  showAspects = true,
  theme = DEFAULT_THEME,
  style,
}: ChartWheelProps) {
  const center = size / 2;
  const outerRadius = size / 2 - 10;
  const signRadius = outerRadius - 30;
  const houseRadius = signRadius - 40;
  const planetRadius = houseRadius - 50;
  const innerRadius = planetRadius - 60;

  // For now, render a placeholder since we don't have chart data yet
  if (!chartData) {
    return (
      <svg width={size} height={size} style={style}>
        <rect width={size} height={size} fill={theme.background} />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          fill={theme.text}
          fontSize={20}
        >
          No chart data
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} style={style}>
      {/* Background */}
      <rect width={size} height={size} fill={theme.background} />

      {/* Outer circle */}
      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill="none"
        stroke={theme.wheel}
        strokeWidth={2}
      />

      {/* Zodiac signs ring */}
      {renderZodiacSigns(center, outerRadius, signRadius, theme)}

      {/* House system ring */}
      {chartData.houses && renderHouses(center, signRadius, houseRadius, chartData.houses, theme)}

      {/* Planet positions */}
      {chartData.planets && renderPlanets(center, planetRadius, chartData.planets, theme)}

      {/* Aspect lines */}
      {showAspects && chartData.aspects && renderAspects(center, innerRadius, chartData.aspects, theme)}

      {/* Inner circle */}
      <circle
        cx={center}
        cy={center}
        r={innerRadius}
        fill="none"
        stroke={theme.wheel}
        strokeWidth={1}
      />
    </svg>
  );
}

/**
 * Render zodiac signs around the outer ring
 */
function renderZodiacSigns(
  center: number,
  outerRadius: number,
  signRadius: number,
  theme: typeof DEFAULT_THEME
) {
  const signs = [];

  for (let i = 0; i < 12; i++) {
    const startAngle = i * 30;
    const endAngle = (i + 1) * 30;
    const midAngle = startAngle + 15;

    const element = getSignElement(i);
    const color = theme.signs[element];

    // Sign arc
    const arcPath = describeArc(
      center,
      center,
      (outerRadius + signRadius) / 2,
      startAngle,
      endAngle
    );

    signs.push(
      <path
        key={`sign-arc-${i}`}
        d={arcPath}
        fill="none"
        stroke={color}
        strokeWidth={outerRadius - signRadius}
        opacity={0.2}
      />
    );

    // Sign symbol
    const symbolPos = polarToCartesian(
      center,
      center,
      (outerRadius + signRadius) / 2,
      midAngle
    );

    signs.push(
      <text
        key={`sign-symbol-${i}`}
        x={symbolPos.x}
        y={symbolPos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.text}
        fontSize={20}
        fontWeight="bold"
      >
        {getZodiacSymbol(i)}
      </text>
    );

    // Dividing line
    const lineStart = polarToCartesian(center, center, outerRadius, endAngle);
    const lineEnd = polarToCartesian(center, center, signRadius, endAngle);

    signs.push(
      <line
        key={`sign-line-${i}`}
        x1={lineStart.x}
        y1={lineStart.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke={theme.wheel}
        strokeWidth={1}
      />
    );
  }

  return <g id="zodiac-signs">{signs}</g>;
}

/**
 * Render house cusps
 */
function renderHouses(
  center: number,
  outerRadius: number,
  houseRadius: number,
  houses: any[],
  theme: typeof DEFAULT_THEME
) {
  const houseElements = [];

  for (let i = 0; i < houses.length; i++) {
    const house = houses[i];
    const angle = normalizeAngle(house.longitude);

    // House cusp line
    const lineStart = polarToCartesian(center, center, outerRadius, angle);
    const lineEnd = polarToCartesian(center, center, houseRadius, angle);

    houseElements.push(
      <line
        key={`house-line-${i}`}
        x1={lineStart.x}
        y1={lineStart.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke={theme.wheel}
        strokeWidth={i % 3 === 0 ? 2 : 1} // Thicker lines for 1st, 4th, 7th, 10th houses
        opacity={0.6}
      />
    );

    // House number
    const nextAngle = i < houses.length - 1 ? normalizeAngle(houses[i + 1].longitude) : normalizeAngle(houses[0].longitude);
    let midAngle = (angle + nextAngle) / 2;

    // Handle wraparound
    if (nextAngle < angle) {
      midAngle = ((angle + nextAngle + 360) / 2) % 360;
    }

    const numPos = polarToCartesian(
      center,
      center,
      (outerRadius + houseRadius) / 2,
      midAngle
    );

    houseElements.push(
      <text
        key={`house-num-${i}`}
        x={numPos.x}
        y={numPos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.text}
        fontSize={14}
        opacity={0.7}
      >
        {i + 1}
      </text>
    );
  }

  return <g id="houses">{houseElements}</g>;
}

/**
 * Render planet positions
 */
function renderPlanets(
  center: number,
  radius: number,
  planets: any[],
  theme: typeof DEFAULT_THEME
) {
  const planetElements = [];

  for (const planet of planets) {
    const angle = normalizeAngle(planet.longitude);
    const pos = polarToCartesian(center, center, radius, angle);

    const color = theme.planets[planet.name] || theme.text;

    // Planet symbol
    planetElements.push(
      <text
        key={`planet-${planet.name}`}
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={18}
        fontWeight="bold"
      >
        {getPlanetSymbol(planet.name)}
      </text>
    );

    // Line from planet to inner circle
    const innerPos = polarToCartesian(center, center, radius - 40, angle);
    planetElements.push(
      <line
        key={`planet-line-${planet.name}`}
        x1={pos.x}
        y1={pos.y}
        x2={innerPos.x}
        y2={innerPos.y}
        stroke={color}
        strokeWidth={1}
        opacity={0.5}
      />
    );
  }

  return <g id="planets">{planetElements}</g>;
}

/**
 * Render aspect lines
 */
function renderAspects(
  center: number,
  radius: number,
  aspects: any[],
  theme: typeof DEFAULT_THEME
) {
  const aspectElements = [];

  for (let i = 0; i < aspects.length; i++) {
    const aspect = aspects[i];

    const angle1 = normalizeAngle(aspect.planet1Longitude);
    const angle2 = normalizeAngle(aspect.planet2Longitude);

    const pos1 = polarToCartesian(center, center, radius, angle1);
    const pos2 = polarToCartesian(center, center, radius, angle2);

    const aspectType = aspect.type.toLowerCase() as keyof typeof theme.aspects;
    const color = theme.aspects[aspectType] || theme.wheel;

    aspectElements.push(
      <line
        key={`aspect-${i}`}
        x1={pos1.x}
        y1={pos1.y}
        x2={pos2.x}
        y2={pos2.y}
        stroke={color}
        strokeWidth={1}
        opacity={0.3}
        strokeDasharray={aspect.type === 'sextile' || aspect.type === 'trine' ? '4,4' : '0'}
      />
    );
  }

  return <g id="aspects">{aspectElements}</g>;
}

export default ChartWheel;
