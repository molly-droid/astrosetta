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

export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
