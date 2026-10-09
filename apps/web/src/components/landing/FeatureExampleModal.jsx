import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ChartWheel from '@/components/chart/ChartWheel';
import { Check } from 'lucide-react';

export const FEATURE_EXAMPLES = {
  daily: {
    title: 'Personalized Daily Readings',
    type: 'snippet',
    text: 'Today the Moon transits your 5th house, trining your natal Venus — a soft, generative window for creative work, romance, and play. Mars sextiling your Mercury sharpens how you say what you mean.',
  },
  learning: {
    title: 'Progressive Learning System',
    type: 'quiz',
    question: 'Which planet rules Aries?',
    options: ['Mars', 'Venus', 'Mercury', 'Saturn'],
    correct: 0,
    explanation: "Mars — the planet of action and drive — rules Aries, mirroring the sign's initiatory fire.",
  },
  synthesis: {
    title: 'Chart Synthesis',
    type: 'snippet',
    text: "You carry a stellium in Scorpio (Sun, Mercury, Venus) in the 3rd house — a concentrated thread of investigative, communicative energy. Your chart ruler is Mercury, placed in the 9th — so your core story runs through teaching, meaning-making, and the long search.",
  },
  wheel: { title: 'Interactive Chart Wheel', type: 'wheel' },
  calendar: {
    title: 'Calendar Sync',
    type: 'snippet',
    text: 'Tue 22 — Moon trine Venus (a creative window). Wed 23 — Mercury enters Virgo (details sharpen). Thu 24 — First Quarter Moon — a checkpoint on whatever you began at the New Moon.',
  },
  synastry: {
    title: 'Synastry & Events',
    type: 'snippet',
    text: "Your Venus sits right on your partner's Ascendant — a natural, almost magnetic pull. Their Saturn squares your Sun, adding weight and structure — and, at times, friction — to how you show up together.",
  },
  navigator: { title: 'Chart Navigator', type: 'chat' },
  density: {
    title: 'Knowledge Density',
    type: 'snippet',
    text: 'Essential — "Mars in Aries: you go first." Insightful — "Mars in Aries initiates without hesitation; the challenge is finishing what you start." Technical — "Mars in its domicile in Aries — essential dignity; a reciprocal reception with Venus in Scorpio softens the combustion."',
  },
  traditions: {
    title: 'Three Traditions',
    type: 'snippet',
    text: 'Modern — Mars in Aries is pure drive. Hellenistic — Mars in its own domicile, governing the daytime triplicity (a Sect consideration). Vedic — Mangala in Mesha: fiery, rajasic, aligned with the Krittika lunar mansion.',
  },
  lots: {
    title: 'Arabic Lots & Asteroid Packs',
    type: 'snippet',
    text: 'Part of Fortune in Taurus, 2nd house — embodied prosperity through steady cultivation. Lot of Spirit in Aquarius — your sense of purpose ignites through collective, future-oriented work. Lot of Eros in Scorpio — desire runs deep and private.',
  },
  goWheel: { title: 'Interactive Chart Wheel', type: 'wheel' },
  goNavigator: { title: 'Chart Navigator', type: 'chat' },
};

function Bubble({ side, children }) {
  const isAnswer = side === 'answer';
  return (
    <div
      className={'rounded-xl px-3.5 py-2.5 max-w-[90%] ' + (isAnswer ? 'self-end' : 'self-start')}
      style={{
        background: isAnswer ? 'rgba(201,169,97,0.08)' : 'rgba(255,255,255,0.05)',
        border: '1px solid ' + (isAnswer ? 'rgba(201,169,97,0.25)' : 'rgba(201,169,97,0.12)'),
      }}
    >
      <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{children}</p>
    </div>
  );
}

function ExampleBody({ example, chartData }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-lg font-bold text-white">{example.title}</DialogTitle>
        <DialogDescription className="font-body text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          An example of how this shows up inside the app.
        </DialogDescription>
      </DialogHeader>

      {example.type === 'wheel' && (
        <div className="rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)' }}>
          {chartData ? (
            <ChartWheel chartData={chartData} skyMode className="p-2" />
          ) : (
            <p className="text-center text-xs py-10" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading the live sky…</p>
          )}
          <p className="font-body text-xs text-center mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Tap any planet or aspect line for its meaning.
          </p>
        </div>
      )}

      {example.type === 'chat' && (
        <div className="flex flex-col gap-2.5 py-1">
          <Bubble side="question">"What does my Saturn return mean for me?"</Bubble>
          <Bubble side="answer">
            Saturn returns to the exact spot it occupied at your birth roughly every 29 years — a structural reset. Yours begins spring 2027, landing in your 4th house, so the theme is home, family, and the foundation you stand on. Here's what to expect, and where to lean in…
          </Bubble>
          <Bubble side="question">"And how do I prepare?"</Bubble>
          <Bubble side="answer">
            Saturn rewards what you build deliberately. In the months before, shore up the 4th-house themes: clarify where "home" is, mend a family thread, and define what stability means to you — not to anyone else.
          </Bubble>
        </div>
      )}

      {example.type === 'quiz' && (
        <div className="space-y-3 py-1">
          <p className="font-display text-sm font-semibold text-white">{example.question}</p>
          <div className="space-y-2">
            {example.options.map((opt, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background: i === example.correct ? 'rgba(201,169,97,0.12)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid ' + (i === example.correct ? 'rgba(201,169,97,0.4)' : 'rgba(255,255,255,0.08)'),
                }}
              >
                {i === example.correct && <Check size={13} style={{ color: '#C9A961' }} />}
                <span className="font-body text-xs" style={{ color: i === example.correct ? '#C9A961' : 'rgba(255,255,255,0.7)' }}>{opt}</span>
              </div>
            ))}
          </div>
          <p className="font-body text-xs leading-relaxed pt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="font-semibold" style={{ color: '#C9A961' }}>Why: </span>{example.explanation}
          </p>
        </div>
      )}

      {example.type === 'snippet' && (
        <div className="rounded-xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)' }}>
          <p className="font-body text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{example.text}</p>
        </div>
      )}
    </>
  );
}

export default function FeatureExampleModal({ example, onClose, chartData }) {
  return (
    <Dialog open={!!example} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="bg-[#0f1a2e] border-[rgba(201,169,97,0.3)] text-white max-w-md"
      >
        {example && <ExampleBody example={example} chartData={chartData} />}
      </DialogContent>
    </Dialog>
  );
}