import { useState } from "react";

// Marketing calendar phases — updated September 2026 to reflect the current
// state of the app: the App Store compliance suite, exact-lunation calendar
// sync, and the Essential knowledge-density rewrite are shipped; paid launch,
// native build submission, and email deliverability are the live workstreams.
const phases = [
  {
    id: "now",
    label: "Now",
    months: "September 2026",
    monthIndices: [8],
    theme: "Launch Readiness",
    color: "#D4AF85",
    icon: "✦",
    tracks: [
      {
        name: "Product",
        items: [
          { text: "App Store compliance suite — account deletion, restore purchases, paywall disclosures, founding member recognition", tag: "done" },
          { text: "Calendar sync rebuilt on exact lunations — single-day moon events in ICS feed + Google sync", tag: "done" },
          { text: "Knowledge Density — Essential tier rewritten for complete beginners", tag: "done" },
          { text: "Paid launch: flip gating live — founding pricing $5.55 / $7.77 on Stripe + App Store IAP", tag: "launch" },
          { text: "Native iOS/Android build submission with push notification credentials", tag: "build" },
          { text: "Email deliverability audit — weekly & system digests log success but don't arrive", tag: "ops" },
          { text: "Founding ticker goes live once 10+ founding members subscribe", tag: "ops" },
        ],
      },
      {
        name: "Content & Community",
        items: [
          { text: "Launch announcement email to waitlist + welcome sequence live", tag: "launch" },
          { text: "Social cadence: weekly transit posts (TikTok / IG)", tag: "create" },
          { text: "Podcast format + guest astrologer outreach list", tag: "research" },
        ],
      },
      {
        name: "Event / Merch",
        items: [
          { text: "Pop-up event target date (Oct or Nov — confirm)", tag: "confirm" },
          { text: "Sun/Moon/Rising keychain & charm concepts + manufacturer quote", tag: "design" },
        ],
      },
    ],
  },
  {
    id: "oct",
    label: "Oct",
    months: "October 2026",
    monthIndices: [9],
    theme: "Pop-Up & Momentum",
    color: "#C9A961",
    icon: "☾",
    tracks: [
      {
        name: "Product",
        items: [
          { text: "Landing page polish: SEO meta tags, OG image, canonical URL", tag: "ship" },
          { text: "Learn: personalized module recommendations from placements", tag: "build" },
          { text: "Curriculum: Hellenistic timing techniques deep-dive (profections, zodiacal releasing)", tag: "build" },
        ],
      },
      {
        name: "Content & Community",
        items: [
          { text: "Podcast Episode 1 published (solo or first guest astrologer)", tag: "launch" },
          { text: "Pre-event explainer posts: What is Astrosetta?", tag: "create" },
          { text: "First cohort retention check: D7, D14, D30 quiz completion rates", tag: "research" },
        ],
      },
      {
        name: "Event / Merch",
        items: [
          { text: "Pop-up event — learner signup gift, Core signup charms, QR + live chart demo booth", tag: "event" },
          { text: "Capture testimonials + photos for content", tag: "ops" },
        ],
      },
    ],
  },
  {
    id: "nov",
    label: "Nov–Dec",
    months: "November – December 2026",
    monthIndices: [10, 11],
    theme: "Holiday & Retention",
    color: "#A8D4D9",
    icon: "♄︎",
    tracks: [
      {
        name: "Product",
        items: [
          { text: "PWA install prompt + offline chart access", tag: "build" },
          { text: "Planner: tap a transit row to start a journal entry", tag: "build" },
          { text: "Transit notifications — push/in-app alerts when major transits are exact", tag: "explore" },
        ],
      },
      {
        name: "Content & Community",
        items: [
          { text: "Year-ahead (2027) transit content series", tag: "create" },
          { text: "Holiday gifting positioning for subscriptions", tag: "launch" },
        ],
      },
      {
        name: "Monetization",
        items: [
          { text: "Track MRR, conversion rate, founding member count weekly", tag: "ops" },
          { text: "Stripe founding pricing logic (lapse → standard pricing) verified", tag: "ship" },
        ],
      },
    ],
  },
  {
    id: "q1",
    label: "Q1 2027",
    months: "Jan – Mar 2027",
    monthIndices: [0, 1, 2],
    theme: "Growth & Curriculum",
    color: "#B8A5C8",
    icon: "❖",
    tracks: [
      {
        name: "Product",
        items: [
          { text: "Quiz Tier 3 — open-response interpretations (Maestro level)", tag: "build" },
          { text: "Chakrasetta / Tarosetta: evaluate as next vertical", tag: "explore" },
          { text: "Community sharing: opt-in feed of top interpretations", tag: "explore" },
        ],
      },
      {
        name: "Content & Community",
        items: [
          { text: "Intermediate/advanced curriculum content series", tag: "create" },
          { text: "Featured astrologer profiles with reading sales links", tag: "launch" },
        ],
      },
      {
        name: "Monetization (V2)",
        items: [
          { text: "Top contributor monetization model scoped", tag: "explore" },
          { text: "Aggregated interpretation data product (B2B?) evaluated", tag: "explore" },
          { text: "Podcast sponsorship outreach (aligned brands only)", tag: "explore" },
        ],
      },
    ],
  },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TAG_STYLES = {
  done:     { bg: "rgba(168,200,168,0.14)", text: "#A8C8A8", border: "rgba(168,200,168,0.35)" },
  ship:     { bg: "rgba(168,200,168,0.18)", text: "#A8C8A8", border: "rgba(168,200,168,0.35)" },
  build:    { bg: "rgba(157,180,200,0.18)", text: "#9DB4C8", border: "rgba(157,180,200,0.35)" },
  launch:   { bg: "rgba(212,175,133,0.18)", text: "#D4AF85", border: "rgba(212,175,133,0.35)" },
  create:   { bg: "rgba(184,165,200,0.18)", text: "#B8A5C8", border: "rgba(184,165,200,0.35)" },
  design:   { bg: "rgba(216,180,194,0.18)", text: "#D8B4C2", border: "rgba(216,180,194,0.35)" },
  ops:      { bg: "rgba(255,255,255,0.08)",  text: "rgba(255,255,255,0.55)", border: "rgba(255,255,255,0.15)" },
  research: { bg: "rgba(168,212,217,0.18)", text: "#A8D4D9", border: "rgba(168,212,217,0.35)" },
  confirm:  { bg: "rgba(201,169,97,0.18)",  text: "#C9A961", border: "rgba(201,169,97,0.35)" },
  explore:  { bg: "rgba(184,165,200,0.12)", text: "#B8A5C8", border: "rgba(184,165,200,0.25)" },
  event:    { bg: "rgba(212,175,133,0.22)", text: "#D4AF85", border: "rgba(212,175,133,0.5)" },
};

export default function MarketingCalendar() {
  const [activePhase, setActivePhase] = useState("now");
  const [activeTrack, setActiveTrack] = useState(null);

  const phase = phases.find((p) => p.id === activePhase);

  return (
    <div className="font-body">
      {/* Phase Tabs */}
      <div className="flex border-b border-white/[0.08] overflow-x-auto">
        {phases.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActivePhase(p.id); setActiveTrack(null); }}
            className={`flex-none py-3 px-5 font-body text-xs tracking-widest uppercase transition-colors border-b-2 whitespace-nowrap ${
              activePhase === p.id
                ? "border-gold-accent text-white font-semibold"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            <span className="mr-1.5">{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Phase Header + Track Filter */}
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3 border-b border-white/[0.06]">
        <div>
          <h2 className="font-display text-lg font-bold text-white">{phase.theme}</h2>
          <p className="font-body text-[10px] uppercase tracking-widest text-white/40 mt-0.5">{phase.months}</p>
        </div>
        {/* Month strip — highlights active phase's months in its color */}
        <div className="flex gap-1 flex-wrap">
          {MONTH_LABELS.map((m, i) => {
            const isHighlighted = phase.monthIndices?.includes(i);
            return (
              <div
                key={m}
                className="font-body text-[9px] uppercase tracking-wider px-2 py-1 rounded transition-all"
                style={{
                  background: isHighlighted ? `${phase.color}22` : "rgba(255,255,255,0.03)",
                  color: isHighlighted ? phase.color : "rgba(255,255,255,0.25)",
                  border: `1px solid ${isHighlighted ? `${phase.color}55` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {m}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTrack(null)}
            className={`font-body text-[10px] px-3 py-1 rounded-full border transition-colors ${
              activeTrack === null
                ? "border-gold-accent bg-gold-primary/20 text-white"
                : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
            }`}
          >
            All tracks
          </button>
          {phase.tracks.map((t) => (
            <button
              key={t.name}
              onClick={() => setActiveTrack(activeTrack === t.name ? null : t.name)}
              className={`font-body text-[10px] px-3 py-1 rounded-full border transition-colors ${
                activeTrack === t.name
                  ? "border-gold-accent bg-gold-primary/20 text-white"
                  : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/70"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div className="p-5 space-y-6">
        {phase.tracks
          .filter((t) => activeTrack === null || t.name === activeTrack)
          .map((track) => (
            <div key={track.name}>
              <p className="font-body text-[10px] uppercase tracking-widest text-white/40 mb-3 pb-2 border-b border-white/[0.06]">
                {track.name}
              </p>
              <div className="space-y-2">
                {track.items.map((item, i) => {
                  const tc = TAG_STYLES[item.tag] || TAG_STYLES.ops;
                  const isDone = item.tag === "done";
                  return (
                    <div
                      key={i}
                      className={`celestial-card px-4 py-3 flex items-start gap-3 ${isDone ? "opacity-60" : ""}`}
                      style={{ borderLeft: `3px solid ${isDone ? "rgba(168,200,168,0.5)" : `${phase.color}40`}` }}
                    >
                      <span
                        className="flex-shrink-0 font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded mt-0.5"
                        style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
                      >
                        {isDone ? "✓ shipped" : item.tag}
                      </span>
                      <span className={`font-body text-sm leading-snug ${isDone ? "text-white/40 line-through" : "text-white"}`}>
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* Tag Legend */}
      <div className="mx-5 mb-6 celestial-card px-4 py-3">
        <p className="font-body text-[9px] uppercase tracking-widest text-white/30 mb-2">Tag Legend</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TAG_STYLES).map(([tag, tc]) => (
            <span
              key={tag}
              className="font-body text-[9px] uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
            >
              {tag === "done" ? "✓ shipped" : tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}