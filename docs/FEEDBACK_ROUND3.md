# Molly's TestFlight feedback — Round 3 triage

Source: the same artifact ("Astrosetta — TestFlight Updates for Jacob",
shared with admin@silexdev.com only), exported to PDF 2026-10-22 (37 pages;
round-2 export was 32). Her round log: *"Round 3 — New: B-28, B-29 (Oct 21
testing; in progress)."* Two more items (B-27, E-03) were added the evening
of Oct 16 — AFTER the export round 2 was triaged from — so they appear here
for the first time. She flags B-27/E-03 and B-29 as launch blockers.

She tested build 9/10 (B-29 describes real gating, so build 10 was in play
by Oct 21).

---

## B-27 (P0) + E-03 (P0) — sign-up email confirmation is broken for new users

"New-email sign-up sends Supabase's default 'Confirm your email address'
email (sender: Supabase Auth), and the flow can't be completed from it. New
users are stuck."

→ REAL, and worse than cosmetic: the confirmation link redirects to the
Supabase-default site URL, which never lands the user back in the native
app (and the web target is Base44's domain until cutover). We never hit it
because every internal account was dashboard-created with Auto Confirm.
**This should be fixed BEFORE App Store submission** — a reviewer who tries
creating an account instead of using the demo credentials hits a dead end
(guideline 2.1 rejection material).

Her two options, assessed:
- **(a) 6-digit code typed in the app — RECOMMENDED.** Supabase supports
  email OTP verification natively; no redirect, no deep link, works
  identically on native and web, and matches the pre-created-accounts
  cutover flow (reset/magic-link) problem space.
- (b) Deep-link redirect (`astrosetta://…` + universal links at cutover) —
  workable but fragile pre-cutover and platform-dependent.
- **E-03 (applies either way):** custom SMTP so auth emails come from our
  domain with branded templates, not "Supabase Auth" (rate-limited,
  not production-grade). The send-email Edge Function already sends via
  Resend from the astrosetta domain — the same Resend account can back
  Supabase SMTP. NOTE: our current RESEND_API_KEY is send-only restricted;
  creating SMTP credentials may need Molly's Resend dashboard access.
  Supabase email templates (subject/body) are settable via the management
  API.

## B-28 (P0) — Today's reading repeats day after day, and re-types on every open

"Same reading repeats day after day instead of reflecting each day's
transits. It also re-types itself on screen every time it's opened.
Calendar sync readings look correctly day-specific."

→ NOT YET INVESTIGATED. Two distinct defects implied:
1. **Stale content across days** — server data is provably day-specific
   (pre-gen writes distinct `day-v20-<date>-<depth>` rows per day; her
   calendar events differ per day), so suspicion falls on the client:
   the localStorage layer in `synthesisCache.js`, or the Today surface
   resolving its date once and caching it. Repro per her steps: open
   Planner → Today on two different days.
2. **Re-typing animation on cached content** — the PF-06 streaming
   renderer should only animate a LIVE stream; content served from cache
   must render instantly. Likely the streaming path runs regardless of
   cache hit.

## B-29 (P0) — Premium purchased but not recognized

"Subscribed to Premium, but the app doesn't recognize it: Navigator asks to
upgrade to Core, choosing another chart asks to upgrade too. Upgrade screen
sits on 'Processing…' while Apple says 'You're currently subscribed'."

→ **ROOT CAUSE FOUND AND FIXED 2026-10-22.** The ASC subscription group
ranked Core ABOVE Premium (levels 1–4 in a line), so Apple treated
Core→Premium as a *downgrade* and silently deferred it to the next renewal
(`auto_renewal_status: will_change_product` on her RevenueCat record). The
server tracked Apple correctly — she stayed Core while believing she was
Premium; her deferred change completed 07:47Z Oct 22 and she is Premium
now. Fixed via ASC API: Premium monthly+yearly = level 1, Core = level 2;
upgrades now apply immediately with proration. (The group was locked by the
draft review submission's items — emptied; re-attach the four subs at
submission, flagged in APP_STORE_SUBMISSION.md.)

Residuals to do:
- The "Processing…" hang: `PlanSelection` polls ~7.5s for the tier to flip
  then stalls without a message. Now rare (upgrades immediate), but handle
  the timeout/pending case with honest copy ("your plan change is
  processing — it can take a minute").
- Her "one check from the active subscription for every gated feature" is
  effectively our architecture already (billing_snapshots → projected
  tier); the failure was upstream at Apple. Her "upgrade to Core" prompts
  likely occurred in sandbox expiry gaps (TestFlight subs cycle daily),
  worth confirming on her next pass.

## C-01 — now carries her decision, and it conflicts with the stores

Her row: plan page shows "$5.59 and $7.79" → change to "Core $5.55/mo or
$55/yr · Premium $7.77/mo or $77/yr" (P0).

→ DO NOT apply as written on native. Apple/Google price points are
$5.59/$7.79 and native copy must match the purchase sheet (App Review
rejection class — the RC build just scrubbed exactly this). Web already
shows $5.55/$7.77. Needs a reply to her, not silent action: native shows
the store's real localized price by design (hers would show CAD on her
phone); web keeps founding $5.55/$7.77.

## Also in the doc, not new work

- Screenshot checklist updated (B-01/02/08/09/10/12 checked off).
- B-22 gained a note to verify the Sun→Scorpio ingress date (fixed and
  verified 2026-10-17 — the fix ships in build 8+, she tested build 7 when
  writing it).
- Rounds 1–2 statuses unchanged otherwise; B-07/B-11/B-13/B-21 fixes await
  her retest on build 9/10.

## Sequencing

1. **B-27/E-03** — before store submission (new-user flow must work for
   review). OTP verification + Resend SMTP + branded templates.
2. **B-28** — investigate next; P0 for the demo, likely small client fix.
3. **B-29** — done; retest on her next pass + add the pending-state copy.
4. **C-01** — reply to Molly with the native-constraint explanation.
