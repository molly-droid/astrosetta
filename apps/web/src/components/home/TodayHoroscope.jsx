import React from 'react';
import LunarEventBanner from '@/components/planner/LunarEventBanner';

export default function TodayHoroscope({ chart, transits, currentTimezone }) {
  const today = new Date();

  return (
    <div className="space-y-4">
      <LunarEventBanner date={today} chart={chart} transits={transits} />
    </div>
  );
}