import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, ArrowRight, MousePointer, Eye, Zap } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'chart_interactivity_v1';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function ChartInteractivitySpotlight() {
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

      const exitCount = parseInt(localStorage.getItem(EXIT_COUNT_KEY) || '0', 10);
      if (exitCount >= 2) return;

      setVisible(true);
      track('spotlight_shown', { feature: SPOTLIGHT_KEY, exit_count: exitCount });
    }, 1800);
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
              Your Chart, Now Interactive
            </h2>
            <p className="font-body text-sm text-brass leading-relaxed">
              Tap any planet, aspect line, or zodiac sign in the chart wheel to reveal its meaning.
              Select a transiting planet to see its aspects to your natal chart — then click any
              aspect line for an instant interpretation. Selections sync live between the wheel,
              the transit list, and your daily reading.
            </p>
          </div>

          <div className="space-y-2.5">
            <FeatureRow
              icon={MousePointer}
              title="Click Any Element"
              desc="Planets, signs, houses, and aspect lines are all tappable — each opens a concise meaning card."
            />
            <FeatureRow
              icon={Zap}
              title="Transit-to-Natal Aspects"
              desc="Select a transiting planet, then tap any dashed aspect line to its natal target for an interpretation."
            />
            <FeatureRow
              icon={Eye}
              title="Live Highlight Sync"
              desc="Click a transit in the daily reading or transit list — the chart wheel highlights it instantly, and vice versa."
            />
          </div>

          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 px-4 py-3">
            <p className="font-body text-[11px] text-brass/80 leading-relaxed">
              <span className="text-gold-accent font-semibold">Where to find it:</span>{' '}
              Open the <span className="text-cream">Planner</span> → <span className="text-cream">Day</span> view,
              set the chart mode to <span className="text-cream">Natal + Now</span>, and start tapping.
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
              Try it in the Planner
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