/**
 * Shared email utility helpers used by the onboarding recap and daily digest.
 * Keep these framework-agnostic and side-effect-free.
 */

/** Append ordinal suffix to a number: 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number | null | undefined): string {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}