import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, ChevronRight, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { LEVELS } from '@/lib/xpUtils';
import { Button } from '@/components/ui/button';
import QuizQuestion from './QuizQuestion';
import StreakBonusCard from './StreakBonusCard';
import TierBadge from './TierBadge';
import TierProgressCard from './TierProgressCard';
import QuizHistoryDrawer from './QuizHistoryDrawer';
import BonusQuizCard from './BonusQuizCard';
import { track, EVENTS } from '@/lib/analytics';
import { forceTextGlyph } from '@/lib/chartUtils';

const PLANET_GLYPHS = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E',
  Jupiter: '♃\uFE0E', Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E',
};

function TransitContextStrip({ transits }) {
  if (!transits?.moonSign) return null;
  const aspects = transits.aspects?.slice(0, 2) || [];
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-gold-primary/15">
      <span className="font-body text-[10px] text-brass uppercase tracking-widest font-semibold mr-0.5">Today's sky</span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-deep-blue/8 border border-gold-primary/20 font-body text-[11px] text-white">
        <span style={{ fontVariantEmoji: 'text', fontFamily:'serif' }}>{forceTextGlyph('☽')}</span> Moon in {transits.moonSign}
      </span>
      {aspects.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-gold-primary/20 font-body text-[11px] text-white/80" style={{fontVariantEmoji:'text'}}>
          {forceTextGlyph(PLANET_GLYPHS[a.planet] || '✦')} {a.planet} {a.aspect} {forceTextGlyph(PLANET_GLYPHS[a.natal_planet] || '')}{a.natal_planet || a.sign || ''}
        </span>
      ))}
    </div>
  );
}

