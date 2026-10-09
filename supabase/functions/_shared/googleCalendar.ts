import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { effectiveTier, meetsGate } from './llm_tasks/core.ts';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const calendarCallbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-connection`;

export function googleCredentials() {
  const client_id = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
  const client_secret = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
  if (!client_id || !client_secret) throw new Error('Google Calendar is not configured');
  return { client_id, client_secret };
}

export async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}

export async function pkceChallenge(verifier: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function calendarAllowed(db: SupabaseClient, userId: string) {
  const { error: refreshError } = await db.rpc('refresh_billing_access', { p_user_id: userId });
  if (refreshError) throw refreshError;
  const { data, error } = await db.from('users').select('role,subscription_tier,subscription_expires').eq('id', userId).maybeSingle();
  if (error) throw error;
  return !!data && meetsGate(effectiveTier(data), 'core');
}

export async function googleToken(fields: Record<string, string>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...googleCredentials(), ...fields }),
    signal: AbortSignal.timeout(15000),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token || !Number.isFinite(token.expires_in)) {
    throw new Error('Google Calendar authorization expired or failed. Reconnect your calendar.');
  }
  return token;
}

export async function googleAccessToken(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from('google_calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (Date.parse(data.expires_at) > Date.now() + 60000) return data.access_token;
  const token = await googleToken({ grant_type: 'refresh_token', refresh_token: data.refresh_token });
  // A reconnect/disconnect while this request runs must not be overwritten.
  const { data: updated, error: saveError } = await db.from('google_calendar_connections').update({
    access_token: token.access_token, refresh_token: token.refresh_token || data.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('refresh_token', data.refresh_token).select('user_id').maybeSingle();
  if (saveError) throw saveError;
  if (!updated) throw new Error('Calendar connection changed. Please try again.');
  return token.access_token;
}
