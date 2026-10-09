import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Sparkles, Loader2, Copy, Mail, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { invokeLLMTask } from '@/api/llmTasks';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { track, EVENTS } from '@/lib/analytics';
import ContextualSuggestions from './ContextualSuggestions';
import { buildCompositeRaw } from '@/lib/compositeChart';
import { fetchNatalCrossAspects } from '@/lib/relationshipSynthesis';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/permissions';
import PaywallModal from '@/components/paywall/PaywallModal';

async function loadChartContext() {
  try {
    // Match MyChart's exact query so the chat always uses the same chart
    const user = await base44.auth.me();
    const charts = await base44.entities.Chart.filter({ user_id: user.id });
    const chart = charts?.[0];
    if (!chart?.raw_data) return null;
    const r = chart.raw_data;
    // Sun/Moon/Ascendant: prefer entity-level fields, fall back to raw_data
    const sunSign = chart.sun_sign || r.planets?.find(p => p.name === 'Sun')?.sign || 'unknown';
    const moonSign = chart.moon_sign || r.planets?.find(p => p.name === 'Moon')?.sign || 'unknown';
    const ascSign = chart.ascendant_sign || r.angles?.ascendant?.sign || 'unknown';
    const planets = (r.planets || []).map(p => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°) H${p.house}${p.retrograde ? ' ℞' : ''}`).join(', ');
    const angles = r.angles ? `ASC ${r.angles.ascendant?.sign} (${r.angles.ascendant?.degree?.toFixed(1)}°), MC ${r.angles.midheaven?.sign} (${r.angles.midheaven?.degree?.toFixed(1)}°)` : '';
    const aspects = (r.aspects || []).filter(a => ['conjunction','opposition','square','trine'].includes(a.aspect)).map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb?.toFixed(1)}°)`).join(', ');
    // birth_location is an object — format it readably
    const loc = r.birth_location;
    const locStr = typeof loc === 'string'
      ? loc
      : [loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ') || `${loc?.latitude?.toFixed(2)}, ${loc?.longitude?.toFixed(2)}`;
    // Fetch today's transits so the agent can answer "what's happening today" questions
    let transitBlock = '';
    try {
      const now = new Date();
      const dateKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toLocaleDateString('en-CA');
      const utcOffset = -now.getTimezoneOffset() / 60;
      const res = await base44.functions.invoke('chartCalculator', {
        chart_type: 'transit',
        birth_date: r.birth_date,
        birth_time: r.birth_time,
        birth_location: r.birth_location,
        transit_date: dateKey,
        transit_time: '12:00:00',
        utc_offset: utcOffset,
        natal_planets_override: r.planets || [],
      });
      const td = res?.data;
      if (td?.transit_planets) {
        const tp = td.transit_planets.map(p => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°)${p.retrograde ? ' ℞' : ''}`).join(', ');
        const ta = (td.transit_aspects || []).map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`).join(', ');
        transitBlock = `\n\nTODAY'S TRANSITS (${dateKey}):\nSky positions: ${tp}\nActive transits to natal chart: ${ta || 'none exact today'}`;
      }
    } catch { /* transits are a bonus — natal context is the priority */ }

    return `USER'S NATAL CHART DATA (already loaded — do not ask for this):
Sun: ${sunSign}, Moon: ${moonSign}, Ascendant: ${ascSign}
Planets: ${planets}
Angles: ${angles}
Key Aspects: ${aspects}
Birth: ${r.birth_date} ${r.birth_time || ''} in ${locStr}${transitBlock}`;
  } catch {
    return null;
  }
}

// Fetch the user's saved charts (partner, friend, event, etc.) so the navigator
// can answer questions about other people the user has added.
async function loadSavedChartsList() {
  try {
    return await base44.entities.SavedChart.list('-created_date', 50);
  } catch {
    return [];
  }
}

// Format the full saved-charts roster as context (used for general questions
// that aren't tied to one specific person, or for synastry/comparison).
function buildSavedChartsContext(saved) {
  if (!saved?.length) return '';
  const blocks = saved.map((s) => {
    const r = s.raw_data || {};
    const sun = s.sun_sign || r.planets?.find(p => p.name === 'Sun')?.sign || 'unknown';
    const moon = s.moon_sign || r.planets?.find(p => p.name === 'Moon')?.sign || 'unknown';
    const asc = s.ascendant_sign || r.angles?.ascendant?.sign || 'unknown';
    const planets = (r.planets || []).map(p => `${p.name} in ${p.sign}${p.house ? ` H${p.house}` : ''}${p.retrograde ? ' ℞' : ''}`).join(', ');
    const aspects = (r.aspects || []).filter(a => ['conjunction','opposition','square','trine'].includes(a.aspect)).map(a => `${a.planet1} ${a.aspect} ${a.planet2}`).join(', ');
    const relTag = s.relationship ? ` (${s.relationship})` : '';
    const typeTag = s.chart_type === 'event' ? ' [EVENT CHART]' : '';
    return `• ${s.name}${relTag}${typeTag} — Sun ${sun}, Moon ${moon}, Rising ${asc}\n  Planets: ${planets || 'unavailable'}\n  Key Aspects: ${aspects || 'none'}`;
  });
  return `\n\nSAVED CHARTS (other people/events the user has added — you can answer questions about any of them by name):\n${blocks.join('\n')}`;
}

