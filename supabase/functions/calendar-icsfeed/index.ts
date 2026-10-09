// ICS calendar feed — no OAuth required.
// External calendar clients use an unguessable bearer feed key issued to the
// authenticated owner by calendar-connection. A user ID alone is not a key.
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions, serviceClient } from '../_shared/edge.ts';
import { calendarAllowed } from '../_shared/googleCalendar.ts';
import { getLunationsBetween } from '../_shared/lunations.ts';

function planetLongitude(name, jd) {
  const T = (jd - 2451545.0) / 36525.0;
  const deg = v => ((v % 360) + 360) % 360;
  switch (name) {
    case 'Jupiter': return deg(34.351519 + 3034.905675 * T);
    case 'Saturn': return deg(50.077444 + 1222.113794 * T);
    case 'Uranus': return deg(314.055005 + 428.466998 * T);
    case 'Neptune': return deg(304.348665 + 218.459213 * T);
    case 'Pluto': return deg(238.929 + 145.2069 * T);
    case 'Mars': return deg(355.433 + 19140.299 * T);
    case 'Venus': return deg(181.979 + 58517.816 * T);
    case 'Mercury': return deg(252.251 + 149472.675 * T);
    case 'Sun': return deg(280.460 + 35999.372 * T);
    default: return 0;
  }
}

function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function longitudeToSign(lon) {
  const idx = Math.floor((((lon % 360) + 360) % 360) / 30);
  return SIGNS[idx] || '';
}

const SLOW_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const FAST_PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars'];
const ALL_TRANSIT_PLANETS = [...FAST_PLANETS, ...SLOW_PLANETS];
const ASPECT_ANGLES = { conjunction: 0, opposition: 180, trine: 120, square: 90, sextile: 60 };
const TRANSIT_ORB = 2.0;
const FAST_ORB = 1.0;
const MUNDANE_ORB = 1.5;

const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Jupiter: '♃', Saturn: '♄', Uranus: '♅',
  Neptune: '♆', Pluto: '♇', Mars: '♂', Venus: '♀', Mercury: '☿',
  Chiron: '⚷', 'North Node': '☊',
};
const ASPECT_EMOJIS = { conjunction: '☌', opposition: '☍', trine: '△', square: '□', sextile: '⚹' };
const ASPECT_LABELS = { conjunction: 'conjunct', opposition: 'opposite', trine: 'trine', square: 'square', sextile: 'sextile' };

const SIGN_THEMES = {
  Aries: 'identity, initiative, and new beginnings',
  Taurus: 'values, resources, and sensory pleasure',
  Gemini: 'communication, learning, and connections',
  Cancer: 'home, family, and emotional security',
  Leo: 'creativity, self-expression, and joy',
  Virgo: 'health, service, and daily refinement',
  Libra: 'relationships, balance, and justice',
  Scorpio: 'transformation, depth, and shared resources',
  Sagittarius: 'expansion, belief, and higher purpose',
  Capricorn: 'ambition, structure, and long-term goals',
  Aquarius: 'community, innovation, and collective change',
  Pisces: 'spirituality, compassion, and dissolution',
};

