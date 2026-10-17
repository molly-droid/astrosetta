# Molly's TestFlight feedback — Round 1 triage

Source: Molly's doc "Astrosetta — TestFlight Updates for Jacob" (Oct 10, 2026,
claude.ai/artifact/4LAko5g3ES2vE3XQn3MxxF — shared with admin@silexdev.com).
44 items: B-01–20, P-01, UX-01–08, F-01–03, PF-01–04, C-01–02, AI-01–04, E-01–02.
Her deadlines: **feature freeze ~Oct 14**, **Nov 13 "Raven Party" demo** (P0 =
blocks store submission or the demo).

## A. Already answered — relay to Molly, no code

- **"Open questions for Jacob" (F-01 payments):** answered by the built
  architecture — StoreKit via RevenueCat on iOS, Play Billing via RevenueCat
  on Android, Stripe direct on web; one account-level tier via
  billing_snapshots (exactly her "one account, one plan" bullet; RevenueCat is
  already in place for the stores). "How do existing Stripe subscribers carry
  over?" — **there are none**: her live Stripe (Astrosetta acct) has zero
  customers/subscriptions (verified 2026-10-09).
- **Suggested product IDs** (core_monthly …): ours already exist as
  com.astrosetta.{interpret,calendar}.{monthly,yearly} (Apple) + Stripe
  lookup_keys core_founding_monthly etc. Renaming now would orphan the ASC
  products — keep ours, note it in her doc.
- **F-01 founding-badge question:** founding stamp + copy already implemented
  app-wide; a visual badge on the plan cards is small — fold into F-01 work.

## B. Needs a DECISION with Molly (conflicts or underspecified)

- **C-01 (P0): show $5.55/$7.77 on the plan page instead of $5.59/$7.79.**
  Conflicts with Apple reality: $5.55/$7.77 are not valid Apple price points,
  and iOS must not advertise a lower price than the App Store charges
  (App Review risk — this is why the app shows the store's real localized
  price on native). Options to put to her: (1) keep platform-true display —
  iOS $5.59/$7.79, web $5.55/$7.77 (recommended); (2) lower ASC prices to
  $5.49/$7.49 so iOS is cheaper-or-equal and display $5.55/$7.77 web-only;
  (3) her wording but iOS keeps real prices. Yearly ($55/$77) matches
  everywhere already.
- **E-02 ✅** (2026-10-16) Her note: remove "Daily Synthesis", it repeats the
  in-app Daily Reading and she prefers that formatting. The
  `✨ Your Daily Synthesis` overview block is out of the paid daily email;
  Personal Reading, Maximize/Focus/Watch and Collective Reading stay, or a
  paid subscriber would receive an email containing no reading. See
  STATUS.md 2026-10-16 if she meant the whole block.
- **Free trial question (F-01):** her call; none implemented.
- **Onboarding emails name points the app now hides (new, found 2026-10-13).**
  UX-02 made Angles, Lunar Nodes, Black Moon Lilith, Arabic Lots and Asteroids
  default OFF so a beginner's first chart is clean. Both onboarding emails
  still list every point in their house sections: the welcome email's "Your
  twelve houses" ("Part of Necessity lives here") and the chart recap's "Your
  Houses, House by House" ("Part of Fortune in Pisces"). A new user's first
  two emails therefore name terms that appear nowhere in their app and that
  her own house copy never defines. Options: (1) filter both sections to the
  ten classic planets (recommended, ~2 lines per function, one deploy each);
  (2) keep as-is as a teaser for what the toggles unlock; (3) filter the
  welcome email only and leave the recap exhaustive. Her copy, her call.
- **Em dashes in static email copy ✅** (resolved 2026-10-16: yes, remove them.
  All three in the welcome email are gone.) AI-04 strips
  dashes from AI output only. The welcome email's subject, body and footer
  carry three em dashes that are verbatim Base44 copy she wrote herself.
  Ask whether the no-dash rule extends to hand-written copy; if yes it's a
  sweep across the email templates, not a code change.

## C. P0 batch — data accuracy (her #1 priority) — ✅ DONE 2026-10-11, deployed + verified

