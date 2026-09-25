import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, Mail, ArrowRight, Check } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'email_digest_opt_in';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function EmailDigestSpotlight() {
  const { realUser, reloadUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [turningOn, setTurningOn] = useState(false);
  // First-time users see only the app tutorial — never a feature spotlight on their first visit
  const [firstVisitAtMount] = useState(() => isFirstVisit());

  useEffect(() => {
    if (!realUser) return;
    if (firstVisitAtMount) return;
    const timer = setTimeout(() => {
      // Only show to users who have it OFF
      if (realUser.daily_email_opt_in !== false) return;

      // Only the single most-recent unseen feature pop-up may show this session
      if (getActiveSpotlight(realUser.seen_spotlights || []) !== SPOTLIGHT_KEY) return;

      // Exit count: show once more after first exit, stop after second
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

  const handleTurnOn = async () => {
    setTurningOn(true);
    try {
      await base44.auth.updateMe({ daily_email_opt_in: true });
      await reloadUser();
      track('spotlight_email_turned_on', {});
      setVisible(false);
      localStorage.removeItem(EXIT_COUNT_KEY);
      await markSeen();
    } catch {
      // non-critical
    }
    setTurningOn(false);
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
              <span className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold">Daily Email Digest</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
              <Mail size={22} className="text-gold-accent" />
            </div>
            <h2 className="font-display text-xl font-bold text-cream leading-tight">
              Your Stars, Delivered Every Morning
            </h2>
            <p className="font-body text-sm text-brass leading-relaxed">
              Wake up to a personalized astrological briefing in your inbox each day — your daily transits,
              collective sky energy, actionable guidance, and a quiz prompt to keep your streak alive.
            </p>
          </div>

          <div className="space-y-2.5">
            <FeatureRow
              title="Personal Transits"
              desc="How today's planets interact with your natal chart — in plain language."
            />
            <FeatureRow
              title="Daily Synthesis"
              desc="Maximize, focus, and watch-out guidance tailored to your chart."
            />
            <FeatureRow
              title="Quiz Teaser"
              desc="An intriguing prompt tied to today's sky to keep your streak going."
            />
          </div>

          <div className="rounded-xl border border-gold-primary/20 bg-gold-primary/5 px-4 py-3">
            <p className="font-body text-[11px] text-brass/80 leading-relaxed">
              <span className="text-gold-accent font-semibold">It's free.</span>{' '}
              You can turn it off anytime from <span className="text-cream">My Info → Details</span>.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleTurnOn}
              disabled={turningOn}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #D4AF85, #C9A961)',
                color: '#0f1a2e',
              }}
            >
              {turningOn ? (
                <>
                  <Check size={14} /> Turning on…
                </>
              ) : (
                <>
                  Turn on daily emails
                  <ArrowRight size={14} />
                </>
              )}
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

function FeatureRow({ title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
        <Check size={14} className="text-gold-accent" />
      </div>
      <div>
        <p className="font-body text-xs font-semibold text-cream">{title}</p>
        <p className="font-body text-[11px] text-brass/70 leading-snug">{desc}</p>
      </div>
    </div>
  );
}