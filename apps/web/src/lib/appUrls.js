import { isNativePlatform } from './platform';

// Native WebView origins are not public URLs. Email and portal links must
// always return to the deployed web application on installed apps.
export function publicAppOrigin() {
  const configured = import.meta.env.VITE_APP_URL;
  if (configured) return new URL(configured).origin;
  return isNativePlatform() ? 'https://astrosetta.com' : window.location.origin;
}

export async function openExternalUrl(url) {
  if (isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.location.assign(url);
  }
}

export function subscriptionManagementUrl(source) {
  if (source === 'apple') return 'https://apps.apple.com/account/subscriptions';
  if (source === 'google') return 'https://play.google.com/store/account/subscriptions';
  return null;
}