Root causes and fixes (all verified against live output):
- **B-18**: ingress "recent/approaching" windows were DEGREE-based (3°) — for
  Neptune that's ~18 months, so old ingresses showed as current news daily.
  Now TIME-based (±14 days, with entered/expected dates). Verified: today's
  ingress list is empty instead of carrying Neptune→Aries.
- **B-14**: both calendar surfaces (Google sync + ICS feed) shipped their own
  "simplified VSOP-like" ephemeris from Base44 — Pluto a whole sign off. Both
  now pull every day from chart-calculator via _shared/calendarDays.ts (same
  Swiss-Ephemeris pipeline as the app; ephemeris_cache keeps it cheap; per-day
  fault tolerance; partial window on provider rate-limit instead of a 500).
  Verified in feed output: Venus in Scorpio ℞, Pluto (stations direct) in
  Aquarius.
- **C-02**: mundane event text now a one-line plain meaning per aspect pair —
  no orb, no "collective aspect affecting everyone", no em dashes (AI-04).
  Natal transit events unchanged (good per Molly).
- **Bonus — B-16 done early**: journal entries removed from BOTH the Google
  sync and the ICS feed (privacy: calendars get shared; journals don't).

## C-old. (superseded by the DONE block above)

- **B-18 Planetary highlights stale** (Neptune→Aries as "current"): highlights
  not filtered/keyed to today; likely shares root with B-14. Wire to the same
  chart-calculator/astrology-API data the rest of the app uses.
- **B-14 calendar sync wrong positions** (Pluto in Capricorn): same fix in
  sync-astro-to-calendar — she confirms Base44 was equally wrong, so this is
  sanctioned beyond-parity work.
- **C-02 mundane transit text** in calendar events: replace "collective aspect
  affecting everyone + orb" with a short definition — same code path as B-14.

## D. P0 batch — store blockers / layout — ✅ DONE 2026-10-12 (uncommitted; server pieces deployed)

- **B-01 ✅** app icon: full padded emblem, opaque 1024×1024.
- **B-02 ✅** tradition confirm dialog portaled to `document.body` (ancestor
  backdrop-filter trapped the fixed overlay).
- **B-09/B-10 ✅** add/edit chart sheets: z-[10010] above the nav (z-[9999]) +
  safe-area bottom padding.
- **UX-01 ✅** `ZodiacHousesSelector` replaces the unlabeled 3-icon
  TraditionSelector: two labeled settings (Zodiac Tropical/Sidereal · Houses
  Whole Sign default/Placidus) with Molly's tooltip copy; tradition derived
  from the pair, any combination valid. Sidereal is live (engine supports it)
  with a `HIDE_SIDEREAL` flag ready if Molly wants it held back (her
  "Tropical only at launch" predates knowing the engine does sidereal).
- **B-19 ✅** plan page shows the real paid tier, editable (earlier batch) —
  and now opens the same PlanSelection flow as onboarding (F-01).
- **F-01 follow-up (2026-10-12, post-build-4)**: killing the app mid-onboarding
  used to skip everything after chart creation (incl. the plan slide) because
  Home routes by chart-existence. Onboarding now writes a per-user resume
  marker (localStorage) for the email/plan/confirmation steps; Home routes
  back into onboarding while it's set. Ships in build 5.
- **F-01 ✅** plan selection inside onboarding: new shared
  `components/plans/PlanSelection.jsx` (Molly's final copy: billing toggle,
  Free/Core/Premium cards, fine print, restore link) used by a new onboarding
  `plan` step + "You're in." confirmation slide AND by Subscribe.jsx — one
  flow everywhere, platform-routed checkout unchanged. Free-trial question
  still open (§B) — none implemented.
- **PF-04 ✅ root-caused**: not a client bug — NO scheduled job had EVER run
  (vault secrets mis-seeded, cron silently no-oped), so every first open of
  the day generated live. Client cache verified correct. Fix needs one Tony
  command (STATUS.md "Tony to run") because secret-store writes are blocked
  for Claude; also discovered `edge_service_key` must be the NEW sb_secret
  key (runtime injects it; legacy JWT fails isServiceRole).
- **PF-03 ✅**: interpretations persist per account (calendar_synthesis,
  period_type `interpretation`, param-hash keys that self-invalidate on
  birth-data edits) in InterpretationDrawer + NatalInterpretation; new
  `pre-generate-interpretations` function + 10-min cron pre-generates the
  classic 10 placements + 12 houses per chart. Key parity client↔server
  verified 8/8; all existing charts back-filled manually.

## E. P1 batch — bugs — ✅ DONE 2026-10-12 (client uncommitted; server deployed)

Root causes, several different from what the report assumed:

- **B-20 ✅** one missing CSS class: the screenshot dropzone `<label>` had no
  `relative`, so its invisible `absolute inset-0` file input stretched over the
  whole form — tapping Subject actually hit the file input. Added `relative`.
- **B-03 + P-01 ✅** the save button called `<a download>` with a data: URL,
  which WKWebView ignores — it could never have worked in the app. Native now
  writes the PNG to the app cache and opens the system share sheet (Save Image
  → Photos, or send straight to Messages/Instagram); web keeps the download.
  Added `@capacitor/share` + `@capacitor/filesystem` and
  `NSPhotoLibraryAddUsageDescription` to Info.plist. Button reads "Save or
  Share" on native; a cancelled sheet is not treated as an error.
- **B-05/B-06 ✅** two real causes: (1) SERVER — `apprentice_correct_total`
  and `_questions_total` were gated behind "is this a new day", so a second
  quiz the same day moved nothing (Molly's row proves it: `total_answered` 10
  but `apprentice_questions_total` 5). Accuracy now counts every answered
  question; only the quiz-DAY counter stays daily. (2) CLIENT — the
  UserProgress record was fetched once at boot and never refreshed; added
  `reloadProgress()` to AuthContext, pushed quiz results into the shared
  record, and refresh on Home. Labels now say "quiz days", not "quizzes",
  which is what the counter actually measures.
- **B-07 ✅✅** the curriculum summary read only `raw.ascendant_sign` and
  silently degraded to "your rising sign"; now falls back through
  `chart.ascendant_sign` / `angles.ascendant.sign` (and shows none when the
  birth time is unknown).
  **Reopened and re-fixed 2026-10-16:** that fix landed in `DaySynthesis.jsx`
  only. The Learn curriculum (`PlacementSlide.jsx`) is a second surface with
  the same single-source read, and rendered a DASH for the rising sign on
  every chart in the project. Molly was right to call this still failing.
  See FEEDBACK_ROUND2.md §B.
- **B-08 ✅** the starfield canvas sized its bitmap from `window.innerWidth`,
  which diverges from the visual viewport on iOS and doesn't fire `resize` —
  the uncovered strip showed the parent's flat navy as a dark column. Now
  sized from `visualViewport` with a matching listener, CSS box pinned 100%.
- **B-11 ✅** `--app-font-scale` only rescales the root rem, but the app is
  written in px-literal Tailwind classes (`text-[10px]` ×416, etc.) which
  ignore it. Converted every px text/leading literal to rem across 132 files,
  so the text-size setting now reaches interpretation cards and planner text.
  **Reported still failing 2026-10-16; investigated and the conversion is
  sound** — no px literals remain in the interpretation chain and the root
  scales correctly. Her `font_scale` is 1.1, and 10% of an 11px body is
  1.1px, i.e. invisible. The real problem was the base size, so the six
  interpretation bodies went to 14px. See FEEDBACK_ROUND2.md §B.
- **B-12 ✅** most interpretation surfaces rendered LLM markdown as one plain
  `<p>`, so "### 🔍 Themes to Explore" showed as body text. New shared
  `InterpretationMarkdown` (markdown + gold astro-term highlighting) now used
  by the chart/transit/mundane/synastry/planner surfaces; it also promotes a
  header the model emitted without its `###` prefix.
- **B-15 ✅** not a partner-chart leak — `SavedChart` never reaches the
  calendar functions. Both read `Chart.filter(...)` and took `charts[0]` with
  no ordering, so a user with more than one chart row could sync a stale one.
  Both now order `-created_date`, matching what the app displays.
- **B-17 ✅** Google renders descriptions as HTML and collapses bare newlines
  (one run-on blob); events now get a bold title line, body, and footer joined
  with `<br>`. ICS was structured already but emitted unfolded lines — added
  RFC 5545 75-octet folding that never splits a multi-byte glyph. Verified
  live: 265 events, 1571 folded continuations, all lines valid UTF-8.
- **B-04 ✅** the bonus round is NOT LLM-generated (no prompt to fix) — it's a
  deterministic template. The aspect question labelled every option with its
  own aspect name ("Trine — flowing harmony…") so the answer announced itself;
  options are now meanings only, plus a `leaksSubject()` guard that drops any
  question whose choices contain the term being asked about.
- **B-13 ✅** (resolved 2026-10-16, unblocked by her round-2 screenshot).
  She reported the same defect on the My Chart aspect card as **B-21** and
  guessed it was one shared component. It is: Planner and My Chart both reach
  `ChartSelectionInfo` through `ChartWheel`. `PillShell`'s action column was a
  `shrink-0` flex sibling, reserving ~90px down the whole card height for a
  button occupying the top 40px. Floated it; one fix closed both.
  See FEEDBACK_ROUND2.md §B.

## E-old. (superseded by the DONE block above)

- B-03 share-card download does nothing + **P-01** photo-library permission
  (add NSPhotoLibraryAddUsageDescription + save flow).
- B-04 bonus-round answers leak the asked term (pairs with AI-02 prompt fix).
- B-05/B-06 Apprentice/quiz progress bars don't update (data wiring).
- B-07 curriculum end summary omits Rising even when known.
- B-08 intermittent dark column down right edge (screenshot in doc).
- B-11 text-size setting should apply app-wide (incl. interpretation cards).
- B-12 generated interpretations missing header styling (markdown rendering
  of LLM output; pairs with AI-04 em-dash cleanup).
- B-13 planner transit card blank right side.
- B-15/B-16 partner charts + journal entries leak into calendar sync — Jacob's
  completion pass touched calendar privacy; verify against current build, fix
  remainder. Privacy-sensitive: treat as P0-adjacent.
- B-17 synced event descriptions unformatted.
- B-20 feedback form: Subject field forces photo upload.

## F. P1 batch — UX polish — ✅ DONE 2026-10-12

- **UX-02 ✅** chart display points now default OFF. The DB had all five
  `show_*` columns `default true` and the client was split (asteroids/lots
  already off-by-default, angles/nodes/Lilith on), so the settings screen and
  the wheels disagreed. Migration flips the column defaults; client reads are
  normalized to `=== true`. Also fixed a latent bug: Profile's wheel checked
  `show_pof`, which is not a column, so Part of Fortune ignored the Lots
  toggle there. **Existing rows are deliberately NOT reset** — see the
  migration for the one-liner if Molly wants beta accounts flipped too.
- **UX-03 ✅** the full tour's Profile stop now calls out the three things
  people were missing: Plan, Zodiac & Houses, and the chart display toggles.
  Note: the anchored first-visit tooltip tour only works on /home, so these
  went into the page-by-page tour rather than as anchored bubbles.
- **UX-04 ✅** the highlight helpers defaulted to `text-white`, so every
  surface that didn't pass a colour rendered tappable terms as plain body
  text (hence "Moon" gold but Part of Fortune/Aries/square/Cancer not — the
  gold one came from a different code path). Gold is now the default, and
  Home's transit list gets the same tap handler the Planner's already had.
- **UX-05 ✅** Regenerate, thumbs up/down and Save removed from the Daily
  Synthesis; "Explain it" and "Share" stay. The SynthesisRating writes went
  with them (nothing read them back).
- **UX-06 ✅** "I don't know — learn this" now carries a return address, so
  Back from the curriculum goes straight back to the quiz instead of walking
  through the module's earlier slides.
- **UX-07 ✅** the "Save to Home Screen" tip and its body are gone.
- **UX-08 ✅** the whole notification tip card is the tap target now.

## F-old. (superseded by the DONE block above)

- UX-02 chart toggles default off · UX-03 tooltip tour should point at plan,
  Houses setting, display toggles · UX-04 tappable terms highlighted gold
  everywhere · UX-05 remove Regenerate/thumbs/Save from Daily Synthesis ·
  UX-06 quiz "learn this" Back returns to quiz · UX-07 remove "Save to home
  screen" tip (web holdover) · UX-08 whole tip cards tappable.

## G. P1/P2 — AI + content + email — ✅ DONE 2026-10-12 (AI-02 n/a)

- **AI-04 ✅** Molly's five style rules are now a `STYLE_RULES` block inside
  the shared PERSONA, so all 31 registry tasks inherit them, plus the two
  local PERSONA copies (daySynthesisGenerator, generate-calendar-synthesis).
  Em/en dashes are also stripped centrally in `_shared/llm.ts` — every
  function's output passes through `invokeLLM`, including structured JSON
  (string leaves are scrubbed recursively), because models reach for dashes
  however firmly the prompt says not to. Verified live: a fresh generation
  came back with zero dashes.
- **AI-01 ✅** the share card now gets its own ≤200-char `summary` field from
  the LLM, hard-trimmed server-side at a sentence/word break, and the image
  renders that instead of the overflowing bullet list (the copied text keeps
  the bullets). Pre-AI-01 cache rows regenerate because the cache gate now
  requires a summary. Verified live: 187 chars.
- **AI-03 / F-02 ✅** the daily quiz now asks about real transits to YOUR
  chart. The function never computed transit-to-natal aspects at all — its
  `mundaneAspects` is transit×transit despite the field names — so no
  generator could reference one. Added that computation plus three
  generators (aspect meaning, natal planet theme, natal house area), offered
  ahead of the generic sign/element trivia.
- **AI-02 — not applicable**: see B-04 in §E. The bonus round is a
  deterministic template, not an LLM prompt; fixed as a code change.
- **E-01 ✅** the welcome email gained a "Your twelve houses" section using
  Molly's copy deck: one line per house plus a personalized line from the
  user's own chart (their house system, their planets), skipped entirely for
  unknown birth times.
- **F-03 ✅** new Journal history panel in the Planner day view: every past
  entry by date, expandable in place, with a link to open that day.

## G-old. (superseded by the DONE block above)

- AI-01 share-card: generate a separate ~200-char summary.
- AI-02 bonus-round: definitions only + reject choices containing the term.
- AI-03/F-02 home quiz built from today's transits vs natal (prompt exists in
  llm_tasks; redirect the quiz source).
