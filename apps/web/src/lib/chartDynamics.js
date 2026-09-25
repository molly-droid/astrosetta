/**
 * Chart Dynamics Analyzer — identifies structural patterns in a natal chart:
 * stelliums, empty houses (with ruling planets), chart ruler placement,
 * element/modality balance, and aspect patterns (grand trines, T-squares).
 *
 * Pure computation — no LLM calls. Instant and free.
 */

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const SIGN_RULERS_MODERN = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};

const SIGN_RULERS_TRAD = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

const SIGN_ELEMENTS = {
  Aries: 'Fire', Leo: 'Fire', Sagittarius: 'Fire',
  Taurus: 'Earth', Virgo: 'Earth', Capricorn: 'Earth',
  Gemini: 'Air', Libra: 'Air', Aquarius: 'Air',
  Cancer: 'Water', Scorpio: 'Water', Pisces: 'Water',
};

const SIGN_MODALITIES = {
  Aries: 'Cardinal', Cancer: 'Cardinal', Libra: 'Cardinal', Capricorn: 'Cardinal',
  Taurus: 'Fixed', Leo: 'Fixed', Scorpio: 'Fixed', Aquarius: 'Fixed',
  Gemini: 'Mutable', Virgo: 'Mutable', Sagittarius: 'Mutable', Pisces: 'Mutable',
};

const OPPOSITE_SIGNS = {
  Aries: 'Libra', Taurus: 'Scorpio', Gemini: 'Sagittarius', Cancer: 'Capricorn',
  Leo: 'Aquarius', Virgo: 'Pisces', Libra: 'Aries', Scorpio: 'Taurus',
  Sagittarius: 'Gemini', Capricorn: 'Cancer', Aquarius: 'Leo', Pisces: 'Virgo',
};

// Planets that count toward stelliums (excludes nodes, ASC, MC, Lilith, etc.)
const STELLIUM_PLANETS = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron',
]);

const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60, quincunx: 150 };
const ASPECT_ORBS = { conjunction: 8, opposition: 8, trine: 8, square: 8, sextile: 8, quincunx: 3 };

function aspectBetween(lon1, lon2) {
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  for (const [name, angle] of Object.entries(ASPECT_ANGLES)) {
    if (Math.abs(diff - angle) <= (ASPECT_ORBS[name] || 8)) return name;
  }
  return null;
}

/**
 * Analyze a natal chart's structural dynamics.
 * @param {object} rawData - chart.raw_data (planets, houses, ascendant_sign, etc.)
 * @returns {object} { stelliums, emptyHouses, chartRuler, elementBalance, modalityBalance, aspectPatterns }
 */
