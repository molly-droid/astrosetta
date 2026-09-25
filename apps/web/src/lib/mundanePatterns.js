/**
 * Mundane Pattern Detection — identifies notable collective (mundane)
 * configurations among transit planets.
 *
 * Detects four families:
 * 1. Cradles (Basket patterns) — including the Barbault's Basket
 * 2. Great Conjunctions — era-defining planetary pair conjunctions
 * 3. Outer-planet aspect patterns — Grand Trines, T-Squares, Grand Crosses
 * 4. Outer-planet stelliums
 *
 * Pure computation — no LLM calls. Instant and free.
 */

const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60, quincunx: 150 };
const ASPECT_ORBS = { conjunction: 8, opposition: 8, trine: 8, square: 8, sextile: 8, quincunx: 3 };

export function aspectBetween(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const [name, angle] of Object.entries(ASPECT_ANGLES)) {
    if (Math.abs(diff - angle) <= (ASPECT_ORBS[name] || 8)) return name;
  }
  return null;
}

export const SIGN_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
};

const SLOW_PLANETS = ['Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const SOCIAL_OUTER = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// ── 1. Cradle (Basket) Detection ────────────────────────────────────────────

function fmtPlanet(p) {
  return `${p.name} at ${p.degree?.toFixed(1)}° ${p.sign}${p.retrograde ? ' ℞' : ''}`;
}

export function aspectOrb(lon1, lon2, aspectName) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  const angle = ASPECT_ANGLES[aspectName];
  return Math.abs(diff - angle);
}

function buildCradleDescription(pi, pj, pci, pcj, isBarbault) {
  const oppOrb = aspectOrb(pi.longitude, pj.longitude, 'opposition');
  const oppAxis = `${pi.sign}–${pj.sign}`;

  // ci trines i, sextiles j; cj sextiles i, trines j
  const ciFlow = `${fmtPlanet(pci)} trines ${pi.name} and sextiles ${pj.name}`;
  const cjFlow = `${fmtPlanet(pcj)} trines ${pj.name} and sextiles ${pi.name}`;
  const oppLine = `${fmtPlanet(pi)} opposes ${fmtPlanet(pj)} (${oppOrb.toFixed(1)}° orb)`;

  const elements = [pi, pj, pci, pcj].map(p => SIGN_ELEMENTS[p.sign]);
  const elementCounts = {};
  for (const e of elements) elementCounts[e] = (elementCounts[e] || 0) + 1;
  const dominantElement = Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0];
  const elementLine = dominantElement && dominantElement[1] >= 3
    ? ` All four planets are in ${dominantElement[0]} signs, giving this cradle a deeply ${dominantElement[0].toLowerCase()} character — ${dominantElement[0] === 'Fire' ? 'action-oriented and inspirational' : dominantElement[0] === 'Earth' ? 'practical and material' : dominantElement[0] === 'Air' ? 'intellectual and social' : 'emotional and intuitive'}.`
    : ` The ${pi.sign}/${pj.sign} opposition axis creates tension between ${SIGN_ELEMENTS[pi.sign] === SIGN_ELEMENTS[pj.sign] ? 'different expressions of the same element' : `${SIGN_ELEMENTS[pi.sign]} and ${SIGN_ELEMENTS[pj.sign]}`}, while ${pci.sign} and ${pcj.sign} bridge the divide through ${SIGN_ELEMENTS[pci.sign]} and ${SIGN_ELEMENTS[pcj.sign]} modalities.`;

  const barbaultIntro = isBarbault
    ? "A rare outer-planet cradle named after André Barbault (1917–2013), the French mundane astrologer who studied planetary cycles and civilizational shifts. Barbault predicted this configuration would mark a major turning point for civilization. "
    : '';

  return `${barbaultIntro}A cradle (or basket) pattern formed by four planets: ${oppLine}. The opposition creates a productive polarity along the ${oppAxis} axis. Two supporting planets cradle this tension with harmonious flow — ${ciFlow}, while ${cjFlow}. Together they form a bridge of trines and sextiles around the central opposition, channeling the tension into creative output rather than deadlock.${elementLine}`;
}

