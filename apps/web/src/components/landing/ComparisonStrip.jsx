import React from 'react';
import { Check, X } from 'lucide-react';

// Generic vs. personal contrast — deliberately avoids any claim about our own
// calculation engine (future-proofed for the licensed astrology API) and names
// no competitors.
const CONTRAST = [
  {
    typical: 'A generic blurb written for your Sun sign alone',
    ours: 'Readings anchored to your exact placements — every planet, house, and angle',
  },
  {
    typical: "Told what the sky means, with no way to check the reasoning",
    ours: 'Every term tappable, every technique explained — you learn to verify it yourself',
  },
  {
    typical: 'The same recycled phrases, whoever you are',
    ours: 'Daily, weekly, and monthly readings drawn from your chart and the live sky',
  },
  {
    typical: 'An app you outgrow once the novelty fades',
    ours: 'A curriculum, quizzes, and tiers that carry you from first placement to fluent reader',
  },
];

const FEATURES = [
  'Interactive chart wheel',
  'Synastry & composite relationship charts',
  'Full learning curriculum with quizzes',
  'Clickable glossary on every term',
  'Modern, Hellenistic & Vedic traditions',
  'Calendar sync with your transits',
];

export default function ComparisonStrip() {
  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <p className="font-body text-xs uppercase tracking-widest mb-2" style={{ color: '#C9A961' }}>Why Astrosetta</p>
        <h2 className="font-display text-3xl font-bold text-white">Not another horoscope app.</h2>
        <p className="font-body text-sm mt-3 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Most apps hand you a reading. Astrosetta hands you the whole sky — your chart, the live transits, and the fluency to read both yourself.
        </p>
      </div>

      {/* Generic vs. personal */}
      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-body text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>A typical horoscope app</p>
          <ul className="space-y-3.5">
            {CONTRAST.map((row, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <X size={14} className="mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{row.typical}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'rgba(201,169,97,0.07)', border: '1px solid rgba(201,169,97,0.35)' }}>
          <p className="font-body text-xs uppercase tracking-widest mb-4" style={{ color: '#C9A961' }}>Astrosetta</p>
          <ul className="space-y-3.5">
            {CONTRAST.map((row, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check size={14} className="mt-0.5 shrink-0" style={{ color: '#C9A961' }} />
                <p className="font-body text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{row.ours}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Feature checklist */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {FEATURES.map(f => (
          <div
            key={f}
            className="flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,169,97,0.15)' }}
          >
            <Check size={13} className="shrink-0" style={{ color: '#C9A961' }} />
            <p className="font-body text-xs text-white/75">{f}</p>
          </div>
        ))}
      </div>
    </section>
  );
}