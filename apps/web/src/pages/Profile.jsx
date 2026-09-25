import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useTabUrl } from '@/hooks/useTabUrl';
import { base44 } from '@/api/base44Client';
import { Loader2, LogOut, Pencil, Globe, Check, Mail } from 'lucide-react';

const TIMEZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Phoenix','America/Anchorage','Pacific/Honolulu',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Rome','Europe/Madrid',
  'Europe/Amsterdam','Europe/Stockholm','Europe/Moscow',
  'Asia/Dubai','Asia/Kolkata','Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Asia/Seoul','Asia/Shanghai',
  'Australia/Sydney','Australia/Melbourne','Pacific/Auckland',
];

import LearningTierGauge from '@/components/quiz/LearningTierGauge';
import TierProgressCard from '@/components/quiz/TierProgressCard';
import XpMeter from '@/components/learning/XpMeter';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { pickBestProgress } from '@/lib/userProgress';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import EditBirthDataModal from '@/components/profile/EditBirthDataModal';
import SignName from '@/components/ui/SignName';
import ChartWheel from '@/components/chart/ChartWheel';
import SubscriptionSection from '@/components/profile/SubscriptionSection';
import DeleteAccountSection from '@/components/profile/DeleteAccountSection';
import FontSizeControl from '@/components/profile/FontSizeControl';
import GoogleCalendarConnect from '@/components/profile/GoogleCalendarConnect';
import TraditionSelector from '@/components/profile/TraditionSelector';
import KnowledgeDensitySlider from '@/components/profile/KnowledgeDensitySlider';
import FoundingPatronBadge from '@/components/shared/FoundingPatronBadge';
import ChartDisplaySettings from '@/components/profile/ChartDisplaySettings';
import MyMomentSection from '@/components/profile/MyMomentSection';

const TABS = [
  { key: 'details',       label: 'Details' },
  { key: 'plan',          label: 'Plan' },
  { key: 'moment',        label: 'My Moment' },
  { key: 'chart',         label: 'Chart' },
  { key: 'streak',        label: 'History' },
];