function detectCradles(planets) {
  const cradles = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      if (aspectBetween(planets[i].longitude, planets[j].longitude) !== 'opposition') continue;
      const sideI = [], sideJ = [];
      for (let k = 0; k < planets.length; k++) {
        if (k === i || k === j) continue;
        const ai = aspectBetween(planets[i].longitude, planets[k].longitude);
        const aj = aspectBetween(planets[j].longitude, planets[k].longitude);
        if (ai === 'trine' && aj === 'sextile') sideI.push(k);
        if (ai === 'sextile' && aj === 'trine') sideJ.push(k);
      }
      for (const ci of sideI) {
        for (const cj of sideJ) {
          if (ci === cj) continue;
          const names = [planets[i].name, planets[j].name, planets[ci].name, planets[cj].name];
          // Only show cradles with 4+ distinct planets
          if (new Set(names).size < 4) continue;
          const key = [...names].sort().join('|');
          if (cradles.some(c => c._key === key)) continue;
          const allOuter = names.every(n => SLOW_PLANETS.includes(n) || n === 'Jupiter');
          const isBarbault = allOuter && names.includes('Jupiter') && names.includes('Pluto');

          const pi = planets[i], pj = planets[j], pci = planets[ci], pcj = planets[cj];
          const planetDetails = [pi, pj, pci, pcj].map(p => ({
            name: p.name, sign: p.sign, degree: p.degree, retrograde: p.retrograde,
          }));
          const aspects = [
            { planet1: pi.name, planet2: pj.name, aspect: 'opposition', orb: aspectOrb(pi.longitude, pj.longitude, 'opposition') },
            { planet1: pci.name, planet2: pi.name, aspect: 'trine', orb: aspectOrb(pci.longitude, pi.longitude, 'trine') },
            { planet1: pci.name, planet2: pj.name, aspect: 'sextile', orb: aspectOrb(pci.longitude, pj.longitude, 'sextile') },
            { planet1: pcj.name, planet2: pj.name, aspect: 'trine', orb: aspectOrb(pcj.longitude, pj.longitude, 'trine') },
            { planet1: pcj.name, planet2: pi.name, aspect: 'sextile', orb: aspectOrb(pcj.longitude, pi.longitude, 'sextile') },
          ];

          cradles.push({
            type: isBarbault ? "Barbault's Basket" : 'Cradle',
            category: 'cradle',
            planets: names,
            opposition: [pi.name, pj.name],
            planetDetails,
            aspects,
            description: buildCradleDescription(pi, pj, pci, pcj, isBarbault),
            isBarbault,
            _key: key,
          });
        }
      }
    }
  }
  cradles.forEach(c => delete c._key);
  return cradles;
}

// ── 2. Great Conjunctions ───────────────────────────────────────────────────

