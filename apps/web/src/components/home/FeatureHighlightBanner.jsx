import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { fetchActiveHighlight } from '@/lib/featureSchedule';
import { getActiveHighlight, ANNOUNCEMENT_ICONS } from '@/lib/featureAnnouncements';

/**
 * Homepage "feature highlight" banner.
 *
 * Single source of truth: the admin-managed FeatureHighlight entity.
 * Reads the live homepage-channel highlight via fetchActiveHighlight();
 * falls back to the static catalog (featureAnnouncements.js) when nothing
 * is scheduled. Editing or launching a highlight in the admin module
 * updates this banner on next load — no code changes needed.
 *
 * Dismiss state is keyed by spotlight_key, so when a new highlight goes
 * live the banner re-appears for it.
 */
export default function FeatureHighlightBanner() {
  const navigate = useNavigate();
  const [highlight, setHighlight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      let hl = await fetchActiveHighlight('homepage');
      if (!hl) hl = getActiveHighlight(); // static fallback
      if (alive) { setHighlight(hl); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const spotlightKey = highlight?.spotlight_key || 'none';
  const dismissKey = `astrosetta_feature_banner_dismissed_${spotlightKey}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!highlight) return;
    try { setDismissed(localStorage.getItem(dismissKey) === '1'); } catch { setDismissed(false); }
  }, [dismissKey, highlight]);

  if (loading || !highlight || dismissed) return null;

  const Icon = ANNOUNCEMENT_ICONS[highlight.icon] || Sparkles;

  const close = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="rounded-xl border p-4 flex flex-row items-start gap-3.5 animate-fade-up"
      style={{ background: 'rgba(201,169,97,0.06)', border: '1px solid rgba(201,169,97,0.25)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(201,169,97,0.12)' }}>
        <Icon size={18} className="text-gold-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-body text-[10px] uppercase tracking-widest text-gold-accent font-semibold mb-0.5">New Feature</p>
            <p className="font-display text-sm font-bold text-white leading-tight">{highlight.title}</p>
          </div>
          <button onClick={close} className="p-1.5 -m-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0" aria-label="Dismiss banner">
            <X size={16} className="text-brass/70" />
          </button>
        </div>
        {highlight.subtitle && (
          <p className="font-body text-xs text-gold-accent italic mt-0.5">{highlight.subtitle}</p>
        )}
        {highlight.description && (
          <p className="font-body text-xs text-white/55 leading-relaxed mt-1.5 max-h-24 overflow-y-auto pr-1">{highlight.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2.5">
          <button
            onClick={() => navigate(highlight.deep_link || '/home')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-body text-[11px] font-semibold transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #D4AF85, #C9A961)', color: '#0f1a2e' }}
          >
            Explore <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}