export default function Profile() {
  const { user, reloadUser, impersonatedUser, realUser, impersonate } = useAuth();
  const isImpersonating = !!impersonatedUser;
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const showSuccess = urlParams.get('success') === 'true';
  const successTier = urlParams.get('tier');
  const [chart, setChart] = useState(null);
  const [progress, setProgress] = useState([]);
  const [userProgress, setUserProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [xpTotal, setXpTotal] = useState(0);
  const [activeTab, setActiveTab] = useTabUrl('tab', 'details');
  const [showEditModal, setShowEditModal] = useState(false);
  const [tzValue, setTzValue] = useState('');
  const [tzSaved, setTzSaved] = useState(false);
  const tzSaveTimer = useRef(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!showSuccess) return;
    let attempts = 0;
    const poll = async () => {
      const u = await reloadUser();
      attempts++;
      if ((u?.subscription_tier === 'interpret' || u?.subscription_tier === 'calendar') && attempts < 8) return;
      if (attempts < 8) setTimeout(poll, 2000);
    };
    poll();
  }, [showSuccess]);

  useEffect(() => {
    if (user) {
      loadData();
      setTzValue(user.current_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      setNameValue(user.display_name || user.full_name || '');
    }
  }, []);

  const saveTimezone = (tz) => {
    setTzValue(tz);
    if (tzSaveTimer.current) clearTimeout(tzSaveTimer.current);
    tzSaveTimer.current = setTimeout(async () => {
      await base44.auth.updateMe({ current_timezone: tz });
      setTzSaved(true);
      setTimeout(() => setTzSaved(false), 2000);
    }, 800);
  };

  const saveName = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!nameValue.trim()) return;
    setSavingName(true);
    if (isImpersonating) {
      await base44.entities.User.update(user.id, { display_name: nameValue.trim() });
      const users = await base44.entities.User.list(null, 200);
      const updated = users.find(u => u.id === user.id);
      if (updated) impersonate(updated);
    } else {
      await base44.auth.updateMe({ display_name: nameValue.trim() });
      reloadUser();
    }
    setSavingName(false);
    setEditingName(false);
  };

  const loadData = async () => {
    const freshUser = await reloadUser();
    if (!freshUser) return;
    const uid = freshUser.id;
    const [charts, moduleProg, progRecords, events] = await Promise.all([
      base44.entities.Chart.filter({ user_id: uid }),
      base44.entities.UserModuleProgress.filter({ user_id: uid }),
      base44.entities.UserProgress.filter({ user_id: uid }),
      base44.entities.XPEvent.filter({ user_id: uid }),
    ]);
    setChart(charts[0] || null);
    setProgress(moduleProg);
    setUserProgress(pickBestProgress(progRecords));
    // Compute XP directly from events — bypasses any me() cache
    const total = events.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
    setXpTotal(total);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-gold-primary" size={28} /></div>;
  }

  const completedModules = progress.filter(p => p.status === 'completed').length;
  const totalModules = progress.length;
  const streak = userProgress?.consecutive_streak_count || 0;
  const bestStreak = userProgress?.streak_best || 0;
  const accuracy = userProgress?.accuracy_rate || 0;
  const totalAnswered = userProgress?.total_answered || 0;

  return (
    <div className="min-h-screen pb-24">
      {showSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-3 text-center">
          <p className="font-display text-sm font-bold text-green-800">
            ✦ Welcome to {successTier === 'calendar' ? 'Navigator' : 'Interpreter'}!
          </p>
          <p className="font-body text-xs text-green-700 mt-0.5">Your subscription is now active.</p>
        </div>
      )}

      <PageHeader>
        {/* Profile header */}
        <div className="px-4 pt-10 pb-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/[0.08] border-2 border-gold-primary/50 flex items-center justify-center">
                <span className="font-display text-2xl font-bold text-gold-accent">
                  {(nameValue || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(e); if (e.key === 'Escape') { setEditingName(false); setNameValue(user?.display_name || user?.full_name || ''); } }}
                      autoFocus
                      className="font-display text-xl font-bold text-cream bg-paper/60 border border-gold-primary/30 rounded px-2 py-1 outline-none"
                    />
                    <button onClick={saveName} disabled={savingName} className="text-green-600 hover:text-green-700 disabled:opacity-50" type="button">
                      <Check size={16} />
                    </button>
                    <button type="button" onClick={() => { setEditingName(false); setNameValue(user?.display_name || user?.full_name || ''); }} className="text-brass/60 hover:text-brass">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="font-display text-xl font-bold text-cream">{user?.display_name || user?.full_name || 'Seeker'}</h1>
                    <button onClick={() => setEditingName(true)} className="text-brass/60 hover:text-brass">
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
                <p className="font-body text-xs text-brass/80">{user?.email}</p>
                <FoundingPatronBadge isFounding={!!user?.is_founding_member} className="mt-2" />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => base44.auth.logout()} className="text-brass/60 hover:text-brass">
              <LogOut size={16} />
            </Button>
          </div>

          <LearningTierGauge userProgress={userProgress} />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/[0.08] overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-3 font-body text-xs tracking-widest uppercase transition-colors border-b-2 whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-gold-accent text-white font-semibold'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="px-4 py-5 max-w-5xl mx-auto space-y-4">

        {/* Details tab */}
        {activeTab === 'details' && (
          <div className="space-y-3">
            {user?.birth_date ? (
              <div className="celestial-card p-3 flex items-center justify-between">
                <div>
                  <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Birth Info</p>
                  <p className="font-body text-sm text-cream">{user.birth_date}{user.birth_location ? ` · ${user.birth_location}` : ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="text-brass hover:text-cream h-8 w-8 p-0">
                  <Pencil size={14} />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} className="w-full border-gold-primary/40 font-body text-sm text-brass">
                <Pencil size={14} className="mr-1.5" /> Add Birth Information
              </Button>
            )}

            <div className="celestial-card p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Globe size={13} className="text-brass/60" />
                <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Timezone</p>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <select
                  value={tzValue}
                  onChange={e => saveTimezone(e.target.value)}
                  className="bg-transparent font-body text-xs text-cream border-none outline-none cursor-pointer max-w-[180px] truncate"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                {tzSaved && <Check size={12} className="text-green-600 shrink-0" />}
              </div>
            </div>

            <FontSizeControl />

            <KnowledgeDensitySlider />

            {/* Daily email digest toggle */}
            <div className="celestial-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={13} className="text-brass/60" />
                  <div>
                    <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Daily Email Digest</p>
                    <p className="font-body text-[0.625rem] text-brass/40">Free — transits, synthesis & quiz each morning</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const next = !user?.daily_email_opt_in;
                    await base44.auth.updateMe({ daily_email_opt_in: next });
                    reloadUser();
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${user?.daily_email_opt_in ? 'bg-gold-primary/60' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${user?.daily_email_opt_in ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {!user?.daily_email_opt_in && (
                <p className="font-body text-[0.625rem] text-gold-accent/70 italic">
                  Turn it on to get your personalized transits, daily synthesis, and a quiz prompt in your inbox every morning.
                </p>
              )}
            </div>

            <div className="celestial-card p-3 flex items-center justify-between">
              <p className="font-body text-xs text-brass/70 uppercase tracking-wide">Time Format</p>
              <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-0.5">
                {['12h','24h'].map(fmt => {
                  const active = (user?.time_format || '12h') === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={async () => { await base44.auth.updateMe({ time_format: fmt }); reloadUser(); }}
                      className={`px-2.5 py-1 rounded-full font-body text-[0.6875rem] transition-all ${
                        active ? 'bg-gold-primary/20 text-white' : 'text-white/30 hover:text-white/50'
                      }`}
                    >{fmt === '12h' ? '12-hour' : '24-hour'}</button>
                  );
                })}
              </div>
            </div>

            <GoogleCalendarConnect />

            <DeleteAccountSection />
          </div>
        )}

        {/* Plan tab */}
        {activeTab === 'plan' && <SubscriptionSection />}

        {/* My Astrosetta Moment — saved event confirmation */}
        {activeTab === 'moment' && <MyMomentSection />}

        {/* Chart tab */}
        {activeTab === 'chart' && (
          chart ? (
            <div className="celestial-card p-3 space-y-3">
              <div className="flex justify-around py-1">
                {[
                  { glyph: '☉', label: 'Sun', value: chart.sun_sign },
                  { glyph: '☽', label: 'Moon', value: chart.moon_sign },
                  { glyph: 'AC', label: 'Rising', value: chart.ascendant_sign },
                ].map(({ glyph, label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-lg text-gold-accent font-display">{glyph}</div>
                    <div className="text-[0.625rem] font-body uppercase tracking-widest text-brass">{label}</div>
                    <div className="text-sm font-display font-bold text-cream"><SignName sign={value} /></div>
                  </div>
                ))}
              </div>
              <OrnamentDivider />
              <ChartWheel chartData={chart.raw_data} showAsteroids={user?.show_asteroids !== false} showAngles={user?.show_angles !== false} showPof={user?.show_pof !== false} showNodes={user?.show_nodes !== false} showLilith={user?.show_lilith !== false} />
              <TraditionSelector
                userProgress={userProgress}
                existingChart={chart}
                onChartRegenerated={loadData}
              />
              <ChartDisplaySettings />
              <div className="flex justify-center gap-3 pt-1">
                <Button variant="ghost" size="sm" onClick={() => navigate('/chart')} className="font-body text-xs text-gold-accent hover:text-cream">
                  ✦ See Chart Details
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="font-body text-xs text-brass hover:text-cream">
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="font-body text-sm text-brass italic">No chart yet.</p>
              <Button variant="ghost" size="sm" onClick={() => setShowEditModal(true)} className="font-body text-xs text-gold-accent">
                Add birth information to generate your chart
              </Button>
            </div>
          )
        )}



        {/* Streak tab */}
        {activeTab === 'streak' && (
          <div className="space-y-4">
            {/* Streak summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="celestial-card p-4 text-center space-y-1">
                <div className="text-2xl font-display text-gold-accent">✦</div>
                <div className="font-display text-3xl font-bold text-white">{streak}</div>
                <div className="font-body text-[0.625rem] text-brass uppercase tracking-wide">Current Streak</div>
              </div>
              <div className="celestial-card p-4 text-center space-y-1">
                <div className="text-2xl font-display text-gold-accent">◎</div>
                <div className="font-display text-3xl font-bold text-white">{bestStreak}</div>
                <div className="font-body text-[0.625rem] text-brass uppercase tracking-wide">Best Streak</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="celestial-card p-4 text-center space-y-1">
                <div className="font-display text-3xl font-bold text-white">{accuracy}%</div>
                <div className="font-body text-[0.625rem] text-brass uppercase tracking-wide">Accuracy</div>
              </div>
              <div className="celestial-card p-4 text-center space-y-1">
                <div className="font-display text-3xl font-bold text-white">{totalAnswered}</div>
                <div className="font-body text-[0.625rem] text-brass uppercase tracking-wide">Questions Answered</div>
              </div>
            </div>

            {/* XP meter — reads the same ledger every curriculum and quiz award lands in */}
            <div className="celestial-card p-4 space-y-2">
              <p className="font-display text-sm font-bold text-white">Experience</p>
              <XpMeter xpTotal={xpTotal} />
            </div>

            {/* Tier progression — uses shared REQUIREMENTS so displayed targets
                always match the real advancement thresholds (10/20 quiz days,
                not the stale 14/30 hard-coded here previously). */}
            <TierProgressCard userProgress={userProgress} />

            {/* Curriculum progress */}
            <div className="celestial-card p-4 space-y-2">
              <p className="font-display text-sm font-bold text-white">Curriculum Progress</p>
              <div className="flex items-center justify-between">
                <p className="font-body text-xs text-white/60">{completedModules} of {totalModules} modules completed</p>
                <p className="font-body text-xs text-gold-accent">{totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0}%</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gold-primary rounded-full" style={{ width: `${totalModules > 0 ? (completedModules / totalModules) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <EditBirthDataModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={user}
        existingChart={chart}
        houseSystem={userProgress?.house_system || 'whole_sign'}
        tradition={userProgress?.active_tradition || 'modern'}
        onChartRegenerated={async () => {
          if (isImpersonating) {
            const users = await base44.entities.User.list(null, 200);
            const updated = users.find(u => u.id === user.id);
            if (updated) impersonate(updated);
          }
          loadData();
        }}
        isImpersonating={isImpersonating}
      />
    </div>
  );
}