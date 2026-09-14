import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Star, GraduationCap, CalendarDays, User, Smartphone, Apple, Bot, Link2 } from 'lucide-react';

const SECTIONS = [
  {
    icon: Home,
    title: 'Home: Today\'s Sky',
    color: 'text-celestial-blue',
    steps: [
      { label: 'Today tab', desc: 'Your personalized daily reading, synthesized from your natal chart and today\'s transits.' },
      { label: 'Transits tab', desc: 'See the live transit wheel and a list of every planet-to-planet aspect active right now.' },
      { label: 'Learn tab', desc: 'Take your daily transit quiz and jump into curriculum modules.' },
    ],
  },
  {
    icon: Star,
    title: 'My Chart',
    color: 'text-gold-accent',
    steps: [
      { label: 'Chart Wheel', desc: 'Interactive visualization of your natal chart. Tap any planet, sign, or aspect for details.' },
      { label: 'Interpretations', desc: 'Tap a placement to read curated interpretations. Rate them to help surface the most resonant ones.' },
      { label: 'Lots & Asteroids', desc: 'Part of Fortune and the lunar nodes show on every chart. Premium unlocks the asteroid pack — Juno, Pallas, Vesta & Tyche — with their own placements, transits, and interpretations.' },
      { label: 'Synastry & Events', desc: 'Save charts for partners, family, or pivotal moments and compare them against your own (Core).' },
      { label: 'Traditions', desc: 'Switch between Modern, Hellenistic, and Vedic — your chart recalculates with each tradition\'s zodiac and house system (Core).' },
      { label: 'Edit Birth Data', desc: 'Update your birth date, time, or location from the Profile page anytime.' },
    ],
  },
  {
    icon: GraduationCap,
    title: 'Learn',
    color: 'text-celestial-purple',
    steps: [
      { label: 'Curriculum', desc: 'Browse modules across Foundations, Planets, Signs, Houses, Elements & Modalities, Aspects, Dynamics, Classical Techniques (dignities, lots & asteroids), and Traditions in a structured path.' },
      { label: 'Daily Quiz', desc: 'A fresh 5-question quiz each day grounded in what\'s actually happening in the sky right now.' },
      { label: 'Bonus Practice', desc: 'After completing the daily quiz, unlock extra practice rounds for more XP.' },
      { label: 'Practitioner\'s Lens', desc: 'Earn 500 XP to unlock scenario-based mastery challenges inside each module.' },
    ],
  },
  {
    icon: CalendarDays,
    title: 'Planner',
    color: 'text-celestial-green',
    steps: [
      { label: 'Calendar views', desc: 'Month, week, and day views showing active transits and lunar events at a glance.' },
      { label: 'Day synthesis', desc: 'Tap any day for a personalized reading blending the collective sky with your natal chart.' },
      { label: 'Journal', desc: 'Each day has a private journal space for notes, intentions, and reflections.' },
      { label: 'Calendar sync', desc: 'Subscribe to your personal ICS calendar feed that auto-updates with transits, lunar events, and personalized synthesis readings. Set up from Profile.' },
    ],
  },
  {
    icon: User,
    title: 'Profile',
    color: 'text-celestial-pink',
    steps: [
      { label: 'Streak & XP', desc: 'Track your learning streak, total XP, and tier progress.' },
      { label: 'Subscription', desc: 'Manage your plan, calendar sync feed, and email digest preferences.' },
      { label: 'Daily email', desc: 'Opt in to receive a personalized daily email with your transits and synthesis.' },
      { label: 'Knowledge Density & Display', desc: 'Scale every explanation from plain-language Essential to full Technical, and set your timezone and text size.' },
    ],
  },
  {
    icon: Bot,
    title: 'Chart Navigator',
    color: 'text-celestial-blue',
    steps: [
      { label: 'Ask anything', desc: 'Tap the floating compass button anytime (Core) to ask questions about your chart, transits, or astrology concepts.' },
    ],
  },
];

