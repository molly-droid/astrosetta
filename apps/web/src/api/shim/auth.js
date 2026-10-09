// Base44 auth -> Supabase Auth + the users table.
//
// The Base44 "User" is one object combining the auth identity and app fields
// (subscription_tier, xp_total, is_founding_member, ...). Here the identity
// lives in Supabase Auth and the app fields in public.users (row id = auth
// uid, created on signup by a database trigger), so me()/updateMe() read and
// write that row.
import { supabase } from './supabase.js';

function authError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const auth = {
  async me() {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (!authUser) throw authError(401, 'Not authenticated');

    const { error: refreshError } = await supabase.rpc('refresh_billing_access', { p_user_id: authUser.id });
    if (refreshError) throw authError(500, refreshError.message);

    const { data: row, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) throw authError(500, error.message);
    if (!row) throw authError(403, 'User not registered');

    return { ...row, email: row.email || authUser.email };
  },

  async updateMe(updates) {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    if (!authUser) throw authError(401, 'Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', authUser.id)
      .select()
      .single();
    if (error) throw authError(500, error.message);
    return data;
  },

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  },

  // Base44 signature: logout(redirectUrl?) — clears the session; with an
  // argument it also leaves the app (Base44 sent users to its login page,
  // we return to the public landing page).
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl !== undefined) window.location.assign('/');
  },

  // Base44 signature: redirectToLogin(fromUrl?) — sends the user to the
  // login screen, remembering where they came from.
  redirectToLogin(fromUrl) {
    const next = fromUrl || window.location.href;
    window.location.assign(`/login?from_url=${encodeURIComponent(next)}`);
  },
};