const TRANSIT_INTERPRETATIONS = {
  conjunction: {
    Sun: 'Identity and vitality are spotlighted. A powerful reset aligned with your core purpose — new cycles are strongly supported.',
    Moon: 'Emotions and instincts surge. Heightened sensitivity makes this ideal for inner work, nurturing, and emotional honesty.',
    Mercury: 'Mental activity peaks. Key conversations, decisions, and communications arrive now — clarity is your edge.',
    Venus: 'Love, beauty, and abundance are activated. Favorable window for relationships, creativity, and financial moves.',
    Mars: 'Drive and willpower surge. Bold action is supported — watch for impulsiveness or unnecessary conflict.',
    Jupiter: 'Expansion and opportunity peak. Fortune favors those who think big and take a genuine leap forward.',
    Saturn: 'Discipline and accountability are tested. A karmic checkpoint — consolidate, commit, and build for the long term.',
    Uranus: 'Sudden change and liberation arrive. Breakthroughs crack old patterns — expect the unexpected.',
    Neptune: 'Spiritual sensitivity peaks. Dreams, creativity, and surrender are deeply activated.',
    Pluto: 'Deep transformation is catalyzed. What no longer serves you is composted into new power.',
    Ascendant: 'A fresh wave of identity and selfhood. How you present to the world is being realigned.',
  },
  opposition: {
    Sun: 'Tension between self and others demands attention. Balance your needs against external expectations for real growth.',
    Moon: 'Emotional push-pull between inner needs and outer circumstances. Awareness — not avoidance — brings resolution.',
    Mercury: 'Conflicting viewpoints or information overload arise. Seek clarity before committing to decisions.',
    Venus: 'Relationship or financial tension surfaces. Find the middle ground between giving and receiving.',
    Mars: 'Conflict and competitive pressure run high. Channel drive constructively — avoid unnecessary battles.',
    Jupiter: 'Overextension or excess may backfire. Balance ambition with groundedness and patience.',
    Saturn: 'Responsibility meets resistance. Face obligations honestly; shortcuts will cost more later.',
    Uranus: 'Disruption challenges the status quo. Flexibility and adaptability are your greatest assets now.',
    Neptune: 'Confusion or illusion peaks. Ground yourself — avoid wishful thinking and double-check the details.',
    Pluto: 'Power struggles surface. Surrender control where you have none; transform what you can.',
    Ascendant: 'Relationships mirror back something essential about your identity. Tension that teaches.',
  },
  trine: {
    Sun: 'Energy flows naturally toward purpose. An easy window for confident self-expression and inspired action.',
    Moon: 'Emotional harmony and intuitive clarity. Home, relationships, and inner life feel aligned.',
    Mercury: 'Clear thinking and smooth communication. Ideal for writing, learning, and meaningful exchange.',
    Venus: 'Luck in love and creativity. Relationships flourish; beauty and abundance flow with ease.',
    Mars: 'Motivated and energized without friction. Act on what matters — momentum is fully on your side.',
    Jupiter: 'Abundance and optimism flow freely. Seize opportunities for growth, expansion, and travel.',
    Saturn: 'Disciplined effort pays off. A stabilizing influence that rewards consistency and patience.',
    Uranus: 'Innovation and inspired change integrate smoothly. New ideas and freedoms arrive naturally.',
    Neptune: 'Spiritual inspiration and creative flow. Intuition is heightened — trust your inner guidance.',
    Pluto: 'Empowering transformation unfolds gracefully. Depth and renewal come without upheaval.',
    Ascendant: 'Authentic self-expression flows with ease. People and opportunities align with who you are.',
  },
  square: {
    Sun: 'Friction challenges your identity and direction. Growth comes through confronting obstacles head-on, not around them.',
    Moon: 'Emotional tension demands action. Old patterns resist change — this pressure is forging something new in you.',
    Mercury: 'Mental stress and miscommunication arise. Slow down, double-check everything, and choose words carefully.',
    Venus: 'Relationship or financial strain demands attention. Honest renegotiation leads to stronger, truer bonds.',
    Mars: 'Frustration and blocked energy build pressure. Direct action — not aggression — is the way through.',
    Jupiter: 'Overconfidence creates friction. Focus on quality over quantity; rein in excess before it overextends you.',
    Saturn: 'Hard work meets resistance. The universe is testing your commitment — stay disciplined and patient.',
    Uranus: 'Unexpected disruption demands adaptation. The shake-up may be exactly the catalyst you needed.',
    Neptune: 'Confusion or unrealistic expectations surface. Seek grounding and avoid wishful thinking at all costs.',
    Pluto: 'Intense pressure demands deep change. Resistance only prolongs the struggle — transform willingly.',
    Ascendant: 'Identity is challenged by external pressure. Growth comes through meeting the friction directly.',
  },
  sextile: {
    Sun: 'A window of opportunity for confident self-expression. Purposeful, intentional action is supported now.',
    Moon: 'Emotional openness creates connection. Share feelings and nurture the relationships that matter most.',
    Mercury: 'Quick thinking and social ease. Networking, learning, and problem-solving come effortlessly.',
    Venus: 'Charming and magnetic energy. Small pleasures, meaningful connections, and creative sparks abound.',
    Mars: 'Productive momentum is available. Take initiative on projects that have been stalled or hesitated over.',
    Jupiter: 'A real but fleeting window of good fortune. Say yes to growth opportunities presenting themselves.',
    Saturn: 'Practical achievements within reach. Steady progress rewards focused, grounded, disciplined effort.',
    Uranus: 'Fresh ideas and mild breakthroughs arrive. Stay open to unconventional, innovative solutions.',
    Neptune: 'Gentle inspiration and creative flow. Ideal for art, meditation, and imaginative, soul-level work.',
    Pluto: 'Subtle empowerment for transformation. Make small but deeply meaningful shifts toward your deeper goals.',
    Ascendant: 'A gentle opportunity to express your authentic self. Small steps toward being seen.',
  },
};

