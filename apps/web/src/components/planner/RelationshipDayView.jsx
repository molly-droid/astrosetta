import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getHiddenChartPoints } from '@/lib/chartPointVisibility';
import { fetchTransitsForChart } from '@/lib/relationshipSynthesis';
import RelationshipDaySynthesis from '@/components/planner/RelationshipDaySynthesis';
import SharedTransitsList from '@/components/planner/SharedTransitsList';
import TransitNatalFormationsBanner from '@/components/planner/TransitNatalFormationsBanner';

/**
 * Relationship (synastry) Day view with the same Today / Transits tab split as
 * the personal PlannerDayView.
 *
 *  • Today     → RelationshipDaySynthesis (the bond read).
 *  • Transits  → natal formations banner + SharedTransitsList, which surfaces
 *                only the transits that are activating BOTH charts so the user
 *                can see how the moment lands on the relationship dynamic.
 *
 * The user's own transits are fetched once at the Planner level (relTransitData)
 * and passed in via `userTransits`; only the partner's transits are fetched
 * here, once, and shared with the SharedTransitsList.
 */
export default function RelationshipDayView({ date, userChart, partnerChart, userId, userTransits, loading: userLoading }) {
  const { user } = useAuth();
  const hidden = getHiddenChartPoints(user);
  const [dayTab, setDayTab] = useState('today');
  const [partnerTransits, setPartnerTransits] = useState(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');

  // Fetch the partner's transit-to-natal data for the shared-transits view.
  useEffect(() => {
    if (!partnerChart?.id) return;
    let cancelled = false;
    setPartnerLoading(true);
    fetchTransitsForChart(date, partnerChart, hidden)
      .then((data) => { if (!cancelled) setPartnerTransits(data); })
      .catch(() => { if (!cancelled) setPartnerTransits(null); })
      .finally(() => { if (!cancelled) setPartnerLoading(false); });
    return () => { cancelled = true; };
  }, [date, partnerChart?.id]);

  const transitsLoading = userLoading || partnerLoading;

  return (
    <div className="space-y-4">
      {/* Today / Transits tabs — mirrors the personal PlannerDayView */}
      <div className="flex border-b border-white/[0.08]">
        {[
          { key: 'today', label: 'Today' },
          { key: 'transits', label: 'Transits' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setDayTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-4 font-body text-xs tracking-widest uppercase transition-colors border-b-2 ${
              dayTab === t.key
                ? 'border-gold-accent text-white font-semibold'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {dayTab === 'today' && (
        <RelationshipDaySynthesis date={date} userChart={userChart} partnerChart={partnerChart} userId={userId} />
      )}

      {dayTab === 'transits' && (
        <div className="space-y-4">
          {/* Natal formations triggered by today's transits — still relevant
              context for the relationship read. */}
          {userTransits && (
            <TransitNatalFormationsBanner transits={userTransits} chart={userChart} dateKey={dateKey} />
          )}

          {transitsLoading && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 size={15} className="animate-spin text-gold-primary" />
              <span className="font-body text-xs text-brass italic">Reading the shared sky…</span>
            </div>
          )}

          <SharedTransitsList
            userTransits={userTransits}
            partnerTransits={partnerTransits}
            userChart={userChart}
            partnerChart={partnerChart}
            date={date}
            loading={transitsLoading}
          />
        </div>
      )}
    </div>
  );
}