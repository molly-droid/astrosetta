import React, { useState, useMemo } from 'react';
import { X, ChevronRight, Sparkles, RotateCcw, Users, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrnamentDivider from '@/components/ui/OrnamentDivider';
import { base44 } from '@/api/base44Client';
import { awardXP, getLevelFromXP, LEVELS } from '@/lib/xpUtils';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

function shuffleQuizOptions(block) {
  if (!block.options) return block;
  const correctText = typeof block.answer === 'number'
    ? block.options[block.answer]
    : block.answer;
  const a = [...block.options];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const newIdx = a.indexOf(correctText);
  return { ...block, options: a, answer: newIdx };
}

export default function MasteryChallenge({ module: mod, progress, userId, onClose, onComplete }) {
  const [blockIndex, setBlockIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const blocks = useMemo(() => {
    return (mod.mastery_blocks || []).map(b => shuffleQuizOptions(b));
  }, [mod.id]);

  const block = blocks[blockIndex];
  const isLast = blockIndex === blocks.length - 1;

  const handleAnswer = (idx) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
  };

  const correctIdx = block?.type === 'quiz'
    ? (typeof block.answer === 'number'
        ? block.answer
        : block.options?.findIndex(o => o === block.answer))
    : -1;
  const isCorrect = answered && selectedAnswer === correctIdx;

  const handleNext = async () => {
    if (!answered) return;
    const nextIndex = blockIndex + 1;
    if (isLast) {
      setSaving(true);
      try {
        const masteryXp = mod.mastery_xp_reward || 100;

        // Update UserModuleProgress with mastery completion
        const data = {
          mastery_completed_at: new Date().toISOString(),
          mastery_xp_earned: masteryXp,
        };
        if (progress?.id) {
          await base44.entities.UserModuleProgress.update(progress.id, data);
        } else {
          await base44.entities.UserModuleProgress.create({
            user_id: userId,
            module_id: mod.id,
            status: 'completed',
            ...data,
          });
        }

        // Award XP
        const prevEvents = await base44.entities.XPEvent.filter({ user_id: userId });
        const prevTotal = prevEvents.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
        const prevLevel = getLevelFromXP(prevTotal).name;
        const result = await awardXP(userId, 'mastery_completed', masteryXp, mod.id, prevLevel);

        if (result.leveledUp) {
          const newLevelInfo = LEVELS.find(l => l.name === result.newLevel);
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          toast.success(
            <div className="text-center">
              <p className="font-display font-bold text-base">✦ Level Up! ✦</p>
              <p className="font-body text-sm mt-0.5">You've reached <span className="font-bold capitalize">{newLevelInfo?.label || result.newLevel}</span></p>
            </div>,
            { duration: 5000 }
          );
        }

        setSaving(false);
        setShowComplete(true);
      } catch (err) {
        setSaving(false);
        toast.error('Could not save mastery progress. Please try again.');
      }
    } else {
      setBlockIndex(nextIndex);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  };

  const handleRestart = () => {
    setBlockIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setShowComplete(false);
  };

  if (showComplete) {
    return (
      <div className="fixed inset-0 bg-cream z-[10020] flex flex-col">
        <div className="bg-paper border-b border-gold-primary/30 px-4 pt-10 pb-4 flex items-center gap-3">
          <button onClick={onClose} className="text-brass hover:text-white transition-colors">
            <X size={20} />
          </button>
          <div className="flex-1">
            <p className="font-body text-xs text-gold-accent uppercase tracking-widest">✦ Practitioner's Lens</p>
            <p className="font-display text-sm font-bold text-white">{mod.title}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-8 max-w-lg mx-auto w-full space-y-6">
          <div className="text-center space-y-3 animate-fade-up">
            <div className="text-5xl text-gold-accent">✦</div>
            <h2 className="font-display text-xl font-bold text-white">Mastery Achieved</h2>
            <p className="font-body text-sm text-brass">
              You've demonstrated practitioner-level understanding of {mod.title.toLowerCase()}.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold-primary/15 border border-gold-accent/30">
              <Sparkles size={14} className="text-gold-accent" />
              <span className="font-display text-sm font-bold text-gold-accent">+{mod.mastery_xp_reward || 100} XP</span>
            </div>
          </div>

          <OrnamentDivider />

          <div className="space-y-3">
            <Button
              onClick={handleRestart}
              variant="outline"
              className="w-full border-gold-primary/40 text-brass font-body text-sm"
            >
              <RotateCcw size={14} className="mr-2" />
              Try Again
            </Button>
            <Button
              onClick={onClose}
              className="w-full bg-gold-primary hover:bg-gold-accent text-paper font-display font-bold py-3"
            >
              Back to Learn
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="fixed inset-0 bg-cream z-[10020] flex items-center justify-center">
        <p className="font-body text-sm text-brass">No mastery content available.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-cream z-[10020] flex flex-col">
      {/* Header */}
      <div className="bg-paper border-b border-gold-accent/40 px-4 pt-10 pb-4 flex items-center gap-3">
        <button onClick={onClose} className="text-brass hover:text-white transition-colors">
          <X size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-gold-accent" />
            <p className="font-body text-xs text-gold-accent uppercase tracking-widest">Practitioner's Lens</p>
          </div>
          <p className="font-display text-sm font-bold text-white">{mod.title}</p>
          <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-gold-accent rounded-full transition-all duration-500"
              style={{ width: `${((blockIndex + 1) / blocks.length) * 100}%` }}
            />
          </div>
        </div>
        <span className="font-body text-[10px] text-brass">{blockIndex + 1} / {blocks.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6 max-w-lg mx-auto w-full">
        {/* What is the Practitioner's Lens? — shown once at the start */}
        {blockIndex === 0 && (
          <div className="celestial-card p-3 mb-4 animate-fade-up" style={{ borderLeft: '3px solid #C9A961' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={12} className="text-gold-accent shrink-0" />
              <p className="font-body text-[10px] text-gold-accent uppercase tracking-widest">What is the Practitioner's Lens?</p>
            </div>
            <p className="font-body text-xs text-white/80 leading-relaxed">
              The Practitioner's Lens is a set of <strong>hypothetical case studies</strong> — like a friend saying, <em>"I've got Saturn in Pisces — what should I expect from my Saturn return?"</em> You'll apply this module's concepts the way a working astrologer would, and each case ends with a <strong>cheat-code</strong>: the practical tip astrologers reach for when reading that placement. These are practice scenarios, separate from the live transit readings on your planner.
            </p>
          </div>
        )}

        {/* Scenario context — clearly framed as a hypothetical case study */}
        {block.scenario && (
          <div className="celestial-card p-4 mb-5 animate-fade-up" style={{ borderLeft: '3px solid #C9A961' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={12} className="text-gold-accent shrink-0" />
              <p className="font-body text-[10px] text-gold-accent uppercase tracking-widest">Case Study — hypothetical</p>
            </div>
            <p className="font-body text-sm text-white/90 leading-relaxed italic">{block.scenario}</p>
          </div>
        )}

        {/* Question */}
        <div className="animate-fade-up space-y-4">
          <p className="font-display text-base font-bold text-white/90 leading-snug">{block.question}</p>
          <OrnamentDivider />

          {/* Options */}
          <div className="space-y-2.5">
            {block.options.map((opt, i) => {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              let rowStyle = 'border-gold-primary/30 bg-paper text-white/90';
              let circleStyle = 'bg-gold-primary/20 text-gold-accent';
              let icon = letters[i];
              if (answered) {
                if (i === correctIdx) {
                  rowStyle = 'border-green-soft/60 bg-green-soft/15 text-white';
                  circleStyle = 'bg-green-soft/40 text-white';
                  icon = '✓';
                } else if (i === selectedAnswer) {
                  rowStyle = 'border-destructive/40 bg-destructive/10 text-red-300';
                  circleStyle = 'bg-destructive/20 text-red-300';
                  icon = '✗';
                } else {
                  rowStyle = 'border-gold-primary/10 bg-paper/40 text-white/30';
                  circleStyle = 'bg-paper/60 text-white/20';
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answered}
                  className={`w-full text-left px-3 py-3 rounded-xl border font-body text-sm transition-all flex items-center gap-3 ${rowStyle} ${!answered ? 'hover:border-gold-accent hover:scale-[1.01] cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${circleStyle}`}>
                    {icon}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Result + Practitioner's Cheat-Code */}
          {answered && (
            <div className="space-y-3 animate-fade-up">
              <div className={`px-3 py-2.5 rounded-xl font-body text-sm border text-center ${isCorrect ? 'bg-green-soft/15 border-green-soft/30 text-white' : 'bg-destructive/10 border-destructive/30 text-red-300'}`}>
                <p className="font-semibold text-xs">{isCorrect ? '✓ Correct' : `Answer: ${block.options?.[correctIdx]}`}</p>
              </div>
              {block.explanation && (
                <div className="relative overflow-hidden px-4 py-3 rounded-xl bg-gold-primary/10 border border-gold-primary/30">
                  <span className="absolute right-4 top-2 text-3xl opacity-10 font-display">✦</span>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb size={12} className="text-gold-accent shrink-0" />
                    <p className="font-body text-[10px] text-gold-accent uppercase tracking-widest">Practitioner's Cheat-Code</p>
                  </div>
                  <p className="font-body text-xs text-white/90 leading-relaxed">{block.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-paper border-t border-gold-accent/40 px-5 pt-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        <Button
          onClick={handleNext}
          disabled={!answered || saving}
          className="w-full bg-gold-accent hover:bg-gold-primary text-paper font-display font-bold disabled:opacity-40"
        >
          {saving ? 'Saving...' : isLast ? `Complete Mastery & Earn ${mod.mastery_xp_reward || 100} XP` : 'Continue'}
          <ChevronRight size={18} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}