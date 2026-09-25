import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isCapacitor } from '@/lib/platform';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Login — replaces Base44's hosted login page (the shim's redirectToLogin
 * points here). Email/password sign in + sign up, Google OAuth, and email
 * password reset, all against Supabase Auth.
 *
 * Migrated Base44 accounts have no portable password hash: existing users
 * arrive pre-created in Supabase Auth and use "Forgot password" (or Google)
 * on first login — hence the reset flow is prominent, not buried.
 */
export default function Login() {
  const { isAuthenticated, checkUserAuth } = useAuth();
  const fromUrl = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('from_url');
    // Only same-origin destinations — never bounce users to foreign URLs
    if (raw) {
      try {
        const u = new URL(raw, window.location.origin);
        if (u.origin === window.location.origin) return u.pathname + u.search;
      } catch { /* fall through */ }
    }
    return '/home';
  }, []);

  const [mode, setMode] = useState('signin'); // signin | signup | forgot | recovery
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Arriving from a password-reset email: supabase-js consumes the link and
  // fires PASSWORD_RECOVERY — switch to the set-new-password form.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('recovery');
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  // Already signed in (or just signed in via OAuth return) — leave.
  useEffect(() => {
    if (isAuthenticated && mode !== 'recovery') window.location.assign(fromUrl);
  }, [isAuthenticated, mode, fromUrl]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong — please try again.');
    }
    setBusy(false);
  };

  const signIn = () =>
    run(async () => {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      await checkUserAuth();
      window.location.assign(fromUrl);
    });

  const signUp = () =>
    run(async () => {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: fullName ? { full_name: fullName } : {} },
      });
      if (err) throw err;
      if (data.session) {
        await checkUserAuth();
        window.location.assign('/onboarding');
      } else {
        setNotice('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
    });

  const signInWithGoogle = () =>
    run(async () => {
      if (isCapacitor()) {
        // Native: Google forbids OAuth inside embedded webviews, so open the
        // provider URL in the system browser and return via the astrosetta://
        // deep link (completed by NativeBridge in lib/native.jsx). The scheme
        // URL must be in the Supabase Auth "Redirect URLs" allowlist.
        const { data, error: err } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: 'astrosetta://login', skipBrowserRedirect: true },
        });
        if (err) throw err;
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url });
        return;
      }
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?from_url=${encodeURIComponent(fromUrl)}`,
        },
      });
      if (err) throw err;
    });

  const sendReset = () =>
    run(async () => {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (err) throw err;
      setNotice('Password link sent — check your email.');
    });

  const setNewPassword = () =>
    run(async () => {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      await checkUserAuth();
      window.location.assign(fromUrl);
    });

  const titles = {
    signin: ['Welcome back', 'Sign in to continue your chart journey'],
    signup: ['Create your account', 'Your birth chart is a few steps away'],
    forgot: ['Reset your password', "We'll email you a secure link to set a new one"],
    recovery: ['Set a new password', 'Choose a new password for your account'],
  };

  const googleButton = (
    <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
      </svg>
      Continue with Google
    </Button>
  );

  return (
    <AuthLayout
      icon={Sparkles}
      title={titles[mode][0]}
      subtitle={titles[mode][1]}
      footer={
        <>
          By continuing you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2">Terms</a> and{' '}
          <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'signin') signIn();
          else if (mode === 'signup') signUp();
          else if (mode === 'forgot') sendReset();
          else setNewPassword();
        }}
      >
        {error && (
          <div className="text-sm rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="text-sm rounded-lg border border-border bg-muted px-3 py-2" role="status">
            {notice}
          </div>
        )}

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Name</Label>
            <Input id="full_name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
        )}

        {mode !== 'recovery' && (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <Label htmlFor="password">{mode === 'recovery' ? 'New password' : 'Password'}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        )}

        {mode === 'signin' && (
          <div className="text-right -mt-2">
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-2" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy
            ? 'One moment…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Save new password'}
        </Button>

        {mode !== 'recovery' && (
          <>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
            </div>
            {googleButton}
          </>
        )}

        <div className="text-center text-sm text-muted-foreground pt-2">
          {mode === 'signin' && (
            <>New to Astrosetta?{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => setMode('signup')}>Create an account</button>
            </>
          )}
          {mode === 'signup' && (
            <>Already have an account?{' '}
              <button type="button" className="underline underline-offset-2" onClick={() => setMode('signin')}>Sign in</button>
            </>
          )}
          {mode === 'forgot' && (
            <button type="button" className="underline underline-offset-2" onClick={() => setMode('signin')}>Back to sign in</button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