// Build context for a SINGLE saved chart, with an explicit directive to use only
// that person's data. Includes houses so "which house is X in" answers are exact
// and never get mixed up with the user's own chart.
function buildScopedChartContext(chart) {
  const r = chart.raw_data || {};
  const sun = chart.sun_sign || r.planets?.find(p => p.name === 'Sun')?.sign || 'unknown';
  const moon = chart.moon_sign || r.planets?.find(p => p.name === 'Moon')?.sign || 'unknown';
  const asc = chart.ascendant_sign || r.angles?.ascendant?.sign || 'unknown';
  const planets = (r.planets || []).map(p => `${p.name} in ${p.sign} (${p.degree != null ? p.degree.toFixed(1) : '?'}°) H${p.house || '?'}${p.retrograde ? ' ℞' : ''}`).join(', ');
  const angles = r.angles ? `ASC ${r.angles.ascendant?.sign} (${r.angles.ascendant?.degree != null ? r.angles.ascendant.degree.toFixed(1) : '?'}°), MC ${r.angles.midheaven?.sign} (${r.angles.midheaven?.degree != null ? r.angles.midheaven.degree.toFixed(1) : '?'}°)` : '';
  const houses = (r.houses || []).map((h, idx) => `H${idx + 1} ${h.sign || '?'}`).join(', ');
  const aspects = (r.aspects || []).filter(a => ['conjunction','opposition','square','trine','sextile'].includes(a.aspect)).map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb != null ? a.orb.toFixed(1) : '?'}°)`).join(', ');
  const loc = r.birth_location;
  const locStr = typeof loc === 'string' ? loc : [loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ');
  const relTag = chart.relationship ? ` (${chart.relationship})` : '';
  const typeTag = chart.chart_type === 'event' ? ' [EVENT CHART]' : '';
  return `THE USER IS ASKING SPECIFICALLY ABOUT: ${chart.name}${relTag}${typeTag}.
Answer using ONLY this person's chart below. Do NOT reference the user's own natal chart or any other saved chart. If a placement, house, or detail is missing from this chart, say it is unavailable rather than substituting another chart's data.

${chart.name.toUpperCase()}'S CHART:
Sun: ${sun}, Moon: ${moon}, Ascendant: ${asc}
Planets: ${planets || 'unavailable'}
Angles: ${angles || 'unavailable'}
Houses: ${houses || 'unavailable'}
Key Aspects: ${aspects || 'none'}
Birth: ${r.birth_date || 'unknown'} ${r.birth_time || ''}${locStr ? ' in ' + locStr : ''}`;
}

// Detect whether the user's message refers to one specific saved chart (by name
// or relationship keyword). Returns the matched chart, or null for general
// questions — including synastry/comparison requests, which need both charts.
function detectTargetSavedChart(message, savedCharts) {
  if (!savedCharts?.length) return null;
  const msg = (message || '').toLowerCase();
  // Comparison requests need both charts — fall back to the full roster.
  if (/\b(compare|comparison|compatib|synastry|versus)\b/.test(msg) || /\band (me|my chart|mine)\b/.test(msg) || /\bvs\.?\b/.test(msg)) {
    return null;
  }
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasWord = (kw) => kw && new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`, 'i').test(msg);
  const REL_KEYWORDS = {
    father: ['dad', 'father', 'pa', 'papa', 'pop', 'pops', 'stepdad', 'stepfather'],
    mother: ['mom', 'mother', 'ma', 'mama', 'mum', 'stepmom', 'stepmother'],
    parent: ['parent', 'parents'],
    partner: ['partner', 'boyfriend', 'girlfriend', 'spouse', 'wife', 'husband', 'hubby', 'fiance', 'fiancé', 'fiancee'],
    child: ['child', 'son', 'daughter', 'kid'],
    sibling: ['sister', 'brother', 'sib'],
    friend: ['friend', 'bestie', 'buddy'],
    grandparent: ['grandfather', 'grandmother', 'grandpa', 'grandma', 'grandad', 'granny'],
  };
  // First pass: a specific name wins over a generic relationship word.
  for (const chart of savedCharts) {
    const name = (chart.name || '').trim();
    if (name.length > 2 && hasWord(name)) return chart;
  }
  // Second pass: match by the stored relationship value or its keyword family.
  for (const chart of savedCharts) {
    const rel = (chart.relationship || '').toLowerCase();
    if (!rel) continue;
    if (hasWord(rel)) return chart;
    for (const [key, kws] of Object.entries(REL_KEYWORDS)) {
      if (rel.includes(key) || key.includes(rel)) {
        if (kws.some(hasWord)) return chart;
      }
    }
  }
  return null;
}

