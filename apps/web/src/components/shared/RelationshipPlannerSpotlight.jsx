import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, ArrowRight, Heart, Layers, CalendarDays } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'relationship_planner_v1';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function RelationshipPlannerSpotlight() {
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
    }, 2400);
    return () => clearTimeout(timer);
  }, [realUser, firstVisitAtMount]);

  const markSeen = async () => {
    try {
      const seen = realUser?.seen_spotlights || [];
      if (!seen.includes(SPOTLIGHT_KEY)) {
        await base44.auth.updateMe({ seen_spotlights: [...seen, SPOTLIGHT_KEY] });
        await reloadUser();
      }
    } catch { /* non-critical */ }
  };

  const handleTakeMeThere = async () => {
    setVisible(false);
    track('spotlight_take_me_there', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/planner');
  };

  const handleMaybeLater = () => {
    setVisible(false);
    track('spotlight_maybe_later', { feature: SPOTLIGHT_KEY });
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
        style={{ background: 'linear-gradient(135deg, #1a2847 0%, #0f1a2e 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-celestial-pink/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={handleExit}
          className="absolute top-2 right-2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={20} className="text-brass/70" />
        </button>

        <div className="relative px-6 pt-8 pb-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-celestial-pink/15 border border-celestial-pink/30">
              <Sparkles size={11} className="text-celestial-pink" />
              <span className="font-body text-[10px] uppercase tracking-widest text-celestial-pink font-semibold">New Feature</span>
            </div>
            <h2 className="font-display text-xl font-bold text-cream leading-tight">
              Read the Sky Through Your Bond
            </h2>
            <p className="font-body text-sm text-brass leading-relaxed">
              The Planner now reads the day, week, and month through your relationship. Switch into
              Synastry to weave two charts together, or Composite to treat the bond itself as one
              chart — with the live sky overlaid on both.
            </p>
          </div>

          <div className="space-y-2.5">
            <FeatureRow
              icon={Heart}
              title="Synastry Planner"
              desc="Day, Week, and Month views weave your chart and your partner's into one shared reading."
            />
            <FeatureRow
              icon={Layers}
              title="Composite Mode"
              desc="Merge both charts into a single relationship chart with midpoint planets — and watch transits activate it."
            />
            <FeatureRow
              icon={CalendarDays}
              title="Live Sky Overlays"
              desc="Today's transits are drawn over the composite wheel, just like your personal chart."
            />
          </div>

          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 px-4 py-3">
            <p className="font-body text-[11px] text-brass/80 leading-relaxed">
              <span className="text-gold-accent font-semibold">Where to find it:</span>{' '}
              Open <span className="text-cream">Planner</span> and tap the{' '}
              <span className="text-cream">Relationship</span> pill below the chart.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleTakeMeThere}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #D4AF85, #C9A961)', color: '#0f1a2e' }}
            >
              Open the Planner
              <ArrowRight size={14} />
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
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-celestial-pink/10 border border-celestial-pink/20 flex items-center justify-center">
        <Icon size={14} className="text-celestial-pink" />
      </div>
      <div>
        <p className="font-body text-xs font-semibold text-cream">{title}</p>
        <p className="font-body text-[11px] text-brass/70 leading-snug">{desc}</p>
      </div>
    </div>
  );
}