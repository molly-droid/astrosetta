import React from 'react';
import ChartPerspectiveSwitcher from '@/components/chart/ChartPerspectiveSwitcher';

/**
 * PlannerPerspectivePicker — Planner-flavored wrapper around
 * ChartPerspectiveSwitcher that lets the user choose which saved chart the
 * Planner reads against (the "base"/primary chart). Mirrors the Chart page's
 * primary-chart selector so the Planner and Chart pages stay consistent.
 *
 * The pill is always active (`isActive`) since the Planner has no separate
 * "natal vs synastry" view toggle — the base chart is always the one being
 * read, whether personally or as one half of a relationship pairing.
 */
export default function PlannerPerspectivePicker({
  perspectiveChartId,
  perspectiveChart,
  chart,
  savedCharts,
  user,
  isPremium,
  effectiveTier,
  onSelect,
  onAddChart,
}) {
  return (
    <ChartPerspectiveSwitcher
      activePerspectiveId={perspectiveChartId}
      activeLabel={perspectiveChart?.name || 'My Chart'}
      isActive
      savedCharts={savedCharts}
      personalChart={chart}
      user={user}
      isPremium={isPremium}
      fromTier={effectiveTier === 'free' ? 'free' : 'interpret'}
      onSelect={onSelect}
      onActivate={() => {}}
      onAddChart={onAddChart}
    />
  );
}