/**
 * Types for chart visualization
 */

export interface ChartWheelProps {
  /** Chart data from @astro/core */
  chartData: any; // TODO: Import from @astro/core when available
  /** Chart size in pixels */
  size?: number;
  /** Whether to show aspect lines */
  showAspects?: boolean;
  /** Theme colors */
  theme?: ChartTheme;
  /** Custom styles */
  style?: React.CSSProperties;
}

export interface ChartTheme {
  background: string;
  text: string;
  wheel: string;
  signs: {
    fire: string;      // Aries, Leo, Sagittarius
    earth: string;     // Taurus, Virgo, Capricorn
    air: string;       // Gemini, Libra, Aquarius
    water: string;     // Cancer, Scorpio, Pisces
  };
  planets: {
    [key: string]: string;
  };
  aspects: {
    conjunction: string;
    opposition: string;
    trine: string;
    square: string;
    sextile: string;
  };
}

export const DEFAULT_THEME: ChartTheme = {
  background: '#ffffff',
  text: '#000000',
  wheel: '#333333',
  signs: {
    fire: '#ff6b6b',
    earth: '#51cf66',
    air: '#ffd43b',
    water: '#339af0',
  },
  planets: {
    Sun: '#ffd700',
    Moon: '#c0c0c0',
    Mercury: '#b8860b',
    Venus: '#ff69b4',
    Mars: '#ff4500',
    Jupiter: '#4169e1',
    Saturn: '#8b4513',
    Uranus: '#00ced1',
    Neptune: '#9370db',
    Pluto: '#8b0000',
  },
  aspects: {
    conjunction: '#ff0000',
    opposition: '#0000ff',
    trine: '#00ff00',
    square: '#ff00ff',
    sextile: '#ffff00',
  },
};

export interface Point {
  x: number;
  y: number;
}
