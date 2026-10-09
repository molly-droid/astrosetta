import React from 'react';
import { Check, Sparkles, CalendarDays, GraduationCap } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    icon: GraduationCap,
    iconColor: 'text-white/60',
    color: 'border-white/[0.08]',
    features: [
      'Natal chart placements',
      'Big Three interpretations (Sun, Moon, Rising)',
      'Arabic Lots (Fortune, Spirit, Eros & Necessity) & lunar nodes',
      'Knowledge Density slider (Essential → Technical)',
      'Daily horoscope & transit list',
      'Full learning curriculum & daily quiz',
      'Journal',
    ],
  },
  {
    name: 'Core',
    price: '$5.55/mo',
    icon: Sparkles,
    iconColor: 'text-celestial-blue',
    color: 'border-celestial-blue/40',
    highlight: true,
    features: [
      'Everything in Free',
      'Interactive chart wheel',
      'Full natal chart interpretations (all planets)',
      'Transit interpretations on demand',
      'Synastry & event charts',
      'Switch your chart\'s tradition — Modern, Hellenistic, or Vedic',
      'Planner (month, week, day views)',
      'Calendar sync (ICS + Google Calendar)',
      'Chart Navigator chatbot',
    ],
  },
  {
    name: 'Premium',
    price: '$7.77/mo',
    icon: CalendarDays,
    iconColor: 'text-gold-accent',
    color: 'border-gold-primary/60',
    features: [
      'Everything in Core',
      'Black Moon Lilith (placements, transits & interpretations)',
      'Asteroid pack — Juno, Pallas, Vesta & Tyche',
      'Early access to new features',
      'Private community (Discord/Subreddit) — coming soon',
      'Founding patron recognition in-app',
    ],
  },
];

export default function UpgradeTab() {
  return (
    <div className="space-y-4">
      <div className="celestial-card p-4 space-y-3 border border-gold-primary/30 bg-gold-primary/5">
        <div className="flex items-center gap-2">
          <span className="text-gold-accent text-base">✦</span>
          <p className="font-display text-base font-bold text-gold-accent">Founding Member Pricing</p>
        </div>
        <p className="font-body text-sm text-white/80 leading-relaxed">
          Astrosetta's early subscribers are <strong className="text-white">founding members</strong> — their subscription pricing is locked in for the lifetime of an active, continuously-renewing subscription, and they're recognized in-app with a founding badge.
        </p>
      </div>

      <div className="celestial-card p-4 space-y-1">
        <p className="font-display text-base font-bold text-white">Current Tiers</p>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          The core learning experience — quiz, curriculum, natal chart, transit tracking — will always be free.
          Paid tiers add personalized interpretations and calendar integration for deeper practice.
        </p>
      </div>

      {PLANS.map(plan => {
        const Icon = plan.icon;
        return (
          <div key={plan.name} className={`celestial-card p-4 space-y-3 border-2 ${plan.color} ${plan.highlight ? 'shadow-gold-primary/10 shadow-lg' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={16} className={plan.iconColor} />
                <p className="font-display text-base font-bold text-white">{plan.name}</p>
                {plan.highlight && (
                  <span className="font-body text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-gold-primary/15 text-gold-accent border border-gold-primary/30">
                    Popular
                  </span>
                )}
              </div>
              <p className="font-display text-lg font-bold text-white">{plan.price}</p>
            </div>
            <ul className="space-y-1.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 font-body text-xs text-white/70">
                  <Check size={12} className="text-gold-accent shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="font-body text-[11px] text-white/30 text-center">
        You can manage or cancel your subscription anytime from the Profile page.
      </p>
    </div>
  );
}