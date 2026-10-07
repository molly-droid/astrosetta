/**
 * sendChartRecapEmail — Detailed onboarding email recapping the user's full natal chart.
 *
 * Replaces the old brief welcome email. Sent only to users who opted into email
 * during onboarding (daily_email_opt_in !== false). Layers an LLM-woven narrative
 * interpretation over a structured placement reference built directly from Chart.raw_data.
 *
 * Triggered from onboarding completion (Onboarding.jsx) via base44.functions.invoke,
 * which carries the user token — so auth.me() resolves to the just-onboarded user.
 * Also accepts { user_id } for admin/testing invocations without a user session.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { insertGlyphs } from '../../shared/emailGlyphs.ts';
import { TONE_DIRECTIVE } from '../../shared/toneDirective.ts';
import { ordinal } from '../../shared/emailUtils.ts';

// ── Glyphs (text-variation selector forces text rendering, prevents emoji) ─────
const PLANET_GLYPHS = {
  Sun: '☉\uFE0E', Moon: '☽\uFE0E', Mercury: '☿\uFE0E', Venus: '♀\uFE0E', Mars: '♂\uFE0E',
  Jupiter: '♃\uFE0E', Saturn: '♄\uFE0E', Uranus: '♅\uFE0E', Neptune: '♆\uFE0E', Pluto: '♇\uFE0E',
  Chiron: '⚷\uFE0E', 'North Node': '☊\uFE0E', 'South Node': '☋\uFE0E',
  'Part of Fortune': '⊕\uFE0E', Ascendant: 'AC', Midheaven: 'MC',
};
const SIGN_GLYPHS = {
  Aries: '♈\uFE0E', Taurus: '♉\uFE0E', Gemini: '♊\uFE0E', Cancer: '♋\uFE0E', Leo: '♌\uFE0E',
  Virgo: '♍\uFE0E', Libra: '♎\uFE0E', Scorpio: '♏\uFE0E', Sagittarius: '♐\uFE0E',
  Capricorn: '♑\uFE0E', Aquarius: '♒\uFE0E', Pisces: '♓\uFE0E',
};
const ASPECT_GLYPHS = {
  conjunction: '☌\uFE0E', opposition: '☍\uFE0E', trine: '△\uFE0E',
  square: '□\uFE0E', sextile: '⚹\uFE0E',
};
const CHART_RULERS = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun',
  Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Pluto', Sagittarius: 'Jupiter',
  Capricorn: 'Saturn', Aquarius: 'Uranus', Pisces: 'Neptune',
};
const CORE_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Part of Fortune'];
const HOUSE_THEMES = [
  '', 'self, appearance, and first impressions',
  'money, values, and material security',
  'communication, learning, and immediate environment',
  'home, family, and emotional foundations',
  'creativity, romance, and self-expression',
  'health, daily routines, and service',
  'partnerships, marriage, and significant others',
  'shared resources, intimacy, and transformation',
  'philosophy, higher learning, travel, and beliefs',
  'career, public standing, and legacy',
  'friendships, groups, and hopes for the future',
  'solitude, spirituality, and hidden matters',
];
const ELEMENT_COLORS = { Fire: '#fb923c', Earth: '#86efac', Air: '#93c5fd', Water: '#67e8f9' };
const MODALITY_COLORS = { Cardinal: '#D4AF85', Fixed: '#B8A5C8', Mutable: '#9DB4C8' };

function signOf(planets, name) {
  return planets.find(p => p.name === name);
}

// ── Build the structured reference from Chart.raw_data ─────────────────────────
function buildStructuredReference(raw, chart) {
  const planets = raw.planets || [];
  const houses = raw.houses || [];
  const aspects = raw.aspects || [];
  const angles = raw.angles || {};
  const nodes = raw.nodes || {};

  // Unknown birth time — rising/houses cannot be determined; report none.
  const unknownTime = !!raw.unknown_time;
  const ascSign = unknownTime ? '' : (chart.ascendant_sign || angles.ascendant?.sign || raw.ascendant_sign || '');
  const sun = signOf(planets, 'Sun');
  const moon = signOf(planets, 'Moon');

  // Chart ruler — the planet ruling the Ascendant sign
  let chartRuler = null;
  const rulerName = unknownTime ? null : CHART_RULERS[ascSign];
  if (rulerName) {
    const ruler = signOf(planets, rulerName);
    if (ruler) {
      chartRuler = {
        name: rulerName,
        sign: ruler.sign,
        house: ruler.house,
        retrograde: !!ruler.retrograde,
      };
    } else {
      chartRuler = { name: rulerName, sign: '', house: null, retrograde: false };
    }
  }

  // Planets list — ordered, with sign + house + retrograde
  const planetRows = PLANET_ORDER.map(name => {
    const p = signOf(planets, name);
    if (!p) return null;
    return {
      name,
      glyph: PLANET_GLYPHS[name] || '',
      sign: p.sign,
      signGlyph: SIGN_GLYPHS[p.sign] || '',
      house: unknownTime ? null : p.house,
      retrograde: !!p.retrograde,
      degree: p.degree,
    };
  }).filter(Boolean);

  // Houses — 12 with cusp sign (none when birth time is unknown)
  const houseRows = unknownTime ? [] : houses.map(h => ({
    number: h.number,
    sign: h.sign,
    signGlyph: SIGN_GLYPHS[h.sign] || '',
    theme: HOUSE_THEMES[h.number] || '',
  }));

  // Major aspects — filter to the five Ptolemaic aspects, sort by orb, take strongest 12
  const MAJOR = ['conjunction', 'opposition', 'trine', 'square', 'sextile'];
  const aspectRows = aspects
    .filter(a => MAJOR.includes(a.aspect))
    .map(a => ({
      planet1: a.planet1,
      planet2: a.planet2,
      aspect: a.aspect,
      glyph: ASPECT_GLYPHS[a.aspect] || '',
      orb: typeof a.orb === 'number' ? a.orb : null,
      strength: a.strength || '',
    }))
    .sort((a, b) => {
      const order = { exact: 0, strong: 1, moderate: 2, wide: 3 };
      const sa = order[a.strength] ?? 4;
      const sb = order[b.strength] ?? 4;
      if (sa !== sb) return sa - sb;
      if (a.orb != null && b.orb != null) return a.orb - b.orb;
      return 0;
    })
    .slice(0, 12);

  // Element & modality balance — computed from the 10 core planets
  const core = planets.filter(p => CORE_PLANETS.includes(p.name));
  const elementCounts = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCounts = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const p of core) {
    if (p.element && elementCounts[p.element] != null) elementCounts[p.element]++;
    if (p.modality && modalityCounts[p.modality] != null) modalityCounts[p.modality]++;
  }
  const coreTotal = core.length || 1;
  const elements = Object.entries(elementCounts).map(([k, v]) => ({
    name: k, count: v, pct: Math.round((v / coreTotal) * 100), color: ELEMENT_COLORS[k],
  }));
  const modalities = Object.entries(modalityCounts).map(([k, v]) => ({
    name: k, count: v, pct: Math.round((v / coreTotal) * 100), color: MODALITY_COLORS[k],
  }));

  // Nodes
  const northNode = nodes.north_node || null;
  const southNode = nodes.south_node || null;

  return {
    unknownTime, ascSign, sun, moon, chartRuler,
    planetRows, houseRows, aspectRows, elements, modalities,
    northNode, southNode,
    angles: unknownTime
      ? { asc: '', mc: '' }
      : { asc: angles.ascendant?.sign || '', mc: angles.midheaven?.sign || '' },
  };
}

// ── Generate the narrative interpretation via LLM ──────────────────────────────
async function buildNarrative(base44, user, chart, ref) {
  const sun = chart.sun_sign || ref.sun?.sign || '';
  const moon = chart.moon_sign || ref.moon?.sign || '';
  const asc = ref.ascSign || '';

  // Compact data dump for the LLM — every placement it's allowed to reference
  const planetLines = ref.planetRows.map(p =>
    `${p.name} in ${p.sign}${p.house ? ` (${ordinal(p.house)} house)` : ''}${p.retrograde ? ' retrograde' : ''}`
  ).join(', ');
  const aspectLines = ref.aspectRows.slice(0, 8).map(a =>
    `${a.planet1} ${a.aspect} ${a.planet2} (orb ${a.orb != null ? a.orb.toFixed(1) + '°' : 'n/a'})`
  ).join(', ');
  const elementLine = ref.elements.map(e => `${e.name} ${e.count}`).join(', ');
  const modalityLine = ref.modalities.map(m => `${m.name} ${m.count}`).join(', ');
  const rulerLine = ref.chartRuler
    ? `Chart ruler: ${ref.chartRuler.name}${ref.chartRuler.sign ? ` in ${ref.chartRuler.sign}` : ''}${ref.chartRuler.house ? ` (${ordinal(ref.chartRuler.house)} house)` : ''}${ref.chartRuler.retrograde ? ' retrograde' : ''}`
    : 'Chart ruler: unknown';
  const nodeLine = ref.northNode
    ? `North Node in ${ref.northNode.sign}${!ref.unknownTime && ref.northNode.house ? ` (${ordinal(ref.northNode.house)} house)` : ''}, South Node in ${ref.southNode?.sign || ''}`
    : '';

  const prompt = `You are a warm, insightful astrologer writing a welcoming onboarding email for ${user.full_name || 'a new student of astrology'} who just had their natal chart cast. This email recaps their full chart.

${TONE_DIRECTIVE}

THEIR CHART (authoritative — use ONLY these placements, do NOT invent any not listed):
- Sun: ${sun}
- Moon: ${moon}
${ref.unknownTime ? '- Ascendant (Rising): unknown — their birth time was not provided, so houses, rising, and angles CANNOT be determined. NEVER mention houses, house numbers, rising, the Ascendant, Midheaven, IC, or Descendant anywhere in your output.' : `- Ascendant (Rising): ${asc}`}
- ${rulerLine}
- Planets: ${planetLines}
- Key aspects: ${aspectLines}
- Element balance: ${elementLine}
- Modality balance: ${modalityLine}
- ${nodeLine}

Write ONLY these fields. Use full English words for every planet, sign, and aspect (no Unicode glyph symbols — the email inserts glyphs automatically). Do NOT mention any placement, aspect, or position not listed above.

${ref.unknownTime ? `- greeting: one warm sentence welcoming them to their chart, naming their Sun and Moon signs.
- big_three: 2-3 sentences on what their Sun and Moon together suggest — the blend of core identity and emotional nature. Invitational, not diagnostic. Do NOT mention rising or houses.
- chart_ruler: 1-2 sentences noting their birth time was not provided, so the rising sign and chart ruler cannot be cast yet — invite them to add their birth time in the app to unlock them.` : `- greeting: one warm sentence welcoming them to their chart, naming the Sun/Moon/Rising combination.
- big_three: 2-3 sentences on what their Sun, Moon, and Rising together suggest — the blend of core identity, emotional nature, and how they meet the world. Invitational, not diagnostic.
- chart_ruler: 1-2 sentences on their chart ruler (name it) and what its placement may mean for their overall life direction.`}
- balance: 1 sentence on their element/modality balance and the temperament it may invite.
- opportunities: 2-3 sentences naming their most supportive natal aspects (trines, sextiles, flowing conjunctions from the list above) — what comes naturally and where they have innate ease. Name the two planets and the aspect.
- challenges: 2-3 sentences naming their most demanding natal aspects (squares, oppositions from the list above) — the growth edges, recurring tensions, and what they are learning to integrate. Name the two planets and the aspect.
- transits_to_watch: 2-3 sentences on which transits to watch for given THIS chart specifically. Reference outer-planet transits to their Sun${ref.unknownTime ? ' or Moon' : ', Moon, or Ascendant'}; a Saturn or Jupiter return if age-relevant; and eclipse activations of their key placements. Name the natal placement that will be lit up. Be specific to their chart, not generic.
- closing: one warm sentence inviting them to explore their chart in the app and start today's quiz.

Return JSON with: greeting, big_three, chart_ruler, balance, opportunities, challenges, transits_to_watch, closing.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        greeting: { type: 'string' },
        big_three: { type: 'string' },
        chart_ruler: { type: 'string' },
        balance: { type: 'string' },
        opportunities: { type: 'string' },
        challenges: { type: 'string' },
        transits_to_watch: { type: 'string' },
        closing: { type: 'string' },
      },
      required: ['greeting', 'big_three', 'chart_ruler', 'balance', 'opportunities', 'challenges', 'transits_to_watch', 'closing'],
    },
  });

  return {
    greeting: result.greeting || '',
    big_three: result.big_three || '',
    chart_ruler: result.chart_ruler || '',
    balance: result.balance || '',
    opportunities: result.opportunities || '',
    challenges: result.challenges || '',
    transits_to_watch: result.transits_to_watch || '',
    closing: result.closing || '',
  };
}

// ── HTML renderer ──────────────────────────────────────────────────────────────
function renderRecapHtml({ user, chart, ref, narrative, appUrl }) {
  const BG = '#FDFBF7', CARD = '#F5F1E8', GOLD = '#A07C3F', GOLD2 = '#B08D4A', TEXT = '#2C3E50', MUTED = '#8B7355', BLUE = '#4E6E8E';
  const home = appUrl ? `${appUrl}/home` : '#';
  const chartLink = appUrl ? `${appUrl}/chart` : '#';
  const quiz = appUrl ? `${appUrl}/home?tab=learn` : '#';
  const planner = appUrl ? `${appUrl}/planner` : '#';

  const highlight = (txt) => insertGlyphs(txt, GOLD2);

  const bigThreePill = (label, sign) => `
    <td style="padding:6px 8px;background:${CARD};border:1px solid ${GOLD}33;border-radius:10px;text-align:center;width:33%;">
      <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${GOLD};margin-bottom:4px;">${label}</div>
      <div style="font-family:Georgia,serif;font-size:22px;color:${GOLD2};margin-bottom:2px;">${SIGN_GLYPHS[sign] || ''}</div>
      <div style="font-family:Georgia,serif;font-size:14px;color:${TEXT};">${sign}</div>
    </td>`;

  const para = (txt) => `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.65;color:${TEXT};margin:0 0 14px;">${highlight(txt)}</p>`;

  // House-by-house breakdown — combines the old separate Planets list and
  // Twelve Houses grid into a single reference: each house shows its ruling
  // sign, its theme, and any natal planets that fall within it.
  const houseBreakdownHtml = ref.houseRows.map(h => {
    const planetsInHouse = ref.planetRows.filter(p => p.house === h.number);
    const planetsHtml = planetsInHouse.length
      ? planetsInHouse.map(p => `
        <span style="display:inline-block;margin:3px 4px 0 0;padding:4px 10px;background:#EAE4D8;border:1px solid ${GOLD}22;border-radius:999px;font-family:Georgia,serif;font-size:12px;color:${TEXT};white-space:nowrap;">
          <span style="color:${GOLD2};font-size:14px;margin-right:4px;">${p.glyph}</span>${p.name} <span style="color:${MUTED};">in</span> <span style="color:${GOLD2};">${p.signGlyph} ${p.sign}</span>${p.retrograde ? ` <span style="color:#A85D75;font-size:11px;">℞</span>` : ''}
        </span>`).join('')
      : `<span style="font-family:Georgia,serif;font-size:11px;color:${MUTED};font-style:italic;">No natal planets in this house</span>`;
    return `
    <tr><td style="padding:9px 12px;background:${CARD};border:1px solid ${GOLD}11;border-radius:8px;">
      <div style="font-family:Georgia,serif;font-size:12px;color:${GOLD};margin-bottom:2px;"><strong>${ordinal(h.number)} house</strong> <span style="color:${MUTED};">·</span> <span style="color:${TEXT};">${h.signGlyph} ${h.sign}</span></div>
      <div style="font-family:Georgia,serif;font-size:10px;color:${MUTED};line-height:1.4;margin-bottom:7px;">${h.theme}</div>
      <div>${planetsHtml}</div>
    </td></tr>
    <tr><td style="height:6px;line-height:6px;">&nbsp;</td></tr>`;
  }).join('');

  // Balance bars
  const balanceBar = (items) => items.map(b => `
    <tr>
      <td style="font-family:Georgia,serif;font-size:12px;color:${TEXT};width:70px;vertical-align:middle;">${b.name}</td>
      <td style="vertical-align:middle;">
        <div style="background:#E5DECF;border-radius:999px;height:10px;overflow:hidden;">
          <div style="background:${b.color};height:10px;width:${b.pct}%;border-radius:999px;"></div>
        </div>
      </td>
      <td style="font-family:Georgia,serif;font-size:11px;color:${MUTED};width:36px;text-align:right;vertical-align:middle;">${b.count}</td>
    </tr><tr><td style="height:5px;line-height:5px;" colspan="3">&nbsp;</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><style>:root{color-scheme:light;supported-color-schemes:light}</style></head>
<body bgcolor="#FDFBF7" style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="text-align:center;padding:12px 24px 22px;">
    <div style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;">✦ Astrosetta ✦</div>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:0 28px 18px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:26px;color:${TEXT};margin:0 0 10px;line-height:1.3;">Your Birth Chart, In Detail</h1>
    <p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0;">Welcome, ${user.full_name || 'friend'} — your natal chart has been cast.</p>
  </td></tr>

  <!-- Big Three -->
  <tr><td style="padding:0 28px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        ${bigThreePill('Sun', chart.sun_sign || '')}
        <td style="width:8px;">&nbsp;</td>
        ${bigThreePill('Moon', chart.moon_sign || '')}
        ${ref.unknownTime ? '' : `<td style="width:8px;">&nbsp;</td>
        ${bigThreePill('Rising', ref.ascSign || '')}`}
      </tr>
    </table>
  </td></tr>

  <!-- Narrative section -->
  <tr><td style="padding:6px 28px 4px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✦ Reading Your Chart</div>
  </td></tr>
  <tr><td style="padding:0 28px 14px;">
    ${narrative.greeting ? `<p style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0 0 14px;border-left:2px solid ${GOLD}55;padding-left:14px;">${highlight(narrative.greeting)}</p>` : ''}
    ${narrative.big_three ? para(narrative.big_three) : ''}
    ${narrative.chart_ruler ? para(narrative.chart_ruler) : ''}
    ${narrative.balance ? para(narrative.balance) : ''}
  </td></tr>

  <tr><td style="padding:6px 28px 16px;">
    <div style="height:1px;background:${GOLD}22;margin-bottom:16px;"></div>
  </td></tr>

  <!-- Chart ruler callout -->
  ${ref.chartRuler ? `
  <tr><td style="padding:6px 28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}44;border-radius:12px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${GOLD};margin-bottom:4px;">✦ Chart Ruler</div>
        <p style="font-family:Georgia,serif;font-size:14px;color:${TEXT};margin:0;">${highlight(`${ref.chartRuler.name}${ref.chartRuler.sign ? ` in ${ref.chartRuler.sign}` : ''}${ref.chartRuler.house ? ` (${ordinal(ref.chartRuler.house)} house)` : ''}${ref.chartRuler.retrograde ? ' retrograde' : ''}`)}</p>
        <p style="font-family:Georgia,serif;font-size:11px;color:${MUTED};margin:4px 0 0;">Because your rising sign is ${ref.ascSign}, ${ref.chartRuler.name} steers your chart.</p>
      </td></tr>
    </table>
  </td></tr>` : ''}

  ${ref.unknownTime ? `
  <!-- Unknown birth time notice -->
  <tr><td style="padding:0 28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;">
      <tr><td style="padding:14px 18px;text-align:center;">
        <p style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;margin:0;">Your birth time wasn't provided, so your rising sign and houses can't be determined yet. Add your birth time in the app to unlock them — your planets, signs, and aspects are all fully valid.</p>
      </td></tr>
    </table>
  </td></tr>` : `
  <!-- House-by-house breakdown -->
  <tr><td style="padding:0 28px 8px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:6px;">✦ Your Houses, House by House</div>
    <p style="font-family:Georgia,serif;font-size:13px;color:${MUTED};line-height:1.5;margin:0 0 14px;">Each house, the sign that rules it, and the planets that live there.</p>
  </td></tr>
  <tr><td style="padding:0 28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${houseBreakdownHtml}</table>
  </td></tr>`}

  <!-- Key Opportunities & Challenges -->
  <tr><td style="padding:6px 28px 8px;">
    <div style="font-family:Georgia,serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};margin-bottom:10px;">✦ Key Opportunities &amp; Challenges</div>
  </td></tr>
  <tr><td style="padding:0 28px 14px;">
    ${narrative.opportunities ? `<div style="margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5E8A5E;margin-bottom:4px;">✦ Opportunities</div><p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:0;">${highlight(narrative.opportunities)}</p></div>` : ''}
    ${narrative.challenges ? `<div style="margin-bottom:12px;"><div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#A85D75;margin-bottom:4px;">⚠ Challenges</div><p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:0;">${highlight(narrative.challenges)}</p></div>` : ''}
    ${narrative.transits_to_watch ? `<div><div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${BLUE};margin-bottom:4px;">🔭 Transits to Watch</div><p style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:${TEXT};margin:0;">${highlight(narrative.transits_to_watch)}</p></div>` : ''}
  </td></tr>

  <!-- Element & Modality balance -->
  <tr><td style="padding:6px 28px 14px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:10px;">
          <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${GOLD2};margin-bottom:8px;">Elements</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${balanceBar(ref.elements)}</table>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:10px;">
          <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${GOLD2};margin-bottom:8px;">Modalities</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${balanceBar(ref.modalities)}</table>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Closing -->
  <tr><td style="padding:8px 28px 14px;text-align:center;">
    ${narrative.closing ? `<p style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${GOLD2};font-style:italic;margin:0 0 18px;">${highlight(narrative.closing)}</p>` : ''}
  </td></tr>

  <!-- CTAs -->
  <tr><td style="padding:0 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${GOLD}44;border-radius:14px;">
      <tr><td style="padding:22px 24px;text-align:center;">
        <a href="${home}" style="display:inline-block;background:${GOLD2};color:#1a2436;font-family:Georgia,serif;font-size:15px;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:999px;">Enter Astrosetta →</a>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
          <td align="center"><a href="${chartLink}" style="font-family:Georgia,serif;font-size:12px;color:${GOLD};text-decoration:underline;">View your chart wheel</a></td>
          <td align="center"><a href="${quiz}" style="font-family:Georgia,serif;font-size:12px;color:${GOLD};text-decoration:underline;">Take today's quiz</a></td>
          <td align="center"><a href="${planner}" style="font-family:Georgia,serif;font-size:12px;color:${GOLD};text-decoration:underline;">Open the Planner</a></td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 28px;text-align:center;">
    <div style="height:1px;background:${GOLD}22;margin-bottom:14px;"></div>
    <p style="font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.6;margin:0;">
      You're receiving this because you opted into email during onboarding.<br>
      <a href="${appUrl ? `${appUrl}/profile` : '#'}" style="color:${GOLD};text-decoration:underline;">Manage email preferences</a>
    </p>
    <p style="font-family:Georgia,serif;font-size:10px;color:${MUTED};margin-top:10px;">Sharp Energetics LLC · <a href="${appUrl ? `${appUrl}/legal` : '#'}" style="color:${GOLD};text-decoration:underline;">Legal</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const appUrl = body.appUrl || 'https://astrosetta.com';

    // Resolve recipient — onboarding invokes with a user token (auth.me resolves);
    // admin/test invocations pass user_id directly.
    let recipient = await base44.auth.me();
    if (!recipient && body.user_id) {
      try {
        recipient = await base44.asServiceRole.entities.User.get(body.user_id);
      } catch {
        const users = await base44.asServiceRole.entities.User.filter({ id: body.user_id }).catch(() => []);
        recipient = users?.[0];
      }
    }
    if (!recipient?.email) return Response.json({ error: 'No user found' }, { status: 400 });

    // Gate on opt-in — onboarding defaults true; only skip explicit opt-out
    if (recipient.daily_email_opt_in === false) {
      return Response.json({ skipped: 'opted_out' });
    }

    // Load most recent chart
    const charts = await base44.asServiceRole.entities.Chart.filter({ user_id: recipient.id }, '-created_date', 5);
    const chart = charts[0];
    if (!chart?.raw_data) return Response.json({ error: 'No natal chart found for this account' }, { status: 400 });
    const raw = chart.raw_data;

    const ref = buildStructuredReference(raw, chart);
    const narrative = await buildNarrative(base44, recipient, chart, ref);
    const html = renderRecapHtml({ user: recipient, chart, ref, narrative, appUrl });
    const subject = ref.unknownTime
      ? `✦ Your Birth Chart, In Detail — ${chart.sun_sign || ''} Sun, ${chart.moon_sign || ''} Moon`
      : `✦ Your Birth Chart, In Detail — ${chart.sun_sign || ''} Sun, ${chart.moon_sign || ''} Moon, ${ref.ascSign || ''} Rising`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient.email,
      from_name: 'Astrosetta',
      subject,
      body: html,
    });

    return Response.json({ success: true, sent_to: recipient.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}