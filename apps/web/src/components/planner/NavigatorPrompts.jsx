import React from 'react';
import { Sparkles } from 'lucide-react';
import { askNavigator } from '@/lib/navigatorBridge';

const PROMPTS_BY_PERIOD = {
  day: [
    "Is today a good day to start something new?",
    "Is today right for an important conversation?",
    "What should I lean into today?",
    "What should I watch out for today?",
  ],
  week: [
    "When this week should I have an important conversation?",
    "What's the best day this week to start something new?",
    "What should I lean into this week?",
    "What should I watch out for this week?",
  ],
  month: [
    "When this month is best to sign a contract?",
    "What's the best window this month for a fresh start?",
    "What should I prioritize this month?",
    "What challenges should I plan around this month?",
  ],
};

export default function NavigatorPrompts({ date, period = 'day' }) {
  const prompts = PROMPTS_BY_PERIOD[period] || PROMPTS_BY_PERIOD.day;
  const isToday = date.toDateString() === new Date().toDateString();
  const periodWord = period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'today';
  const label = period === 'day'
    ? (isToday ? 'today' : `on ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`)
    : periodWord;

  return (
    <div className="celestial-card p-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-gold-accent" />
        <p className="font-body text-[10px] text-brass uppercase tracking-widest">Ask the Navigator</p>
      </div>
      <p className="font-body text-[11px] text-white/60 leading-snug">
        Wondering if {label} is right for something? Tap a prompt to ask:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map(q => (
          <button
            key={q}
            onClick={() => askNavigator(q)}
            className="text-left px-2.5 py-1.5 rounded-full transition-colors hover:bg-gold-primary/15"
            style={{ background: 'rgba(201,169,97,0.08)', border: '1px solid rgba(201,169,97,0.18)' }}
          >
            <span className="font-body text-[11px] text-white/65 leading-snug">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}