// Explain only the reading visible in the current tab. Never fall back from a
// collective reading to personal placements or include paid, hidden guidance.
export function buildSynthesisExplanation(synthesis, { period = 'day', tab = 'personal', isPaid = true } = {}) {
  if (!synthesis) return '';
  const join = values => values.flat(Infinity).filter(value => typeof value === 'string' && value.trim()).join('\n');
  if (tab === 'collective') return join(period === 'month'
    ? [synthesis.collective_tags || [], synthesis.collective_theme]
    : [synthesis.collective_highlight]);
  if (period === 'week') return join([synthesis.overview, Object.values(synthesis.day_sentences || {}), synthesis.maximize, synthesis.focus, synthesis.watch]);
  if (period === 'month') return join([synthesis.overview, synthesis.personal_focus, synthesis.best_areas || [], synthesis.maximize, synthesis.focus, synthesis.watch]);
  return join([synthesis.overview, ...(isPaid ? [synthesis.dynamics_insight, synthesis.maximize, synthesis.focus, synthesis.watch] : [])]);
}
