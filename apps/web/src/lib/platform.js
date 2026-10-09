/**
 * Platform detection utilities for IAP routing.
 * Detects whether the app is running on iOS, Android, or web.
 */

/** Returns 'ios' | 'android' | 'web' */
export function getPlatform() {
  // Prefer the Capacitor native bridge — the strictly-correct "is this the
  // installed app" signal — over UA sniffing when available.
  if (typeof window !== 'undefined' && window.Capacitor?.getPlatform) {
    const p = window.Capacitor.getPlatform();
    if (p === 'ios' || p === 'android') return p;
    if (p === 'web') return 'web';
  }

  // A mobile browser/PWA is still web: it must use Stripe, not a native SDK.
  return 'web';
}

export function isNativePlatform() {
  return getPlatform() !== 'web';
}

export function isCapacitor() {
  return isNativePlatform();
}

export const PLATFORM = getPlatform();
