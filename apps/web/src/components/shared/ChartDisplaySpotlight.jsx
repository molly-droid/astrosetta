import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, ArrowRight, SlidersHorizontal, GraduationCap } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'chart_display_v1';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function ChartDisplaySpotlight() {
  const { realUser, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [firstVisitAtMount] = useState(() => isFirstVisit());

  useEffect(() => {
    if (!realUser) return;
    if (firstVisitAtMount) return;
    const timer = setTimeout(() => {
      if (getActiveSpotlight(realUser.seen_spotlights || []) !== SPOTLIGHT_KEY) return;
      const exitCount = parseInt(localStorage.getItem(EXIT_COUNT_KEY) || '0', 10);
      if (exitCount >= 2) return;
      setVisible(true);
      track('spotlight_shown', { feature: SPOTLIGHT_KEY, exit_count: exitCount });
    }, 1400);
    return () => clearTimeout(timer);
  }, [realUser, firstVisitAtMount]);

  const markSeen = async () => {
    try {
      const seen = realUser?.seen_spotlights || [];
      if (!seen.includes(SPOTLIGHT_KEY)) {
        await base44.auth.updateMe({ seen_spotlights: [...seen, SPOTLIGHT_KEY] });
        await reloadUser();
      }
    } catch {}
  };

  const handleManage = async () => {
    setVisible(false);
    track('spotlight_take_me_there', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/profile?tab=chart');
  };

  const handleLearn = async () => {
    setVisible(false);
    track('spotlight_learn_curriculum', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/learn?section=classical_techniques');
  };

  const handleExit = async () => {
    setVisible(false);
    const exitCount = parseInt(localStorage.getItem(EXIT_COUNT_KEY) || '0', 10);
    const newCount = exitCount + 1;
    localStorage.setItem(EXIT_COUNT_KEY, String(newCount));
    track('spotlight_exited', { feature: SPOTLIGHT_KEY, exit_count: newCount });
    if (newCount >= 2) await markSeen();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[10010] flex items-start sm:items-center justify-center p-4 pb-24 bg-black/60 backdrop-blur-sm animate-fade-up overflow-y-auto"
      onClick={handleExit}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-gold-primary/40 shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f1a2e 0%, #141e33 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleExit}
          className="absolute top-2 right-2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X size={20} className="text-brass/70" />
        </button>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center mx-auto">
              <SlidersHorizontal size={24} className="text-gold-accent" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">Arabic Lots & Chart Display</h2>
            <p className="font-body text-sm text-brass italic">Shape your chart — learn the Lots.</p>
          </div>

          <p className="font-body text-xs text-brass/80 text-center leading-relaxed">
            Your chart now holds more than planets. The Arabic Lots of Spirit, Eros, and Necessity join the Lunar Nodes, Black Moon Lilith, and Chiron — and you choose which appear on your wheels.
          </p>

          <div className="space-y-2.5">
            <SpotlightRow
              icon={<SlidersHorizontal size={14} className="text-gold-accent" />}
              title="Chart Display"
              desc="Toggle Lots, Nodes, Lilith & asteroids on or off — on every wheel."
            />
            <SpotlightRow
              icon={<Sparkles size={14} className="text-gold-accent" />}
              title="New Calculated Points"
              desc="Spirit, Eros & Necessity — points of purpose, desire & duty."
            />
            <SpotlightRow
              icon={<GraduationCap size={14} className="text-celestial-blue" />}
              title="Six New Lessons"
              desc="Learn each point in the Classical Techniques & Dynamics curriculum."
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleManage}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-sm transition-colors"
            >
              Manage what you see <ArrowRight size={15} />
            </button>
            <button
              onClick={handleLearn}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-body text-xs font-semibold transition-all border border-gold-primary/30 hover:bg-gold-primary/10"
              style={{ color: '#D4AF85' }}
            >
              <GraduationCap size={13} />
              Learn the Lots
            </button>
            <button
              onClick={handleExit}
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

function SpotlightRow({ icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="font-display text-sm font-semibold text-white">{title}</p>
        <p className="font-body text-[11px] text-brass/70 leading-snug">{desc}</p>
      </div>
    </div>
  );
}