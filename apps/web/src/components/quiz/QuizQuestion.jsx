import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { forceTextGlyph } from '@/lib/chartUtils';

export default function QuizQuestion({ question, questionNumber, totalQuestions, onAnswer, answered, result, onLearn }) {
  if (!question) return null;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-4"
    >
      {/* Progress dots */}
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < questionNumber - 1 ? 'bg-gold-accent' :
              i === questionNumber - 1 ? 'bg-gold-primary' :
              'bg-muted'
            }`}
          />
        ))}
      </div>

      <p className="text-[11px] font-body text-brass uppercase tracking-wider">
        Question {questionNumber} of {totalQuestions}
      </p>

      <p className="font-body text-base text-white/90 leading-relaxed" style={{fontVariantEmoji:'text'}}>{forceTextGlyph(question.question)}</p>

      {!answered && onLearn && (
        <button
          type="button"
          onClick={onLearn}
          className="flex items-center gap-1.5 font-body text-[11px] text-brass hover:text-gold-accent transition-colors self-start -mt-1"
        >
          <BookOpen size={11} />
          I don't know — learn this
        </button>
      )}

      <div className="space-y-2.5">
        {question.options.map((option, idx) => {
          let style = 'border-gold-primary/30 bg-paper hover:border-gold-accent hover:bg-gold-primary/5';
          if (answered) {
            if (idx === question.correct_index) {
              style = 'border-green-500/60 bg-green-900/40';
            } else if (idx === result?.chosen_option_index && !result?.is_correct) {
              style = 'border-red-400/60 bg-red-900/30';
            } else {
              style = 'border-gold-primary/20 bg-paper/60 opacity-60';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !answered && onAnswer(idx)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all font-body text-sm flex items-center justify-between gap-3 ${style} text-white`}
            >
              <span className={`font-display text-xs ${answered && idx === question.correct_index ? 'text-green-400' : answered && idx === result?.chosen_option_index && !result?.is_correct ? 'text-red-400' : 'text-brass'}`}>
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className="flex-1 text-base leading-snug" style={{fontVariantEmoji:'text'}}>{forceTextGlyph(option)}</span>
              {answered && idx === question.correct_index && <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
              {answered && idx === result?.chosen_option_index && !result?.is_correct && <XCircle size={16} className="text-red-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {answered && result?.explanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gold-primary/8 border border-gold-primary/30 rounded-lg px-4 py-3"
        >
          <p className="font-body text-xs text-white/90 italic leading-relaxed" style={{fontVariantEmoji:'text'}}>✦ {forceTextGlyph(result.explanation)}</p>
        </motion.div>
      )}
    </motion.div>
  );
}