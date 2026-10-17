/**
 * Station and ingress event filtering (B-22).
 *
 * `chart-calculator` returns three flavours of station and ingress for a
 * queried day:
 *
 *   exact        happening on that day (stations carry no flag; ingresses
 *                carry `exact: true`)
 *   approaching  will happen within the lookahead window, and carries
 *                `days_until` + `expected_date` (stations look ahead 5 days,
 *                ingresses 14)
 *   recent       ingresses only: entered the sign within the window
 *
 * Any surface that speaks for a SINGLE day — a calendar cell, a day card, or
 * the text we hand the LLM as "here is what happens today" — must render only
 * the exact ones. Treating an approaching station as a current event is what
 * printed "Mercury stations retrograde" on Oct 19 when it stations on Oct 24,
 * and tagged the 19th and 20th "Mercury ℞" while Mercury was still direct.
 * The engine was right; every one of these call sites dropped the flag.
 *
 * Surfaces that deliberately preview what is coming — TransitList's "Upcoming
 * Stations" header, the home highlight banners, StationBanner — read
 * `approaching` and `days_until` themselves and must NOT use these helpers.
 */

/** True when the event happens on the queried day, not near it. */
export function isOnDay(event) {
  return !!event && !event.approaching && !event.recent;
}

/** The subset of stations/ingresses that actually occur on the queried day. */
export function onDayOnly(events) {
  return (events || []).filter(isOnDay);
}