// Keywords that signal a relationship/composite/synastry question — when these
// appear alongside a named partner, we inject the computed composite chart and
// synastry cross-aspects so the navigator can read the relationship directly.
const RELATIONSHIP_REGEX = /\b(composite|synastry|relationship|our chart|our bond|our dynamic|together|compatib|chemistry|between us|me and |us\b|couple|partnership)\b/i;

// Detect a specific partner chart referenced by name or relationship keyword.
// Unlike detectTargetSavedChart, this does NOT exclude comparison questions —
// we want the partner identity for synastry/composite reads.
function detectPartnerChart(message, savedCharts) {
  if (!savedCharts?.length) return null;
  const msg = (message || '').toLowerCase();
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasWord = (kw) => kw && new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`, 'i').test(msg);
  const REL_KEYWORDS = {
    partner: ['partner', 'boyfriend', 'girlfriend', 'spouse', 'wife', 'husband', 'hubby', 'fiance', 'fiancé', 'fiancee'],
    friend: ['friend', 'bestie', 'buddy'],
    child: ['child', 'son', 'daughter', 'kid'],
    sibling: ['sister', 'brother'],
    parent: ['parent', 'parents'],
    father: ['dad', 'father', 'pa', 'papa'],
    mother: ['mom', 'mother', 'ma', 'mum'],
  };
  // Prefer a specific name match.
  for (const chart of savedCharts) {
    const name = (chart.name || '').trim();
    if (name.length > 2 && hasWord(name)) return chart;
  }
  // Then match by stored relationship or its keyword family.
  for (const chart of savedCharts) {
    const rel = (chart.relationship || '').toLowerCase();
    if (!rel) continue;
    if (hasWord(rel)) return chart;
    for (const [key, kws] of Object.entries(REL_KEYWORDS)) {
      if (rel.includes(key) || key.includes(rel)) {
        if (kws.some(hasWord)) return chart;
      }
    }
  }
  return null;
}

// Format the composite chart (the relationship as one entity) as readable text.
function formatComposite(composite) {
  if (!composite) return 'unavailable';
  const planets = (composite.planets || [])
    .map(p => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°) H${p.house || '?'}`)
    .join(', ');
  const angles = composite.angles || {};
  const asc = angles.ascendant ? `ASC ${angles.ascendant.sign} (${angles.ascendant.degree?.toFixed(1)}°)` : '';
  const mc = angles.midheaven ? `MC ${angles.midheaven.sign} (${angles.midheaven.degree?.toFixed(1)}°)` : '';
  const aspects = (composite.aspects || [])
    .filter(a => ['conjunction', 'opposition', 'square', 'trine'].includes(a.aspect))
    .map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb?.toFixed(1)}°)`)
    .join(', ');
  return `Composite Sun: ${composite.sun_sign || '?'}, Moon: ${composite.moon_sign || '?'}, Ascendant: ${composite.ascendant_sign || '?'}
Composite Planets: ${planets || 'unavailable'}
Composite Angles: ${[asc, mc].filter(Boolean).join(', ') || 'unavailable'}
Composite Key Aspects (the relationship's built-in dynamics): ${aspects || 'none'}`;
}

// Build a full relationship-layer context block: both charts + synastry cross-
// aspects (the chemistry) + the composite chart (the relationship as a whole).
function buildRelationshipContext(userChart, partnerChart, crossAspects, composite) {
  const ur = userChart?.raw_data || {};
  const pr = partnerChart?.raw_data || {};
  const fmtPlanets = (r) => (r.planets || []).map(p => `${p.name} in ${p.sign} H${p.house || '?'}`).join(', ');
  const fmtAspects = (r) => (r.aspects || []).filter(a => ['conjunction','opposition','square','trine'].includes(a.aspect)).map(a => `${a.planet1} ${a.aspect} ${a.planet2}`).join(', ');
  const syn = (crossAspects || []).filter(a => ['conjunction','opposition','square','trine','sextile'].includes(a.aspect)).slice(0, 25)
    .map(a => `Your ${a.person1_planet} ${a.aspect} ${partnerChart.name}'s ${a.person2_planet} (orb ${a.orb != null ? a.orb.toFixed(1) : '?'}°)`)
    .join('\n') || 'none computed';
  const relTag = partnerChart.relationship ? ` (${partnerChart.relationship})` : '';
  return `THE USER IS ASKING ABOUT THEIR RELATIONSHIP WITH: ${partnerChart.name}${relTag}.
Answer through the RELATIONSHIP LENS — the bond between them — not either person alone.

=== USER'S CHART ===
Sun: ${userChart.sun_sign || ur.sun_sign || '?'}, Moon: ${userChart.moon_sign || ur.moon_sign || '?'}, Ascendant: ${userChart.ascendant_sign || ur.ascendant_sign || '?'}
Planets: ${fmtPlanets(ur) || 'unavailable'}
Key Aspects: ${fmtAspects(ur) || 'none'}

=== ${partnerChart.name.toUpperCase()}'S CHART ===
Sun: ${partnerChart.sun_sign || pr.sun_sign || '?'}, Moon: ${partnerChart.moon_sign || pr.moon_sign || '?'}, Ascendant: ${partnerChart.ascendant_sign || pr.ascendant_sign || '?'}
Planets: ${fmtPlanets(pr) || 'unavailable'}
Key Aspects: ${fmtAspects(pr) || 'none'}

=== SYNASTRY — CROSS-CHART ASPECTS (how the two charts interact) ===
${syn}

=== COMPOSITE CHART — THE RELATIONSHIP AS ONE ENTITY ===
${formatComposite(composite)}

Guidance: Synastry cross-aspects show how each person activates the other (the chemistry between you). The composite chart is the relationship itself — a single chart made from the midpoints of both people's placements; its Sun is the relationship's core identity, its Moon is the emotional climate, its Ascendant is how the bond presents to the world, and its internal aspects are the relationship's built-in dynamics. Use whichever lens the question calls for (or both), and always name the specific placements/aspects you are reading.`;
}

