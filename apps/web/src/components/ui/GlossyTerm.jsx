import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUserPrefs } from '@/lib/UserPrefsContext';
import { base44 } from '@/api/base44Client';
import { ChevronDown, BookOpen } from 'lucide-react';

/**
 * Static fallback glossary — used instantly while the GlossaryItem entity
 * loads (or if no record exists for a term). Mirrors GlyphInfo's approach
 * so the click-to-learn never feels broken.
 */
const STATIC_GLOSSARY = {
  conjunction: { display_name: 'Conjunction', category: 'aspect', definition_essential: '0° — Two forces merging into one. Energy is amplified and focused.', definition_technical: '0° ±8° (Sun/Moon tighter). The strongest merging aspect; planets co-function as a single complex. Consider orb tightness, dispositors, and whether the conjunction is cazimi, combust, or under the beams.' },
  opposition: { display_name: 'Opposition', category: 'aspect', definition_essential: '180° — Two forces pulling in opposite directions. Awareness through tension and balance.', definition_technical: '180° ±8°. A polarity axis; the two planets are mutual projections. Integration comes through relationship and the midpoint (which acts as a sensitive point). Often experienced through other people.' },
  square: { display_name: 'Square', category: 'aspect', definition_essential: '90° — Friction demanding action. A productive crisis that builds strength.', definition_technical: '90° ±7°. Internal tension between planets in the same modality, different elements. Generates action and growth through conflict; associated with the "cross of matter."' },
  trine: { display_name: 'Trine', category: 'aspect', definition_essential: '120° — Effortless flow and harmony. Natural gifts that can go unnoticed.', definition_technical: '120° ±8°. Same element, different modality. Flowing, supportive but potentially inert energy; trines need conscious engagement to be productive.' },
  sextile: { display_name: 'Sextile', category: 'aspect', definition_essential: '60° — Gentle opportunity. Requires conscious effort to activate.', definition_technical: '60° ±5°. Compatible elements, supportive but requiring initiative. Read as a minor opportunity aspect.' },
  quincunx: { display_name: 'Quincunx', category: 'aspect', definition_essential: '150° — Awkward misalignment needing constant adjustment.', definition_technical: '150° ±3°. Also called inconjunct. No shared element, modality, or polarity — the planets "don\'t speak the same language." Requires creative integration; often linked to health and adjustment themes.' },
  ascendant: { display_name: 'Ascendant', category: 'angle', definition_essential: 'Your rising sign — the lens through which you meet the world and your first impression.', definition_technical: 'The cusp of the 1st house; the degree of the ecliptic rising on the eastern horizon at birth. Determines house placement, the chart ruler, and the physical body/temperament in traditional astrology.' },
  midheaven: { display_name: 'Midheaven', category: 'angle', definition_essential: 'Your highest point — career, public reputation, and calling.', definition_technical: 'The Medium Coeli (MC); the cusp of the 10th house. In quadrant systems it is the upper meridian; signifies public standing, vocation, and authority figures. Its ruler is the career significator.' },
  retrograde: { display_name: 'Retrograde', category: 'concept', definition_essential: 'When a planet appears to move backward — its energy turns inward for review.', definition_technical: 'Apparent backward motion from Earth\'s frame. The planet is closest to Earth and brightest. Its significations are intensified, delayed, or require re-doing; secondary motion is reversed in traditional doctrine.' },
  stellium: { display_name: 'Stellium', category: 'concept', definition_essential: 'Three or more planets clustered together — concentrated energy in one area.', definition_technical: 'Traditionally 3+ planets in the same sign (modern: same sign OR house within tight orbs). Concentrates that sign/house\'s themes; the stellium\'s dispositors become critical handles for the chart.' },
  transit: { display_name: 'Transit', category: 'concept', definition_essential: 'Where the planets are right now — and how they interact with your birth chart.', definition_technical: 'The current real-time positions of planets forming aspects to their natal (birth) positions or to each other (mundane). Transit-to-natal aspects time when natal potentials are activated.' },
  ingress: { display_name: 'Ingress', category: 'concept', definition_essential: 'When a planet enters a new sign — a shift in collective mood.', definition_technical: 'A planet crossing 0° of a new sign. Cardinal ingresses (especially Aries/Sun) set mundane charts; used in traditional mundane and electional astrology.' },
  'essential dignity': { display_name: 'Essential Dignity', category: 'technique', definition_essential: 'A planet being "at home" — expressing its energy naturally and comfortably.', definition_technical: 'A planet in its own sign (domicile), exaltation, triplicity, term, or face. Indicates the planet has rulership and agency; measured via the traditional dignity scheme (Rulerships, Exaltations, Triplicities, Terms/Bounds, Faces/Decans).' },
  dispositor: { display_name: 'Dispositor', category: 'technique', definition_essential: 'The planet that "hosts" another — the ruler of the sign a planet sits in.', definition_technical: 'The ruler of the sign a planet occupies. The chain of dispositors (and the final dispositor, if one exists) reveals how a planet\'s energy is ultimately expressed and grounded.' },
  orb: { display_name: 'Orb', category: 'technique', definition_essential: 'How close an aspect is to exact — tighter means stronger.', definition_technical: 'The allowed deviation in degrees from an exact aspect angle. Classical orbs vary by planet and aspect type (e.g. Sun conjunction 15°, Moon 12°, Mercury 7°); tighter orbs = stronger, more acute manifestation.' },
  station: { display_name: 'Station', category: 'concept', definition_essential: 'When a planet appears to pause and change direction — turning retrograde (inward review) or direct (forward momentum resumes).', definition_technical: 'A planet reaches ~0° apparent daily motion and "stations" before reversing direction. A station retrograde opens a review period; a station direct resumes outward motion. Transits within ~1° of a station point are intensely concentrated.' },
  'nodal axis': { display_name: 'Nodal Axis', category: 'node', definition_essential: 'The line linking your North and South Nodes — the growth edge and the past-pattern comfort zone.', definition_technical: 'The axis through the lunar nodes (mean or true). The North Node marks evolutionary direction; the South Node marks karmic defaults. A transit to either end activates the whole axis.' },
  descendant: { display_name: 'Descendant', category: 'angle', definition_essential: 'Your setting point — partnerships, one-to-one relationships, and what you seek in others.', definition_technical: 'The cusp of the 7th house; the degree of the ecliptic setting on the western horizon at birth. The point opposite the Ascendant; governs marriage, open enemies, and projected qualities. Its ruler describes how relationships unfold.' },
  ic: { display_name: 'IC (Imum Coeli)', category: 'angle', definition_essential: 'Your lowest point — roots, home, family, and inner foundation.', definition_technical: 'The Imum Coeli; the cusp of the 4th house and the lower meridian. In quadrant systems it is the nadir; signifies origins, ancestry, the private self, and the end of the matter. Its ruler and any planets nearby shape one\'s sense of home and belonging.' },
  domicile: { display_name: 'Domicile', category: 'technique', definition_essential: 'A planet in the sign it rules — "at home," expressing its nature freely and at full strength.', definition_technical: 'A planet in its own sign (e.g. Mars in Aries). The strongest essential dignity; the planet has agency, rulership, and clean expression. Opposite of detriment.' },
  detriment: { display_name: 'Detriment', category: 'technique', definition_essential: 'A planet in the sign opposite the one it rules — uncomfortable, its energy strained or misdirected.', definition_technical: 'A planet in the sign opposite its domicile (e.g. Mars in Libra). Its energy is present but compromised — harder to express cleanly, prone to overcompensation or friction.' },
  exaltation: { display_name: 'Exaltation', category: 'technique', definition_essential: 'A planet elevated and celebrated — operating at its highest, most visible expression.', definition_technical: 'A specific sign where a planet is exalted (e.g. Sun in Aries, Jupiter in Cancer). Distinct from domicile; associated with peak power and visibility. Opposite of fall.' },
  fall: { display_name: 'Fall', category: 'technique', definition_essential: 'A planet in the sign opposite its exaltation — diminished, its energy harder to access constructively.', definition_technical: 'A planet in the sign opposite its exaltation (e.g. Saturn in Aries). Its dignity is lowered; expression tends toward awkwardness or weakness unless supported by other factors.' },
  peregrine: { display_name: 'Peregrine', category: 'technique', definition_essential: 'A planet in a sign where it has no dignity — neutral, neither helped nor hindered by sign placement.', definition_technical: 'A planet with no essential dignity (domicile, exaltation, triplicity, term, or face) in its sign. Neutral condition; its expression depends almost entirely on aspects and house placement.' },
  cazimi: { display_name: 'Cazimi', category: 'technique', definition_essential: 'A planet within ~17′ of the Sun — "in the heart of the sun," considered exalted and sharpened.', definition_technical: 'A planet within roughly 17 arc minutes of the Sun\'s exact longitude. Traditionally a great dignity — the planet is "on the solar throne," intensified and empowered. Distinct from combustion.' },
  combust: { display_name: 'Combust', category: 'technique', definition_essential: 'A planet too close to the Sun — its energy is overwhelmed or hidden by solar glare.', definition_technical: 'A planet within ~8°30′ of the Sun (some traditions 8° or 15°). Its significations are weakened, obscured, or "burned up" by the Sun\'s rays. Closer than cazimi but outside the cazimi core.' },
  bonification: { display_name: 'Bonification', category: 'technique', definition_essential: 'Helpful support a planet receives — aspects or configurations that strengthen it.', definition_technical: 'In Hellenistic practice, a planet is bonified by helpful aspects from benefics, sect rulers, or dignified planets. Maltreatment is the opposite — harmful aspects from malefics that weaken a planet\'s capacity to act.' },
  triplicity: { display_name: 'Triplicity', category: 'technique', definition_essential: 'A form of dignity based on the element of a sign — a secondary rulership shared across a trine of signs.', definition_technical: 'A planet assigned as a day or night ruler of a triplicity (Fire, Earth, Air, Water). A lesser essential dignity than domicile/exaltation; provides ongoing, background support. Dorothean vs. Ptolemaic schemes differ.' },
  nakshatra: { display_name: 'Nakshatra', category: 'concept', definition_essential: 'One of 27 lunar mansions in Vedic astrology — the Moon\'s zodiac, finer than the 12 signs.', definition_technical: 'The 27 (sometimes 28) mansions the Moon travels through, each ~13°20′. In Jyotish the Moon\'s nakshatra is a core chart feature, governing temperament and dasha timing. Each has a ruling planet and deity.' },
  dasha: { display_name: 'Dasha', category: 'concept', definition_essential: 'A Vedic planetary period — a chapter of life ruled by a single planet for a set number of years.', definition_technical: 'In Jyotish, the Vimshottari dasha assigns each planet a fixed span (e.g. Venus 20 yrs, Sun 6) unfolding in sequence from the Moon\'s nakshatra. The current dasha and its sub-periods (bhuktis) time when natal potentials activate.' },
  ayanamsa: { display_name: 'Ayanamsa', category: 'concept', definition_essential: 'The offset between the tropical and sidereal zodiacs — what makes Vedic charts shift signs.', definition_technical: 'The precession-of-the-equinoxes correction (currently ~24°) added to tropical positions to get sidereal. Lahiri (Chitrapaksha) is the most common; others (Raman, Krishnamurti) exist. It\'s why Vedic Sun signs differ from Western.' },
  lots: { display_name: 'Lots (Arabic Parts)', category: 'technique', definition_essential: 'Calculated points — not planets — that mark where a theme concentrates in the chart.', definition_technical: 'Mathematically derived points, e.g. Lot of Fortune = ASC + Moon − Sun (day chart). Hellenistic in origin; each lot has a ruler and signifies a life domain. The Lot of Fortune (body/material) and Lot of Spirit (action/soul) are the most used.' },
  'part of fortune': { display_name: 'Part of Fortune', category: 'point', definition_essential: 'A calculated point marking where earthly fortune and opportunity naturally gather in your life.', definition_technical: 'Lot of Fortune = ASC + Moon − Sun (day chart; reverse the luminary order at night). Not a body; signifies material luck, the body, and where ease accumulates. Its house and ruling planet describe the arena of fortune.' },
  'part of spirit': { display_name: 'Part of Spirit', category: 'point', definition_essential: 'A calculated point marking where your intentional action and will most readily manifest.', definition_technical: 'Lot of Spirit = ASC + Sun − Moon (day chart; reverse at night). Paired with the Lot of Fortune — Fortune is the body/circumstance, Spirit is the soul/effort. Used together in Hellenistic technique.' },
  'whole sign': { display_name: 'Whole Sign Houses', category: 'technique', definition_essential: 'A house system where each entire sign is one house — the oldest and simplest method.', definition_technical: 'The oldest house system: the sign of the Ascendant is the entire 1st house, the next sign the 2nd, etc. House cusps equal sign cusps. Used in Hellenistic and traditional astrology; favored for its clean relationship between sign rulership and house topics.' },
  decan: { display_name: 'Decan', category: 'technique', definition_essential: 'Each sign divided into three 10° slices — a subtle sub-flavor within the sign.', definition_technical: 'Each decan is ruled by a planet — by the Chaldean order in modern practice, or the triplicity rulers in the classical "face" scheme. A planet in its own decan is "in its face," the weakest of the five essential dignities.' },
  'void of course': { display_name: 'Void of Course', category: 'concept', definition_essential: 'When the Moon makes no more major aspects before leaving its sign — a pause in the lunar narrative.', definition_technical: 'Classically: the Moon applies to no aspect with the seven classical planets within her orb (17°) before changing signs. Modern practice counts only the major aspects. Associated with drift and "nothing comes of it" outcomes; avoided for launching new ventures in electional work.' },
  semisextile: { display_name: 'Semisextile', category: 'aspect', definition_essential: '30° — neighboring signs. A quiet, mildly awkward adjustment between two very different styles.', definition_technical: '30° ±2°. Signs share neither element nor modality — a low-grade friction requiring small ongoing adjustments. A minor aspect; read with tight orbs, as the gentler cousin of the quincunx family.' },
  sesquiquadrate: { display_name: 'Sesquiquadrate', category: 'aspect', definition_essential: '135° — an agitating, restless minor aspect that surfaces hidden friction.', definition_technical: '135° (square + semisquare) ±2°. Part of the square family; acts like a nagging irritant that forces course corrections. Often triggers events when it repeats across a transit sequence.' },
  'under the beams': { display_name: 'Under the Beams', category: 'technique', definition_essential: 'A planet within ~15° of the Sun — hidden from view, its energy working behind the scenes.', definition_technical: 'A planet between roughly 8°30′ and 15° of the Sun. Not fully combust, but obscured: its significations are weakened, hidden, or working invisibly. A key visibility condition in traditional astrology.' },
  antiscion: { display_name: 'Antiscion', category: 'technique', definition_essential: 'A "mirror point" — degrees equidistant from the solstice axis that secretly share energy.', definition_technical: 'From the Greek "opposite shadows." Degrees mirrored across the Cancer–Capricorn solstice axis (e.g. 5° Gemini ↔ 25° Cancer). Contact between a planet and another\'s antiscion behaves like a hidden conjunction. Used in synastry and transit work.' },
  contrascion: { display_name: 'Contrascion', category: 'technique', definition_essential: 'The equinox-axis mirror of a degree — points that act like a hidden opposition.', definition_technical: 'Degrees mirrored across the Aries–Libra equinox axis (e.g. 5° Taurus ↔ 25° Aries). Contact by contrascion functions like an opposition; often read as shadow dynamics between charts.' },
  sect: { display_name: 'Sect', category: 'technique', definition_essential: 'Whether a chart is a day or night chart — which changes how each planet behaves.', definition_technical: 'A chart is diurnal if the Sun is above the horizon (houses 7–12), nocturnal if below (1–6). Jupiter and Saturn belong to the diurnal sect; Venus and Mars to the nocturnal. Sect-mates act more constructively — sect alone can flip a malefic from hostile to supportive.' },
  hayz: { display_name: 'Hayz', category: 'technique', definition_essential: 'A planet in its own sect, hemisphere, and a compatible sign — strongly "at home" and empowered to act.', definition_technical: 'A planet is hayz when it is in its proper hemisphere for its sect and in a sign of its sect\'s triplicity. An indication of empowerment: the planet can deliver its significations with minimal obstruction.' },
  profection: { display_name: 'Profection', category: 'technique', definition_essential: 'A technique that "activates" one house of your chart each year, on a repeating 12-year cycle.', definition_technical: 'Annual profections advance the Profected Ascendant one whole-sign house per year from the 1st at birth. The sign of the year — and its ruler, the Lord of the Year — shows the dominant theme; combined with transits for timing.' },
  bhava: { display_name: 'Bhava', category: 'house', definition_essential: 'The Vedic equivalent of a house — one of twelve life areas, read from the sidereal chart.', definition_technical: 'In Jyotish, the bhavas are counted whole-sign from the lagna (rising sign). Key bhavas: 1st (tanu — body/self), 4th (sukha — home/comfort), 7th (kalatra — partnership), 10th (karma — career). Each bhava\'s ruler (bhava-lord) describes outcomes in that domain.' },
  'sidereal zodiac': { display_name: 'Sidereal Zodiac', category: 'concept', definition_essential: 'The zodiac fixed to the actual constellations — the one Vedic astrology uses.', definition_technical: 'A zodiac measured against the fixed stars (via the Lahiri ayanamsa) rather than the equinox point. Precession currently offsets it ~24° from the tropical zodiac — why Vedic placements often differ by one sign from Western ones.' },
};

