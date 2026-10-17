# Molly's TestFlight feedback — Round 2 triage

Source: the same doc as round 1, "Astrosetta — TestFlight Updates for Jacob"
(claude.ai/artifact/4LAko5g3ES2vE3XQn3MxxF), **updated Oct 16 2026, 8:00 PM**,
now 32 pages. The artifact is shared with admin@silexdev.com only, so it can't
be read directly from this workspace; triage is from a PDF export diffed
against the Oct 11 one.

Her round log: *"Retest: 14 items verified; B-07, B-11, B-13 still failing;
B-14 positions to retest. New: B-21, B-22, B-23, B-24, B-25, B-26, UX-09,
PF-05, PF-06, AI-05."*

She tested **build 1.0 (7)** (uploaded Oct 14), which contains everything
through PF-01/PF-02. Work landed on Oct 16 is not in any build.

---

## A. The 10 new items

### P0 — blocks the Nov 13 demo

**PF-06 — app-wide slowness. Her single biggest concern this round.**
"Almost everything takes a long time to load in the TestFlight build,
including features that now work correctly."
→ This is a verdict on work we already shipped: PF-01/PF-02 caching went out
in build 7, and after testing that build she ranked loading as the top
problem. The next pass must start with **measurement, not more caching** —
we do not currently know whether the cost is chart math, the astrology API,
LLM latency or cold edge-function starts. Her own proposal (profile first,
then stream and preload) is the right shape. Nothing should be optimised
until a profile says what to optimise.

**B-23 — Planner readings for tomorrow and later never load.** Only today's
resolves; other days spin indefinitely.
→ Worst of the three loading complaints because it is a hard failure, not
slowness. Likely the same generate-on-demand path as the day synthesis, with
no pre-generation for non-today dates. Related to PF-04. Needs a repro with
the network panel open to see whether the request is slow, erroring, or never
issued.

**B-22 — Planner week shows wrong station/ingress dates.** Mercury stations
retrograde shown Mon Oct 19; it actually stations Oct 24. "Mercury R Scorpio"
tags appear on the 19th and 20th, before the ingress.
→ She links it to B-14 and B-18. B-14 moved both calendar surfaces onto
chart-calculator; the Planner week view may still be using the older
day-sampling path for stations and ingresses. Check whether the week view
reads the same `_shared/calendarDays.ts` data the calendar now does. If it
does not, this is the last surface on the old ephemeris.

### P1

**B-21 — My Chart aspect card text stops short of the right edge.**
→ **FIXED Oct 16.** Same component as B-13, exactly as she guessed. See §B.

**B-24 — Practitioner's Lens repeats the same tip after every quiz**
("The Saturn-Rx-in-Aries Audit Cheat-Code").
**AI-05 — the prompt-side pair:** tie each tip to the quiz just taken, rotate
through today's transits, pass recent tip titles in with "don't repeat these".
→ Lives in `components/learning/MasteryChallenge.jsx`. Treat as one fix, not
two: whether the repeat is a cache being reused or a deterministic pick has
to be established first, and that determines whether AI-05's prompt change is
needed at all.