- AI-04 style rules → add to every prompt (PERSONA/tone directive is shared —
  one change covers most tasks) + em-dash post-processing.
- E-01 welcome email: add the 12-house section (copy + template in her doc).
- F-03 journal history list (P1; small page).

## H. P1 batch — remaining performance — ✅ DONE 2026-10-13

These two were never triaged into batches D–G; found when re-reading Molly's
PDF against the tracker.

- **PF-01 ✅ (second half)** the first half was already covered by PF-03's
  pre-generation job (10 classic planets + 12 houses per chart, 10-min cron).
  The missing half: generating a point the moment its Chart Display toggle is
  switched on. UX-02 made all five toggles default OFF, so every extra point
  was a first-tap wait. `lib/chartPointWarmup.js` now warms exactly the
  readings a toggle reveals, firing from ChartDisplaySettings' save. It
  mirrors MyChart's item/context shapes so the hash matches what the card
  will ask for (planets get the house-stripped `wheelData`, nodes get `raw`),
  skips points the chart doesn't carry, and no-ops for non-Core accounts,
  which see a paywall on those cards rather than text. `show_angles` warms
  nothing — the angles row is a degree readout, not an interpretable card.
  Verified against a real chart: asteroids warms Chiron/Pallas/Juno/Vesta/
  Tyche and skips Ceres/Hygiea/Eris (not produced by the engine), lots 4,
  nodes 2, Lilith 1.