const CATEGORY_STYLES = {
  planet: 'border-celestial-blue/50 bg-celestial-blue/15',
  sign: 'border-gold-primary/50 bg-gold-primary/15',
  house: 'border-celestial-green/50 bg-celestial-green/15',
  aspect: 'border-purple-300/50 bg-purple-300/15',
  angle: 'border-gold-accent/50 bg-gold-accent/15',
  node: 'border-celestial-cyan/50 bg-celestial-cyan/15',
  technique: 'border-brass/50 bg-brass/15',
  concept: 'border-white/30 bg-white/10',
};

const POPOVER_W = 248;
const MARGIN = 8;

// Cache fetched glossary items so we don't re-query for the same term
const glossaryCache = new Map();
let cacheLoadedAll = false;

export default function GlossyTerm({ term, children, className = '' }) {
  const { knowledgeDepth } = useUserPrefs();
  const [open, setOpen] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [item, setItem] = useState(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const btnRef = useRef(null);

  const termKey = (term || '').toLowerCase().trim();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [open]);

  // Reset progressive disclosure each time we open
  useEffect(() => { setShowTechnical(false); }, [open]);

  const lookupItem = useCallback(async (key) => {
    if (!key) return null;
    if (glossaryCache.has(key)) return glossaryCache.get(key);
    if (STATIC_GLOSSARY[key]) {
      glossaryCache.set(key, STATIC_GLOSSARY[key]);
      return STATIC_GLOSSARY[key];
    }
    try {
      const results = await base44.entities.GlossaryItem.filter({ term_key: key });
      const found = results[0] || null;
      if (found) {
        // Also check aliases if no direct match
        glossaryCache.set(key, found);
        return found;
      }
      // Try alias match
      if (!cacheLoadedAll) {
        const all = await base44.entities.GlossaryItem.list();
        cacheLoadedAll = true;
        for (const gi of all) {
          glossaryCache.set(gi.term_key, gi);
          (gi.aliases || []).forEach(a => {
            const ak = a.toLowerCase();
            if (!glossaryCache.has(ak)) glossaryCache.set(ak, gi);
          });
        }
        return glossaryCache.get(key) || null;
      }
    } catch {
      // non-critical
    }
    return null;
  }, []);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    setLoadingItem(true);
    const found = await lookupItem(termKey);
    setItem(found);
    setLoadingItem(false);

    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popoverH = 150;
    let top;
    const spaceAbove = rect.top - MARGIN;
    if (spaceAbove >= popoverH) top = rect.top - popoverH - 6;
    else top = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - POPOVER_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - POPOVER_W - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - popoverH - MARGIN));
    setPos({ top, left });
    setOpen(true);
  };

  const displayName = item?.display_name || STATIC_GLOSSARY[termKey]?.display_name || term;
  const category = item?.category || STATIC_GLOSSARY[termKey]?.category || 'concept';
  const essential = item?.definition_essential || STATIC_GLOSSARY[termKey]?.definition_essential || '';
  const technical = item?.definition_technical || STATIC_GLOSSARY[termKey]?.definition_technical || '';
  const isTechnicalMode = knowledgeDepth === 'technical';
  const showTechByDefault = isTechnicalMode && !!technical;

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleClick}
        className={`inline cursor-pointer border-b border-dotted border-gold-accent/40 hover:border-gold-accent hover:text-gold-accent transition-colors ${className}`}
        title={`${displayName} — tap to learn more`}
        aria-label={`${displayName} — tap to learn more`}
      >
        {children || term}
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className={`fixed z-[9999] rounded-xl border shadow-xl p-3 text-left ${CATEGORY_STYLES[category] || CATEGORY_STYLES.concept}`}
            style={{
              top: pos.top, left: pos.left, width: POPOVER_W,
              background: 'rgba(15, 26, 46, 0.97)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen size={13} className="text-gold-accent shrink-0" />
              <span className="font-display text-sm font-semibold text-white capitalize">{displayName}</span>
              <span className="font-body text-[9px] uppercase tracking-widest text-white/40 ml-auto">{category}</span>
            </div>
            {loadingItem ? (
              <p className="font-body text-xs text-brass/60 italic">Loading…</p>
            ) : (
              <>
                <p className="font-body text-xs leading-relaxed text-white/85">
                  {showTechnical || showTechByDefault ? (technical || essential) : essential}
                </p>
                {technical && !showTechByDefault && !showTechnical && (
                  <button
                    onClick={() => setShowTechnical(true)}
                    className="mt-2 flex items-center gap-1 font-body text-[10px] text-gold-accent hover:text-gold-primary transition-colors"
                  >
                    <ChevronDown size={11} /> Reveal technical depth
                  </button>
                )}
                {technical && showTechnical && !showTechByDefault && (
                  <button
                    onClick={() => setShowTechnical(false)}
                    className="mt-2 flex items-center gap-1 font-body text-[10px] text-brass/60 hover:text-brass transition-colors"
                  >
                    <ChevronDown size={11} className="rotate-180" /> Hide
                  </button>
                )}
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </span>
  );
}