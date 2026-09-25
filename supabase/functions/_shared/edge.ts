/**
 * Shared helpers for Edge Functions ported from Base44.
 *
 * Base44 handled CORS and auth at the platform layer; on Supabase each
 * function does it explicitly. Ported handlers keep their original shape:
 * handleOptions() first, getAuthUser() where the original called
 * base44.auth.me(), and json() in place of Response.json() so every
 * response carries CORS headers.
 */
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  return null;
}

/** Client bound to the caller's JWT — RLS applies as that user. */
export function userClient(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
}

/** The authenticated user, or null. */
export async function getAuthUser(req: Request) {
  const { data } = await userClient(req).auth.getUser();
  return data?.user ?? null;
}

/**
 * True when the caller presented the service-role key (function-to-function
 * calls, e.g. recalc-all-charts -> chart-calculator, and scheduled jobs).
 */
export function isServiceRole(req: Request): boolean {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return Boolean(key) && bearer === key;
}

/** Service-role client — bypasses RLS. Server-side use only. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}