export default function DailyQuizCard({ userProgress, onProgressUpdate, transits }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [tierAdvanced, setTierAdvanced] = useState(null);
  const [retaking, setRetaking] = useState(false);
  const [retakeAnswers, setRetakeAnswers] = useState([]);

  useEffect(() => {
    if (user) loadQuiz();
  }, [user]);

  const loadQuiz = async () => {
    setLoading(true);
    setLoadError(null);
    const timezone = user?.current_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const res = await base44.functions.invoke('generateDailyQuiz', { timezone, quiz_mode: 'progression' });
    const q = res.data?.quiz;
    if (!q) {
      setLoadError('Could not load today\'s quiz.');
      setLoading(false);
      return;
    }
    setQuiz(q);

    // If already completed today, show results
    if (q.completed_at) {
      setCompleted(true);
      setFinalScore(q.score);
    } else if (q.user_answers?.length > 0) {
      // Partially answered — resume where left off
      setCurrentQ(q.user_answers.length);
    }
    setLoading(false);
  };

  const handleAnswer = async (chosenIdx) => {
    if (submitting || answered) return;

    // Retake mode: just show correct/incorrect locally without re-submitting
    if (retaking) {
      const q = questions[currentQ];
      const correct_index = q.correct_index;
      const isLast = currentQ === questions.length - 1;
      setLastResult({
        is_correct: chosenIdx === correct_index,
        explanation: q.explanation || '',
        correct_index,
        chosen_option_index: chosenIdx
      });
      setAnswered(true);
      setRetakeAnswers(prev => {
        const filtered = prev.filter(a => a.question_index !== currentQ);
        return [...filtered, { question_index: currentQ, chosen_option_index: chosenIdx }];
      });
      if (isLast) setFinalScore(null);
      return;
    }

    setSubmitting(true);

    const res = await base44.functions.invoke('submitQuizAnswer', {
      quiz_id: quiz.id,
      question_index: currentQ,
      chosen_option_index: chosenIdx
    });

    const data = res.data;
    setLastResult({
      is_correct: data.is_correct,
      explanation: data.explanation,
      correct_index: data.correct_index,
      chosen_option_index: chosenIdx
    });
    setAnswered(true);
    setSubmitting(false);

    if (data.quiz_complete) {
      track(EVENTS.DAILY_QUIZ_COMPLETED, {
        score: data.score,
        tier: quiz.tier,
        streak: data.streak,
        tier_advanced: !!data.tier_advanced,
      });
      setFinalScore(data.score);
      setStreakData({ streak: data.streak, streak_bonus_unlocked: data.streak_bonus_unlocked });
      if (data.tier_advanced) setTierAdvanced(data.tier_advanced);
      if (data.xp_leveled_up) {
        const levelInfo = LEVELS.find(l => l.name === data.new_xp_level);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        toast.success(
          <div className="text-center">
            <p className="font-display font-bold text-base">✦ Level Up! ✦</p>
            <p className="font-body text-sm mt-0.5">You've reached <span className="font-bold capitalize">{levelInfo?.label || data.new_xp_level}</span></p>
          </div>,
          { duration: 5000 }
        );
      }
      if (onProgressUpdate) {
        onProgressUpdate(prev => ({
          ...(prev || {}),
          consecutive_streak_count: data.streak,
          modules_completed: data.modules_completed,
          current_tier: data.current_tier || (prev?.current_tier),
          apprentice_quiz_days_count: data.apprentice_quiz_days_count ?? prev?.apprentice_quiz_days_count,
          apprentice_correct_total: data.apprentice_correct_total ?? prev?.apprentice_correct_total,
          apprentice_questions_total: data.apprentice_questions_total ?? prev?.apprentice_questions_total,
          adept_quiz_days_count: data.adept_quiz_days_count ?? prev?.adept_quiz_days_count,
          adept_correct_total: data.adept_correct_total ?? prev?.adept_correct_total,
          adept_questions_total: data.adept_questions_total ?? prev?.adept_questions_total,
        }));
      }
    }
  };

  const submitRetake = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitRetake', {
        quiz_id: quiz.id,
        answers: retakeAnswers,
      });
      const data = res.data;
      if (data?.score != null) {
        setFinalScore(data.score);
        if (data.updated) {
          setQuiz(prev => prev ? ({ ...prev, score: data.score }) : prev);
          if (onProgressUpdate) {
            onProgressUpdate(prev => ({
              ...(prev || {}),
              apprentice_correct_total: data.apprentice_correct_total ?? prev?.apprentice_correct_total,
              adept_correct_total: data.adept_correct_total ?? prev?.adept_correct_total,
              accuracy_rate: data.accuracy_rate ?? prev?.accuracy_rate,
            }));
          }
        }
      } else {
        setFinalScore(quiz.score);
      }
    } catch {
      setFinalScore(quiz.score);
    }
    setSubmitting(false);
    setCompleted(true);
    setRetaking(false);
  };

  const handleNext = () => {
    if (retaking && currentQ === questions.length - 1) {
      submitRetake();
      return;
    }
    if (finalScore !== null) {
      setCompleted(true);
      setRetaking(false);
      return;
    }
    setAnswered(false);
    setLastResult(null);
    setCurrentQ(i => i + 1);
  };

  const handleRetake = () => {
    setRetaking(true);
    setCompleted(false);
    setCurrentQ(0);
    setAnswered(false);
    setLastResult(null);
    setFinalScore(null);
    setStreakData(null);
    setTierAdvanced(null);
    setRetakeAnswers([]);
  };

  if (loading) {
    return (
      <div className="celestial-card p-5 flex items-center justify-center gap-2 text-brass font-body text-sm">
        <Loader2 size={16} className="animate-spin text-gold-primary" />
        Loading today's quiz…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="celestial-card p-5 text-center space-y-3">
        <p className="font-body text-sm text-brass italic">{loadError}</p>
        <Button variant="outline" size="sm" onClick={loadQuiz} className="border-gold-primary/40 text-brass font-body text-xs">
          Try Again
        </Button>
      </div>
    );
  }

  if (!quiz) return null;

  const tier = quiz.tier || 'apprentice';
  const questions = quiz.questions || [];

  // Completed state
  if (completed) {
    const streakCount = streakData?.streak || userProgress?.consecutive_streak_count || 0;
    const bonusUnlocked = true; // Quiz completed — Practitioner's Lens is unlocked
    const displayTier = userProgress?.current_tier || tier;

    return (
      <div className="space-y-4">
        {tierAdvanced && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="celestial-card p-4 text-center space-y-2 bg-gradient-to-br from-gold-primary/20 to-paper border-gold-accent/60"
          >
            <p className="text-2xl">✨</p>
            <p className="font-display text-base font-bold text-white">Tier Advanced!</p>
            <p className="font-body text-xs text-brass italic">
              You've earned your way to <span className="font-bold capitalize text-gold-accent">{tierAdvanced}</span>
            </p>
            <TierBadge tier={tierAdvanced} />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="celestial-card p-5 space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-gold-accent" />
                <p className="font-display text-sm font-bold text-white">Daily Quiz Complete</p>
              </div>
              <TierBadge tier={displayTier} streak={streakCount} />
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-white">{finalScore ?? quiz.score}%</p>
              <p className="font-body text-[10px] text-brass font-semibold">score</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gold-primary/8 border border-gold-primary/20 rounded-lg px-3 py-2">
            <span className="text-lg">✦</span>
            <div>
              <p className="font-body text-xs text-white font-semibold">Practitioner's Lens unlocked</p>
              <p className="font-body text-[10px] text-gold-accent">Your daily deep-dive transit insight is ready</p>
            </div>
          </div>

          <p className="font-body text-xs text-brass italic text-center">Keep learning at your own pace ✦</p>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRetake}
            className="w-full border-gold-primary/30 text-brass font-body text-xs hover:text-white"
          >
            Retake Quiz
          </Button>
        </motion.div>

        {bonusUnlocked && <StreakBonusCard userProgress={userProgress} />}
        {!tierAdvanced && <TierProgressCard userProgress={userProgress} />}
        <BonusQuizCard userProgress={userProgress} />
      </div>
    );
  }

  // Quiz already done today (loaded from cache with completed_at)
  if (quiz.completed_at && !completed && !retaking) {
    const streakCount = userProgress?.consecutive_streak_count || 0;
    const bonusUnlocked = true; // Quiz completed — Practitioner's Lens is unlocked

    return (
      <div className="space-y-4">
        <div className="celestial-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-gold-accent" />
              <p className="font-display text-sm font-bold text-white">Quiz Done Today</p>
            </div>
            <TierBadge tier={tier} streak={streakCount} />
          </div>
          <div className="flex items-center justify-between">
            <p className="font-body text-sm text-brass">Score: <span className="font-bold text-white">{quiz.score}%</span></p>
            <div className="flex items-center gap-1.5">
              <span>✦</span>
              <span className="font-body text-sm text-white font-semibold">Practitioner's Lens ready</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetake}
            className="w-full border-gold-primary/30 text-brass font-body text-xs hover:text-white"
          >
            Retake Quiz
          </Button>
        </div>
        {bonusUnlocked && <StreakBonusCard userProgress={userProgress} />}
        <TierProgressCard userProgress={userProgress} />
        <BonusQuizCard userProgress={userProgress} />
      </div>
    );
  }

  const currentQuestion = questions[currentQ];
  if (!currentQuestion) return null;

  const handleLearn = () => {
    const learn = currentQuestion?.learn;
    if (!learn) return;
    navigate('/learn', {
      state: {
        subjectKey: learn.subject_key,
        section: learn.section,
        blockIndex: learn.block_index,
        title: learn.title,
      },
    });
  };

  return (
    <div className="celestial-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-bold text-white">Daily Transit Quiz</p>
        <div className="flex items-center gap-2">
          <QuizHistoryDrawer userProgress={userProgress} />
          <TierBadge tier={tier} />
        </div>
      </div>

      <TransitContextStrip transits={transits} />

      <AnimatePresence mode="wait">
        <QuizQuestion
          key={currentQ}
          question={currentQuestion}
          questionNumber={currentQ + 1}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
          answered={answered}
          result={lastResult}
          onLearn={currentQuestion?.learn ? handleLearn : null}
        />
      </AnimatePresence>

      {answered && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button
            onClick={handleNext}
            disabled={submitting}
            className="w-full bg-gold-primary hover:bg-gold-accent text-paper font-body text-sm gap-2"
          >
            {finalScore !== null ? 'See Results' : 'Next Question'}
            <ChevronRight size={16} />
          </Button>
        </motion.div>
      )}

      {submitting && (
        <div className="flex justify-center">
          <Loader2 size={16} className="animate-spin text-gold-primary" />
        </div>
      )}
    </div>
  );
}