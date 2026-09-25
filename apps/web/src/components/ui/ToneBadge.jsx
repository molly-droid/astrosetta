import React from 'react';
import { TONE_COLORS, TONE_LABELS } from '@/lib/chartUtils';

export default function ToneBadge({ tone }) {
  const color = TONE_COLORS[tone] || '#D4AF85';
  const label = TONE_LABELS[tone] || tone;

  return (
    <span
      className="inline-block text-[10px] font-display italic px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: `${color}20`, borderColor: `${color}60`, color: '#2C3E50' }}
    >
      {label}
    </span>
  );
}