const CONJUNCTION_PAIRS = [
  {
    planets: ['Jupiter', 'Saturn'],
    label: 'Grand Conjunction',
    cycle: '~20 years',
    description: 'The Jupiter-Saturn Grand Conjunction — the most studied alignment in mundane astrology, tracked since Babylonian times as the "great chronocrators." Occurring roughly every 20 years, it marks the start of a new socio-economic cycle. Every ~200 years the conjunctions shift element (a "Great Mutation"), inaugurating a new era. The 2020 conjunction in Aquarius began the Air era after 200 years of Earth.',
  },
  {
    planets: ['Saturn', 'Pluto'],
    label: 'Saturn-Pluto Conjunction',
    cycle: '~34 years',
    description: 'The Saturn-Pluto conjunction occurs approximately every 34 years, marking periods of deep structural transformation, confrontation with entrenched power, and the dismantling of old orders. Historically associated with major political and economic restructuring.',
  },
  {
    planets: ['Jupiter', 'Pluto'],
    label: 'Jupiter-Pluto Conjunction',
    cycle: '~13 years',
    description: 'The Jupiter-Pluto conjunction occurs approximately every 13 years, signaling periods of intense transformation, financial power shifts, and the exposure of hidden dynamics. Often associated with collective crises that catalyze renewal and reform.',
  },
  {
    planets: ['Saturn', 'Neptune'],
    label: 'Saturn-Neptune Conjunction',
    cycle: '~36 years',
    description: 'The Saturn-Neptune conjunction occurs roughly every 36 years, dissolving old structures and blurring boundaries between reality and idealism. Periods of collective disillusionment, spiritual questioning, and the restructuring of both institutions and dreams.',
  },
  {
    planets: ['Saturn', 'Uranus'],
    label: 'Saturn-Uranus Conjunction',
    cycle: '~45 years',
    description: 'The Saturn-Uranus conjunction occurs approximately every 45 years, representing the collision of established order (Saturn) with revolutionary change (Uranus). Periods of social upheaval, technological disruption, and the tension between tradition and innovation.',
  },
  {
    planets: ['Uranus', 'Neptune'],
    label: 'Uranus-Neptune Conjunction',
    cycle: '~172 years',
    description: 'The Uranus-Neptune conjunction occurs approximately every 172 years and marks the dawn of entirely new cultural paradigms — shifts in consciousness, technology, and collective ideals that reshape civilization for generations.',
  },
  {
    planets: ['Jupiter', 'Neptune'],
    label: 'Jupiter-Neptune Conjunction',
    cycle: '~13 years',
    description: 'The Jupiter-Neptune conjunction occurs approximately every 13 years, amplifying collective idealism, spiritual movements, and cultural imagination. Periods of expanded vision that can inspire or delude, depending on the grounding.',
  },
  {
    planets: ['Jupiter', 'Uranus'],
    label: 'Jupiter-Uranus Conjunction',
    cycle: '~14 years',
    description: 'The Jupiter-Uranus conjunction occurs approximately every 14 years, sparking innovation, breakthroughs, and sudden opportunities. Periods of technological advancement and collective optimism about the future.',
  },
];

function detectGreatConjunctions(planets) {
  const results = [];
  for (const pair of CONJUNCTION_PAIRS) {
    const p1 = planets.find(p => p.name === pair.planets[0]);
    const p2 = planets.find(p => p.name === pair.planets[1]);
    if (!p1 || !p2) continue;
    if (aspectBetween(p1.longitude, p2.longitude) !== 'conjunction') continue;
    const sameSign = p1.sign === p2.sign;
    results.push({
      type: pair.label,
      category: 'conjunction',
      planets: pair.planets,
      sign: sameSign ? p1.sign : `${p1.sign} / ${p2.sign}`,
      element: sameSign ? SIGN_ELEMENTS[p1.sign] : null,
      cycle: pair.cycle,
      description: pair.description,
    });
  }
  return results;
}

// ── 3. Outer-Planet Aspect Patterns ──────────────────────────────────────────

