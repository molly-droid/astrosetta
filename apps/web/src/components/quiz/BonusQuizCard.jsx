import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuizQuestion from './QuizQuestion';
import { awardXP } from '@/lib/xpUtils';

export default function BonusQuizCard({ userProgress, onClose }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [roundDone, setRoundDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const updateProgressStats = async (correct, total) => {
    const records = await base44.entities.UserProgress.filter({ user_id: user.id });
    const prog = records[0];
    if (!prog) return;
    const prevTotal = prog.total_answered || 0;
    const prevCorrect = Math.round(((prog.accuracy_rate || 0) / 100) * prevTotal);
    const newTotal = prevTotal + total;
    const newAccuracy = newTotal > 0 ? Math.round(((prevCorrect + correct) / newTotal) * 100) : 0;
    await base44.entities.UserProgress.update(prog.id, { total_answered: newTotal, accuracy_rate: newAccuracy });
  };

  const startRound = async () => {
    setLoading(true);
    setCurrentQ(0);
    setAnswered(false);
    setLastResult(null);
    setXpEarned(0);
    setRoundDone(false);
    setCorrectCount(0);
    const timezone = user?.current_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const tier = userProgress?.current_tier || 'apprentice';
    const res = await base44.functions.invoke('generateBonusQuiz', { timezone, tier });
    setQuestions(res.data?.questions || []);
    setLoading(false);
  };

  const handleAnswer = (chosenIdx) => {
    if (answered) return;
    const q = questions[currentQ];
    const isCorrect = chosenIdx === q.correct_index;
    setLastResult({ is_correct: isCorrect, explanation: q.explanation, correct_index: q.correct_index, chosen_option_index: chosenIdx });
    setAnswered(true);
    if (isCorrect) {
      setCorrectCount(c => c + 1);
      setXpEarned(x => x + 10);
      awardXP(user.id, 'card_completed', 10, 'bonus_quiz', user.level).catch(() => {});
    }
  };

  const handleNext = () => {
    if (currentQ + 1 >= questions.length) {
      setRoundDone(true);
      // correctCount is already fully updated by handleAnswer before handleNext is called
      updateProgressStats(correctCount, questions.length).catch(() => {});
      return;
    }
    setAnswered(false);
    setLastResult(null);
    setCurrentQ(i => i + 1);
  };

  // Entry state — not yet started
  if (!questions && !loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="celestial-card p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-gold-accent" />
          <p className="font-display text-sm font-bold text-white">Keep Studying</p>
        </div>
        <p className="font-body text-xs text-brass leading-relaxed">
          Daily quiz done! Generate a fresh bonus round — 5 new questions, earn 10 XP per correct answer.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={startRound}
            className="flex-1 bg-gold-primary/20 hover:bg-gold-primary/30 border border-gold-primary/40 text-gold-primary font-body text-xs gap-2"
            variant="outline"
          >
            <Sparkles size={13} /> Start Bonus Round
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-brass/60 font-body text-xs">
              Dismiss
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="celestial-card p-5 flex items-center justify-center gap-2 text-brass font-body text-sm">
        <Loader2 size={16} className="animate-spin text-gold-primary" />
        Generating questions…
      </div>
    );
  }

  if (roundDone) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="celestial-card p-5 space-y-4"
      >
        <div className="text-center space-y-2">
          <p className="text-2xl">✦</p>
          <p className="font-display text-sm font-bold text-white">Round Complete!</p>
          <p className="font-body text-xs text-brass">
            {correctCount} / {questions.length} correct · <span className="text-gold-accent font-semibold">+{xpEarned} XP earned</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={startRound}
            className="flex-1 bg-gold-primary/20 hover:bg-gold-primary/30 border border-gold-primary/40 text-gold-primary font-body text-xs gap-2"
            variant="outline"
          >
            <RefreshCw size={13} /> Another Round
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-brass/60 font-body text-xs">
              Done
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  const currentQuestion = questions[currentQ];
  if (!currentQuestion) return null;

  return (
    <div className="celestial-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-gold-accent" />
          <p className="font-display text-sm font-bold text-white">Bonus Round</p>
        </div>
        {xpEarned > 0 && (
          <span className="font-body text-xs text-gold-accent font-semibold">+{xpEarned} XP</span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <QuizQuestion
          key={currentQ}
          question={currentQuestion}
          questionNumber={currentQ + 1}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
          answered={answered}
          result={lastResult}
        />
      </AnimatePresence>

      {answered && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {lastResult?.is_correct && (
            <p className="font-body text-xs text-gold-accent text-center mb-2 animate-fade-up">+10 XP ✦</p>
          )}
          <Button
            onClick={handleNext}
            className="w-full bg-gold-primary hover:bg-gold-accent text-paper font-body text-sm gap-2"
          >
            {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question'}
            <ChevronRight size={16} />
          </Button>
        </motion.div>
      )}
    </div>
  );
}