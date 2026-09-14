import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, ArrowRight, BookOpen, Layers, Gauge } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isFirstVisit, getActiveSpotlight } from '@/lib/spotlightCoordinator';

const SPOTLIGHT_KEY = 'knowledge_density_v1';
const EXIT_COUNT_KEY = `spotlight_exit_${SPOTLIGHT_KEY}`;

export default function KnowledgeDensitySpotlight() {
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

  const handleTakeMeThere = async () => {
    setVisible(false);
    track('spotlight_take_me_there', { feature: SPOTLIGHT_KEY });
    localStorage.removeItem(EXIT_COUNT_KEY);
    await markSeen();
    navigate('/profile?tab=details');
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
              <Gauge size={26} className="text-gold-accent" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">Adaptive Knowledge Density</h2>
            <p className="font-body text-sm text-brass italic">Learn at your own depth — anytime.</p>
          </div>

          <div className="space-y-2.5">
            <SpotlightRow
              icon={<Sparkles size={14} className="text-gold-accent" />}
              title="Essential"
              desc="Beginner-friendly plain language — every term explained, even the basics."
            />
            <SpotlightRow
              icon={<BookOpen size={14} className="text-celestial-blue" />}
              title="Insightful"
              desc="Balanced depth with astrological terms explained in context."
            />
            <SpotlightRow
              icon={<Layers size={14} className="text-purple-300" />}
              title="Technical"
              desc="Full mechanical & traditional depth — orbs, dignities, dispositors."
            />
          </div>

          <p className="font-body text-xs text-brass/70 text-center leading-relaxed">
            Your choice instantly reshapes interpretations, the curriculum, and your daily email — plus every astrological term is now <span className="text-gold-accent">tappable</span> to learn more.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleExit}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/15 text-brass font-body text-sm hover:bg-white/5 transition-colors"
            >
              Maybe later
            </button>
            <button
              onClick={handleTakeMeThere}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-sm transition-colors flex items-center justify-center gap-1.5"
            >
              Try it now <ArrowRight size={15} />
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