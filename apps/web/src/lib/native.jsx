/**
 * Native (Capacitor) runtime wiring — no-ops entirely on the web build.
 *
 * initNative(): status bar styling + splash-screen hide, called once from
 * main.jsx after React mounts.
 *
 * <NativeBridge />: mounted inside the Router. Handles:
 *  - Android hardware back: history back, or minimize the app at a root route
 *  - Deep links (astrosetta:// scheme, and later https://astrosetta.com app
 *    links): routes the path into React Router, and completes Supabase auth
 *    callbacks (OAuth ?code= or implicit #access_token=) arriving via the
 *    scheme — see docs/MOBILE.md for the provider-side redirect setup.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isCapacitor } from '@/lib/platform';
import { supabase } from '@/api/shim/supabase.js';

// Routes where Android back should minimize instead of popping history.
const ROOT_ROUTES = new Set(['/', '/home', '/login']);

// Light-background routes (AuthLayout pages) need dark status-bar text;
// everything else is dark navy and needs light text.
const LIGHT_ROUTES = new Set(['/login', '/delete-account']);

async function syncStatusBarToRoute(pathname) {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const light = LIGHT_ROUTES.has(pathname);
    await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: light ? '#faf7f2' : '#0f1a2e' }).catch(() => {}); // Android only
  } catch { /* plugin missing (web) */ }
}

export async function initNative() {
  if (!isCapacitor()) return;
  // CSS hooks for native-only tweaks: html.native / html.native-ios / html.native-android
  try {
    const platform = window.Capacitor.getPlatform();
    document.documentElement.classList.add('native', `native-${platform}`);
  } catch { /* non-fatal */ }
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Dark navy chrome behind light content, matching the app background.
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0f1a2e' }).catch(() => {}); // Android only
  } catch { /* plugin missing (web) */ }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    // launchAutoHide is false in capacitor.config.ts — hide once React owns
    // the screen so there's no white flash between splash and first paint.
    await SplashScreen.hide();
  } catch { /* plugin missing (web) */ }
}

/** Turn a deep-link URL into an in-app path: astrosetta://planner?x=1 -> /planner?x=1 */
function deepLinkToPath(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'astrosetta:') {
      // Custom scheme: the "host" is really the first path segment.
      const path = `/${u.host}${u.pathname}`.replace(/\/+$/, '') || '/';
      return `${path}${u.search}`;
    }
    return `${u.pathname}${u.search}`; // https app link
  } catch {
    return null;
  }
}

/** Complete a Supabase auth callback delivered via deep link, if present. */
async function completeAuthCallback(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const code = u.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return !error;
    }
    // Implicit-flow tokens arrive in the fragment.
    const hash = new URLSearchParams((u.hash || '').replace(/^#/, ''));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      return !error;
    }
  } catch { /* not an auth link */ }
  return false;
}

export default function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  // Status-bar contrast follows the page theme (light auth pages vs dark app).
  useEffect(() => {
    if (!isCapacitor()) return;
    syncStatusBarToRoute(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCapacitor()) return;
    let handles = [];
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import('@capacitor/app');

        const back = await App.addListener('backButton', ({ canGoBack }) => {
          if (ROOT_ROUTES.has(window.location.pathname) || !canGoBack) {
            App.minimizeApp();
          } else {
            window.history.back();
          }
        });

        const open = await App.addListener('appUrlOpen', async ({ url }) => {
          const authed = await completeAuthCallback(url);
          const path = deepLinkToPath(url);
          if (authed) {
            navigate('/home', { replace: true });
          } else if (path) {
            navigate(path);
          }
        });

        if (cancelled) {
          back.remove();
          open.remove();
        } else {
          handles = [back, open];
        }
      } catch { /* plugin missing (web) */ }
    })();
    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
    // navigate is stable; location intentionally not a dep — listeners read
    // window.location at event time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
