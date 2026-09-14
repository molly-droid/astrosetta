import React, { Suspense, lazy } from 'react';
import ChartWheelBoundary from '@/components/chart/ChartWheelBoundary';

// Split the heavy ChartWheel SVG out of the main bundle so the page chrome
// (tab headers, date label, XP bar) paints immediately while the wheel loads
// in the background. Wraps in the existing ChartWheelBoundary so a render
// crash in the wheel never takes down the whole page.
const ChartWheel = lazy(() => import('@/components/chart/ChartWheel'));

function ChartWheelSkeleton() {
  return (
    <div className="flex items-center justify-center py-10" aria-label="Loading chart">
      <div className="w-32 h-32 rounded-full border-2 border-gold-primary/25 border-t-gold-primary animate-spin" />
    </div>
  );
}

export default function LazyChartWheel(props) {
  return (
    <ChartWheelBoundary>
      <Suspense fallback={<ChartWheelSkeleton />}>
        <ChartWheel {...props} />
      </Suspense>
    </ChartWheelBoundary>
  );
}