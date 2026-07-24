/**
 * Root layout for Expo Router
 */

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initializeSupabase } from '@astro/shared';

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export default function RootLayout() {
  useEffect(() => {
    // Initialize Supabase client
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      initializeSupabase({
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
      });
    } else {
      console.warn('Supabase credentials not found in environment');
    }
  }, []);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Astrosetta' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