function getTransitInterpretation(aspect, natalPlanetName) {
  return TRANSIT_INTERPRETATIONS[aspect]?.[natalPlanetName] || `${aspect} transit to your natal ${natalPlanetName} — a meaningful activation of this planet's themes in your chart.`;
}

const DAILY_MOTIONS = {
  Sun: 1.0, Moon: 12.0, Mercury: 1.2, Venus: 1.0, Mars: 0.5,
  Jupiter: 0.08, Saturn: 0.03, Uranus: 0.01, Neptune: 0.006, Pluto: 0.004,
};

const STATION_PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function checkNatalAspects(transitLon, natalLon, maxOrb = TRANSIT_ORB) {
  let diff = Math.abs(transitLon - natalLon);
  if (diff > 180) diff = 360 - diff;
  for (const [aspName, aspAngle] of Object.entries(ASPECT_ANGLES)) {
    const orb = Math.abs(diff - aspAngle);
    if (orb <= maxOrb) return { aspect: aspName, orb };
  }
  return null;
}

function isApplying(transitLon, natalLon, aspect, jd, planetName) {
  // Check if orb is shrinking (applying) or growing (separating) by comparing today vs tomorrow
  const tomorrowJd = jd + 1;
  const todayDiff = Math.abs(transitLon - natalLon);
  const tomorrowLon = planetLongitude(planetName, tomorrowJd);
  const tomorrowDiff = Math.abs(tomorrowLon - natalLon);
  // Normalize diffs to aspect angle
  const target = ASPECT_ANGLES[aspect];
  const todayOrb = Math.abs(Math.min(todayDiff, 360 - todayDiff) - target);
  const tomorrowOrb = Math.abs(Math.min(tomorrowDiff, 360 - tomorrowDiff) - target);
  return tomorrowOrb < todayOrb;
}

function detectRetrograde(name, date) {
  const prevDate = new Date(date.getTime() - 2 * 86400000);
  const nextDate = new Date(date.getTime() + 2 * 86400000);
  const jd0 = dateToJD(prevDate);
  const jd1 = dateToJD(date);
  const jd2 = dateToJD(nextDate);
  const l0 = planetLongitude(name, jd0);
  const l1 = planetLongitude(name, jd1);
  const l2 = planetLongitude(name, jd2);
  function motion(la, lb) {
    let d = lb - la;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }
  const m1 = motion(l0, l1);
  const m2 = motion(l1, l2);
  if (m1 > 0 && m2 < 0) return 'retrograde_start';
  if (m1 < 0 && m2 > 0) return 'retrograde_end';
  return null;
}

function estimateTransitHour(orb, planetName) {
  const dailyMotion = DAILY_MOTIONS[planetName] || 0.5;
  const hours = (orb / dailyMotion) * 24;
  return 12 + hours;
}

function formatDateTime(dateStr, decimalHour) {
  const clamped = ((decimalHour % 24) + 24) % 24;
  const h = Math.floor(clamped);
  let m = Math.round((clamped % 1) * 60);
  if (m === 60) m = 0;
  const pad = n => n.toString().padStart(2, '0');
  return `${dateStr}T${pad(h)}:${pad(m)}:00`;
}

function toICSDateTime(date) {
  const pad = n => n.toString().padStart(2, '0');
  return date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z';
}

function toICSDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function escapeICS(text) {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function ordinal(n) {
  if (!n) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const APP_URL = 'https://astrosetta.com/planner';

function getPlannerUrl(req: Request, dateStr: string): string {
  return `${APP_URL}?date=${dateStr}`;
}

function buildICS(events, req: Request) {
  const now = toICSDateTime(new Date());

  // Stagger timed events on the same day so they never overlap.
  // Group by dateStr, assign non-overlapping 30-min slots starting at 07:00.
  const daySlots: Record<string, number> = {}; // dateStr → next available hour offset from 07:00

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Astrosetta//Astro Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Astrosetta Planner`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const evt of events) {
    let dtStart: string;
    let dtEnd: string;

    if (evt.allDay) {
      dtStart = toICSDate(evt.dateStr);
      dtEnd = toICSDate(evt.dateStr);
    } else if (evt.exactMs != null) {
      // Exact-instant events (lunations) at their true moment, UTC
      dtStart = toICSDateTime(new Date(evt.exactMs));
      dtEnd = toICSDateTime(new Date(evt.exactMs + 30 * 60 * 1000));
    } else {
      // Assign next available 30-min slot for this day
      if (daySlots[evt.dateStr] === undefined) daySlots[evt.dateStr] = 0;
      const slotIndex = daySlots[evt.dateStr]++;
      const slotMinutes = 7 * 60 + slotIndex * 30; // start at 07:00
      const startMs = new Date(evt.dateStr + 'T00:00:00Z').getTime() + slotMinutes * 60 * 1000;
      const endMs = startMs + 25 * 60 * 1000; // 25-min events leave a 5-min gap
      dtStart = toICSDateTime(new Date(startMs));
      dtEnd = toICSDateTime(new Date(endMs));
    }

    const uid = `astrosetta-${evt.dateStr}-${evt.summary}`.replace(/[^a-zA-Z0-9-]/g, '');
    const plannerUrl = getPlannerUrl(req, evt.dateStr);
    const descWithLink = `${evt.description}\n\nOpen in Astrosetta: ${plannerUrl}`;

    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}@astrosetta`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(evt.summary)}`,
      `DESCRIPTION:${escapeICS(descWithLink)}`,
      `URL:${plannerUrl}`,
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);

    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Invalid calendar link' }, { status: 401 });
    const db = serviceClient();
    const { data: feed, error } = await db.from('calendar_feed_keys').select('user_id').eq('token', token).maybeSingle();
    if (error) throw error;
    if (!feed) return json({ error: 'Calendar link not found' }, { status: 404 });
    const userId = feed.user_id;
    if (!await calendarAllowed(db, userId)) return json({ error: 'Calendar subscription inactive' }, { status: 403 });

    const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: userId });
    if (!charts.length) {
      return new Response('No chart found', { status: 404 });
    }
    const raw = charts[0].raw_data || {};
    // Re-assign natal planet houses using stored cusps — the stored planet
    // houses may be stale if the chart was calculated with a different house system
    const natalHousesForPlanets = raw.houses || [];
    const houseSystemForPlanets = raw.house_system || 'whole_sign';
    const ascSignForPlanets = raw.ascendant_sign;
    const natalPlanets = (raw.planets || [])
      .filter(p => SLOW_PLANETS.includes(p.name) || ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Ascendant'].includes(p.name))
      .map(p => {
        const np = { name: p.name, longitude: parseFloat(p.longitude) || 0, sign: p.sign || '', house: p.house || null };
        if (natalHousesForPlanets.length >= 12) {
          const norm = v => ((v % 360) + 360) % 360;
          if (houseSystemForPlanets === 'whole_sign' && ascSignForPlanets) {
            const signIdx = Math.floor(norm(np.longitude) / 30);
            const ascIdx = SIGNS.indexOf(ascSignForPlanets);
            np.house = ((signIdx - ascIdx + 12) % 12) + 1;
          } else {
            const lon = norm(np.longitude);
            for (let i = 0; i < 12; i++) {
              const a = norm(natalHousesForPlanets[i].longitude);
              const b = norm(natalHousesForPlanets[(i + 1) % 12].longitude);
              const inside = a <= b ? (lon >= a && lon < b) : (lon >= a || lon < b);
              if (inside) { np.house = i + 1; break; }
            }
          }
        }
        return np;
      });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAhead = 60;

    // User's timezone — lunations are attributed to the same local date the
    // Planner shows (falls back to UTC when no preference is stored).
    const [progress] = await base44.asServiceRole.entities.UserProgress.filter({ user_id: userId });
    const userTz = progress?.timezone || 'UTC';
    const lunationByDate = new Map(
      getLunationsBetween(today.getTime() - 86400000, today.getTime() + (daysAhead + 2) * 86400000, userTz)
        .map(l => [l.dateKey, l])
    );

    const events = [];

    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const jd = dateToJD(d);

      // Moon phases — ONE event per exact new/full moon, on the same local
      // date the Planner shows, at the exact moment, with sign info.
      const lunation = lunationByDate.get(dateStr);
      if (lunation) {
        const moonSign = lunation.sign;
        const themes = SIGN_THEMES[moonSign] || 'this area of life';
        // Find natal house the lunation falls in
        const natalHouses = raw.houses || [];
        let lunationHouse = null;
        const norm = v => ((v % 360) + 360) % 360;
        const checkLon = norm(lunation.lunationLon);
        for (let h = 0; h < natalHouses.length; h++) {
          const a = norm(natalHouses[h].longitude);
          const b = norm(natalHouses[(h + 1) % natalHouses.length].longitude);
          const inside = a <= b ? (checkLon >= a && checkLon < b) : (checkLon >= a || checkLon < b);
          if (inside) { lunationHouse = natalHouses[h].number; break; }
        }
        const glyph = lunation.type === 'new' ? '🌑' : '🌕';
        const houseStr = lunationHouse ? ` · ${ordinal(lunationHouse)} House` : '';
        const action = lunation.type === 'new' ? 'Set intentions, plant seeds, and initiate new cycles.' : 'Celebrate culminations, release what is complete, and illuminate what is ripe.';
        events.push({
          dateStr,
          exactMs: lunation.utMs,
          allDay: false,
          summary: `${glyph} ${lunation.phaseName} in ${moonSign}${houseStr}`,
          description: `${lunation.phaseName} in ${moonSign}${lunationHouse ? ` (your ${ordinal(lunationHouse)} house)` : ''}\n\nActivating themes of ${themes}. ${action}\n\nAdded by Astrosetta`,
        });
      }

      // Natal transits — with glyphs, signs, houses, interpretations
      if (natalPlanets.length) {
        const seen = new Set();
        for (const tPlanetName of ALL_TRANSIT_PLANETS) {
          const transitLon = planetLongitude(tPlanetName, jd);
          const transitSign = longitudeToSign(transitLon);
          const orbLimit = FAST_PLANETS.includes(tPlanetName) ? FAST_ORB : TRANSIT_ORB;
          for (const nPlanet of natalPlanets) {
            const result = checkNatalAspects(transitLon, nPlanet.longitude, orbLimit);
            if (result) {
              const key = `${tPlanetName}_${result.aspect}_${nPlanet.name}`;
              if (seen.has(key)) continue;
              seen.add(key);

              const estHour = estimateTransitHour(result.orb, tPlanetName);
              const aspectLabel = ASPECT_LABELS[result.aspect] || result.aspect;
              const tG = PLANET_GLYPHS[tPlanetName] || '';
              const nG = PLANET_GLYPHS[nPlanet.name] || '';
              const sym = ASPECT_EMOJIS[result.aspect] || result.aspect;
              const houseStr = nPlanet.house ? ` · ${ordinal(nPlanet.house)} House` : '';
              const signStr = nPlanet.sign ? ` of ${nPlanet.sign}` : '';
              const applying = isApplying(transitLon, nPlanet.longitude, result.aspect, jd, tPlanetName);
              const dirStr = applying ? '▲ Applying (building)' : '▽ Separating (fading)';
              const interpretation = getTransitInterpretation(result.aspect, nPlanet.name);

              events.push({
                dateStr,
                dtLocal: new Date(formatDateTime(dateStr, estHour)),
                allDay: false,
                summary: `${tG}${tPlanetName} in ${transitSign} ${sym} natal ${nG}${nPlanet.name}${houseStr}`,
                description: `Transit: ${tPlanetName} (in ${transitSign}) ${aspectLabel} your natal ${nPlanet.name}${nPlanet.house ? ` in the ${ordinal(nPlanet.house)} house` : ''}${nPlanet.sign ? ` of ${nPlanet.sign}` : ''}.\nOrb: ~${result.orb.toFixed(1)}° · ${dirStr}\n\n${interpretation}\n\nAdded by Astrosetta`,
              });
            }
          }
        }
      }

      // Retrograde stations — with sign and glyph
      for (const planet of STATION_PLANETS) {
        const station = detectRetrograde(planet, d);
        if (station) {
          const isRx = station === 'retrograde_start';
          const lon = planetLongitude(planet, jd);
          const sign = longitudeToSign(lon);
          const g = PLANET_GLYPHS[planet] || '';
          const meaning = isRx
            ? `${planet} turns retrograde in ${sign}. A period of review, revisiting, and reconsidering matters ruled by ${planet} begins. Reflect before pushing forward.`
            : `${planet} stations direct in ${sign}. The review period ends — forward momentum returns to matters ruled by ${planet}. Integrate lessons learned and move ahead.`;
          events.push({
            dateStr,
            dtLocal: new Date(dateStr + 'T12:00:00'),
            allDay: false,
            summary: `${g}${planet} ${isRx ? 'Retrograde begins' : 'Direct resumes'} in ${sign}`,
            description: `${meaning}\n\nAdded by Astrosetta`,
          });
        }
      }

      // Mundane (sky) transits — transit-to-transit aspects
      const mundaneSeen = new Set();
      for (let mi = 0; mi < ALL_TRANSIT_PLANETS.length; mi++) {
        for (let mj = mi + 1; mj < ALL_TRANSIT_PLANETS.length; mj++) {
          const p1Name = ALL_TRANSIT_PLANETS[mi];
          const p2Name = ALL_TRANSIT_PLANETS[mj];
          if (FAST_PLANETS.includes(p1Name) && FAST_PLANETS.includes(p2Name)) continue;
          const lon1 = planetLongitude(p1Name, jd);
          const lon2 = planetLongitude(p2Name, jd);
          const mResult = checkNatalAspects(lon1, lon2, MUNDANE_ORB);
          if (mResult) {
            const mKey = `${p1Name}_${mResult.aspect}_${p2Name}`;
            if (mundaneSeen.has(mKey)) continue;
            mundaneSeen.add(mKey);
            const sign1 = longitudeToSign(lon1);
            const sign2 = longitudeToSign(lon2);
            const aspectLabel = ASPECT_LABELS[mResult.aspect] || mResult.aspect;
            const g1 = PLANET_GLYPHS[p1Name] || '';
            const g2 = PLANET_GLYPHS[p2Name] || '';
            const sym = ASPECT_EMOJIS[mResult.aspect] || mResult.aspect;
            events.push({
              dateStr,
              dtLocal: new Date(dateStr + 'T12:00:00'),
              allDay: false,
              summary: `🌌 ${g1}${p1Name} in ${sign1} ${sym} ${g2}${p2Name} in ${sign2}`,
              description: `Sky event: ${p1Name} in ${sign1} ${aspectLabel} ${p2Name} in ${sign2} — a collective aspect affecting everyone.\nOrb: ~${mResult.orb.toFixed(1)}°\n\nAdded by Astrosetta`,
            });
          }
        }
      }
    }

    // Planner journal entries
    const journals = await base44.asServiceRole.entities.PlannerJournalEntry.filter({ user_id: userId });
    for (const entry of journals) {
      if (!entry.date_key || !entry.notes) continue;
      const entryDate = new Date(entry.date_key + 'T00:00:00');
      if (entryDate < today || entryDate > new Date(today.getTime() + daysAhead * 86400000)) continue;
      events.push({
        dateStr: entry.date_key,
        dtLocal: new Date(entry.date_key + 'T09:00:00'),
        allDay: false,
        summary: '✦ Planner Journal',
        description: entry.notes + '\n\nAdded by Astrosetta',
      });
    }

    // Calendar synthesis events (pre-generated by weekly automation)
    const syntheses = await base44.asServiceRole.entities.CalendarSynthesis.filter({ user_id: userId });
    for (const synth of syntheses) {
      if (!synth.date_start || !synth.summary) continue;
      const synthStart = new Date(synth.date_start + 'T00:00:00');
      const synthEnd = synth.date_end ? new Date(synth.date_end + 'T00:00:00') : synthStart;
      if (synthEnd < today || synthStart > new Date(today.getTime() + daysAhead * 86400000)) continue;
      events.push({
        dateStr: synth.date_start,
        dtLocal: new Date(synth.date_start + 'T09:00:00'),
        allDay: true,
        summary: synth.summary,
        description: (synth.description || '') + '\n\nAdded by Astrosetta',
      });
    }

    const ics = buildICS(events, req);
    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});
