import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { loadSavedChartsWithSettings, resolveChartSettings } from '@/lib/savedChartSettings';

export function useSavedCharts(user, natalChart) {
  const { progressRecord } = useAuth();
  const settings = resolveChartSettings(progressRecord?.user_id === user?.id ? progressRecord : null, natalChart);
  const enabled = !!user?.id && !!natalChart;
  const query = useQuery({
    queryKey: ['saved-charts', user?.id, settings.house_system, settings.tradition],
    queryFn: () => loadSavedChartsWithSettings(user.id, settings),
    enabled,
    staleTime: 0,
    retry: false,
  });
  return {
    charts: enabled ? (query.data || []) : [],
    loading: enabled && query.isPending,
    error: query.error,
    refresh: query.refetch,
  };
}
