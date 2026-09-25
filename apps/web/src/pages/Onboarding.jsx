import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import BirthDataForm from '@/components/onboarding/BirthDataForm';
import ChartSummaryPreview from '@/components/onboarding/ChartSummaryPreview';
import ReferralSourceStep from '@/components/onboarding/ReferralSourceStep';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { track, EVENTS } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Mail, Check, Sparkles, ArrowRight } from 'lucide-react';
import { depthFromOnboardingLevel } from '@/lib/knowledgeDensity';
import { useUserPrefs } from '@/lib/UserPrefsContext';

const STEPS = ['age_gate', 'experience', 'referral', 'birth_data', 'chart_summary', 'email_digest'];

const ASTRO_LEVELS = [
  { key: 'new',      label: "New to astrology",           desc: "I know my Sun sign but not much else",            start: 'foundations' },
  { key: 'some',     label: "Some basics",                 desc: "I know my Big Three and a few planets",           start: 'planets' },
  { key: 'familiar', label: "Fairly familiar",             desc: "I understand houses, aspects, and transits",      start: 'elements_modalities' },
  { key: 'advanced', label: "Practiced or advanced",       desc: "I interpret charts and follow transits regularly", start: 'aspects' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { knowledgeDepth: currentDepth, reload: reloadPrefs } = useUserPrefs();
  const [step, setStep] = useState('age_gate');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [referralSource, setReferralSource] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [placementKeys, setPlacementKeys] = useState([]);
  const [sunSign, setSunSign] = useState('');
  const [moonSign, setMoonSign] = useState('');
  const [ascSign, setAscSign] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(true);

  const handleReferralComplete = (referral) => {
    setReferralSource(referral);
    setStep('birth_data');
  };

  const handleBirthDataComplete = (data, keys, asc, sun, moon) => {
    setChartData(data);
    setPlacementKeys(keys);
    setAscSign(asc);
    setSunSign(sun);
    setMoonSign(moon);
    setStep('chart_summary');
  };

  const handleStartLearning = async () => {
    const startSection = selectedLevel?.start || 'foundations';
    track(EVENTS.ONBOARDING_COMPLETED, { sun_sign: sunSign, moon_sign: moonSign, ascendant_sign: ascSign, start_section: startSection });
    // Persist chosen start section so the Learn page can queue the right modules
    try {
      const [existing] = await base44.entities.UserProgress.filter({ user_id: user.id });
      const updateData = { recommended_start_section: startSection };
      // Map the onboarding familiarity answer to an initial Knowledge Density
      // so interpretations, curriculum, and email tone match the user from day one.
      if (selectedLevel?.key) {
        updateData.knowledge_depth = depthFromOnboardingLevel(selectedLevel.key);
      }
      if (referralSource) {
        updateData.referral_source = referralSource.referral_source;
        if (referralSource.referral_source_detail) {
          updateData.referral_source_detail = referralSource.referral_source_detail;
        }
      }
      if (existing) {
        await base44.entities.UserProgress.update(existing.id, updateData);
      } else {
        await base44.entities.UserProgress.create({ user_id: user.id, current_tier: 'apprentice', ...updateData });
      }
    } catch {}
    // Fire analytics + sync the global preference context so the chosen depth
    // is reflected immediately on /home (and in the Profile slider) without a reload.
    const chosenDepth = depthFromOnboardingLevel(selectedLevel?.key);
    if (chosenDepth && chosenDepth !== currentDepth) {
      track(EVENTS.KNOWLEDGE_DENSITY_CHANGED, { old_depth: currentDepth, new_depth: chosenDepth, source: 'onboarding' });
    }
    reloadPrefs();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-[#0f1a2e] flex flex-col">
      {/* Centered container — wide on desktop */}
      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 px-6 py-12">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="text-4xl font-display text-gold-accent">✦</div>
          <h1 className="font-display text-3xl font-bold text-white">Astrosetta</h1>
          <p className="font-body text-sm text-brass italic">
            {step === 'age_gate'
              ? 'Before we begin'
              : step === 'experience'
              ? 'Personalize your path'
              : step === 'referral'
              ? 'How did you get here?'
              : step === 'birth_data'
              ? 'Let us cast your natal chart'
              : step === 'email_digest'
              ? 'One last thing'
              : 'Your chart has been drawn'}
          </p>
          <OrnamentDivider className="mt-2" />
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                step === s || STEPS.indexOf(step) > i ? 'bg-gold-primary' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        <div className="flex-1">
          {step === 'age_gate' && (
            <div className="space-y-5 animate-fade-up">
              <div className="space-y-1">
                <h2 className="font-display text-xl text-white">Age Confirmation</h2>
                <p className="font-body text-xs text-brass/80">Astrosetta is designed for users who are at least 13 years old. Subscriptions require you to be 18 or older.</p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" id="age-confirm" defaultChecked={false}
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-transparent text-gold-primary focus:ring-gold-accent shrink-0"
                    onChange={(e) => setAgeConfirmed(e.target.checked)} />
                  <span className="font-body text-xs text-white/70 leading-relaxed">
                    I confirm that I am at least <strong className="text-white/90">13 years old</strong>, and I understand that purchasing a subscription requires me to be <strong className="text-white/90">18 or older</strong>.
                  </span>
                </label>
                <p className="font-body text-[10px] text-brass/40 leading-relaxed">
                  By continuing you agree to our <a href="/terms" className="text-gold-accent underline hover:text-gold-primary">Terms of Service</a> and <a href="/privacy" className="text-gold-accent underline hover:text-gold-primary">Privacy Policy</a>.
                </p>
              </div>
              <Button
                onClick={() => setStep('experience')}
                disabled={!ageConfirmed}
                className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all disabled:opacity-40"
              >
                Continue ✦
              </Button>
            </div>
          )}

          {step === 'experience' && (
            <div className="space-y-5 animate-fade-up">
              <div className="space-y-1">
                <h2 className="font-display text-xl text-white">How familiar are you with astrology?</h2>
                <p className="font-body text-xs text-brass/80">We'll tailor your learning queue to match where you are.</p>
              </div>
              <div className="space-y-2.5">
                {ASTRO_LEVELS.map((level) => {
                  const isSelected = selectedLevel?.key === level.key;
                  return (
                    <button
                      key={level.key}
                      onClick={() => setSelectedLevel(level)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-gold-accent/60 bg-gold-accent/10'
                          : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
                      }`}
                    >
                      <div className="font-body text-sm font-semibold text-white">{level.label}</div>
                      <div className="font-body text-xs text-brass/60 mt-0.5">{level.desc}</div>
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => setStep('referral')}
                disabled={!selectedLevel}
                className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all disabled:opacity-40"
              >
                Continue ✦
              </Button>
            </div>
          )}

          {step === 'referral' && (
            <ReferralSourceStep onComplete={handleReferralComplete} />
          )}

          {step === 'birth_data' && (
            <div className="space-y-2">
              <h2 className="font-display text-xl text-white">When & Where Were You Born?</h2>
              <p className="font-body text-xs text-brass/80 mb-4">
                This information is used only to calculate your natal chart.
              </p>
              <BirthDataForm user={user} onComplete={handleBirthDataComplete} />
            </div>
          )}

          {step === 'chart_summary' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="font-display text-xl text-white">Your Chart Awaits</h2>
                <p className="font-body text-xs text-brass italic">+50 XP — First Chart</p>
              </div>
              <ChartSummaryPreview
                chartData={chartData}
                sunSign={sunSign}
                moonSign={moonSign}
                ascSign={ascSign}
                placementKeys={placementKeys}
                onStartLearning={() => setStep('email_digest')}
              />
            </div>
          )}

          {step === 'email_digest' && (
            <div className="space-y-5 animate-fade-up">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center mx-auto">
                  <Mail size={26} className="text-gold-accent" />
                </div>
                <h2 className="font-display text-xl text-white">Your Stars, Every Morning</h2>
                <p className="font-body text-xs text-brass/80 leading-relaxed">
                  Wake up to a personalized astrological briefing — your transits, daily synthesis,
                  and a quiz prompt to keep your streak alive. Free, and you can turn it off anytime.
                </p>
              </div>

              <div className="space-y-2.5">
                <DigestRow title="Personal Transits" desc="How today's planets interact with your natal chart — in plain language." />
                <DigestRow title="Daily Synthesis" desc="Maximize, focus, and watch-out guidance tailored to your chart." />
                <DigestRow title="Quiz Teaser" desc="An intriguing prompt tied to today's sky to keep your streak going." />
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-body text-sm font-semibold text-white">Send me the daily digest</p>
                    <p className="font-body text-[10px] text-brass/60">To {user?.email || 'your email'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailOptIn(!emailOptIn)}
                    className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${emailOptIn ? 'bg-gold-primary/60' : 'bg-white/10'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${emailOptIn ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </label>
              </div>

              <Button
                onClick={async () => {
                  try {
                    await base44.auth.updateMe({ daily_email_opt_in: emailOptIn });
                  } catch {}
                  // Send the detailed chart-recap email to users who opted in.
                  // Fire-and-forget — the recap generates server-side and shouldn't block entry.
                  if (emailOptIn) {
                    base44.functions.invoke('sendChartRecapEmail', {}).catch(() => {});
                  }
                  handleStartLearning();
                }}
                className="w-full bg-gold-primary hover:bg-gold-accent text-deep-blue font-display font-bold text-base tracking-wide rounded-xl h-12 shadow-sm transition-all"
              >
                {emailOptIn ? (
                  <>Start Learning <ArrowRight size={16} className="ml-1 inline" /></>
                ) : (
                  'Maybe later'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DigestRow({ title, desc }) {
  return (
    <div className="flex items-start gap-3 px-1">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center">
        <Check size={14} className="text-gold-accent" />
      </div>
      <div>
        <p className="font-body text-xs font-semibold text-white">{title}</p>
        <p className="font-body text-[11px] text-brass/70 leading-snug">{desc}</p>
      </div>
    </div>
  );
}