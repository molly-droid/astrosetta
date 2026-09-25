import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/**
 * Placeholder for composite Week / Month reads in the Planner. Composite
 * synthesis is daily for now (CompositeDaySynthesis); the longer-term themes
 * of the composite chart live on the Chart page, so we cross-link there
 * instead of building a half-finished period read.
 */
export default function CompositePeriodStub({ periodLabel, partnerChart }) {
  return (
    <div className="celestial-card p-6 text-center space-y-3">
      <div className="text-3xl text-gold-accent/50" style={{ fontVariantEmoji: 'text', fontVariant: 'normal' }}>∞</div>
      <p className="font-body text-sm text-brass leading-relaxed">
        Composite {periodLabel} readings are coming soon. For now, composite reads are daily — and the longer-term themes of your composite chart live on the Chart page.
      </p>
      <Link
        to={`/chart?view=synastry&with=${partnerChart?.id || ''}`}
        className="inline-flex items-center gap-1.5 font-body text-xs text-gold-accent hover:text-gold-primary transition-colors"
      >
        <Sparkles size={12} className="shrink-0" />
        Open your composite chart
      </Link>
    </div>
  );
}