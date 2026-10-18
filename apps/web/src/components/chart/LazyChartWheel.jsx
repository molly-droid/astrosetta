import React, { Suspense, lazy } from 'react';
import ChartWheelBoundary from '@/components/chart/ChartWheelBoundary';

// Split the heavy ChartWheel SVG out of the main bundle so the page chrome
// (tab headers, date label, XP bar) paints immediately while the wheel loads
// in the background. Wraps in the existing ChartWheelBoundary so a render
// crash in the wheel never takes down the whole page.
const ChartWheel = lazy(() => import('@/components/chart/ChartWheel'));

function ChartWheelSkeleton() {
  // Reserve the wheel's real footprint: the loaded SVG is a full-width square
  // capped at 440px, and a short spinner here meant everything below jumped
  // ~200px when the wheel mounted. On Android WebView that mount-time shift
  // stranded the gauges' composited layers at their pre-shift offsets,
  // painting ghost copies over the Home header (ANDROID_QA finding A2); on
  // every platform it was layout jank. Same box, no shift, no ghosts.
  return (
    <div
      className="w-full max-w-[440px] mx-auto aspect-square flex items-center justify-center"
      aria-label="Loading chart"
    >
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