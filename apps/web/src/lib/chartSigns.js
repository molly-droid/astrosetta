export function chartSigns(chart) {
  const raw = chart?.raw_data || {};
  const planets = Array.isArray(raw.planets) ? raw.planets : [];
  const planetSign = name => planets.find(p => p.name === name || p.planet === name)?.sign;
  return {
    sun: raw.sun_sign || chart?.sun_sign || planetSign('Sun') || null,
    moon: raw.moon_sign || chart?.moon_sign || planetSign('Moon') || null,
    rising: raw.unknown_time || chart?.unknown_time ? null
      : raw.ascendant_sign || raw.angles?.ascendant?.sign || chart?.ascendant_sign || null,
  };
}
