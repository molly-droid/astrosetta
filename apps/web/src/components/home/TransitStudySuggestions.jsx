import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Map planet names to their placement key prefixes
const PLANET_KEY_PREFIX = {
  Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus',
  Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn',
  Uranus: 'uranus', Neptune: 'neptune', Pluto: 'pluto',
  Chiron: 'chiron',
};

// Map signs to their Learning section subject_key
const SIGN_KEY = {
  Aries: 'aries', Taurus: 'taurus', Gemini: 'gemini', Cancer: 'cancer',
  Leo: 'leo', Virgo: 'virgo', Libra: 'libra', Scorpio: 'scorpio',
  Sagittarius: 'sagittarius', Capricorn: 'capricorn', Aquarius: 'aquarius', Pisces: 'pisces',
};

const ASPECT_DISPLAY = {
  conjunction: 'conjunct', opposition: 'opposing', trine: 'trining',
  square: 'squaring', sextile: 'sextiling', quincunx: 'quincunx',
};

/**
 * Derives a prioritised list of placement keys to study today based on active transits.
 * Intersects with the user's own chart placement_keys so we only suggest what they have.
 */
function deriveRelevantKeys(transits, chartPlacementKeys) {
  if (!transits || !chartPlacementKeys?.length) return [];

  const chartSet = new Set(chartPlacementKeys);
  const candidates = new Map(); // key -> reason string

  const addCandidate = (key, reason) => {
    if (chartSet.has(key) && !candidates.has(key)) {
      candidates.set(key, reason);
    }
  };

  // From natal aspects (slow planet transiting natal planet in a sign/house)
  for (const a of (transits.natalAspects || [])) {
    const transitPrefix = PLANET_KEY_PREFIX[a.transit_planet];
    const natalPrefix = PLANET_KEY_PREFIX[a.natal_planet];

    // The natal planet being activated is most relevant
    if (natalPrefix) {
      // find the user's natal planet+sign key (e.g. mars_scorpio)
      const natalKey = chartPlacementKeys.find(k => k.startsWith(natalPrefix + '_') && !k.includes('h'));
      if (natalKey) addCandidate(natalKey, `${a.transit_planet} ${ASPECT_DISPLAY[a.aspect] || a.aspect} your natal ${a.natal_planet}`);
      // house key
      const houseKey = chartPlacementKeys.find(k => k.startsWith(natalPrefix + '_') && k.includes('h'));
      if (houseKey) addCandidate(houseKey, `${a.natal_planet}'s house is activated today`);
    }
    // Transiting planet itself
    if (transitPrefix) {
      const tKey = chartPlacementKeys.find(k => k.startsWith(transitPrefix + '_') && !k.includes('h'));
      if (tKey) addCandidate(tKey, `${a.transit_planet} is ${ASPECT_DISPLAY[a.aspect] || a.aspect} active today`);
    }
  }

  // From moon transits — highlight the natal planet the Moon is touching
  for (const a of (transits.lunarAspects || [])) {
    const natalPrefix = PLANET_KEY_PREFIX[a.natal_planet];
    if (natalPrefix) {
      const natalKey = chartPlacementKeys.find(k => k.startsWith(natalPrefix + '_') && !k.includes('h'));
      if (natalKey) addCandidate(natalKey, `Moon ${ASPECT_DISPLAY[a.aspect] || a.aspect} your natal ${a.natal_planet} — emotional layer active`);
    }
  }

  // Moon sign itself — always relevant
  if (transits.moonSign) {
    const signKey = SIGN_KEY[transits.moonSign];
    if (signKey) {
      const moonSignKey = chartPlacementKeys.find(k => k === `moon_${signKey}`);
      if (moonSignKey) addCandidate(moonSignKey, `Moon is currently in ${transits.moonSign}`);
    }
  }

  return Array.from(candidates.entries()).slice(0, 3); // max 3 suggestions
}

function formatKey(key) {
  return key
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/(\d+) H$/, 'House $1')
    .replace(/ H$/, '');
}

// Derive which section of Learn a placement key maps to
function getSectionForKey(key) {
  if (key.includes('_h') || /house/.test(key)) return 'houses';
  const planet = key.split('_')[0];
  if (Object.values(PLANET_KEY_PREFIX).includes(planet)) return 'planets';
  if (Object.values(SIGN_KEY).includes(planet)) return 'signs';
  return 'planets';
}

// Derive a subject_key for the LearningModule from a placement key (e.g. mars_scorpio -> mars)
function getSubjectKeyForPlacementKey(key) {
  return key.split('_')[0];
}

export default function TransitStudySuggestions({ transits, chartPlacementKeys, onSelectKey }) {
  const navigate = useNavigate();
  const suggestions = useMemo(
    () => deriveRelevantKeys(transits, chartPlacementKeys),
    [transits, chartPlacementKeys]
  );

  if (!suggestions.length) return null;

  const handleClick = (key) => {
    // Try jumping within the study queue first
    if (onSelectKey) onSelectKey(key);
    // Also navigate to Learn with the relevant module open
    const section = getSectionForKey(key);
    const subjectKey = getSubjectKeyForPlacementKey(key);
    navigate('/learn', { state: { section, subjectKey } });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles size={12} className="text-gold-accent" />
        <p className="font-body text-[10px] uppercase tracking-widest text-brass">Suggested by today's sky</p>
      </div>
      <div className="space-y-1.5">
        {suggestions.map(([key, reason]) => (
          <button
            key={key}
            onClick={() => handleClick(key)}
            className="w-full flex items-start gap-2 py-2 px-3 bg-paper/60 border border-gold-primary/20 rounded-lg text-left hover:border-gold-accent/40 hover:bg-gold-primary/5 transition-all"
          >
            <span className="text-gold-accent/60 text-xs mt-0.5">✦</span>
            <div>
              <p className="font-body text-xs text-deep-blue font-semibold capitalize">{formatKey(key)}</p>
              <p className="font-body text-[10px] text-brass/70 italic">{reason}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}