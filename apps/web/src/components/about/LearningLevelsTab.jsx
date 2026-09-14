import React from 'react';

const TIERS = [
  {
    name: 'Apprentice',
    glyph: '✦',
    color: 'border-gold-primary/40 bg-gold-primary/5',
    labelColor: 'text-gold-accent',
    tagline: 'Learning the language of symbols',
    description: 'The Apprentice tier is about building visual fluency: recognizing the glyphs for planets, signs, and elements before worrying about what they mean in combination.',
    quiz_focus: [
      'Identify planet symbols (☉\uFE0E ☽\uFE0E ♂\uFE0E ♃\uFE0E etc.) from a transit chart',
      'Match zodiac glyphs (♈\uFE0E ♊\uFE0E ♎\uFE0E etc.) to their sign names',
      'Identify which sign a planet is transiting today',
      'Recognize element symbols (\uFE0E🜂\uFE0E Fire, 🜃\uFE0E Earth, 🜁\uFE0E Air, 🜄\uFE0E Water)',
      'Understand retrograde (Rx) and what it means astronomically',
    ],
    advancement: '10 daily quizzes at 70%+ accuracy + 10 curriculum modules completed → Adept',
    xp: 'Earn XP for every quiz completed, curriculum module finished, and streak maintained.',
    access: 'Full curriculum (Foundations, Planets, Signs, Houses, Elements & Modalities, Aspects), natal chart with Part of Fortune & nodes, transit list, daily quiz, bonus practice rounds.',
  },
  {
    name: 'Adept',
    glyph: '◈',
    color: 'border-celestial-blue/40 bg-celestial-blue/5',
    labelColor: 'text-celestial-blue',
    tagline: 'Reading aspects & making meaning',
    description: 'The Adept tier moves from recognition into interpretation, understanding how planets relate to each other and what those relationships feel like in everyday life.',
    quiz_focus: [
      'Interpret mundane aspects (what does a Sun-Saturn square mean collectively today?)',
      'Connect specific transits to psychological or practical themes',
      'Understand how a current transit interacts with your natal placements',
      'Recognize modalities (Cardinal, Fixed, Mutable) and how they shape sign expression',
      'Basic synthesis: what does the current sky feel like overall?',
    ],
    advancement: '10 daily quizzes at 75%+ accuracy + 10 curriculum modules completed → Maestro',
    xp: 'Longer quizzes with harder questions — and streak bonuses unlock the Practitioner\'s Lens bonus content.',
    access: 'All Apprentice features + quiz questions drawn from real daily transits and your natal placements.',
  },
  {
    name: 'Maestro',
    glyph: '⊕',
    color: 'border-celestial-purple/40 bg-celestial-purple/5',
    labelColor: 'text-celestial-purple',
    tagline: 'Interpreting & contributing (coming soon)',
    description: 'The Maestro tier is for practitioners who can synthesize complex transit patterns, reading both the mundane sky and how it activates personal natal placements, and eventually teaching others.',
    quiz_focus: [
      'Deep natal-to-transit synthesis questions (how does today\'s Jupiter-Pluto aspect activate your natal chart?)',
      'Classical techniques — essential dignities, the Part of Fortune, and the goddess asteroids (Juno, Pallas, Vesta, Tyche) in transit',
      'Multi-planet pattern reading (stelliums, t-squares, grand trines)',
      'Predictive timing: what is the window of a transit\'s influence?',
      'Contribution: submit and rate interpretations for the community library',
    ],
    advancement: 'Maestro is the final tier. Focus shifts to contribution and teaching.',
    xp: 'XP from approved interpretation contributions and community ratings.',
    access: 'All Adept features + the Classical Techniques curriculum (dignities, lots & asteroids) and contribution tools (interpretation submissions).',
    coming_soon: true,
  },
];

const XP_SOURCES = [
  { action: 'Complete daily quiz', xp: '+10 XP' },
  { action: 'Finish curriculum module', xp: '+50 XP' },
  { action: 'Complete a module mastery challenge', xp: '+100 XP' },
  { action: 'Calculate your first chart', xp: '+50 XP' },
  { action: 'Submit interpretation (pending approval)', xp: '+25 XP' },
  { action: 'Interpretation marked helpful by the community', xp: '+50 XP' },
  { action: '7-day streak', xp: 'Practitioner\'s Lens bonus content' },
];

export default function LearningLevelsTab() {
  return (
    <div className="space-y-5">
      <div className="celestial-card p-4 space-y-1">
        <p className="font-display text-base font-bold text-white">Your Learning Path</p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Astrosetta uses a three-tier progression system. You advance by demonstrating fluency through daily quizzes grounded in the actual sky, so reading alone won't move you up. You have to show what you know. The curriculum spans Foundations, Planets, Signs, Houses, Elements & Modalities, Aspects, Dynamics, Classical Techniques, and Traditions — including the Part of Fortune, the goddess asteroids, and essential dignities.
        </p>
      </div>

      {TIERS.map(tier => (
        <div key={tier.name} className={`celestial-card p-4 space-y-3 border ${tier.color}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={`font-display text-lg ${tier.labelColor}`}>{tier.glyph}</span>
                <p className={`font-display text-base font-bold ${tier.labelColor}`}>{tier.name}</p>
                {tier.coming_soon && (
                  <span className="font-body text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/10">
                    In development
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-white/50 italic">{tier.tagline}</p>
            </div>
          </div>

          <p className="font-body text-sm text-white/70 leading-relaxed">{tier.description}</p>

          <div className="space-y-1.5">
            <p className="font-body text-[10px] uppercase tracking-widest text-brass/60">Daily quiz focuses on</p>
            {tier.quiz_focus.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gold-accent text-xs mt-0.5 shrink-0">·</span>
                <p className="font-body text-xs text-white/70" style={{ fontVariantEmoji: 'text' }}>{item}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
            <p className="font-body text-xs text-white/50"><span className="text-brass/70 font-semibold">Advancement:</span> {tier.advancement}</p>
            <p className="font-body text-xs text-white/50"><span className="text-brass/70 font-semibold">Access:</span> {tier.access}</p>
          </div>
        </div>
      ))}

      {/* XP Table */}
      <div className="celestial-card p-4 space-y-3">
        <p className="font-display text-sm font-bold text-white">How to Earn XP</p>
        <div className="space-y-2">
          {XP_SOURCES.map(({ action, xp }) => (
            <div key={action} className="flex items-center justify-between gap-3">
              <p className="font-body text-xs text-white/70">{action}</p>
              <span className="font-body text-xs text-gold-accent font-semibold whitespace-nowrap">{xp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}