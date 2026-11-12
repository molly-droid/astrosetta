// Supabase client singleton for the Base44-compat API shim.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy apps/web/.env.example to apps/web/.env'
  );
}

// Exposed for the streaming llm-task call, which needs raw fetch:
// supabase.functions.invoke() buffers the whole body before resolving.
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

// A password-reset link lands with `type=recovery` in the URL. supabase-js
// consumes it (and fires PASSWORD_RECOVERY) before the Login page mounts to
// listen, so the page missed it and sent the user home without ever showing
// the set-new-password form. Read it here, before the client strips the URL.
export const ARRIVED_FOR_RECOVERY = typeof window !== 'undefined'
  && /(^|[#?&])type=recovery(&|$)/.test(`${window.location.hash}&${window.location.search}`);

export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
