import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Layers, Compass, Eye, Sparkles, CalendarCheck, Smartphone, Telescope, Mail, Users, X, ArrowRight, Route } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { FEATURE_ANNOUNCEMENTS, ANNOUNCEMENT_ICONS } from '@/lib/featureAnnouncements';
import { startFullAppTour } from '@/components/shared/FullAppTour';
import { startQuickTip } from '@/components/shared/QuickTipTour';
import { track } from '@/lib/analytics';

// Icons resolved from ANNOUNCEMENT_ICONS (shared with InteractiveFeatures)

// Flip to true when the Sky Watch transit-alert backend is ready
const SKY_WATCH_ENABLED = false;

export default function NotificationsBell() {
  const { realUser, reloadUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('whats_new');
  const ref = useRef(null);

  const seenSpotlights = realUser?.seen_spotlights || [];
  const unseenCount = FEATURE_ANNOUNCEMENTS.filter(
    (a) => !a.is_tour && !a.is_quick_tip && !seenSpotlights.includes(a.spotlight_key)
  ).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleTakeTour = async (announcement) => {
    if (announcement.is_tour) {
      track('notifications_full_app_tour', {});
      startFullAppTour();
      setOpen(false);
      navigate('/home');
      return;
    }
    if (announcement.is_quick_tip) {
      track('notifications_quick_tip', { tip: announcement.tip_key });
      startQuickTip(announcement.tip_key);
      setOpen(false);
      return;
    }
    track('notifications_retake_tour', { feature: announcement.spotlight_key });
    // Remove from seen_spotlights so the spotlight shows again
    const newSeen = seenSpotlights.filter((k) => k !== announcement.spotlight_key);
    await base44.auth.updateMe({ seen_spotlights: newSeen });
    // Clear the localStorage exit counter so it's not blocked
    localStorage.removeItem(`spotlight_exit_${announcement.spotlight_key}`);
    await reloadUser();
    setOpen(false);
    navigate(announcement.deep_link);
  };

  // Newest first
  const sorted = [...FEATURE_ANNOUNCEMENTS].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return (
    <div ref={ref} className="fixed top-3 right-3 z-[9997]">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full border border-white/[0.06] transition-all hover:bg-gold-primary/10"
        aria-label="What's new"
        title="Notifications"
      >
        <Bell
          size={18}
          className="text-brass/70 hover:text-gold-accent transition-colors"
        />
        {unseenCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold-accent animate-pulse" />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-gold-primary/30 shadow-2xl overflow-hidden animate-fade-up"
          style={{
            background: 'linear-gradient(135deg, #1a2847 0%, #0f1a2e 100%)',
          }}
        >
          <div className="px-4 py-3 border-b border-gold-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-gold-accent" />
              <span className="font-display text-sm font-semibold text-white">
                What's New
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-brass/40 hover:text-brass transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {SKY_WATCH_ENABLED && (
            <div className="flex border-b border-white/[0.06]">
              <button
                onClick={() => setActiveTab('whats_new')}
                className="flex-1 py-2.5 font-body text-[11px] font-semibold transition-colors"
                style={{
                  color: activeTab === 'whats_new' ? '#C9A961' : 'rgba(255,255,255,0.4)',
                  borderBottom: activeTab === 'whats_new' ? '2px solid #C9A961' : '2px solid transparent',
                }}
              >
                What's New
              </button>
              <button
                onClick={() => setActiveTab('sky_watch')}
                className="flex-1 py-2.5 font-body text-[11px] font-semibold transition-colors"
                style={{
                  color: activeTab === 'sky_watch' ? '#C9A961' : 'rgba(255,255,255,0.4)',
                  borderBottom: activeTab === 'sky_watch' ? '2px solid #C9A961' : '2px solid transparent',
                }}
              >
                <Telescope size={11} className="inline mr-1 -mt-0.5" />
                Sky Watch
              </button>
            </div>
          )}

          {(!SKY_WATCH_ENABLED || activeTab === 'whats_new') && (
            <div className="max-h-96 overflow-y-auto">
              {sorted.length === 0 ? (
                <p className="font-body text-xs text-brass/60 px-4 py-8 text-center">
                  No announcements yet.
                </p>
              ) : (
                sorted.map((a) => {
                  const Icon = ANNOUNCEMENT_ICONS[a.icon] || Sparkles;
                  const isSeen = a.is_tour || a.is_quick_tip || seenSpotlights.includes(a.spotlight_key);
                  return (
                    <div
                      key={a.spotlight_key}
                      className="px-4 py-3 border-b border-white/[0.06] last:border-b-0 hover:bg-gold-primary/5 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
                          <Icon size={14} className="text-gold-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-body text-xs font-semibold text-white truncate">
                              {a.title}
                            </p>
                            {!isSeen && (
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-accent flex-shrink-0" />
                            )}
                          </div>
                          <p className="font-body text-[11px] text-brass/70 leading-snug mt-0.5">
                            {a.description}
                          </p>
                          <button
                            onClick={() => handleTakeTour(a)}
                            className="flex items-center gap-1 mt-2 font-body text-[10px] text-gold-accent hover:text-gold-primary transition-colors font-semibold"
                          >
                            {a.is_tour
                              ? 'Start tour'
                              : a.is_quick_tip
                                ? 'View tip'
                                : (isSeen ? 'Take the tour again' : 'Take the tour')}
                            <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {SKY_WATCH_ENABLED && activeTab === 'sky_watch' && (
            <div className="max-h-96 overflow-y-auto">
              <div className="px-4 py-8 text-center">
                <Telescope size={24} className="text-brass/30 mx-auto mb-2" />
                <p className="font-body text-xs text-brass/60">
                  No major transits right now — check back soon.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}