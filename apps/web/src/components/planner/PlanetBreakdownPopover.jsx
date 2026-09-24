import React, { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, X } from 'lucide-react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { findNatalHouseForSign, ordinal } from '@/lib/houseUtils';

const HOUSE_THEMES = [
  '', 'self & first impressions', 'money & values', 'communication & learning',
  'home & family', 'creativity & romance', 'health & daily routines',
  'partnerships', 'shared resources & transformation', 'philosophy & travel',
  'career & public standing', 'friendships & community', 'solitude & spirituality',
];

// Click-to-breakdown for a transiting planet in a sign — shows BOTH a personal
// reading (which natal house/life area it activates for THIS chart) and a
// collective reading (the archetypal theme for everyone).
export default function PlanetBreakdownPopover({ planet, sign, rx, chart, onClose }) {
  const [tab, setTab] = useState('personal');
  const [personal, setPersonal] = useState(null);
  const [collective, setCollective] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const raw = chart?.raw_data || {};
    const houseSystem = raw.house_system || 'whole_sign';
    const ascendantSign = raw.ascendant_sign || null;
    const { entryHouse } = findNatalHouseForSign(sign, raw.houses || [], houseSystem, ascendantSign);
    const houseTheme = entryHouse ? HOUSE_THEMES[entryHouse] : '';
    const natalInSign = (raw.planets || []).filter(p => p.sign === sign).map(p => `${p.name} (house ${p.house || '?'})`).join(', ');
    const houseContext = entryHouse ? ordinal(entryHouse) + ' house of ' + houseTheme : '';

    Promise.all([
      invokeLLMTask('planet-breakdown-personal', { planet, sign, rx: !!rx, houseContext, natalInSign }).catch(() => null),
      invokeLLMTask('planet-breakdown-collective', { planet, sign, rx: !!rx }).catch(() => null),
    ]).then(([p, c]) => {
      if (cancelled) return;
      setPersonal(p || 'Unable to generate.');
      setCollective(c || 'Unable to generate.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [planet, sign, rx, chart?.id]);

  const glyph = PLANET_GLYPHS[planet] || planet;

  return (
    <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(7,16,30,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-4 space-y-3" style={{ background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.25)' }}>
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-white">
            {glyph} {planet} in {sign}
            {rx && <span className="ml-1.5 font-body text-[10px] text-celestial-purple">℞ Retrograde</span>}
          </p>
          <button onClick={onClose} className="text-brass/50 hover:text-white"><X size={14} /></button>
        </div>

        <div className="flex border-b border-white/[0.06]">
          {[{ key: 'personal', label: 'For You' }, { key: 'collective', label: 'Collective' }].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 font-body text-[11px] tracking-widest uppercase transition-colors border-b-2 ${
                tab === t.key
                  ? 'border-gold-accent text-white font-semibold'
                  : 'border-transparent text-white/35 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={13} className="animate-spin text-gold-accent" />
            <span className="font-body text-xs text-brass italic">Reading the transit...</span>
          </div>
        ) : (
          <p className="font-body text-xs text-white/80 leading-relaxed">{tab === 'personal' ? personal : collective}</p>
        )}
      </div>
    </div>
  );
}