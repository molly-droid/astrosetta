import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { pickBestProgress } from '@/lib/userProgress';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [realUser, setRealUser] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Base44-era concept; kept for interface compatibility
  const [progressRecord, setProgressRecord] = useState(null); // Fetched in parallel with auth.me() to avoid a waterfall

  useEffect(() => {
    checkAppState();

    // Re-check when the Supabase session changes (magic-link return,
    // password reset completion, sign-out in another tab).
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') checkUserAuth();
      if (event === 'SIGNED_OUT') {
        setRealUser(null);
        setImpersonatedUser(null);
        setIsAuthenticated(false);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const checkAppState = async () => {
    // Base44 gated every load behind an app public-settings request; with
    // Supabase there is no equivalent gate — the app is public and auth is
    // checked directly against the session.
    setAuthError(null);
    setIsLoadingPublicSettings(false);
    setAppPublicSettings(null);

    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      await checkUserAuth();
    } else {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      // Fire auth.me() and the UserProgress fetch in parallel — both use the
      // auth token, and UserProgress.list is RLS-scoped to the current user,
      // so neither depends on the other's result. This shaves a serial
      // round-trip off the cold boot (was: auth.me() → UserPrefsContext →
      // UserProgress.filter).
      const [currentUser, progRecords] = await Promise.all([
        base44.auth.me(),
        base44.entities.UserProgress.filter({}).catch(() => []),
      ]);

      // Stamp founding member flag and tier preference on first login
      const updates = {};
      if (currentUser.is_founding_member === undefined || currentUser.is_founding_member === null) {
        updates.is_founding_member = true;
      }
      const storedTier = localStorage.getItem('founding_tier_preference');
      if (storedTier && !currentUser.founding_tier_preference) {
        updates.founding_tier_preference = storedTier;
        localStorage.removeItem('founding_tier_preference');
      }
      if (Object.keys(updates).length > 0) {
        await base44.auth.updateMe(updates);
      }

      setRealUser(currentUser);
      setProgressRecord(pickBestProgress(progRecords));
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      // Count distinct login sessions so first-visit UI (e.g. the Navigator
      // nudge) can surface only during the user's first couple of logins.
      // One increment per browser session — reloads within the same tab don't
      // double-count (guarded by a sessionStorage flag).
      try {
        if (!sessionStorage.getItem('astrosetta_login_counted')) {
          const next = (parseInt(localStorage.getItem('astrosetta_login_count') || '0', 10) || 0) + 1;
          localStorage.setItem('astrosetta_login_count', String(next));
          sessionStorage.setItem('astrosetta_login_counted', '1');
        }
      } catch { /* storage may be unavailable */ }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      if (error.status === 401) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      } else if (error.status === 403) {
        // Authenticated in Supabase but no users row — the account was not
        // provisioned (signup trigger missing or data not migrated).
        setAuthError({
          type: 'user_not_registered',
          message: 'User not registered for this app'
        });
      }
    }
  };

  // The visible "user" is the impersonated one if set (admin only)
  const user = impersonatedUser || realUser;

  // Apply the user's saved font-size scale globally so it's consistent on every
  // page, not only when the Profile/FontSizeControl mounts.
  useEffect(() => {
    const scale = typeof realUser?.font_scale === 'number' && realUser.font_scale >= 0.8 && realUser.font_scale <= 1.8 ? realUser.font_scale : 1;
    document.documentElement.style.setProperty('--app-font-scale', String(scale));
  }, [realUser?.font_scale]);

  const reloadUser = async () => {
    const currentUser = await base44.auth.me();
    setRealUser(currentUser);
    if (!impersonatedUser) return currentUser;
    return currentUser;
  };

  const impersonate = (targetUser) => {
    if (realUser?.role !== 'admin') return;
    setImpersonatedUser(targetUser);
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
  };

  const logout = (shouldRedirect = true) => {
    setRealUser(null);
    setImpersonatedUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      realUser,
      impersonatedUser,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      progressRecord,
      setProgressRecord,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
      reloadUser,
      impersonate,
      stopImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
