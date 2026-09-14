/**
 * bondVerbiage — computes the RelationshipBadge phrase + name pair for a
 * relationship read, depending on what the base chart is.
 *
 * baseChart:  null = the user's own natal chart; otherwise a SavedChart.
 * partnerChart: the other SavedChart in the pairing (may be undefined while
 *   no partner is selected — the caller only renders the badge once a partner
 *   exists, but the guard keeps this safe to call eagerly).
 * userPhrase: phrase used when the base is the user's own chart, so each page
 *   preserves its existing default copy.
 *
 * Returns { phrase, name }.
 */
export function bondVerbiage(baseChart, partnerChart, userPhrase = 'Reading your bond with') {
  if (!partnerChart) return { phrase: userPhrase, name: '' };
  if (!baseChart) {
    return { phrase: userPhrase, name: partnerChart.name };
  }
  const baseIsEvent = baseChart.chart_type === 'event';
  const partnerIsEvent = partnerChart.chart_type === 'event';
  if (baseIsEvent && partnerIsEvent) {
    return { phrase: 'Reading the astrology of', name: `${baseChart.name} & ${partnerChart.name}` };
  }
  if (baseIsEvent) {
    return { phrase: 'Reading the event chart of', name: `${baseChart.name} with ${partnerChart.name}` };
  }
  if (partnerIsEvent) {
    return { phrase: 'Reading the event chart of', name: `${partnerChart.name} with ${baseChart.name}` };
  }
  return { phrase: 'Reading the bond between', name: `${baseChart.name} & ${partnerChart.name}` };
}