**B-25 — Apple purchase sheet shows no app icon / product image.**
→ Almost certainly **not code**. The image on the StoreKit sheet comes from
App Store Connect (the subscription's promotional image, and the app icon).
A config task, and a quick one. Worth confirming before anyone opens an
editor.

**B-26 — no route to the bonus round after a quiz retake.**
→ Her accepted alternative is a clear message if bonus is once per day, so
this may be a copy fix rather than a flow change. Needs the current rule
established first: is bonus genuinely once-daily, or is the retake path
simply missing the entry point?

**UX-09 — tapping out doesn't clear a selection on Synastry / another
person's chart.** Works on My Chart; the wheel stays dimmed.
→ Hypothesis, not yet confirmed: `ChartWheel.jsx:447` clears the selection by
walking up from the click target and bailing out if any ancestor has an
**inline** `cursor: pointer`. Synastry renders extra overlay elements
(partner planets, overlay aspects). If any of those sit over the empty space,
or set the cursor by class rather than inline style, the walk returns early
and the selection never clears. Cheap to verify.

**PF-05 — Planner monthly calendar and themes very slow.**
→ Her proposal is sound and worth following as written: month transits are
identical for every user, so compute and cache once, generate personal themes
monthly, render the calendar immediately and fill themes in. Subsumed by the
PF-06 profiling work; do not fix in isolation.

---

## B. Round 1 retest — what she found, and what we did about it

She verified 14 fixed: B-01, B-03, B-05, B-06, B-08, B-09, B-10, B-12, B-15,
B-16, B-17, B-18, B-19, P-01.

Three she reported still failing. All three were investigated Oct 16; **she
was right on two of them, and our round-1 ✅ was premature.**

**B-07 ✅ (really, this time).** The round-1 fix added an ascendant fallback
chain to `DaySynthesis.jsx:408`. The Learn curriculum is a **second, separate
surface** that was never touched: `PlacementSlide.jsx` read only
`raw.ascendant_sign` and rendered a dash when it was absent. Every chart in
the project has that field null — the ascendant lives in
`raw_data.angles.ascendant.sign` and in the `chart.ascendant_sign` column —
so the Big Three card showed a dash for **every user**, not just Molly.
Fixed with the same fallback chain plus the unknown-time guard, and verified
on device: the card now reads AC / RISING ♌ Leo.

**B-13 + B-21 ✅ — one component, as she predicted.** Planner renders
`LazyChartWheel` → `ChartWheel` → `ChartSelectionInfo`; My Chart renders the
identical path. In `PillShell`, the `✦ Interpret` / `✕` column was a flex
sibling with `shrink-0`, so it reserved its width down the **entire height**
of the card: every line of a ten-line interpretation stopped ~90px short to
leave room for a button occupying the top 40px. Floating the column takes it
out of flow — the first lines wrap around it, the rest run full width.
Verified at 393px device width.

**B-11 — not a bug; her diagnosis was wrong but her experience was real.**
The rem conversion did reach these components; there are no px literals left
anywhere in the interpretation chain, and the root scales correctly via
`--app-font-scale`. Her stored `font_scale` is **1.1**, one step up on a
0.8–1.8 slider, and scaling is proportional:

| Element | Base | At 1.1 |
|---|---|---|
| Page heading | 24px | 26.4px (+2.4, visible) |
| Aspect card body | 11px | 12.1px (+1.1, invisible) |

Which is precisely her round-1 wording: "applies to main elements, misses
aspect interpretations". Nothing was broken — but `0.6875rem` is a caption
size carrying multi-paragraph reading content, and iOS HIG puts body text
near 17px. Raised the six interpretation bodies to `text-sm` (14px):
Natal/Mundane/Synastry/Transit aspect interpretations, the Planner transit
list, and the chart dynamics card. Short factual labels in
`ChartDynamicsCard` (chart ruler, house ruler lines) deliberately left at
12px — they are metadata, not reading content. **14px is a proposal, not her
decision**; she should see a screenshot before it is treated as settled.

**B-14** — she wants positions retested rather than reporting it failed.
B-18 (planetary highlights) she has verified fixed. B-22 is the live part.

---

## C. Still open from round 1

Carrying her status column, not ours. Most of these are items she has not
retested rather than regressions.

B-02, B-04, B-20, C-01, C-02, UX-01, AI-01–04, F-02, F-03, PF-01.

C-01 (pricing) remains a decision for her, not a defect. Round-1 items she
answered by chat on Oct 16 — E-02, the welcome-email em dashes, the calendar
cleanup action, and the founding lapse policy — are **not** reflected in her
doc, which predates that conversation. Nothing to act on there.

---

## D. Sequencing

1. **Profile before optimising** (PF-06). Everything in the loading cluster —
   PF-05, B-23, parts of PF-04 — should wait on a measurement pass. Fixing
   them blind risks a repeat of PF-01/PF-02, which shipped and did not move
   her experience.
2. **B-22** is separable and has a concrete expected value to test against
   (Mercury stations Oct 24), so it can run in parallel.
3. **B-25** is probably an App Store Connect config change; confirm before
   scheduling engineering time.
4. **B-24/AI-05**, **B-26**, **UX-09** are small and independent.
