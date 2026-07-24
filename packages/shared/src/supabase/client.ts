/**
 * Supabase client configuration
 * Shared between web and mobile apps
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Initialize the Supabase client
 * Call this once at app startup
 */
export function initializeSupabase(config: SupabaseConfig): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseInstance;
}

/**
 * Get the Supabase client instance
 * Throws if not initialized
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase client not initialized. Call initializeSupabase() first.'
    );
  }
  return supabaseInstance;
}

/**
 * Reset the Supabase client (useful for testing)
 */
export function resetSupabase(): void {
  supabaseInstance = null;
}
