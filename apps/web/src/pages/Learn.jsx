import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp, Flame, Sparkles, Bell } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ModulePlayer from '@/components/learning/ModulePlayer';
import ScrollableTabs from '@/components/ui/ScrollableTabs';
import { forceTextGlyph } from '@/lib/chartUtils';
import { getLevelFromXP } from '@/lib/xpUtils';

const NEW_MODULE_KEYS = new Set(['chart_synthesis', 'retrograde_planets', 'synastry_basics', 'kite_pattern', 'mystic_rectangle_pattern', 'yod_pattern', 'part_of_fortune', 'part_of_spirit', 'part_of_eros', 'part_of_necessity', 'lunar_nodes', 'black_moon_lilith', 'chiron', 'tyche', 'traditions_intro', 'modern_origins', 'modern_techniques', 'modern_reading', 'hellenistic_origins', 'hellenistic_techniques', 'hellenistic_reading', 'vedic_origins', 'vedic_techniques', 'vedic_reading', 'decans', 'moon_phases', 'void_of_course', 'minor_aspects', 'cazimi_combust_beams', 'antiscia_contrascia', 'sect_day_night', 'peregrine_condition', 'profections', 'vedic_nakshatras', 'vedic_dashas', 'vedic_bhavas_sidereal']);

const SECTIONS = [
  { key: 'foundations', label: 'Foundations', glyph: '✦', description: 'How astrology works — natal vs transits, symbols, aspects, and how to read the sky', accent: '#D4AF85' },
  { key: 'planets', label: 'Planets', glyph: '☉', description: 'The celestial bodies and their meanings', accent: '#fb923c' },
  { key: 'signs', label: 'Signs & Elements', glyph: '♎\uFE0E', description: 'The twelve zodiac signs, their elements, and modalities', queryKeys: ['signs', 'elements_modalities'], accent: '#b8a5c8' },
  { key: 'houses', label: 'Houses', glyph: 'XII', description: 'The twelve life areas', accent: '#93c5fd' },
  { key: 'aspects', label: 'Aspects', glyph: '☌', description: 'Planetary relationships and angles', accent: '#67e8f9' },
  { key: 'dynamics', label: 'Dynamics', glyph: '◇', description: 'Chart ruler, stelliums, empty houses, and patterns — how your chart works as a whole', accent: '#D4AF85' },
  { key: 'classical_techniques', label: 'Classical', glyph: '⚜', description: 'Essential dignities and historical techniques from the classical tradition — rulership, exaltation, detriment, and fall', accent: '#C4A882' },
  { key: 'traditions', label: 'Traditions', glyph: '⊕', description: 'Modern, Hellenistic, and Vedic approaches — origins, key techniques, and how to read a chart in each tradition', accent: '#E8A030' },
];

