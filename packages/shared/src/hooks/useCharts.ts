/**
 * Charts hook
 * Manages saved birth charts
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '../supabase/index.js';
import type { Database } from '../supabase/types.js';
import { useAuth } from './useAuth.js';

type SavedChart = Database['public']['Tables']['saved_charts']['Row'];
type ChartInsert = Database['public']['Tables']['saved_charts']['Insert'];
type ChartUpdate = Database['public']['Tables']['saved_charts']['Update'];

export interface UseChartsResult {
  charts: SavedChart[];
  primaryChart: SavedChart | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  saveChart: (chart: ChartInsert) => Promise<SavedChart>;
  updateChart: (id: string, updates: ChartUpdate) => Promise<void>;
  deleteChart: (id: string) => Promise<void>;
  setPrimaryChart: (id: string) => Promise<void>;
}

export function useCharts(): UseChartsResult {
  const { user } = useAuth();
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCharts = async () => {
    if (!user) {
      setCharts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabase();
      const { data, error: fetchError } = await supabase
        .from('saved_charts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCharts(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, [user?.id]);

  const saveChart = async (chart: ChartInsert): Promise<SavedChart> => {
    if (!user) throw new Error('No user logged in');

    const supabase = getSupabase();
    const { data, error: insertError } = await supabase
      .from('saved_charts')
      .insert({ ...chart, user_id: user.id } as any) // TODO: Fix Supabase type inference
      .select()
      .single();

    if (insertError) throw insertError;

    setCharts((prev) => [data!, ...prev]);
    return data!;
  };

  const updateChart = async (id: string, updates: ChartUpdate) => {
    const supabase = getSupabase();
    const { data, error: updateError} = await supabase
      .from('saved_charts')
      // @ts-ignore - Supabase type inference limitation
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    setCharts((prev) => prev.map((c) => (c.id === id ? data! : c)));
  };

  const deleteChart = async (id: string) => {
    const supabase = getSupabase();
    const { error: deleteError } = await supabase
      .from('saved_charts')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    setCharts((prev) => prev.filter((c) => c.id !== id));
  };

  const setPrimaryChart = async (id: string) => {
    if (!user) throw new Error('No user logged in');

    const supabase = getSupabase();

    // First, unset all charts as primary
    await supabase
      .from('saved_charts')
      // @ts-ignore - Supabase type inference limitation
      .update({ is_primary: false })
      .eq('user_id', user.id);

    // Then set the selected chart as primary
    await updateChart(id, { is_primary: true });

    await fetchCharts();
  };

  const primaryChart = charts.find((c) => c.is_primary) || null;

  return {
    charts,
    primaryChart,
    loading,
    error,
    refresh: fetchCharts,
    saveChart,
    updateChart,
    deleteChart,
    setPrimaryChart,
  };
}
