import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, ArrowRight, Compass, Layers, Eye, GraduationCap } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'chart_dynamics_v1';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function FeatureSpotlight() {
  const { realUser, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  // First-time users see only the app tutorial — never a feature spotlight on their first visit
  const [firstVisitAtMount] = useState(() => isFirstVisit());

  useEffect(() => {
    if (!realUser) return;
    if (firstVisitAtMount) return;
    const timer = setTimeout(() => {
      // Only the single most-recent unseen feature pop-up may show this session
      if (getActiveSpotlight(realUser.seen_spotlights || []) !== SPOTLIGHT_KEY) return;

      // Exit count: show once more after first exit, stop after second
      const exitCount = parseInt(localStorage.getItem(EXIT_COUNT_KEY) || '0', 10);
      if (exitCount >= 2) return;

      setVisible(true);
      track('spotlight_shown', { feature: SPOTLIGHT_KEY, exit_count: exitCount });
    }, 1200);
    return () => clearTimeout(timer);
  }, [realUser, firstVisitAtMount]);

  const markSeen = async () => {
    try {
      const seen = realUser?.seen_spotlights || [];
      if (!seen.includes(SPOTLIGHT_KEY)) {
        await base44.auth.updateMe({ seen_spotlights: [...seen, SPOTLIGHT_KEY] });
        await reloadUser();
      }
    } catch {
      // non-critical
    }
  };

  const handleTakeMeThere = async () => {
    setVisible(false);
    track('spotlight_take_me_there', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/planner?spotlight=dynamics');
  };

  const handleLearnCurriculum = async () => {
    setVisible(false);
    track('spotlight_learn_curriculum', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/learn?section=dynamics');
  };

  const handleMaybeLater = () => {
    setVisible(false);
    track('spotlight_maybe_later', { feature: SPOTLIGHT_KEY });
    // No state change — show again next visit
  };

  const handleExit = async () => {
    setVisible(false);
    const exitCount = parseInt(localStorage.getItem(EXIT_COUNT_KEY) || '0', 10);
    const newCount = exitCount + 1;
    localStorage.setItem(EXIT_COUNT_KEY, String(newCount));
    track('spotlight_exited', { feature: SPOTLIGHT_KEY, exit_count: newCount });
    // After second exit, permanently dismiss
    if (newCount >= 2) {
      await markSeen();
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[10010] flex items-start sm:items-center justify-center p-4 pb-24 bg-black/60 backdrop-blur-sm animate-fade-up overflow-y-auto"
      onClick={handleExit}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gold-primary/40 shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a2847 0%, #0f1a2e 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={handleExit}
          className="absolute top-2 right-2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={20} className="text-brass/70" />
        </button>

        <div className="relative px-6 pt-8 pb-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-primary/15 border border-gold-accent/30">
              <Sparkles size={11} className="text-gold-accent" />
              <span className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold">New Feature</span>
            </div>
            <h2 className="font-display text-xl font-bold text-cream leading-tight">
              Chart Dynamics
            </h2>
            <p className="font-body text-sm text-brass leading-relaxed">
              Your birth chart has hidden architecture. Discover the stelliums, empty houses,
              and chart ruler that shape how your energy moves — not just where your planets sit.
              Explore it interactively in the Planner, or learn the foundations in the new
              Dynamics curriculum.
            </p>
          </div>

          <div className="space-y-2.5">
            <FeatureRow
              icon={Layers}
              title="Stelliums"
              desc="Clusters of 3+ planets in one sign or house, amplifying that area of life."
            />
            <FeatureRow
              icon={Eye}
              title="Empty Houses"
              desc="Houses with no natal planets — discover what they mean for you."
            />
            <FeatureRow
              icon={Compass}
              title="Chart Ruler"
              desc="The planet that governs your Ascendant — your life's guiding force."
            />
          </div>

          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 px-4 py-3">
            <p className="font-body text-[11px] text-brass/80 leading-relaxed">
              <span className="text-gold-accent font-semibold">Where to find it:</span>{' '}
              Open the <span className="text-cream">Planner</span> → <span className="text-cream">Day</span> view,
              then scroll to the <span className="text-cream">Chart Dynamics</span> card.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleTakeMeThere}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #D4AF85, #C9A961)',
                color: '#0f1a2e',
              }}
            >
              Explore in Planner
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleLearnCurriculum}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-body text-xs font-semibold transition-all border border-gold-primary/30 hover:bg-gold-primary/10"
              style={{ color: '#D4AF85' }}
            >
              <GraduationCap size={13} />
              Learn the fundamentals
            </button>
            <button
              onClick={handleMaybeLater}
              className="w-full py-2 rounded-xl font-body text-xs text-brass/50 hover:text-brass transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
        <Icon size={14} className="text-gold-accent" />
      </div>
      <div>
        <p className="font-body text-xs font-semibold text-cream">{title}</p>
        <p className="font-body text-[11px] text-brass/70 leading-snug">{desc}</p>
      </div>
    </div>
  );
}