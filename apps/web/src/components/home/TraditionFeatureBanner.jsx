import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scroll, X, ArrowRight, GraduationCap } from 'lucide-react';

const DISMISS_KEY = 'astrosetta_tradition_banner_dismissed_v1';

export default function TraditionFeatureBanner() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="rounded-xl border p-4 flex flex-row items-start gap-3.5 animate-fade-up"
      style={{ background: 'rgba(201,169,97,0.06)', border: '1px solid rgba(201,169,97,0.25)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,169,97,0.12)' }}>
        <Scroll size={18} className="text-gold-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold mb-0.5">New · Three Traditions</p>
            <p className="font-display text-sm font-bold text-white leading-tight">Modern, Hellenistic &amp; Vedic — one chart</p>
          </div>
          <button onClick={close} className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0">
            <X size={13} className="text-brass/50" />
          </button>
        </div>
        <p className="font-body text-xs text-white/55 leading-relaxed mt-1.5">
          Switch your live chart's zodiac, house system, and rulerships — every reading recalculates to match.
        </p>
        <div className="mt-2 rounded-lg border border-gold-primary/15 bg-gold-primary/5 px-2.5 py-1.5">
          <p className="font-body text-[10px] text-brass/80 leading-relaxed">
            <span className="text-cream font-semibold">Free</span> — explore the Traditions curriculum in Learn.{' '}
            <span className="text-cream font-semibold">Core &amp; Premium</span> — switch your live chart in Profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-2.5">
          <button
            onClick={() => navigate('/profile')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-[11px] font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #D4AF85, #C9A961)', color: '#0f1a2e' }}
          >
            Switch in Profile <ArrowRight size={11} />
          </button>
          <button
            onClick={() => navigate('/learn?section=traditions')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-[11px] font-semibold transition-all border border-gold-primary/30 hover:bg-gold-primary/10"
            style={{ color: '#D4AF85' }}
          >
            <GraduationCap size={11} /> Learn the traditions
          </button>
        </div>
      </div>
    </div>
  );
}