- **PF-02 ✅** the partner's own chart was already computed and stored at save
  time, so that half was done. The actual cost was `SynastryView` calling
  `chartCalculator` with `chart_type: 'synastry'` on EVERY mount and every
  partner switch — a full two-chart calculation plus cross-aspects, never
  cached. Now cached per (user, partner) in CalendarSynthesis under
  `period_type: 'synastry'`, keyed by a hash of both charts' birth inputs +
  house system, so editing either chart's birth data misses and recalculates
  with no explicit invalidation. Added in-flight de-duplication (a remount
  joins the running call) and `warmSynastry` on SavedChart create/update, so
  the first open is warm too. `saveCachedSynthesis` gained a `description`
  override so this payload isn't stored twice (once as jsonb, once as a JSON
  string).
- **PF-02 follow-on — the relationship reading** ("investigate other caching"
  in her row). `SynastrySynthesis` had a variable named `cacheKey` that was
  only a useEffect dependency: nothing was stored, so every mount regenerated
  the whole LLM reading ("Synthesizing your connection..."). Now persisted
  under `period_type: 'synastry_synthesis'`, keyed by a hash of the exact
  params sent to the model. Fixing only the chart calculation would have left
  the wait she actually reported.
- **Bug found while testing**: the first cut hashed only top-level keys, but
  `birth_location` is an object and Postgres `jsonb` does not preserve key
  order — so a partner warmed on save hashed the calculator's key order while
  the view hashed jsonb's, missed its own cache entry, and wrote a second row
  per partner. Hash now sorts at every depth. Caught only because Tony opened
  a comparison he'd been asked not to; with one row the test would have
  passed and shipped a cache that never hit.