export function analyzeChartDynamics(rawData) {
  if (!rawData) return null;

  const allPlanets = (rawData.planets || []).filter(p => p.sign && p.longitude != null);
  const stelliumPlanets = allPlanets.filter(p => STELLIUM_PLANETS.has(p.name));
  const houses = rawData.houses || [];
  const ascendantSign = rawData.ascendant_sign;
  const houseSystem = rawData.house_system || 'whole_sign';

  // ── Stelliums ──────────────────────────────────────────────────────────
  const stelliums = [];

  // By sign
  const bySign = {};
  for (const p of stelliumPlanets) {
    if (!bySign[p.sign]) bySign[p.sign] = [];
    bySign[p.sign].push(p);
  }
  for (const [sign, planets] of Object.entries(bySign)) {
    if (planets.length >= 3) {
      stelliums.push({ type: 'sign', sign, planets: planets.map(p => p.name) });
    }
  }

  // By house
  const byHouse = {};
  for (const p of stelliumPlanets) {
    if (!p.house) continue;
    if (!byHouse[p.house]) byHouse[p.house] = [];
    byHouse[p.house].push(p);
  }
  const houseStelliums = [];
  for (const [house, planets] of Object.entries(byHouse)) {
    if (planets.length >= 3) {
      houseStelliums.push({ type: 'house', house: parseInt(house), planets: planets.map(p => p.name) });
    }
  }

  // Dedupe: a house stellium whose planet set matches a sign stellium is the
  // same cluster (always true in whole-sign, where sign === house). Merge the
  // house number into the sign stellium and drop the redundant entry. A house
  // stellium is only kept as its own card when its planets genuinely differ
  // from any sign stellium (e.g. a Placidus cluster spanning a house cusp).
  const norm = (arr) => [...arr].sort().join(',');
  for (const hs of houseStelliums) {
    const match = stelliums.find(s => s.type === 'sign' && norm(s.planets) === norm(hs.planets));
    if (match) {
      if (match.house == null) match.house = hs.house;
    } else {
      stelliums.push(hs);
    }
  }

  // ── Stellium oppositions ──────────────────────────────────────────────
  const signStelliums = stelliums.filter(s => s.type === 'sign');
  const stelliumOppositions = [];
  for (let i = 0; i < signStelliums.length; i++) {
    for (let j = i + 1; j < signStelliums.length; j++) {
      if (OPPOSITE_SIGNS[signStelliums[i].sign] === signStelliums[j].sign) {
        stelliumOppositions.push({
          sign1: signStelliums[i].sign,
          sign2: signStelliums[j].sign,
          planets1: signStelliums[i].planets,
          planets2: signStelliums[j].planets,
        });
      }
    }
  }

  // ── Empty houses ───────────────────────────────────────────────────────
  // Determine which houses have planets, then for empty ones find the ruling planet.
  const housesWithPlanets = new Set(stelliumPlanets.filter(p => p.house).map(p => p.house));
  const emptyHouses = [];

  for (let h = 1; h <= 12; h++) {
    if (housesWithPlanets.has(h)) continue;

    // Find the sign on this house cusp
    let cuspSign = null;
    if (houseSystem === 'whole_sign' && ascendantSign) {
      const ascIdx = SIGNS.indexOf(ascendantSign);
      const signIdx = (ascIdx + h - 1) % 12;
      cuspSign = SIGNS[signIdx];
    } else {
      const houseData = houses.find(x => x.number === h);
      cuspSign = houseData?.sign;
    }

    if (!cuspSign) continue;

    const ruler = SIGN_RULERS_MODERN[cuspSign];
    const tradRuler = SIGN_RULERS_TRAD[cuspSign];
    const rulerPlanet = allPlanets.find(p => p.name === ruler);
    const tradRulerPlanet = tradRuler !== ruler ? allPlanets.find(p => p.name === tradRuler) : null;

    emptyHouses.push({
      house: h,
      cuspSign,
      ruler,
      rulerPlacement: rulerPlanet ? `${ruler} in ${rulerPlanet.sign}${rulerPlanet.house ? ` (${rulerPlanet.house}H)` : ''}` : `${ruler} — placement unknown`,
      tradRuler: tradRuler !== ruler ? tradRuler : null,
    });
  }

  // ── Chart ruler ────────────────────────────────────────────────────────
  let chartRuler = null;
  if (ascendantSign) {
    const ruler = SIGN_RULERS_MODERN[ascendantSign];
    const tradRuler = SIGN_RULERS_TRAD[ascendantSign];
    const rulerPlanet = allPlanets.find(p => p.name === ruler);
    const tradRulerPlanet = tradRuler !== ruler ? allPlanets.find(p => p.name === tradRuler) : null;
    chartRuler = {
      planet: ruler,
      sign: ascendantSign,
      placement: rulerPlanet ? `${ruler} in ${rulerPlanet.sign}${rulerPlanet.house ? ` (${rulerPlanet.house}H)` : ''}` : null,
      tradRuler: tradRuler !== ruler ? {
        planet: tradRuler,
        placement: tradRulerPlanet ? `${tradRuler} in ${tradRulerPlanet.sign}${tradRulerPlanet.house ? ` (${tradRulerPlanet.house}H)` : ''}` : null,
      } : null,
    };
  }

  // ── Element & modality balance ─────────────────────────────────────────
  const elementCount = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCount = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const p of stelliumPlanets) {
    const el = SIGN_ELEMENTS[p.sign];
    const mod = SIGN_MODALITIES[p.sign];
    if (el) elementCount[el]++;
    if (mod) modalityCount[mod]++;
  }
  const total = stelliumPlanets.length || 1;
  const elementBalance = Object.entries(elementCount)
    .map(([el, count]) => ({ element: el, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
  const modalityBalance = Object.entries(modalityCount)
    .map(([mod, count]) => ({ modality: mod, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  // ── Aspect patterns ────────────────────────────────────────────────────
  const aspectPatterns = [];
  const pls = stelliumPlanets;

  // Grand Trine: three planets all in mutual trine
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'trine') continue;
      for (let k = j + 1; k < pls.length; k++) {
        if (aspectBetween(pls[i].longitude, pls[k].longitude) === 'trine' &&
            aspectBetween(pls[j].longitude, pls[k].longitude) === 'trine') {
          aspectPatterns.push({
            type: 'Grand Trine',
            planets: [pls[i].name, pls[j].name, pls[k].name],
            element: SIGN_ELEMENTS[pls[i].sign] === SIGN_ELEMENTS[pls[j].sign] ? SIGN_ELEMENTS[pls[i].sign] : null,
          });
        }
      }
    }
  }

  // T-Square: opposition + both planets square a third
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < pls.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(pls[i].longitude, pls[k].longitude) === 'square' &&
            aspectBetween(pls[j].longitude, pls[k].longitude) === 'square') {
          // Avoid duplicates (k could match from either side)
          const key = [pls[i].name, pls[j].name, pls[k].name].sort().join('|');
          if (!aspectPatterns.some(p => p._key === key)) {
            aspectPatterns.push({
              type: 'T-Square',
              planets: [pls[i].name, pls[j].name, pls[k].name],
              apex: pls[k].name,
              _key: key,
            });
          }
        }
      }
    }
  }

  // Grand Cross: two oppositions, four planets in a square cycle
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < pls.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(pls[i].longitude, pls[k].longitude) !== 'square') continue;
        for (let l = k + 1; l < pls.length; l++) {
          if (l === i || l === j) continue;
          if (aspectBetween(pls[j].longitude, pls[l].longitude) !== 'square') continue;
          if (aspectBetween(pls[k].longitude, pls[l].longitude) === 'opposition' &&
              aspectBetween(pls[i].longitude, pls[l].longitude) === 'square' &&
              aspectBetween(pls[j].longitude, pls[k].longitude) === 'square') {
            const key = [pls[i].name, pls[j].name, pls[k].name, pls[l].name].sort().join('|');
            if (!aspectPatterns.some(p => p._key === key)) {
              aspectPatterns.push({
                type: 'Grand Cross',
                planets: [pls[i].name, pls[j].name, pls[k].name, pls[l].name],
                _key: key,
              });
            }
          }
        }
      }
    }
  }

  // Kite: a Grand Trine + a fourth planet that opposes one trine vertex and
  // sextiles the other two. The opposing planet is the focal point (apex).
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'trine') continue;
      for (let k = j + 1; k < pls.length; k++) {
        if (aspectBetween(pls[i].longitude, pls[k].longitude) !== 'trine') continue;
        if (aspectBetween(pls[j].longitude, pls[k].longitude) !== 'trine') continue;
        const trine = [pls[i], pls[j], pls[k]];
        for (let m = 0; m < pls.length; m++) {
          if (m === i || m === j || m === k) continue;
          for (let v = 0; v < 3; v++) {
            const apex = trine[v];
            const others = [trine[(v + 1) % 3], trine[(v + 2) % 3]];
            if (aspectBetween(apex.longitude, pls[m].longitude) === 'opposition' &&
                aspectBetween(others[0].longitude, pls[m].longitude) === 'sextile' &&
                aspectBetween(others[1].longitude, pls[m].longitude) === 'sextile') {
              const names = [pls[i].name, pls[j].name, pls[k].name, pls[m].name];
              const key = [...names].sort().join('|');
              if (!aspectPatterns.some(p => p._key === key)) {
                aspectPatterns.push({ type: 'Kite', planets: names, apex: pls[m].name, _key: key });
              }
            }
          }
        }
      }
    }
  }

  // Mystic Rectangle: two opposition pairs linked by trines & sextiles
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'opposition') continue;
      for (let k = 0; k < pls.length; k++) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < pls.length; l++) {
          if (l === i || l === j) continue;
          if (aspectBetween(pls[k].longitude, pls[l].longitude) !== 'opposition') continue;
          const a1 = aspectBetween(pls[i].longitude, pls[k].longitude);
          const a2 = aspectBetween(pls[i].longitude, pls[l].longitude);
          const a3 = aspectBetween(pls[j].longitude, pls[k].longitude);
          const a4 = aspectBetween(pls[j].longitude, pls[l].longitude);
          const valid = (a1 === 'trine' && a2 === 'sextile' && a3 === 'sextile' && a4 === 'trine') ||
                        (a1 === 'sextile' && a2 === 'trine' && a3 === 'trine' && a4 === 'sextile');
          if (!valid) continue;
          const names = [pls[i].name, pls[j].name, pls[k].name, pls[l].name];
          const key = [...names].sort().join('|');
          if (!aspectPatterns.some(p => p._key === key)) {
            aspectPatterns.push({ type: 'Mystic Rectangle', planets: names, _key: key });
          }
        }
      }
    }
  }

  // Yod (Finger of God): two planets sextile, both quincunx a third (the apex)
  for (let i = 0; i < pls.length; i++) {
    for (let j = i + 1; j < pls.length; j++) {
      if (aspectBetween(pls[i].longitude, pls[j].longitude) !== 'sextile') continue;
      for (let k = 0; k < pls.length; k++) {
        if (k === i || k === j) continue;
        if (aspectBetween(pls[i].longitude, pls[k].longitude) === 'quincunx' &&
            aspectBetween(pls[j].longitude, pls[k].longitude) === 'quincunx') {
          const names = [pls[i].name, pls[j].name, pls[k].name];
          const key = [...names].sort().join('|');
          if (!aspectPatterns.some(p => p._key === key)) {
            aspectPatterns.push({ type: 'Yod', planets: names, apex: pls[k].name, _key: key });
          }
        }
      }
    }
  }

  // Clean up internal keys
  aspectPatterns.forEach(p => delete p._key);

  return { stelliums, stelliumOppositions, emptyHouses, chartRuler, elementBalance, modalityBalance, aspectPatterns };
}