export default function HowToUseTab() {
  return (
    <div className="space-y-5">
      <div className="celestial-card p-4 space-y-1">
        <p className="font-display text-base font-bold text-white">Welcome to Astrosetta ✦</p>
        <p className="font-body text-sm text-white/70 leading-relaxed">
          Astrosetta is built around one idea: the sky is happening right now, and you can learn to read it.
          Every feature is rooted in today's actual transits, so the more you use it, the more the symbols start to mean something.
        </p>
        <p className="font-body text-xs text-brass/60 italic mt-2">
          Tip: Use this guide as your reference anytime you want to explore a new section.
        </p>
      </div>

      {SECTIONS.map(({ icon: Icon, title, color, steps }) => (
        <div key={title} className="celestial-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icon size={15} className={color} />
            <p className="font-display text-sm font-bold text-white">{title}</p>
          </div>
          <div className="space-y-2.5">
            {steps.map(({ label, desc }) => (
              <div key={label} className="flex gap-2.5">
                <span className="mt-0.5 text-gold-accent text-xs">✦</span>
                <div>
                  <span className="font-body text-xs font-semibold text-white">{label}: </span>
                  <span className="font-body text-xs text-white/60">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Calendar Sync */}
      <div className="celestial-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-gold-accent" />
          <p className="font-display text-sm font-bold text-white">Calendar Sync</p>
        </div>
        <p className="font-body text-xs text-white/60 leading-relaxed">
          Subscribe to your personal astrology calendar feed so transits, lunar events, and personalized synthesis readings appear directly in your calendar app and auto-update automatically.
        </p>
        <div className="space-y-1.5 pl-1">
          <div className="flex gap-2">
            <span className="text-gold-accent text-xs mt-0.5">1.</span>
            <p className="font-body text-xs text-white/60">Go to <Link to="/profile" className="text-gold-accent underline underline-offset-2">Profile and find Calendar Sync</Link>.</p>
          </div>
          <div className="flex gap-2">
            <span className="text-gold-accent text-xs mt-0.5">2.</span>
            <p className="font-body text-xs text-white/60"><strong className="text-white/80">Apple Calendar:</strong> Tap "Add to Apple Calendar" and iOS/macOS will prompt you to subscribe.</p>
          </div>
          <div className="flex gap-2">
            <span className="text-gold-accent text-xs mt-0.5">3.</span>
            <p className="font-body text-xs text-white/60"><strong className="text-white/80">Google Calendar:</strong> Click the button and the URL copies automatically, then paste it under "From URL" in Google Calendar settings.</p>
          </div>
          <div className="flex gap-2">
            <span className="text-gold-accent text-xs mt-0.5">4.</span>
            <p className="font-body text-xs text-white/60"><strong className="text-white/80">Outlook / other:</strong> Copy the URL and add it as an internet calendar subscription.</p>
          </div>
        </div>
        <p className="font-body text-[10px] text-brass/50 italic pt-1">
          The feed includes all transits, lunar events, retrograde stations, and weekly synthesis readings. No account connection needed.
        </p>
      </div>

      {/* Save to Home Screen */}
      <div className="celestial-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} className="text-gold-accent" />
          <p className="font-display text-sm font-bold text-white">Save to Home Screen</p>
        </div>
        <p className="font-body text-xs text-white/60 leading-relaxed">
          Add Astrosetta to your home screen for quick one-tap access. It works like a native app.
        </p>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2 mb-1">
            <Apple size={13} className="text-white/50" />
            <span className="font-body text-xs font-semibold text-white">iPhone / iPad (Safari)</span>
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">1.</span>
              <p className="font-body text-xs text-white/60">Open Astrosetta in <strong className="text-white/80">Safari</strong> (not Chrome).</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">2.</span>
              <p className="font-body text-xs text-white/60">Tap the <strong className="text-white/80">Share</strong> button (square with up arrow) at the bottom of the screen.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">3.</span>
              <p className="font-body text-xs text-white/60">Scroll down and tap <strong className="text-white/80">"Add to Home Screen"</strong>.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">4.</span>
              <p className="font-body text-xs text-white/60">Tap <strong className="text-white/80">"Add"</strong> and you're done! The app icon appears on your home screen.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone size={13} className="text-white/50" />
            <span className="font-body text-xs font-semibold text-white">Android (Chrome)</span>
          </div>
          <div className="space-y-1.5 pl-5">
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">1.</span>
              <p className="font-body text-xs text-white/60">Open Astrosetta in <strong className="text-white/80">Chrome</strong>.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">2.</span>
              <p className="font-body text-xs text-white/60">Tap the <strong className="text-white/80">three-dot menu</strong> (top or bottom right).</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">3.</span>
              <p className="font-body text-xs text-white/60">Tap <strong className="text-white/80">"Add to Home screen"</strong> or <strong className="text-white/80">"Install app"</strong>.</p>
            </div>
            <div className="flex gap-2">
              <span className="text-gold-accent text-xs mt-0.5">4.</span>
              <p className="font-body text-xs text-white/60">Tap <strong className="text-white/80">"Add"</strong> and you're done!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}