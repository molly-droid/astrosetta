import React from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';

/**
 * Subtle link to Profile → Chart Display settings.
 * Drop beside any chart so users can manage which points are shown.
 */
export default function ManageChartViewLink({ className = '', label = 'Manage what you see' }) {
  return (
    <Link
      to="/profile?tab=chart"
      title="Choose which points appear on your charts"
      style={{ marginTop: 15 }}
      className={`inline-flex items-center gap-1.5 font-body text-[10px] text-brass/55 hover:text-gold-accent transition-colors ${className}`}
    >
      <SlidersHorizontal size={11} />
      <span>{label}</span>
    </Link>
  );
}