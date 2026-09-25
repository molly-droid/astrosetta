import React from 'react';
import { Link } from 'react-router-dom';
import LegalPageLayout from '@/components/legal/LegalPageLayout';
import { Check, Database } from 'lucide-react';

// Mirrors the App Store privacy "nutrition label" — plain-English summary of
// exactly what Astrosetta collects, why, and whether it's tied to the user.
const LINKED_SECTIONS = [
  {
    type: 'Contact Info',
    items: [
      {
        name: 'Email address',
        purposeType: 'App Functionality',
        purpose: 'Your account, sign-in, subscription receipts, support requests, and the daily, weekly, and monthly email digests you opt into.',
      },
    ],
  },
  {
    type: 'User Content',
    items: [
      {
        name: 'Birth date, birth time, and birth location',
        purposeType: 'App Functionality',
        purpose: 'Calculating your natal chart and the personalized readings, transits, and planner insights built on it.',
      },
      {
        name: 'Journal entries and saved charts',
        purposeType: 'App Functionality',
        purpose: 'Your planner notes and the people and events you save for synastry readings.',
      },
      {
        name: 'Feedback and community contributions',
        purposeType: 'App Functionality',
        purpose: 'Bug reports, feature requests, cancellation surveys, and interpretations you choose to submit.',
      },
    ],
  },
  {
    type: 'Identifiers',
    items: [
      {
        name: 'User ID',
        purposeType: 'App Functionality',
        purpose: 'Linking your charts, progress, and preferences to your account.',
      },
    ],
  },
  {
    type: 'Purchases',
    items: [
      {
        name: 'Purchase history',
        purposeType: 'App Functionality',
        purpose: 'Managing your subscription, tier, and billing through Stripe or the App Store / Google Play.',
      },
    ],
  },
  {
    type: 'Usage Data',
    items: [
      {
        name: 'Product interaction (quizzes, XP, streaks, reading ratings)',
        purposeType: 'App Functionality & Analytics',
        purpose: 'Tracking your learning progress, personalizing your curriculum, and improving features. Never sold or shared for advertising.',
      },
    ],
  },
  {
    type: 'Diagnostics',
    items: [
      {
        name: 'Crash and error data',
        purposeType: 'App Functionality',
        purpose: 'Diagnosing and fixing issues you run into.',
      },
    ],
  },
];

export default function PrivacyNutritionLabel() {
  return (
    <LegalPageLayout
      title="Privacy at a Glance"
      subtitle="A plain-English summary of exactly what data Astrosetta collects and why — mirroring the App Store privacy label. For full legal detail, see the Privacy Policy."
      lastUpdated="September 6, 2026"
    >
      {/* No tracking */}
      <div className="rounded-xl border border-green-400/20 bg-green-400/[0.04] p-4 flex items-start gap-3">
        <Check size={16} className="text-green-400 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-display font-semibold text-white text-sm">Data Used to Track You: None</h3>
          <p className="font-body text-xs text-white/50 leading-relaxed mt-1">
            Astrosetta does not track you across other companies' apps or websites, contains no advertising SDKs,
            and does not sell your data or share it for advertising or tracking.
          </p>
        </div>
      </div>

      {/* Data linked to you */}
      <h2 className="font-display text-lg font-bold text-white mt-7">Data Linked to You</h2>
      <p className="font-body text-xs text-white/50 leading-relaxed mt-1 mb-3">
        Collected and tied to your account identity.
      </p>
      <div className="space-y-3">
        {LINKED_SECTIONS.map(section => (
          <div key={section.type} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="font-display font-semibold text-white text-sm mb-3">{section.type}</h3>
            <div className="space-y-3">
              {section.items.map(item => (
                <div key={item.name} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-body text-xs text-white/85">{item.name}</span>
                    <span className="font-label text-[9px] font-medium uppercase tracking-[0.05em] text-gold-accent/70 shrink-0">{item.purposeType}</span>
                  </div>
                  <p className="font-body text-[11px] text-white/45 leading-relaxed">{item.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data not linked to you */}
      <h2 className="font-display text-lg font-bold text-white mt-7">Data Not Linked to You</h2>
      <p className="font-body text-xs text-white/50 leading-relaxed mt-1 mb-3">
        Collected in a form that is not tied to your identity.
      </p>
      <div className="rounded-xl border border-white/[0.06] p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-body text-xs text-white/85">Anonymous aggregate usage stats</span>
            <span className="font-label text-[9px] font-medium uppercase tracking-[0.05em] text-gold-accent/70 shrink-0">App Functionality &amp; Analytics</span>
          </div>
          <p className="font-body text-[11px] text-white/45 leading-relaxed">
            Aggregate counts of readings generated and features used, kept only in anonymous form. When an account is
            deleted, every personal record is permanently erased and only these anonymous aggregates remain — nothing
            in them can be linked back to you.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-7 rounded-xl p-4 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-start gap-3">
          <Database size={14} className="text-gold-accent mt-0.5 shrink-0" />
          <p className="font-body text-xs text-white/50 leading-relaxed">
            You can permanently erase everything — charts, readings, journal, and learning progress — at any time from
            Profile → Delete Account. See the{' '}
            <Link to="/privacy" className="text-gold-accent underline hover:text-gold-primary">full Privacy Policy</Link>, the{' '}
            <Link to="/california-privacy-notice" className="text-gold-accent underline hover:text-gold-primary">California Privacy Notice</Link>, or{' '}
            <Link to="/legal" className="text-gold-accent underline hover:text-gold-primary">all legal documents</Link>.
          </p>
        </div>
      </div>
    </LegalPageLayout>
  );
}