export default function Learn() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState([]);
  const [chart, setChart] = useState(null);
  const [userProgress, setUserProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('foundations');
  const [activeModule, setActiveModule] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [resumeBlockIndex, setResumeBlockIndex] = useState(null);
  const navigate = useNavigate();

  const openModule = (mod, blockIndex = null) => {
    setResumeBlockIndex(blockIndex);
    setActiveModule(mod);
  };

  const handleViewChart = (blockIndex) => {
    navigate('/chart', { state: { returnToLearn: { subjectKey: activeModule.subject_key, section: activeSection, blockIndex, title: activeModule.title } } });
  };

  const handleSetSection = (key) => {
    setActiveSection(key);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('section', key);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async (opts = {}) => {
    const [mods, prog, charts, userProgressList] = await Promise.all([
      base44.entities.LearningModule.list('order_index'),
      base44.entities.UserModuleProgress.filter({ user_id: user.id }),
      base44.entities.Chart.filter({ user_id: user.id }),
      base44.entities.UserProgress.filter({ user_id: user.id }),
    ]);
    setModules(mods);
    setProgress(prog);
    setChart(charts[0] || null);
    if (userProgressList[0]) setUserProgress(userProgressList[0]);
    setLoading(false);

    if (opts.skipAutoSelect) return;

    if (location.state?.subjectKey && !opts.skipNavState) {
      const { section, subjectKey } = location.state;
      if (section) handleSetSection(section);
      const match = mods.find(m => m.subject_key === subjectKey);
      if (match) openModule(match, location.state?.blockIndex);
    } else if (searchParams.get('section')) {
      const urlSection = searchParams.get('section');
      if (SECTIONS.find(s => s.key === urlSection)) setActiveSection(urlSection);
    } else {
      // Use recommended start section from onboarding familiarity answer if no progress yet
      const userProgress = userProgressList[0];
      const hasAnyProgress = prog.some(p => p.status === 'completed' || p.status === 'in_progress');
      const recommended = userProgress?.recommended_start_section;

      if (!hasAnyProgress && recommended && SECTIONS.find(s => s.key === recommended)) {
        // Use onboarding recommendation only if foundations is already completed,
        // otherwise always start new users at foundations
        const foundationsMods = mods.filter(m => m.section === 'foundations');
        const foundationsComplete = foundationsMods.length > 0 &&
          foundationsMods.every(m => prog.find(pr => pr.module_id === m.id)?.status === 'completed');
        setActiveSection(foundationsComplete ? recommended : 'foundations');
      } else {
        // Auto-advance to first section that has modules with incomplete (or no) progress
        const firstIncomplete = SECTIONS.find(s => {
          const sectionMods = mods.filter(m =>
            s.queryKeys ? s.queryKeys.includes(m.section) : m.section === s.key
          );
          if (sectionMods.length === 0) return false;
          return sectionMods.some(m => prog.find(pr => pr.module_id === m.id)?.status !== 'completed');
        });
        setActiveSection(firstIncomplete?.key ?? 'foundations');
      }
    }
  };

  const getModuleProgress = (moduleId) =>
    progress.find(p => p.module_id === moduleId);

  const isSectionCompleted = (sectionKey) => {
    const config = SECTIONS.find(s => s.key === sectionKey);
    if (!config) return false;
    const sectionMods = modules.filter(m =>
      config.queryKeys ? config.queryKeys.includes(m.section) : m.section === config.key
    );
    return sectionMods.length > 0 && sectionMods.every(m =>
      getModuleProgress(m.id)?.status === 'completed'
    );
  };

  const streak = userProgress?.consecutive_streak_count || 0;
  const userLevel = getLevelFromXP(user?.xp_total || 0);
  const isPractitionerPlus = ['practitioner', 'sage'].includes(userLevel.name);

  // Sections that contain newly added modules — shows a bell on the tab
  const sectionsWithNew = SECTIONS.filter(s => {
    const sectionKeys = s.queryKeys || [s.key];
    return modules.some(m => sectionKeys.includes(m.section) && NEW_MODULE_KEYS.has(m.subject_key));
  }).map(s => s.key);
  const activeSectionConfig = SECTIONS.find(s => s.key === activeSection);
  const sectionModules = modules.filter(m =>
    activeSectionConfig?.queryKeys
      ? activeSectionConfig.queryKeys.includes(m.section)
      : m.section === activeSection
  );
  const pendingModules = sectionModules
    .filter(m => getModuleProgress(m.id)?.status !== 'completed')
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  const completedModules = sectionModules
    .filter(m => getModuleProgress(m.id)?.status === 'completed')
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const handleModuleComplete = () => {
    setActiveModule(null);
    loadData({ skipAutoSelect: true });
  };

  const handleNavigate = (nextMod, sectionKey) => {
    if (nextMod) {
      openModule(nextMod);
    } else if (sectionKey) {
      handleSetSection(sectionKey);
      setActiveModule(null);
    }
    loadData({ skipAutoSelect: true });
  };

  const renderModuleCard = (mod) => {
    const prog = getModuleProgress(mod.id);
    const isCompleted = prog?.status === 'completed';
    const isInProgress = prog?.status === 'in_progress';
    const accent = activeSectionConfig?.accent || '#D4AF85';
    return (
      <div
        key={mod.id}
        onClick={() => openModule(mod)}
        className="celestial-card p-4 flex items-center gap-4 transition-all cursor-pointer hover:shadow-md hover:scale-[1.01]"
        style={{ borderLeft: `3px solid ${isCompleted ? '#86efac44' : accent + '66'}` }}
      >
        <div className="shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="text-white" size={24} strokeWidth={1.5} />
          ) : (
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              isInProgress ? 'border-gold-accent bg-gold-primary/20' : 'border-gold-primary/40'
            }`}>
              {mod.glyph && <span className="text-xs text-gold-accent" style={{fontVariantEmoji:'text', fontFamily:'serif'}}>{forceTextGlyph(mod.glyph)}</span>}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold text-cream">{mod.title}</h3>
            {isInProgress && (
              <span className="text-[10px] font-body px-1.5 py-0.5 bg-gold-primary/20 text-brass rounded-full border border-gold-primary/30">
                In Progress
              </span>
            )}
            {NEW_MODULE_KEYS.has(mod.subject_key) && !isCompleted && (
              <span className="text-[9px] font-body px-1.5 py-0.5 bg-gold-accent/20 text-gold-accent rounded-full border border-gold-accent/40 uppercase tracking-wide font-bold flex items-center gap-0.5">
                <Bell size={8} className="fill-gold-accent/30" /> New
              </span>
            )}
          </div>
          {mod.subtitle && (
            <p className="font-body text-xs text-brass mt-0.5 truncate">{mod.subtitle}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="font-body text-[10px] text-brass">
              {mod.content_blocks?.length || 0} blocks
            </span>
            <span className="font-body text-[10px] text-gold-accent">
              +{mod.xp_reward || 50} XP
            </span>
            {isCompleted && prog?.xp_earned > 0 && (
              <span className="font-body text-[10px] text-brass">
                ✓ earned {prog.xp_earned} XP
              </span>
            )}
            {isPractitionerPlus && mod.mastery_blocks?.length > 0 && (
              <span className="font-body text-[10px] px-1.5 py-0.5 bg-gold-accent/15 text-gold-accent rounded-full border border-gold-accent/30 flex items-center gap-0.5">
                <Sparkles size={8} /> Mastery
              </span>
            )}
          </div>
        </div>
        {isInProgress && mod.content_blocks?.length > 0 && (
          <div className="shrink-0 w-8 h-8">
            <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#D4AF85" strokeWidth="2.5" strokeOpacity="0.3" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#C9A961" strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - (prog.current_block_index || 0) / mod.content_blocks.length)}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-gold-primary" size={28} />
      </div>
    );
  }

  if (activeModule) {
    return (
      <ModulePlayer
        module={activeModule}
        progress={getModuleProgress(activeModule.id)}
        userId={user.id}
        user={user}
        chart={chart}
        modules={modules}
        initialBlockIndex={resumeBlockIndex ?? 0}
        activeTradition={userProgress?.active_tradition || 'modern'}
        onClose={() => setActiveModule(null)}
        onComplete={handleModuleComplete}
        onNavigate={handleNavigate}
        onViewChart={handleViewChart}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <PageHeader>
        <div className="px-4 pt-12 pb-5 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-body text-xs text-white/40 uppercase tracking-widest">Astrology School</p>
              <h1 className="font-display text-2xl font-bold text-white">Learn</h1>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 text-gold-accent/60" title={`${streak}-day quiz streak`}>
                <Flame size={12} fill="#C9A961" className="text-gold-accent" />
                <span className="font-body text-xs font-semibold">{streak}</span>
              </div>
            )}
          </div>
          {activeSectionConfig && (
            <p className="font-body text-xs text-white/50 italic">{activeSectionConfig.description}</p>
          )}
        </div>

        {/* Section tabs */}
        <ScrollableTabs
          fullWidth
          tabs={SECTIONS.map(s => ({ key: s.key, label: s.label, glyph: s.glyph, completed: isSectionCompleted(s.key) }))}
          activeTab={activeSection}
          onChange={handleSetSection}
          renderTab={(tab) => (
            <span className="flex items-center gap-1.5">
              <span style={{ fontVariantEmoji: 'text', fontFamily: 'serif' }}>{forceTextGlyph(tab.glyph)}</span>
              <span>{tab.label}</span>
              {tab.completed && <CheckCircle2 size={10} className="text-white/40" />}
              {sectionsWithNew.includes(tab.key) && (
                <span className="relative flex items-center">
                  <Bell size={10} className="text-gold-accent fill-gold-accent/20" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-gold-accent rounded-full" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                </span>
              )}
            </span>
          )}
        />
      </PageHeader>

      {/* Modules list */}
      <div className="px-4 py-4 space-y-3">
        {pendingModules.length === 0 && completedModules.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="text-4xl text-gold-accent/40">✦</div>
            <p className="font-body text-sm text-brass italic">Modules coming soon...</p>
          </div>
        ) : (
          <>
            {pendingModules.length === 0 && completedModules.length > 0 && (
              <div className="text-center py-6 space-y-1">
                <p className="font-display text-sm text-gold-accent">Section Complete</p>
                <p className="font-body text-xs text-brass">All modules in this section are done. Tap the next section above to continue.</p>
              </div>
            )}
            {pendingModules.map(mod => renderModuleCard(mod))}
            {completedModules.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 w-full text-left py-2"
                >
                  <CheckCircle2 size={14} className="text-white/40" />
                  <span className="font-body text-xs text-brass">
                    {showCompleted ? 'Hide' : 'Show'} Completed ({completedModules.length})
                  </span>
                  {showCompleted ? (
                    <ChevronUp size={14} className="text-brass ml-auto" />
                  ) : (
                    <ChevronDown size={14} className="text-brass ml-auto" />
                  )}
                </button>
                {showCompleted && (
                  <div className="space-y-3 opacity-60">
                    {completedModules.map(mod => renderModuleCard(mod))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}