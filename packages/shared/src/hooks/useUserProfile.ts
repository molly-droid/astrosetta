/**
 * User profile hook
 * Fetches and manages user profile data
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '../supabase/index.js';
import type { Database } from '../supabase/types.js';
import { useAuth } from './useAuth.js';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export interface UseUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: UserProfileUpdate) => Promise<void>;
}

export function useUserProfile(): UseUserProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabase();
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const updateProfile = async (updates: UserProfileUpdate) => {
    if (!user) throw new Error('No user logged in');

    const supabase = getSupabase();
    const { data, error: updateError } = await supabase
      .from('user_profiles')
      // @ts-ignore - Supabase type inference limitation
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    setProfile(data!);
  };

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    updateProfile,
  };
}
