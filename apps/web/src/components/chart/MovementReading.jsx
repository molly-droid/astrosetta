import React, { useState, useEffect } from 'react';
import { invokeLLMTask } from '@/api/llmTasks';
import { Loader2, X } from 'lucide-react';
import { PLANET_GLYPHS } from '@/lib/chartUtils';
import { findNatalHouseForSign, ordinal } from '@/lib/houseUtils';
import { highlightSynthesisText } from '@/lib/transitUtils';
import { useUserPrefs } from '@/lib/UserPrefsContext';

const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const HOUSE_THEMES = [
  '', 'self & first impressions', 'money & values', 'communication & learning',
  'home & family', 'creativity & romance', 'health & daily routines',
  'partnerships', 'shared resources & transformation', 'philosophy & travel',
  'career & public standing', 'friendships & community', 'solitude & spirituality',
];

function signOf(lon) { return SIGN_NAMES[Math.floor((((lon % 360) + 360) % 360) / 30)]; }

// Is a natal longitude swept by the planet's path from startLon to endLon?
function inArc(lon, startLon, endLon, retrograde) {
  const l = ((lon % 360) + 360) % 360;
  const s = ((startLon % 360) + 360) % 360;
  const e = ((endLon % 360) + 360) % 360;
  const lo = retrograde ? e : s;
  const hi = retrograde ? s : e;
  if (hi >= lo) return l > lo && l < hi;
  return l > lo || l < hi; // path wraps past 0°
}

export default function MovementReading({ item, chart, periodLabel = 'this period', onClose }) {
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(true);
  const { knowledgeDepth } = useUserPrefs();

  useEffect(() => {
    let cancelled = false;
    const raw = chart?.raw_data || {};
    const natal = raw.planets || [];
    const { planet, startLon, endLon, retrograde } = item;
    const startSign = signOf(startLon);
    const endSign = signOf(endLon);

    const crossed = natal.filter(p => inArc(p.longitude, startLon, endLon, retrograde));
    const crossedNames = crossed.map(p => `${p.name} in ${p.sign}`).join(', ');

    const houseSystem = raw.house_system || 'whole_sign';
    const asc = raw.ascendant_sign || null;
    const startHouse = findNatalHouseForSign(startSign, raw.houses || [], houseSystem, asc)?.entryHouse;
    const endHouse = findNatalHouseForSign(endSign, raw.houses || [], houseSystem, asc)?.entryHouse;

    const signCounts = {};
    crossed.forEach(p => { signCounts[p.sign] = (signCounts[p.sign] || 0) + 1; });
    const stelliumSign = Object.keys(signCounts).find(s => signCounts[s] >= 3);

    const context = [
      crossedNames ? `Natal placements it will cross (conjunct): ${crossedNames}.` : 'It does not form exact conjunctions with natal planets this period.',
      startHouse ? `It begins in the ${ordinal(startHouse)} house (${HOUSE_THEMES[startHouse] || ''}).` : '',
      endHouse && endHouse !== startHouse ? `It reaches the ${ordinal(endHouse)} house (${HOUSE_THEMES[endHouse] || ''}).` : '',
      stelliumSign ? `It activates a stellium in ${stelliumSign}.` : '',
    ].filter(Boolean).join(' ');

    invokeLLMTask('movement-reading', {
      periodLabel,
      planet,
      retrograde,
      startSign,
      endSign,
      context,
      knowledgeDepth,
    }).then(res => {
      if (cancelled) return;
      setReading(typeof res === 'string' ? res : (res?.text || (res?.overview) || 'Unable to generate this reading right now.'));
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setReading('Unable to generate this reading right now.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [item?.planet, item?.startLon, item?.endLon, chart?.id, knowledgeDepth]);

  const glyph = PLANET_GLYPHS[item?.planet] || '';
  const startSign = item ? signOf(item.startLon) : '';
  const endSign = item ? signOf(item.endLon) : '';

  return (
    <div className="w-full mt-2 animate-fade-up">
      <div className="rounded-xl border border-gold-primary/25 overflow-hidden" style={{ background: 'rgba(15,26,46,0.96)' }}>
        <div className="px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-[11px] text-gold-accent font-semibold">{glyph} {item?.planet}</span>
              <span className="font-body text-[10px] text-white/60">{startSign} → {endSign}</span>
              {item?.retrograde && <span className="font-body text-[9px] text-gold-accent italic">℞ Retrograde</span>}
            </div>
            <p className="font-body text-[10px] text-brass/50 uppercase tracking-wide">{periodLabel} · movement</p>
            {loading ? (
              <div className="flex items-center gap-2 py-1">
                <Loader2 size={12} className="animate-spin text-gold-accent" />
                <span className="font-body text-[11px] text-brass italic">Reading the movement...</span>
              </div>
            ) : (
              <p className="font-body text-[12px] text-white/85 leading-relaxed">{highlightSynthesisText(reading, null, 'text-gold-primary')}</p>
            )}
          </div>
          <button onClick={onClose} className="font-body text-[9px] text-brass/30 hover:text-brass transition-colors shrink-0">✕</button>
        </div>
      </div>
    </div>
  );
}