## I. Found during testing — not in Molly's doc

- **Tab refocus reset every page's state ✅ fixed 2026-10-14.** Switching away
  from the app and back returned you to the default tab (reported on the
  Relationship view, but it hit every page: the planner's date, open drawers,
  scroll position). Chain: `@supabase/auth-js@2.110.8` registers a
  `visibilitychange` handler (GoTrueClient.js:4642) that calls
  `_recoverAndRefresh()`, which emits **SIGNED_IN even when the session is
  unchanged** (:4085, in the branch whose own comment says there is nothing to
  persist). AuthContext treated that as a real sign-in, re-ran checkUserAuth,
  flipped `isLoadingAuth`, and App.jsx swapped the entire routed tree for a
  full-screen spinner — unmounting the current page. It also fired auth.me()
  plus a UserProgress fetch on every refocus. Fix: SIGNED_IN refreshes
  silently once a user is loaded (ref, not state — the listener closes over
  its first render), and a silent check that fails on anything other than
  401/403 leaves the session alone so a network blip can't sign the user out
  without explanation. Worth its own ID in Molly's round 2.
- **...and the follow-on: refocus scrolled the page to the top.** With the
  tree no longer torn down, a second cause surfaced. `checkUserAuth` published
  a freshly-built user object every time, and eight components depend on
  `[user]` rather than `[user?.id]` (MyChart, Planner ×2, Learn,
  DailyQuizCard, FontSizeControl, Contribute, Admin). The new identity re-ran
  their loaders, which flip a page-level `loading` flag — the tall content
  unmounts, the browser clamps scroll to 0, and the content returns with the
  page at the top. Fixed at the source rather than in eight dependency
  arrays: AuthContext now keeps the SAME user object when a re-read is
  byte-identical (same for the progress record), so a quiet refresh really is
  quiet. `reloadUser`, sign-out and logout keep that ref in step. The `[user]`
  deps are now harmless but still imprecise — worth tightening to `[user?.id]`
  if anyone touches those files.

## Scope flag (Tony)

This round mixes parity bugs (ours under the migration) with new product work
(F-01 onboarding checkout, UX-01 redesign, AI prompt changes, E-01, F-02/03 —
and B-14/B-18 fixing things broken in Base44 too). The fixed-scope agreement
was replica-parity; worth a friendly line to Molly distinguishing "migration
fixes" from "Round 1 product improvements" before absorbing it silently.

## Suggested order (freeze Oct 14 → demo Nov 13)

1. Data-accuracy P0s (C) — her top priority, shared root, server-side only.
2. Store blockers (D): icon, z-index/layout trio, B-19 wiring; F-01 onboarding
   selection last (biggest new surface).
3. PF-03/04 persistence.
4. Decision items (B) to Molly today — C-01 especially, it gates the plan page.
5. P1 bug batch (E), then UX polish (F), then AI/content (G) — post-freeze OK
   per her own rule (non-essential → P2).
