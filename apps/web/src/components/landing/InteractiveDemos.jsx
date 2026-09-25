import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, X, RotateCcw } from 'lucide-react';

const GOLD = '#C9A961';
const GOLD_LIGHT = '#D4AF85';

// ── Interactive Reading Demo ──────────────────────────────────────────────────
export function ReadingDemo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl p-5 space-y-3 transition-all cursor-pointer"
      style={{ background: 'rgba(15,26,46,0.9)', border: '1px solid rgba(201,169,97,0.25)', backdropFilter: 'blur(12px)' }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg" style={{ color: GOLD, fontVariantEmoji: 'text' }}>♄</span>
          <span className="font-body text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Today's Key Transit</span>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
      </div>

      <p className="font-display text-base font-bold text-white">Saturn square Venus</p>
      <div className="flex gap-2">
        <span className="px-2 py-0.5 rounded-full font-body text-[10px]" style={{ background: 'rgba(201,169,97,0.15)', color: GOLD }}>Applying</span>
        <span className="px-2 py-0.5 rounded-full font-body text-[10px]" style={{ background: 'rgba(157,180,200,0.1)', color: '#9DB4C8' }}>Square</span>
      </div>

      {!expanded ? (
        <p className="font-body text-xs italic" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Tap to see the interpretation →
        </p>
      ) : (
        <div className="space-y-2.5 pt-1 animate-fade-up">
          <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Saturn pressing on Venus asks you to get real about relationships and what you value. There's friction here, but it's the kind that clarifies. Commitments get tested, and the ones that hold are the ones worth keeping.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2 py-0.5 rounded-full font-body text-[10px]" style={{ background: 'rgba(201,169,97,0.1)', color: GOLD }}>Structure</span>
            <span className="px-2 py-0.5 rounded-full font-body text-[10px]" style={{ background: 'rgba(216,180,194,0.1)', color: '#D8B4C2' }}>Relationships</span>
            <span className="px-2 py-0.5 rounded-full font-body text-[10px]" style={{ background: 'rgba(168,200,168,0.1)', color: '#A8C8A8' }}>Values</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interactive Quiz Demo ─────────────────────────────────────────────────────
const QUIZZES = [
  {
    glyph: '♄',
    question: 'Which planet is this?',
    options: ['Mars', 'Saturn', 'Jupiter', 'Mercury'],
    correct: 1,
    explanation: 'Saturn (♄) rules structure, discipline, and time. Its ring is visible in the glyph.',
  },
  {
    glyph: '♉',
    question: 'Which zodiac sign is this?',
    options: ['Aries', 'Cancer', 'Taurus', 'Virgo'],
    correct: 2,
    explanation: 'Taurus (♉) is an earth sign ruled by Venus, associated with steadiness and sensuality.',
  },
];

export function QuizDemo() {
  const [quizIndex, setQuizIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  const quiz = QUIZZES[quizIndex];

  const handleSelect = (i) => {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
  };

  const handleNext = () => {
    setQuizIndex((quizIndex + 1) % QUIZZES.length);
    setSelected(null);
    setAnswered(false);
  };

  const isCorrect = selected === quiz.correct;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(15,26,46,0.9)', border: '1px solid rgba(201,169,97,0.25)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-body text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Daily Quiz</span>
        <span className="font-body text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Sample question</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-display text-3xl" style={{ color: GOLD, fontVariantEmoji: 'text' }}>{quiz.glyph}</span>
        <p className="font-body text-sm font-semibold text-white">{quiz.question}</p>
      </div>

      <div className="space-y-2">
        {quiz.options.map((opt, i) => {
          const isAnswer = i === quiz.correct;
          const isSelected = i === selected;
          let bg = 'rgba(255,255,255,0.04)';
          let border = '1px solid rgba(255,255,255,0.06)';
          let textColor = 'rgba(255,255,255,0.6)';

          if (answered) {
            if (isAnswer) {
              bg = 'rgba(168,200,168,0.15)';
              border = '1px solid rgba(168,200,168,0.4)';
              textColor = '#A8C8A8';
            } else if (isSelected) {
              bg = 'rgba(216,180,194,0.12)';
              border = '1px solid rgba(216,180,194,0.3)';
              textColor = '#D8B4C2';
            } else {
              textColor = 'rgba(255,255,255,0.2)';
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left"
              style={{ background: bg, border, cursor: answered ? 'default' : 'pointer' }}
            >
              <span className="font-body text-xs" style={{ color: textColor }}>{opt}</span>
              {answered && isAnswer && <Check size={13} className="text-green-400" />}
              {answered && isSelected && !isAnswer && <X size={13} style={{ color: '#D8B4C2' }} />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="pt-1 animate-fade-up space-y-2">
          <p className="font-body text-xs leading-relaxed" style={{ color: isCorrect ? 'rgba(168,200,168,0.9)' : 'rgba(255,255,255,0.6)' }}>
            {isCorrect ? '✓ Nice work!' : 'Close! Here\'s the answer:'} {quiz.explanation}
          </p>
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 font-body text-xs transition-colors"
            style={{ color: GOLD }}
          >
            <RotateCcw size={11} /> Try another
          </button>
        </div>
      )}
    </div>
  );
}

// ── Animated Progress Demo ───────────────────────────────────────────────────
const TIERS = [
  { name: 'Apprentice', glyph: '✦', color: GOLD },
  { name: 'Adept', glyph: '◈', color: '#9DB4C8' },
  { name: 'Maestro', glyph: '⬡', color: '#B8A5C8' },
];

export function ProgressDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive(prev => (prev + 1) % (TIERS.length + 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const progress = active <= 0 ? 0 : active <= 1 ? 33 : active <= 2 ? 66 : 100;

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(15,26,46,0.9)', border: '1px solid rgba(201,169,97,0.25)', backdropFilter: 'blur(12px)' }}
    >
      <span className="font-body text-xs tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Your Progress</span>

      <div className="flex items-center justify-between">
        {TIERS.map((tier, i) => {
          const reached = i < active;
          const current = i === active - 1;
          return (
            <div key={tier.name} className="flex flex-col items-center gap-1.5 transition-all">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
                style={{
                  background: reached ? `${tier.color}33` : 'rgba(255,255,255,0.05)',
                  border: reached ? `2px solid ${tier.color}` : '2px solid rgba(255,255,255,0.08)',
                  transform: current ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <span className="font-display text-xs" style={{ color: reached ? tier.color : 'rgba(255,255,255,0.2)', fontVariantEmoji: 'text' }}>
                  {tier.glyph}
                </span>
              </div>
              <span className="font-body text-[9px] transition-colors duration-500" style={{ color: reached ? tier.color : 'rgba(255,255,255,0.2)' }}>
                {tier.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }}
        />
      </div>

      <p className="font-body text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {active === 0 ? 'Start your journey' : active > TIERS.length ? 'Maestro achieved!' : `Now in ${TIERS[active - 1].name} tier`}
      </p>
    </div>
  );
}