// Load the chart object so we can fetch date-specific transits on demand
async function loadChartObject() {
  try {
    const user = await base44.auth.me();
    const charts = await base44.entities.Chart.filter({ user_id: user.id });
    return charts?.[0] || null;
  } catch {
    return null;
  }
}

// Fetch transits for a specific date — used when the user asks about a future/past date
async function fetchTransitsForDate(chart, date) {
  try {
    const r = chart.raw_data;
    if (!r?.birth_date || !r?.birth_location?.latitude) return null;
    const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toLocaleDateString('en-CA');
    const utcOffset = -date.getTimezoneOffset() / 60;
    const res = await base44.functions.invoke('chartCalculator', {
      chart_type: 'transit',
      birth_date: r.birth_date,
      birth_time: r.birth_time,
      birth_location: r.birth_location,
      transit_date: dateKey,
      transit_time: '12:00:00',
      utc_offset: utcOffset,
      natal_planets_override: r.planets || [],
    });
    const td = res?.data;
    if (!td?.transit_planets) return null;
    const tp = td.transit_planets.map(p => `${p.name} in ${p.sign} (${p.degree?.toFixed(1)}°)${p.retrograde ? ' ℞' : ''}`).join(', ');
    const ta = (td.transit_aspects || []).map(a => `${a.transit_planet} ${a.aspect} natal ${a.natal_planet} (${a.orb?.toFixed(1)}°)`).join(', ');
    const stations = (td.stations || []).map(s => `${s.planet} stations ${s.type} in ${s.sign}`).join(', ') || 'none';
    const ingresses = (td.ingresses || []).map(ing => `${ing.planet} enters ${ing.to_sign} (from ${ing.from_sign})`).join(', ') || 'none';
    return `\n\nTRANSITS FOR ${dateKey} (use these instead of today's transits when answering):\nSky positions: ${tp}\nActive transits to natal chart: ${ta || 'none exact'}\nStations: ${stations}\nIngresses: ${ingresses}`;
  } catch {
    return null;
  }
}

