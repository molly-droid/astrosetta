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
- **E-02:** placeholder — Molly's Daily Digest notes still to come.
- **Free trial question (F-01):** her call; none implemented.

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

## D. P0 batch — store blockers / layout

- **B-01 app icon overflows frame** — rescale artwork with padding (asset fix).
- **B-02 tradition confirm dialog behind Chart Display card** (z-index).
- **B-09/B-10 add/edit chart hidden behind bottom nav** (same overlay class as
  the safe-area fixes we shipped — bottom inset this time).
- **UX-01 zodiac/houses split** — her decision table is in the doc: two labeled
  settings, Zodiac (Tropical only at launch) + Houses (Whole Sign default /
  Placidus), tooltip copy provided. Replaces the unlabeled 3-icon selector.
  NOTE: the app already HAS Vedic/sidereal via the tradition engine — her
  "Tropical only at launch, Sidereal comes later" may be out of date; confirm
  whether to hide or keep Vedic.
- **B-19 + F-01 (P0): plan management + onboarding plan selection.** B-19 (My
  Info → Plan opens the plan/upgrade flow) is mostly wiring to the existing
  Subscribe screen. F-01 (plan choice INSIDE onboarding, full spec + copy in
  her doc) is the one genuinely new pre-freeze feature.
- **PF-03/PF-04 (P0): persist interpretations + daily reading.** PF-04: daily
  reading IS server-cached (day-v20) — reproduce "reloads after a while"
  (suspect: client cache or knowledge-depth key change). PF-03: save generated
  Placements/Houses/Aspects/Dynamics interpretations per account (new
  persistence), pre-generate Placements+Houses in background at account
  creation/upgrade.

## E. P1 batch — bugs

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

## F. P1 batch — UX polish

- UX-02 chart toggles default off · UX-03 tooltip tour should point at plan,
  Houses setting, display toggles · UX-04 tappable terms highlighted gold
  everywhere · UX-05 remove Regenerate/thumbs/Save from Daily Synthesis ·
  UX-06 quiz "learn this" Back returns to quiz · UX-07 remove "Save to home
  screen" tip (web holdover) · UX-08 whole tip cards tappable.

## G. P1/P2 — AI + content + email

- AI-01 share-card: generate a separate ~200-char summary.
- AI-02 bonus-round: definitions only + reject choices containing the term.
- AI-03/F-02 home quiz built from today's transits vs natal (prompt exists in
  llm_tasks; redirect the quiz source).
- AI-04 style rules → add to every prompt (PERSONA/tone directive is shared —
  one change covers most tasks) + em-dash post-processing.
- E-01 welcome email: add the 12-house section (copy + template in her doc).
- F-03 journal history list (P1; small page).

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
