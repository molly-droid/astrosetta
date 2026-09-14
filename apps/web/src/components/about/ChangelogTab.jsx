import React from 'react';

const CHANGELOG = [
  {
    version: 'v0.4, September 2026',
    label: 'Personalization & Launch Prep',
    entries: [
      { type: 'new', text: 'Knowledge Density — scale every reading and lesson from plain-language Essential to full Technical, matched to how you like to learn' },
      { type: 'new', text: 'Traditions — switch between Modern, Hellenistic, and Vedic, with your chart recalculated using each tradition\'s zodiac, houses, and rulerships' },
      { type: 'new', text: 'The relationship layer — read your Planner against any saved chart: a partner, family member, or an event chart' },
      { type: 'new', text: 'Account deletion, restore purchases, and clear paywall disclosures — full App Store compliance' },
      { type: 'new', text: 'Founding member recognition — early subscribers are permanently marked and celebrated' },
      { type: 'improved', text: 'Calendar sync rebuilt on exact lunation timing — every new and full moon is a single event at its precise moment, in both the ICS feed and Google Calendar sync' },
      { type: 'improved', text: 'Essential explanations rewritten for complete beginners — every foundational term defined in plain language' },
      { type: 'improved', text: 'The full app tour now walks you through what your plan actually includes, ending with a peek at what\'s next' },
    ],
  },
  {
    version: 'v0.3, August 2026',
    label: 'Classical Techniques & Asteroids',
    entries: [
      { type: 'new', text: 'Asteroid pack (Premium) — Juno, Pallas Athene & Vesta join Tyche with natal placements, transit aspects, and interpretations across your chart, planner, and daily readings' },
      { type: 'new', text: 'Part of Fortune now free for everyone — the calculated lot of ease and opportunity appears alongside your lunar nodes on every natal chart' },
      { type: 'new', text: 'Classical Techniques curriculum section — essential dignities, the Part of Fortune, Tyche, and the goddess asteroids each get their own learning module with a personal placement card' },
      { type: 'new', text: 'Transits to calculated points — the daily reading and planner now interpret transits aspecting your Part of Fortune, Tyche, and the asteroids, not just planets and angles' },
      { type: 'improved', text: 'Chart recalculation — the chart engine now uses a single source of truth, so lots, asteroids, and house assignments stay perfectly in sync on every recalculation' },
      { type: 'improved', text: 'Updated plan structure — Free, Core, and Premium tiers with clear feature boundaries and founding-member pricing locked in forever' },
    ],
  },
  {
    version: 'v0.2, July 2026',
    label: 'Feature Expansion',
    entries: [
      { type: 'new', text: 'Synastry readings — save charts for partners, family, and friends; compare cross-chart aspects, house overlays, and relationship dynamics with guided interpretations' },
      { type: 'new', text: 'Chart Dynamics — stelliums, empty houses, chart ruler, element & modality balance, and aspect pattern detection integrated into daily readings when transits activate your natal concentrations' },
      { type: 'new', text: 'Solar Return & Profections — birthday tracking with year-lord analysis and profection house themes' },
      { type: 'new', text: 'Chart Navigator — floating chat assistant to ask questions about your chart, transits, or astrology concepts anytime' },
      { type: 'new', text: 'Personal ICS calendar feed — subscribe via Apple Calendar, Google Calendar, or Outlook with auto-updating transits, lunar events, and personalized synthesis readings' },
      { type: 'new', text: 'Email digests — opt in to personalized daily, weekly, and monthly emails with your transit highlights and synthesis' },
      { type: 'new', text: 'Full App Tour — guided walkthrough of every feature for new users' },
      { type: 'new', text: 'Save to Home Screen — install Astrosetta as a native-style app on iOS and Android' },
      { type: 'new', text: 'Transit study suggestions — daily recommendations for which curriculum modules to study based on today\'s active transits' },
      { type: 'new', text: 'Mundane pattern detection — collective sky formations like cradles and stelliums surfaced in daily readings' },
      { type: 'new', text: 'Ingress & station alerts — planetary sign changes, retrograde/direct stations with approaching event notifications' },
      { type: 'new', text: 'Lunar event tracking — moon phases, exact new/full moon detection, and moon sign in the daily planner' },
      { type: 'improved', text: 'Chart wheel focus mode — selecting a planet or aspect dims everything else and draws interactive transit-to-natal aspect lines to the exterior angle labels' },
    ],
  },
  {
    version: 'v0.1, June 2026',
    label: 'First Release',
    entries: [
      { type: 'new', text: 'Apprentice-level daily transit quiz — glyph recognition, sign identification, element symbols, retrograde Rx' },
      { type: 'new', text: 'Quiz questions now grounded in today\'s actual sky (live transit data)' },
      { type: 'new', text: 'Element symbols (🜂🜃🜁🜄) integrated into quiz and curriculum' },
      { type: 'new', text: 'Global unicode text rendering — all astrological glyphs display as crisp text, never emoji' },
      { type: 'new', text: 'Retake Quiz mode — replay today\'s questions locally after completing' },
      { type: 'new', text: 'Bonus practice rounds available after daily quiz completion' },
      { type: 'new', text: 'Streak tracking with 7-day Practitioner\'s Lens unlock' },
      { type: 'new', text: 'Planner with month, week, and day views + journal entries' },
      { type: 'new', text: 'Daily synthesis — personal + mundane transit readings' },
      { type: 'new', text: 'Google Calendar sync (Navigator plan)' },
      { type: 'new', text: 'Natal chart wheel with interactive planet/aspect/house selection' },
      { type: 'new', text: 'Click transit-to-natal aspect lines in the Planner chart wheel to see interpretations and highlights — selections sync between the wheel, transit list, and daily reading' },
      { type: 'new', text: 'Tier progression: Apprentice → Adept → Maestro' },
    ],
  },
];

const TYPE_STYLES = {
  new:     { label: 'New',     style: 'bg-green-900/30 text-green-400 border-green-500/30' },
  improved:{ label: 'Improved',style: 'bg-celestial-blue/10 text-celestial-blue border-celestial-blue/30' },
  fixed:   { label: 'Fixed',   style: 'bg-gold-primary/10 text-gold-accent border-gold-primary/30' },
};

export default function ChangelogTab() {
  return (
    <div className="space-y-6">
      <div className="celestial-card p-4 space-y-1">
        <p className="font-display text-base font-bold text-white">What's New</p>
        <p className="font-body text-sm text-white/60">A running log of changes, improvements, and new features.</p>
      </div>

      {CHANGELOG.map(release => (
        <div key={release.version} className="space-y-3">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-display text-sm font-bold text-white">{release.version}</p>
              <span className="font-body text-[10px] uppercase tracking-widest text-gold-accent">{release.label}</span>
            </div>
          </div>
          <div className="space-y-2">
            {release.entries.map((entry, i) => (
              <div key={i} className="flex items-start gap-2.5 celestial-card p-2.5">
                <span className={`font-body text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${TYPE_STYLES[entry.type]?.style}`}>
                  {TYPE_STYLES[entry.type]?.label}
                </span>
                <p className="font-body text-xs text-white/70 leading-relaxed">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="font-body text-[11px] text-white/30 text-center pt-2">
        More updates coming soon ✦
      </p>
    </div>
  );
}