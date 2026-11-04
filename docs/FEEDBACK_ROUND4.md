# Molly's TestFlight feedback — Round 4 triage

Source: the same artifact ("Astrosetta — TestFlight Updates for Jacob"),
exported to PDF 2026-10-29 as "phase 4" (40 pages; round-3 export was 37).
Her round log: *"Round 4 — Verified: B-07. New: AI-08, B-31 (Oct 27
testing; in progress)."* Diffed against the round-3 export: those three
rows are the whole delta.

She tested Oct 27 — B-30 (plan switching) still shows **New**; she had not
retested on build 15 yet.

---

## B-07 ✅ verified by Molly (Oct 27)

Rising sign now pulls into the curriculum end-cards. Closed.

## B-31 ✅ (fixed 2026-10-31) — fixed-axis "aspects" (P1)

**Her report:** "North Node opposing South Node" is listed and interpreted
as a transit (Transits → Collective → Oppositions) and comes up often —
the nodes are always exactly opposite, so it's not a real aspect. Rule:
never generate aspects between the two ends of a fixed axis (NN–SN;
on charts ASC–DESC and MC–IC), keep node sign changes and node aspects to
real planets, and strip the pairs from AI-reading data.

**Origin:** faithful port of Base44 behavior (the pairwise aspect loops
never excluded axis partners) — a parity-preserved defect, now fixed at
her request.

**Shipped:** shared `isAxisPair` helper (`apps/web/src/lib/axisPairs.js` +
`supabase/functions/_shared/axisPairs.ts`) applied to every same-frame
aspect loop:

- client collective/mundane list (`useTransits.jsx`) — her repro
- mundane pattern detector (cradle opposition seed, `mundanePatterns.js`)
- transit–natal formations (`transitNatalFormations.js` `leg()` — node
  pools fed fake T-squares/kites here too)
- composite chart internal aspects (`compositeChart.js` — composite nodes
  are midpoint-opposite by construction)
- server transit→natal aspects (`chart-calculator`), day-synthesis
  generator (natal + both mundane loops — this is the AI-payload path),
  and calendar mundane aspects (`calendarDays.ts` — Google sync + ICS)

Cross-frame NN–SN contacts (transit node to natal opposite node) are also
filtered: they duplicate the matching node-to-same-node contact. Synastry
(chart-to-chart) is deliberately NOT filtered — one person's ASC to
another's DESC is a real, variable contact. Natal chart aspects were
already clean (South Node skipped server-side; angles not in the pair
list).

**Already-generated content** (cached day syntheses, previously synced
calendar events) ages out naturally / is overwritten on next sync — no
backfill needed.

Needs: redeploy of chart-calculator, calendar-icsfeed,
sync-astro-to-calendar, send-daily-email, pre-generate-synthesis; web
ships on push. Native picks it up in the next binary (client half), but
the server half fixes AI readings and calendars for the shipped builds
immediately.

## AI-08 — module-aware "in your chart" end slides (P1, Tier 1 SHIPPED 2026-10-31)

**Tier 1 shipped and E2E-verified** (9 subjects that used to show the generic
Big Three): `moon_phases` (natal phase from the Sun–Moon angle + Moon
placement card), `void_of_course` (NEW server branch `chart_type:
'natal_voc'` in chart-calculator steps the natal Moon at ~7-min resolution
against Sun–Saturn Ptolemaic aspects; verified against an independent
fixed-planet cross-check — same aspect, same body, same timeframe),
`chart_balance` (ten-planet element/modality tallies), `chart_ruler`
(Ascendant ruler + its placement, honest copy for unknown birth times),
`empty_houses` (lists them + cusp-ruler explanation), `decans` (Sun's decan,
method-neutral copy), and `juno`/`pallas`/`vesta` (full placement card +
aspects via the existing point template). Cards: subjects about a body
borrow its placement card (Moon for the lunar modules, the ruler for
chart_ruler); self-contained subjects show no card. Big-Three fallback
remains for not-yet-tiered modules (better than nothing; shrinks as tiers
land). Before/after screenshots on Tony's Desktop (ai08-*.png).

**Her report:** every Learn module's end slide repeats the Big Three and
doesn't connect the lesson to the user's chart. She wants a per-module
"where this shows up for you" hook: Moon Phases → natal phase (from the
Sun–Moon angle); Void-of-Course → natal Moon void status, sign, house;
planet modules → that planet's sign/house/aspects; house modules → cusp
sign + occupants; Big Three only on Big-Three modules.

**Tier 2 shipped 2026-11-03 (20 modules):** aspects family (intro: counts +
tightest; conjunction; squares/oppositions; trines/sextiles; minor) using the
ten planets + Chiron — the SAME bodies chartDynamics uses, so the aspect and
pattern modules can't contradict each other (caught when a T-Square's
Uranus–Chiron opposition was missing from "your oppositions"); Lots
excluded (derived from Sun/Moon/ASC). Patterns family (aspect_patterns,
kite, mystic rectangle, yod, stelliums) from analyzeChartDynamics — honest
"you don't have one" copy that points to a related pattern if present.
Elements (four elements = which planet sits where; modalities; element
balance). Dignities (intro, domicile/detriment, exaltation/fall, peregrine —
labelled as major dignities only, dignity in practice) on the classical
seven with traditional rulers; sect (Sun vs Ascendant longitude, sect
benefic/malefic/contrary); cazimi/combust/under the beams (17′ / 8.5° / 17°).
Validation: every claim recomputed independently from raw longitudes for
Tony's chart (all matched); the real template code compiled into a Node
harness and run against all 6 prod charts × 20 modules (pattern-present
wording exercised on two T-Square charts) — no crashes, blanks, undefined,
em dashes or nested parens. Before/after pairs: ~/Desktop/ai08-tier2/pairs/.
Copy note: the AI-04 display stripper turns " — " into ", ", so new templates
avoid em dashes (Tier 1 copy rewritten the same way). Note the "before" was
not purely generic: Base44 appended a family-level line (same dignity list on
every classical module, same aspect list incl. Lots on every aspects module).
Still on the fallback (24): traditions series (13), foundations intros (4),
chart_synthesis, synastry_basics, antiscia_contrascia, and the Tier 3
history/mundane modules (great_conjunctions, profections, barbaults_basket,
mundane_aspect_patterns) awaiting Molly's call on the personal hook.

**Triage:** new product work (F-01 family), not migration parity. The end
slide is template-generated (no LLM), so "prompt" changes are template
branches in ModulePlayer's buildPersonalSynthesis. Remaining tiers for the
scope conversation: Tier 2 = aspects family (your tightest example of the
aspect being taught), patterns family (run chartDynamics detectors on the
natal chart), dignities family (classical tables); Tier 3 = mundane/history
modules (Great Conjunctions, profections — personalization method needs
Molly's call).

## Sequencing

1. **B-31** — done; deploy + her retest.
2. **B-30** — awaiting her retest on build 15 (in App Review as 1.0).
3. **AI-08** — estimate + scope conversation, then schedule.