// Detect if the user's message references a specific date; if so, parse it into a Date object
async function extractDateFromMessage(message) {
  const planningWords = /\b(tomorrow|yesterday|next|this|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|in \d+ days|upcoming|when should|which day|best day|good day|planning|schedule)\b/i;
  if (!planningWords.test(message)) return null;
  try {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const result = await invokeLLMTask('extract-date', { todayStr, message });
    if (!result.date || result.date === 'NONE') return null;
    const parsed = new Date(result.date + 'T12:00:00');
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Context-aware prompts per route
const PAGE_CONTEXT = {
  '/home': {
    nudge: "Don't forget your daily quiz! ✦ Tap to ask about today's transits.",
    suggestions: [
      "What part of my personality is so unconscious I mistake it for reality?",
      "What placement looks difficult but is my hidden advantage?",
      "What do today's transits mean for me personally?",
      "Which transit should I pay the most attention to today?",
    ],
  },
  '/learn': {
    nudge: "Questions about what you're studying? Ask away.",
    suggestions: [
      "Explain the difference between a square and an opposition.",
      "Why is Saturn considered a malefic?",
      "What does it mean to have a stellium?",
      "What's the most misunderstood placement in astrology?",
    ],
  },
  '/chart': {
    nudge: "Curious about a placement in your chart? Ask me.",
    suggestions: [
      "What part of my personality is so unconscious I mistake it for reality?",
      "What placement looks difficult but is my hidden advantage?",
      "What's the most revealing placement in my chart?",
      "Why do I feel so different from my Sun sign?",
      "What does my Ascendant say about how others see me?",
      "Which placement most affects my relationships?",
    ],
  },
  '/planner': {
    nudge: "Planning ahead? Ask what the stars say for any future date.",
    suggestions: [
      "Is next Friday a good day to start something new?",
      "What are the transits like on July 15th?",
      "Which day next week is best for an important conversation?",
      "What should I watch out for this weekend astrologically?",
    ],
  },
  '/profile': {
    nudge: "Want to understand your chart on a deeper level?",
    suggestions: [
      "Why am I so sensitive to what others say about me?",
      "What placement explains my daddy issues?",
      "Why do I keep attracting unavailable partners?",
      "What's my most challenging placement and how do I work with it?",
    ],
  },
  '/about': {
    nudge: "New here? Ask me how to get the most out of Astrosetta.",
    suggestions: [
      "Where should I start as a beginner?",
      "What's the fastest way to learn my chart?",
      "How do daily transits affect me differently than general horoscopes?",
    ],
  },
};

const DEFAULT_CONTEXT = {
  nudge: "Have a cosmic question? I'm here.",
  suggestions: [
    "What placement is most indicative of my communication style?",
    "Why am I so sensitive to what others say about me?",
    "What does it mean to have planets in the 12th house?",
  ],
};

function isOverlayPopupActive() {
  // FeatureSpotlight renders at z-[10000], FullAppTour at z-[10002]
  return !!document.querySelector('[class*="z-[10010"]') || !!document.querySelector('[class*="z-[10000"]') || !!document.querySelector('[class*="z-[10002"]');
}

// The nudge is an onboarding cue — it should only surface during a user's first
// couple of logins, then never again. Login count is stamped once per browser
// session in AuthContext (astrosetta_login_count).
function isWithinFirstLogins(max = 2) {
  try {
    const count = parseInt(localStorage.getItem('astrosetta_login_count') || '0', 10) || 0;
    return count > 0 && count <= max;
  } catch { return false; }
}

export default function FloatingNavigator() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [emailingIdx, setEmailingIdx] = useState(null);
  const [emailSentIdx, setEmailSentIdx] = useState(null);
  const bottomRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const lastAssistantRef = useRef(null);
  const lastUserCountRef = useRef(0);
  const lastAssistantCountRef = useRef(0);
  const wasOpenRef = useRef(false);
  const pendingOpenScrollRef = useRef(false);
  const awaitingPinRef = useRef(false);
  const unsubRef = useRef(null);
  const nudgeTimerRef = useRef(null);
  const chartContextRef = useRef(null);
  const savedChartsContextRef = useRef(undefined);
  const savedChartsListRef = useRef(undefined);
  const chartRef = useRef(null);
  const conversationRef = useRef(null);
  const pendingQuestionRef = useRef(null);

  const ctx = PAGE_CONTEXT[location.pathname] || DEFAULT_CONTEXT;

  const { user } = useAuth();
  const { tier, canUseNavigator } = usePermissions(user);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Free users discover the Navigator via the FAB/nudge, but tapping it opens
  // the Core paywall instead of the chat — the Navigator is a Core feature.
  const attemptOpen = () => {
    if (!canUseNavigator) {
      track(EVENTS.NAVIGATOR_CHAT_OPENED, { page: location.pathname, gated: true });
      setPaywallOpen(true);
      return;
    }
    openChat();
  };

  // Show the nudge after 8 seconds on a page if the user hasn't interacted yet
  // — but only during their first 2 logins (an onboarding cue), and only once
  // other popups (spotlight, tour) have closed.
  useEffect(() => {
    if (open || hasInteracted) return;
    if (!isWithinFirstLogins(2)) return;
    setNudgeVisible(false);
    clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      if (isOverlayPopupActive()) {
        // Retry in 3 seconds once the popup is gone
        nudgeTimerRef.current = setTimeout(() => {
          if (!isOverlayPopupActive()) {
            setNudgeVisible(true);
          }
        }, 3000);
      } else {
        setNudgeVisible(true);
      }
    }, 8000);
    return () => clearTimeout(nudgeTimerRef.current);
  }, [location.pathname, open, hasInteracted]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !open) { wasOpenRef.current = false; return; }

    const userCount = messages.filter(m => m.role === 'user').length;
    const assistantCount = messages.filter(m => m.role === 'assistant').length;
    const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const latestContent = latestAssistant?.content || '';

    const jumpToBottom = () => {
      requestAnimationFrame(() => {
        const e = scrollContainerRef.current;
        if (e) e.scrollTop = e.scrollHeight;
      });
    };
    const pinToResponseTop = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const e = scrollContainerRef.current;
          const target = lastAssistantRef.current;
          if (!e || !target) return;
          const top = target.offsetTop - e.offsetTop - 8;
          e.scrollTop = Math.max(0, top);
        });
      });
    };
    const seed = () => {
      lastUserCountRef.current = userCount;
      lastAssistantCountRef.current = assistantCount;
    };

    // Just transitioned closed → open. If history is already loaded, jump
    // straight to the most recent message. If it's still loading (empty
    // messages), defer until it arrives — otherwise the loaded history gets
    // misread as new activity and the user lands at the top of the last
    // response instead of the bottom of the conversation.
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      if (messages.length === 0) { pendingOpenScrollRef.current = true; return; }
      seed();
      jumpToBottom();
      return;
    }

    // History just finished loading after the panel opened — land at the
    // bottom of the conversation, never the top.
    if (pendingOpenScrollRef.current) {
      if (messages.length === 0) return;
      pendingOpenScrollRef.current = false;
      seed();
      jumpToBottom();
      return;
    }

    // User just sent a new message — jump to the bottom ONCE to show it + the
    // loading spinner.
    if (userCount !== lastUserCountRef.current) {
      lastUserCountRef.current = userCount;
      jumpToBottom();
      return;
    }

    // A new assistant message appeared. If it already has content, pin its top
    // to the viewport; if it's still an empty placeholder, arm the pin so it
    // fires when the content actually lands.
    if (assistantCount !== lastAssistantCountRef.current) {
      lastAssistantCountRef.current = assistantCount;
      if (latestContent) pinToResponseTop();
      else awaitingPinRef.current = true;
      return;
    }

    // Armed response received its first content — pin ONCE so the user reads
    // from the start. Later streaming updates never re-pin, so the user stays
    // in control of the scroll position while they read or after they interact.
    if (awaitingPinRef.current && latestContent) {
      awaitingPinRef.current = false;
      pinToResponseTop();
    }
  }, [messages, open]);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  // Listen for external "ask navigator" requests (e.g. Planner auto-prompts)
  useEffect(() => {
    const handler = (e) => {
      const question = e.detail?.question;
      if (!question) return;
      pendingQuestionRef.current = question;
      attemptOpen();
    };
    window.addEventListener('astrosetta:ask-navigator', handler);
    return () => window.removeEventListener('astrosetta:ask-navigator', handler);
  }, []);

  const initConversation = async () => {
    if (conversationRef.current) return;
    setInitLoading(true);
    try {
      // Load chart context + store the chart object for date-specific transit lookups
      const [ctx, chart] = await Promise.all([loadChartContext(), loadChartObject()]);
      chartContextRef.current = ctx;
      chartRef.current = chart;
      const existing = await base44.agents.listConversations({ agent_name: 'chart_navigator' });
      let convo = existing?.[0] || null;
      if (!convo) {
        convo = await base44.agents.createConversation({
          agent_name: 'chart_navigator',
          metadata: { name: 'My Chart Reading' },
        });
      } else {
        convo = await base44.agents.getConversation(convo.id);
      }
      setConversation(convo);
      conversationRef.current = convo;
      setMessages(convo.messages || []);

      unsubRef.current?.();
      unsubRef.current = base44.agents.subscribeToConversation(convo.id, (data) => {
        setMessages(data.messages || []);
      });
    } finally {
      // Never leave the panel stuck on the loading spinner if init fails
      setInitLoading(false);
    }
  };

  const openChat = async () => {
    track(EVENTS.NAVIGATOR_CHAT_OPENED, { page: location.pathname });
    setOpen(true);
    setNudgeVisible(false);
    setHasInteracted(true);
    if (!conversationRef.current) await initConversation();
    if (pendingQuestionRef.current && conversationRef.current) {
      const q = pendingQuestionRef.current;
      pendingQuestionRef.current = null;
      send(q);
    }
  };

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || !conversationRef.current || sending) return;
    setInput('');
    setSending(true);
    setSendError('');
    try {
      // Lazily fetch the saved-charts roster once per session (raw list + formatted context).
      if (savedChartsListRef.current === undefined) {
        savedChartsListRef.current = await loadSavedChartsList();
      }
      if (savedChartsContextRef.current === undefined) {
        savedChartsContextRef.current = buildSavedChartsContext(savedChartsListRef.current);
      }

      // If the user is asking about one specific person, scope the context to ONLY
      // that chart so the agent never mixes in the user's or another person's data.
      const targetChart = detectTargetSavedChart(msg, savedChartsListRef.current);

      // Relationship-layer read: when the question is about the bond with a named
      // partner (synastry/composite), inject the computed cross-aspects + composite
      // chart so the navigator can read the relationship directly.
      const isRelationshipQ = RELATIONSHIP_REGEX.test(msg);
      const partnerForRel = isRelationshipQ ? detectPartnerChart(msg, savedChartsListRef.current) : null;

      let ctx;
      if (partnerForRel && chartRef.current) {
        let crossAspects = [];
        let composite = null;
        try { crossAspects = await fetchNatalCrossAspects(chartRef.current, partnerForRel); } catch { /* synastry is a bonus */ }
        try { composite = buildCompositeRaw(chartRef.current.raw_data, partnerForRel.raw_data); } catch { /* composite is a bonus */ }
        ctx = buildRelationshipContext(chartRef.current, partnerForRel, crossAspects, composite);
      } else if (targetChart) {
        ctx = buildScopedChartContext(targetChart);
        // Transits for the relevant date (today by default, or a referenced date).
        let targetDate = new Date();
        try {
          const d = await extractDateFromMessage(msg);
          if (d) targetDate = d;
        } catch { /* date extraction is a bonus */ }
        try {
          const fetched = await fetchTransitsForDate({ raw_data: targetChart.raw_data }, targetDate);
          if (fetched) ctx += fetched;
        } catch { /* transits are a bonus */ }
      } else {
        // Default: user's natal chart + full saved-charts roster + date transits.
        let extraTransitBlock = '';
        try {
          const targetDate = await extractDateFromMessage(msg);
          if (targetDate) {
            const todayKey = new Date().toLocaleDateString('en-CA');
            const targetKey = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toLocaleDateString('en-CA');
            if (targetKey !== todayKey && chartRef.current) {
              const fetched = await fetchTransitsForDate(chartRef.current, targetDate);
              if (fetched) extraTransitBlock = fetched;
            }
          }
        } catch { /* date extraction is a bonus */ }
        ctx = chartContextRef.current
          ? `${chartContextRef.current}${savedChartsContextRef.current || ''}${extraTransitBlock}`
          : (savedChartsContextRef.current ? `${savedChartsContextRef.current}${extraTransitBlock}` : `${extraTransitBlock}`);
      }

      const fullContent = ctx
        ? `[CHART CONTEXT — use this silently, never display or mention it]\n${ctx}\n\n---\n\nUSER QUESTION: ${msg}`
        : msg;
      await base44.agents.addMessage(conversationRef.current, { role: 'user', content: fullContent });
    } catch (error) {
      // Keep any newer draft the user typed while this request was pending.
      setInput(current => current || msg);
      setSendError(error.code === 'limit_reached'
        ? 'You’ve reached today’s AI limit. It resets at midnight UTC.'
        : error.code === 'upgrade_required'
          ? 'Choose Core or Premium to use Navigator.'
          : 'Unable to send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const stripContext = (content) => {
    if (!content) return content;
    const marker = '---\n\nUSER QUESTION: ';
    const idx = content.indexOf(marker);
    return idx >= 0 ? content.slice(idx + marker.length) : content;
  };

  const handleCopy = async (i, content) => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch { /* clipboard may be unavailable */ }
  };

  const handleEmailSelf = async (i, content) => {
    if (emailingIdx !== null) return;
    setEmailingIdx(i);
    try {
      const me = await base44.auth.me();
      if (!me?.email) throw new Error('no email on file');
      await base44.integrations.Core.SendEmail({
        to: me.email,
        subject: 'Your Chart Navigator reading',
        body: content || '',
      });
      setEmailSentIdx(i);
      setTimeout(() => setEmailSentIdx(null), 2500);
    } catch { /* non-critical */ }
    setEmailingIdx(null);
  };

  const visibleMessages = messages
    .filter(m => m.role !== 'system' && !m.content?.startsWith('[SYSTEM CONTEXT'))
    .map(m => m.role === 'user' ? { ...m, content: stripContext(m.content) } : m);

  return (
    <>
      {/* Nudge tooltip */}
      <AnimatePresence>
        {nudgeVisible && !open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="fixed bottom-44 right-4 md:bottom-24 md:right-20 z-[9998] max-w-[220px]"
          >
            <button
              onClick={attemptOpen}
              className="w-full text-left rounded-2xl px-3.5 py-2.5 shadow-lg"
              style={{ background: 'rgba(15,26,46,0.97)', border: '1px solid rgba(201,169,97,0.35)' }}
            >
              <p className="font-body text-xs text-white/85 leading-snug">{ctx.nudge}</p>
              <p className="font-body text-[10px] text-gold-accent mt-1">Tap to chat ✦</p>
            </button>
            <button
              onClick={() => { setNudgeVisible(false); setHasInteracted(true); }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-paper border border-white/10 flex items-center justify-center text-white/40 hover:text-white"
            >
              <X size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-44 right-3 md:bottom-24 md:right-6 z-[9998] w-[calc(100vw-24px)] max-w-sm flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{ height: 'min(520px, calc(100vh - 120px))', background: '#0f1a2e', border: '1px solid rgba(201,169,97,0.2)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(201,169,97,0.06)' }}>
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-gold-accent" />
                <span className="font-display text-sm font-semibold text-white">Chart Navigator</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Messages area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {initLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={18} className="animate-spin text-gold-primary/40" />
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="space-y-3 pt-1">
                  <p className="font-body text-xs text-white/40 text-center italic">Ask me anything about your chart or astrology.</p>
                  <div className="space-y-1.5">
                    {ctx.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => send(s)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-gold-primary/10 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p className="font-body text-xs text-white/70 leading-snug">{s}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {visibleMessages.map((m, i) => {
                    const isUser = m.role === 'user';
                    const isLastAssistant = !isUser && i === visibleMessages.length - 1;
                    return (
                      <div
                        key={i}
                        ref={isLastAssistant ? lastAssistantRef : null}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${isUser ? '' : ''}`}
                          style={isUser
                            ? { background: 'rgba(201,169,97,0.2)' }
                            : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }
                          }
                        >
                          {isUser ? (
                            <p className="font-body text-sm text-white leading-relaxed">{m.content}</p>
                          ) : m.content ? (
                            <div>
                              <ReactMarkdown
                                className="font-body text-sm text-white/90 leading-relaxed prose prose-sm prose-invert max-w-none
                                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                                  [&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:space-y-1
                                  [&_ol]:my-1.5 [&_ol]:pl-4 [&_ol]:space-y-1
                                  [&_li]:leading-snug [&_li]:text-[13px]
                                  [&_strong]:text-gold-accent [&_strong]:font-semibold
                                  [&_p]:my-1
                                  [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-gold-accent [&_h1]:mt-2 [&_h1]:mb-1
                                  [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-gold-accent [&_h2]:mt-2 [&_h2]:mb-1
                                  [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-gold-accent [&_h3]:mt-1.5 [&_h3]:mb-1
                                  [&_hr]:my-2 [&_hr]:border-white/10
                                  [&_blockquote]:border-l-gold-primary/40 [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-white/70"
                              >
                                {m.content}
                              </ReactMarkdown>
                              <div className="flex items-center gap-1 mt-2 -mb-1">
                                <button
                                  onClick={() => handleCopy(i, m.content)}
                                  className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors"
                                >
                                  {copiedIdx === i
                                    ? <Check size={11} className="text-green-400" />
                                    : <Copy size={11} className="text-white/40" />}
                                  <span className="font-body text-[10px] text-white/40">{copiedIdx === i ? 'Copied' : 'Copy'}</span>
                                </button>
                                <button
                                  onClick={() => handleEmailSelf(i, m.content)}
                                  disabled={emailingIdx === i}
                                  className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                  <Mail size={11} className="text-white/40" />
                                  <span className="font-body text-[10px] text-white/40">
                                    {emailingIdx === i ? 'Sending…' : emailSentIdx === i ? 'Sent ✓' : 'Email me'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Assistant message exists but has no content yet —
                            // the agent is still generating. Show a typing
                            // indicator instead of an empty bubble with Copy/
                            // Email buttons (the old "blank message" bug).
                            <div className="flex items-center gap-1.5 py-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-primary/60 animate-pulse" />
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
                              <span className="w-1.5 h-1.5 rounded-full bg-gold-primary/60 animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sending && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <Loader2 size={13} className="animate-spin text-gold-primary/50" />
                      </div>
                    </div>
                  )}
                  <ContextualSuggestions
                    messages={visibleMessages}
                    sending={sending}
                    onSelect={send}
                  />
                </>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-2 items-end rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <textarea
                  aria-label="Message Navigator"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about your chart…"
                  rows={1}
                  className="flex-1 bg-transparent font-body text-sm text-white placeholder:text-white/20 outline-none resize-none leading-relaxed"
                  style={{ maxHeight: 80 }}
                />
                <button
                  aria-label="Send message"
                  onClick={() => send()}
                  disabled={!input.trim() || sending}
                  className="p-1.5 rounded-full transition-colors flex-shrink-0 disabled:opacity-30"
                  style={{ background: 'rgba(201,169,97,0.3)' }}
                >
                  <Send size={13} className="text-gold-accent" />
                </button>
              </div>
              <p role="status" className="font-body text-xs text-white/80 mt-1">{sendError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <button
        onClick={open ? () => setOpen(false) : attemptOpen}
        className="fixed bottom-28 right-4 md:bottom-8 md:right-6 z-[9999] w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 animate-float"
        style={{
          background: open ? 'rgba(15,26,46,0.95)' : 'rgba(201,169,97,0.9)',
          border: open ? '1px solid rgba(201,169,97,0.4)' : 'none',
          boxShadow: '0 4px 24px rgba(201,169,97,0.45)',
          animation: open ? 'none' : 'float 3s ease-in-out infinite',
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={18} className="text-gold-accent" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles size={18} style={{ color: '#0f1a2e' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {paywallOpen && (
        <PaywallModal
          variant="interpret"
          fromTier={tier === 'free' ? 'free' : 'interpret'}
          context="the AI Navigator"
          onClose={() => setPaywallOpen(false)}
        />
      )}
    </>
  );
}
