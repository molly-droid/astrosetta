// Eclipse detection + shared styling for banners and highlights.
// A lunation (New or Full Moon) is an eclipse when the Sun-Moon axis aligns
// with the lunar nodes — i.e. the Moon is crossing the ecliptic plane. We use
// an 18° "eclipse-season" window, which captures partial/total eclipses alike.

export const ECLIPSE_ORB = 18;

// Eclipses can perfect hours from the noon snapshot (often overnight), so the
// phase window for eclipse detection is wider than the "exact" lunation orb —
// this lets an eclipse surface on the calendar day it perfects even when the
// exact lunation is still ~13° (≈26h) away. Node proximity (ECLIPSE_ORB) still
// gates this, so regular non-eclipse lunations never trigger.
export const ECLIPSE_PHASE_ORB = 13;

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function signOf(longitude) {
  const l = ((longitude % 360) + 360) % 360;
  return { sign: SIGNS[Math.floor(l / 30)], degree: Math.round((l % 30) * 10000) / 10000 };
}

/**
 * Detect whether the current day's exact lunation is an eclipse.
 * Returns { isEclipse, type, moonSign, degree } or null.
 *
 * The eclipse sign is the sign at the moment of exactness, NOT the noon
 * snapshot. A lunation can perfect hours from noon, and the fast-moving Moon
 * (≈12°/day) may cross a sign boundary between noon and exactness — so the noon
 * Moon can read a sign behind the actual eclipse (e.g. noon Moon in late
 * Aquarius while the Full Moon eclipse perfects in Pisces). We therefore derive
 * the eclipse sign from the Sun, which moves only ~1°/day and is stable to
 * ~0.5° across the day: solar eclipse → Sun's sign; lunar eclipse → Sun + 180°.
 */
export function detectEclipse({ sunPlanet, moonPlanet, transitPlanets = [], isExactNewMoon, isExactFullMoon }) {
  const norm = (v) => ((v % 360) + 360) % 360;
  const northNode = (transitPlanets || []).find(p => p.name === 'North Node');
  const southNode = (transitPlanets || []).find(p => p.name === 'South Node');

  const nodeLons = [];
  if (northNode) nodeLons.push(norm(northNode.longitude));
  if (southNode) nodeLons.push(norm(southNode.longitude));
  if (northNode && !southNode) nodeLons.push(norm(northNode.longitude + 180));
  if (nodeLons.length === 0 || !sunPlanet || !moonPlanet) return null;

  const nearest = (lon) => {
    let min = Infinity;
    for (const n of nodeLons) {
      let d = Math.abs(norm(lon) - n);
      if (d > 180) d = 360 - d;
      if (d < min) min = d;
    }
    return min;
  };

  // Compute phase proximity from the longitudes with the wider eclipse window
  // (the Moon can be up to ~13° from exact on the day it perfects overnight).
  const diff = ((moonPlanet.longitude - sunPlanet.longitude) + 360) % 360;
  const nearNew = diff <= ECLIPSE_PHASE_ORB || diff >= 360 - ECLIPSE_PHASE_ORB;
  const nearFull = Math.abs(diff - 180) <= ECLIPSE_PHASE_ORB;

  if (nearNew && nearest(sunPlanet.longitude) <= ECLIPSE_ORB) {
    // Solar eclipse perfects at the New Moon conjunction (Sun ≈ Moon).
    const s = signOf(sunPlanet.longitude);
    return { isEclipse: true, type: 'solar', moonSign: s.sign, degree: s.degree };
  }
  if (nearFull && nearest(moonPlanet.longitude) <= ECLIPSE_ORB) {
    // Lunar eclipse perfects at the Full Moon opposition (Moon = Sun + 180°).
    const s = signOf((sunPlanet?.longitude ?? 0) + 180);
    return { isEclipse: true, type: 'lunar', moonSign: s.sign, degree: s.degree };
  }
  return null;
}

export const ECLIPSE_META = {
  solar: {
    label: 'Solar Eclipse',
    basePhase: 'New Moon',
    glyph: '🌑',
    color: 'text-gold-accent',
    glow: 'rgba(212,175,133,0.9)',
    bg: 'bg-gold-primary/15',
    border: 'border-gold-accent/50',
    badge: 'Solar · New Moon Eclipse',
    meaning: 'A solar eclipse supercharges the new moon — a fated new beginning and a turning point. What is seeded now carries far beyond a typical lunation and can unfold across the coming six months.',
  },
  lunar: {
    label: 'Lunar Eclipse',
    basePhase: 'Full Moon',
    glyph: '🌕',
    color: 'text-amber-300',
    glow: 'rgba(251,191,36,0.9)',
    bg: 'bg-amber-950/60',
    border: 'border-amber-400/50',
    badge: 'Lunar · Full Moon Eclipse',
    meaning: 'A lunar eclipse illuminates and releases what has been building — a culminating full moon with extra weight. Revelations and closures arrive now and ripple out across the coming six months.',
  },
};