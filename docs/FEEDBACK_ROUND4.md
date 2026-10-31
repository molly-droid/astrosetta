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

## AI-08 — module-aware "in your chart" end slides (P1, scoped, not started)

**Her report:** every Learn module's end slide repeats the Big Three and
doesn't connect the lesson to the user's chart. She wants a per-module
"where this shows up for you" hook: Moon Phases → natal phase (from the
Sun–Moon angle); Void-of-Course → natal Moon void status, sign, house;
planet modules → that planet's sign/house/aspects; house modules → cusp
sign + occupants; Big Three only on Big-Three modules.

**Triage:** new product work (F-01 family), not migration parity — needs a
per-module chart-data mapping across the curriculum plus llm-task prompt
changes. Flag in the scope conversation with Molly before building.

## Sequencing

1. **B-31** — done; deploy + her retest.
2. **B-30** — awaiting her retest on build 15 (in App Review as 1.0).
3. **AI-08** — estimate + scope conversation, then schedule.