/**
 * Given natal chart dynamics and current transit data, determine which
 * dynamics (stelliums, oppositions, patterns, chart ruler) are being
 * activated by today's transits.
 */
export function getActivatedDynamics(dynamics, transits) {
  if (!dynamics || !transits?.natalAspects) {
    return { activatedStelliums: [], rulerActivated: false, activatedOppositions: [], activatedPatterns: [], hasActivated: false };
  }

  const isPlanetActivated = (planetName) =>
    transits.natalAspects.some(a => a.natal_planet === planetName);

  const activatedStelliums = (dynamics.stelliums || []).filter(s =>
    s.planets.some(p => isPlanetActivated(p))
  );
  const rulerActivated = !!dynamics.chartRuler && isPlanetActivated(dynamics.chartRuler.planet);
  const activatedOppositions = (dynamics.stelliumOppositions || []).filter(opp =>
    [...opp.planets1, ...opp.planets2].some(p => isPlanetActivated(p))
  );
  const activatedPatterns = (dynamics.aspectPatterns || []).filter(p =>
    p.planets.some(pl => isPlanetActivated(pl))
  );

  return {
    activatedStelliums,
    rulerActivated,
    activatedOppositions,
    activatedPatterns,
    hasActivated: activatedStelliums.length > 0 || rulerActivated ||
      activatedOppositions.length > 0 || activatedPatterns.length > 0,
  };
}

export { SIGN_RULERS_MODERN, SIGN_RULERS_TRAD, SIGN_ELEMENTS, SIGN_MODALITIES, SIGNS, OPPOSITE_SIGNS };