import { base44 } from '@/api/base44Client';
import { getTradition } from './traditions';

export function resolveChartSettings(progress, natalChart) {
  const raw = natalChart?.raw_data || {};
  const tradition = progress?.active_tradition || raw.tradition || 'modern';
  return {
    tradition,
    house_system: progress?.house_system || raw.house_system || getTradition(tradition).houseSystem,
  };
}

export function savedChartMatchesSettings(chart, settings) {
  const raw = chart?.raw_data || {};
  return raw.house_system === settings.house_system
    && (raw.tradition || 'modern') === settings.tradition;
}

// Keep unknown-time charts free of estimated houses and angles, including
// when an old saved chart is recalculated after a preference change.
export function savedChartCalculationData(data, unknownTime) {
  if (data?.error || !Array.isArray(data?.planets)) {
    throw new Error(data?.error || 'The saved chart could not be calculated.');
  }
  const raw = unknownTime ? {
    ...data, unknown_time: true, houses: [], angles: {}, ascendant_sign: '',
    planets: data.planets.map(p => ({ ...p, house: null })),
    nodes: Object.fromEntries(Object.entries(data.nodes || {}).map(([key, node]) => [key, { ...node, house: null }])),
  } : { ...data, unknown_time: false };
  return {
    raw_data: raw,
    sun_sign: raw.planets.find(p => p.name === 'Sun')?.sign || '',
    moon_sign: raw.planets.find(p => p.name === 'Moon')?.sign || '',
    ascendant_sign: unknownTime ? '' : (raw.angles?.ascendant?.sign || ''),
  };
}

const inFlight = new Map();

export async function ensureSavedChartSettings(chart, settings) {
  if (savedChartMatchesSettings(chart, settings)) return chart;
  const raw = chart.raw_data || {};
  const input = {
    chart_type: 'natal',
    birth_date: chart.birth_date || raw.birth_date,
    birth_time: chart.birth_time || raw.birth_time || '12:00:00',
    birth_location: chart.birth_location || raw.birth_location,
    utc_offset: chart.utc_offset ?? raw.utc_offset ?? 0,
    unknown_time: !!raw.unknown_time || !(chart.birth_time || raw.birth_time),
    ...settings,
  };
  if (!input.birth_date || input.birth_location?.latitude == null) {
    throw new Error(`Missing birth data for ${chart.name || 'a saved chart'}.`);
  }
  const key = JSON.stringify([chart.id, input]);
  if (!inFlight.has(key)) {
    const work = (async () => {
      const { data } = await base44.functions.invoke('chartCalculator', input);
      const patch = savedChartCalculationData(data, input.unknown_time);
      const updated = await base44.entities.SavedChart.update(chart.id, patch);
      return { ...chart, ...updated, ...patch };
    })();
    inFlight.set(key, work);
  }
  try {
    return await inFlight.get(key);
  } finally {
    inFlight.delete(key);
  }
}

export async function loadSavedChartsWithSettings(userId, settings) {
  const charts = await base44.entities.SavedChart.filter({ created_by_id: userId }, '-created_date', 50);
  const result = [];
  // Bound one-time repairs so legacy accounts cannot flood the calculator.
  for (let offset = 0; offset < charts.length; offset += 3) {
    result.push(...await Promise.all(charts.slice(offset, offset + 3).map(chart => ensureSavedChartSettings(chart, settings))));
  }
  return result;
}