function detectOuterPlanetPatterns(planets) {
  const slow = planets.filter(p => SLOW_PLANETS.includes(p.name));
  if (slow.length < 3) return [];
  const patterns = [];

  // Grand Trine: three slow planets all in mutual trine
  for (let i = 0; i < slow.length; i++) {
    for (let j = i + 1; j < slow.length; j++) {
      if (aspectBetween(slow[i].longitude, slow[j].longitude) !== 'trine') continue;
      for (let k = j + 1; k < slow.length; k++) {
        if (aspectBetween(slow[i].longitude, slow[k].longitude) === 'trine' &&
            aspectBetween(slow[j].longitude, slow[k].longitude) === 'trine') {
          const names = [slow[i].name, slow[j].name, slow[k].name];
          const key = [...names].sort().join('|');
          if (!patterns.some(p => p._key === key)) {
            patterns.push({
              type: 'Outer-Planet Grand Trine',
              category: 'pattern',
              planets: names,
              element: SIGN_ELEMENTS[slow[i].sign] === SIGN_ELEMENTS[slow[j].sign] ? SIGN_ELEMENTS[slow[i].sign] : null,
              description: 'A rare Grand Trine among the slow outer planets — a prolonged period of harmonious collective flow. Unlike personal grand trines, a mundane grand trine marks an era of unusual stability, though it can also indicate collective complacency if the ease is not actively used.',
              _key: key,
            });
          }
        }
      }
    }
  }

  // T-Square: two slow planets in opposition, both squaring a third
  for (let i = 0; i < slow.length; i++) {
    for (let j = i + 1; j < slow.length; j++) {
      if (aspectBetween(slow[i].longitude, slow[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < slow.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(slow[i].longitude, slow[k].longitude) === 'square' &&
            aspectBetween(slow[j].longitude, slow[k].longitude) === 'square') {
          const names = [slow[i].name, slow[j].name, slow[k].name];
          const key = [...names].sort().join('|');
          if (!patterns.some(p => p._key === key)) {
            patterns.push({
              type: 'Outer-Planet T-Square',
              category: 'pattern',
              planets: names,
              apex: slow[k].name,
              description: 'A T-Square among the slow outer planets — a prolonged era of collective tension and crisis. The opposition creates polarization while the apex planet bears the pressure. Historically, mundane T-Squares mark periods of sustained social conflict, economic pressure, and the need for structural reform.',
              _key: key,
            });
          }
        }
      }
    }
  }

  // Grand Cross: four slow planets in two oppositions + four squares
  for (let i = 0; i < slow.length; i++) {
    for (let j = i + 1; j < slow.length; j++) {
      if (aspectBetween(slow[i].longitude, slow[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < slow.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(slow[i].longitude, slow[k].longitude) !== 'square') continue;
        for (let l = k + 1; l < slow.length; l++) {
          if (l === i || l === j) continue;
          if (aspectBetween(slow[j].longitude, slow[l].longitude) !== 'square') continue;
          if (aspectBetween(slow[k].longitude, slow[l].longitude) === 'opposition' &&
              aspectBetween(slow[i].longitude, slow[l].longitude) === 'square' &&
              aspectBetween(slow[j].longitude, slow[k].longitude) === 'square') {
            const names = [slow[i].name, slow[j].name, slow[k].name, slow[l].name];
            const key = [...names].sort().join('|');
            if (!patterns.some(p => p._key === key)) {
              patterns.push({
                type: 'Outer-Planet Grand Cross',
                category: 'pattern',
                planets: names,
                description: 'A Grand Cross among the slow outer planets — one of the rarest and most intense mundane configurations. Four planets locked in mutual tension create a crucible of collective transformation. Periods marked by simultaneous crises on multiple fronts, demanding comprehensive restructuring.',
                _key: key,
              });
            }
          }
        }
      }
    }
  }

  patterns.forEach(p => delete p._key);
  return patterns;
}

// ── 4. Outer-Planet Stelliums & Elemental Clusters ──────────────────────────

function detectStelliums(planets) {
  const slow = planets.filter(p => SOCIAL_OUTER.includes(p.name));
  if (slow.length < 3) return [];
  const results = [];

  // Sign stellium: 3+ outer/social planets in the same sign
  const bySign = {};
  for (const p of slow) {
    if (!bySign[p.sign]) bySign[p.sign] = [];
    bySign[p.sign].push(p);
  }
  for (const [sign, ps] of Object.entries(bySign)) {
    if (ps.length >= 3) {
      results.push({
        type: 'Mundane Stellium',
        category: 'stellium',
        planets: ps.map(p => p.name),
        sign,
        element: SIGN_ELEMENTS[sign],
        description: `A rare mundane stellium — ${ps.length} outer planets concentrated in ${sign} (${SIGN_ELEMENTS[sign]}). This concentrates collective energy into one archetypal theme for an extended period, making this sign's qualities dominant in the cultural zeitgeist.`,
      });
    }
  }

  return results;
}

// ── 5. Advanced Aspect Patterns (Kite, Mystic Rectangle, Yod) ───────────────

function planetDetailsOf(all, names) {
  return names.map(n => {
    const p = all.find(x => x.name === n);
    return { name: p.name, sign: p.sign, degree: p.degree, retrograde: p.retrograde };
  });
}

function detectAdvancedPatterns(planets) {
  const social = planets.filter(p => SOCIAL_OUTER.includes(p.name));
  if (social.length < 3) return [];
  const results = [];

  // Kite: a Grand Trine + a 4th planet opposing one vertex, sextiling the other two
  for (let i = 0; i < social.length; i++) {
    for (let j = i + 1; j < social.length; j++) {
      if (aspectBetween(social[i].longitude, social[j].longitude) !== 'trine') continue;
      for (let k = j + 1; k < social.length; k++) {
        if (aspectBetween(social[i].longitude, social[k].longitude) !== 'trine') continue;
        if (aspectBetween(social[j].longitude, social[k].longitude) !== 'trine') continue;
        const trine = [social[i], social[j], social[k]];
        for (let m = 0; m < social.length; m++) {
          if (m === i || m === j || m === k) continue;
          for (let v = 0; v < 3; v++) {
            const apex = trine[v];
            const others = [trine[(v + 1) % 3], trine[(v + 2) % 3]];
            if (aspectBetween(apex.longitude, social[m].longitude) === 'opposition' &&
                aspectBetween(others[0].longitude, social[m].longitude) === 'sextile' &&
                aspectBetween(others[1].longitude, social[m].longitude) === 'sextile') {
              const names = [social[i].name, social[j].name, social[k].name, social[m].name];
              const key = [...names].sort().join('|');
              if (results.some(r => r._key === key)) continue;
              results.push({
                type: 'Kite',
                category: 'pattern',
                planets: names,
                apex: social[m].name,
                planetDetails: planetDetailsOf(social, names),
                aspects: [
                  { planet1: social[i].name, planet2: social[j].name, aspect: 'trine', orb: aspectOrb(social[i].longitude, social[j].longitude, 'trine') },
                  { planet1: social[i].name, planet2: social[k].name, aspect: 'trine', orb: aspectOrb(social[i].longitude, social[k].longitude, 'trine') },
                  { planet1: social[j].name, planet2: social[k].name, aspect: 'trine', orb: aspectOrb(social[j].longitude, social[k].longitude, 'trine') },
                  { planet1: apex.name, planet2: social[m].name, aspect: 'opposition', orb: aspectOrb(apex.longitude, social[m].longitude, 'opposition') },
                  { planet1: others[0].name, planet2: social[m].name, aspect: 'sextile', orb: aspectOrb(others[0].longitude, social[m].longitude, 'sextile') },
                  { planet1: others[1].name, planet2: social[m].name, aspect: 'sextile', orb: aspectOrb(others[1].longitude, social[m].longitude, 'sextile') },
                ],
                description: "A Kite formation — a Grand Trine (three planets in harmonious 120° triangles) anchored by a fourth planet that opposes one vertex and sextiles the other two. The opposition gives the trine's easy energy a direction and a release valve. In mundane astrology, a collective Kite marks an era when latent potential crystallizes into directed action — the focal planet becomes the pivot around which cultural energy organizes, turning effortless flow into purposeful momentum.",
                _key: key,
              });
            }
          }
        }
      }
    }
  }

  // Mystic Rectangle: two opposition pairs linked by trines & sextiles
  for (let i = 0; i < social.length; i++) {
    for (let j = i + 1; j < social.length; j++) {
      if (aspectBetween(social[i].longitude, social[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < social.length; k++) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < social.length; l++) {
          if (l === i || l === j) continue;
          if (aspectBetween(social[k].longitude, social[l].longitude) !== 'opposition') continue;
          const a1 = aspectBetween(social[i].longitude, social[k].longitude);
          const a2 = aspectBetween(social[i].longitude, social[l].longitude);
          const a3 = aspectBetween(social[j].longitude, social[k].longitude);
          const a4 = aspectBetween(social[j].longitude, social[l].longitude);
          let trinePairs, sextilePairs;
          if (a1 === 'trine' && a2 === 'sextile' && a3 === 'sextile' && a4 === 'trine') {
            trinePairs = [[i, k], [j, l]];
            sextilePairs = [[i, l], [j, k]];
          } else if (a1 === 'sextile' && a2 === 'trine' && a3 === 'trine' && a4 === 'sextile') {
            trinePairs = [[i, l], [j, k]];
            sextilePairs = [[i, k], [j, l]];
          } else continue;
          const names = [social[i].name, social[j].name, social[k].name, social[l].name];
          const key = [...names].sort().join('|');
          if (results.some(r => r._key === key)) continue;
          const oppPairs = [[i, j], [k, l]];
          const aspects = [
            ...oppPairs.map(([x, y]) => ({ planet1: social[x].name, planet2: social[y].name, aspect: 'opposition', orb: aspectOrb(social[x].longitude, social[y].longitude, 'opposition') })),
            ...trinePairs.map(([x, y]) => ({ planet1: social[x].name, planet2: social[y].name, aspect: 'trine', orb: aspectOrb(social[x].longitude, social[y].longitude, 'trine') })),
            ...sextilePairs.map(([x, y]) => ({ planet1: social[x].name, planet2: social[y].name, aspect: 'sextile', orb: aspectOrb(social[x].longitude, social[y].longitude, 'sextile') })),
          ];
          results.push({
            type: 'Mystic Rectangle',
            category: 'pattern',
            planets: names,
            planetDetails: planetDetailsOf(social, names),
            aspects,
            description: "A Mystic Rectangle — two pairs of opposing planets linked by trines and sextiles into a closed rectangle. The oppositions create productive tension along two axes, while the harmonious trines and sextiles provide channels for resolution. A rare configuration of contained tension and structured flow, signaling periods when competing collective forces can find balance through negotiation and integration rather than crisis.",
            _key: key,
          });
        }
      }
    }
  }

  // Yod (Finger of God): two planets sextile, both quincunx a third (the apex)
  for (let i = 0; i < social.length; i++) {
    for (let j = i + 1; j < social.length; j++) {
      if (aspectBetween(social[i].longitude, social[j].longitude) !== 'sextile') continue;
      for (let k = 0; k < social.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(social[i].longitude, social[k].longitude) === 'quincunx' &&
            aspectBetween(social[j].longitude, social[k].longitude) === 'quincunx') {
          const names = [social[i].name, social[j].name, social[k].name];
          const key = [...names].sort().join('|');
          if (results.some(r => r._key === key)) continue;
          results.push({
            type: 'Yod',
            category: 'pattern',
            planets: names,
            apex: social[k].name,
            planetDetails: planetDetailsOf(social, names),
            aspects: [
              { planet1: social[i].name, planet2: social[j].name, aspect: 'sextile', orb: aspectOrb(social[i].longitude, social[j].longitude, 'sextile') },
              { planet1: social[i].name, planet2: social[k].name, aspect: 'quincunx', orb: aspectOrb(social[i].longitude, social[k].longitude, 'quincunx') },
              { planet1: social[j].name, planet2: social[k].name, aspect: 'quincunx', orb: aspectOrb(social[j].longitude, social[k].longitude, 'quincunx') },
            ],
            description: "A Yod, or 'Finger of God' — two planets in sextile, both quincunx (150°) a third, the apex. The apex planet becomes a focal point of unavoidable adjustment, a collective destiny point. Historically associated with turning points where a civilization must make a fateful recalibration — the energy of the sextile is funneled into the apex, demanding the integration of forces that speak different languages.",
            _key: key,
          });
        }
      }
    }
  }

  results.forEach(r => delete r._key);
  return results;
}

// ── Aggregate ────────────────────────────────────────────────────────────────

/**
 * Detect all notable mundane (collective) patterns among transit planets.
 * @param {Array} transitPlanets — Array of { name, sign, longitude, ... }
 * @returns {Array} Detected patterns across all four families.
 */
export function getMundanePatterns(transitPlanets) {
  if (!transitPlanets?.length) return [];
  const planets = transitPlanets.filter(p => p.longitude != null && p.sign);
  if (planets.length < 2) return [];
  return [
    ...detectCradles(planets),
    ...detectGreatConjunctions(planets),
    ...detectOuterPlanetPatterns(planets),
    ...detectStelliums(planets),
    ...detectAdvancedPatterns(planets),
  ];
}

/**
 * Filter mundane patterns to only those significant enough for ritual planning.
 * A formation is "significant" if any of its transit planets is also making
 * a personal (natal) transit aspect — i.e. the collective energy is personally
 * activated for the user.
 * @param {Array} transitPlanets
 * @param {Array} natalAspects — personal transit-to-natal aspects from useTransits
 * @returns {Array} Filtered patterns
 */
export function getSignificantMundanePatterns(transitPlanets, natalAspects) {
  const all = getMundanePatterns(transitPlanets);
  if (!natalAspects?.length) return [];
  const personalPlanets = new Set();
  for (const a of natalAspects) {
    if (a.transit_planet) personalPlanets.add(a.transit_planet);
    if (a.natal_planet) personalPlanets.add(a.natal_planet);
  }
  return all.filter(p => p.planets.some(name => personalPlanets.has(name)));
}