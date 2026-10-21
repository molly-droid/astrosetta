# App Store submission — checklist and draft copy

Plan (Tony, 2026-10-20): submit now, get approved, THEN do the cutover.
App Store Connect supports this directly: choose **"Manually release this
version"** at submission, and the approved app sits unreleased until we
press Release on cutover day.

RC build: **1.0 (10)** — gating live (`GATING_ADMIN_ONLY=false` client-side),
price-free native teaser CTAs / store-priced plan cards, B-26, deletion
dead-end Log out fix. Built from commit (fill in after commit).

---

## 1. Code state in the RC build (done)

- [x] `GATING_ADMIN_ONLY = false` in `permissions.js` — reviewers (and launch
      users) see real tiers and paywalls. Server mirror in `llm_tasks/core.ts`
      stays true until cutover deploy (server-lenient is invisible).
- [x] No hardcoded web prices on native: teaser CTAs ("Unlock Core") are
      price-free on native via `CORE_CTA_LABEL`; UpgradeTab + Profile plan
      cards show the store's live localized price; PaywallModal already did.
      Web copy unchanged ($5.55/$7.77 founding).
- [x] `ITSAppUsesNonExemptEncryption=false` already in Info.plist (no
      export-compliance prompt).
- [x] Account deletion in-app (Apple 5.1.1(v)) — E2E verified 2026-10-19.

## 2. TestFlight heads-up (tell Molly BEFORE she opens build 10)

Build 10 enforces real tiers: her tester account will see paywalls for the
first time. TestFlight purchases are sandbox (no real money) — subscribing
in-app restores full access and is itself the first real test of the paid
experience. Admin accounts are unaffected.

## 3. ASC version page (Tony/Molly, in the browser)

- [ ] App Store → create version **1.0** if not present; select **build 10**
- [ ] **Release option: Manually release this version** ← the whole plan
- [ ] **Screenshots — MOLLY** (decided 2026-10-20): 6.9" (1320×2868)
      required; 6.5" optional. Suggested set: Home (reading + gauges),
      Chart wheel, Planner day view, Learn/quiz, Practitioner's Lens.
      iPhone 16 Pro Max simulator or device.
- [ ] **Description / subtitle / keywords / promotional text — MOLLY**;
      §5 below is a starting draft she can rewrite or discard
- [ ] Support URL (astrosetta.com contact page) and Privacy Policy URL —
      must be LIVE URLs; today they resolve to the Base44 site, which is
      fine (same product, policy pages already exist there — confirm paths)
- [ ] App Privacy questionnaire — guide in §6
- [ ] Age rating questionnaire — nothing applies; lands at 4+
- [ ] Category: Lifestyle (primary), Education (secondary)
- [ ] Price: Free (with in-app purchases)
- [ ] **App Review Information**: sign-in required ✓,
      apple.review@silexdev.com + password; notes draft in §7
- [ ] **In-App Purchases: attach all four subscriptions to the version**
      (first submission must carry them). Each sub needs its localization
      (display name + description) and a **review screenshot** (B-25: a
      screenshot of the paywall/plan screen is acceptable); subscription
      GROUP also needs a localization ("Astrosetta").

## 4. After approval (do NOT release)

Approved-but-unreleased is the parking state. Release on cutover day, after
DNS points astrosetta.com at our web app (the binary links account-deletion
emails and portal returns there) and the server gating flip deploys.

## 5. Draft listing copy (starting point for Molly — she owns the final text)

**Subtitle (≤30 chars):** `Learn the sky. Live your chart.`

**Promotional text (≤170 chars):**
Your natal chart, daily readings written for your sky, and a learning
curriculum that turns you into the astrologer. Start free.

**Description (draft):**

Astrosetta is astrology you learn, not just consume. Your natal chart is
the textbook; the live sky is the lesson plan.

YOUR CHART, FULLY DRAWN
Interactive natal wheel with placements, houses, aspects and dynamics.
Big Three deep-dives free for everyone.

READINGS FOR YOUR SKY
Daily, weekly and monthly readings generated from the real positions of
the planets against your chart — not sun-sign boilerplate.

A PLANNER THAT KNOWS THE SKY
Day, week and month views of upcoming transits, stations, ingresses and
lunations. Sync them to Google Calendar or any calendar app.

LEARN AS YOU GO
A full curriculum from Apprentice to Maestro, a daily quiz tuned to the
actual sky, and the Practitioner's Lens — a daily deep-dive unlocked by
learning.

ASK THE NAVIGATOR
A chart-aware guide for the questions your chart raises.

GO DEEPER WITH PREMIUM
Black Moon Lilith and the asteroid pack (Juno, Pallas, Vesta, Tyche) with
placements, transits and interpretations.

Start free: your chart, Big Three interpretations, the transit list, the
full curriculum, the daily quiz and a journal. Core and Premium
subscriptions unlock interpretations everywhere, the planner, calendar
sync and the Navigator. Founding members lock in their rate.

**Keywords (≤100 chars):**
`astrology,natal chart,birth chart,horoscope,transits,moon,zodiac,learn astrology,planner,synastry`

## 6. App Privacy questionnaire (answers reflect the actual code)

Collected, linked to identity, NOT used for tracking (no ads, no third-party
ad SDKs):
- Contact info: email address (account), name (optional profile)
- User content: birth date/time/place and journal entries ("Other user
  content"), feedback
- Identifiers: user ID
- Purchases: purchase history (RevenueCat)
- Usage data: product interaction (first-party analytics events)

NOT collected: precise location (birth location is user-entered, not device
GPS), contacts, photos (share cards are generated, saving requires the
user's explicit share action), browsing history, advertising data.
"Data used to track you": none.

## 7. App Review notes (paste into App Review Information)

Demo account: apple.review@silexdev.com / [password]. The account is a
standard free account; subscriptions can be tested with a sandbox purchase
from the Plan screen (Profile → Membership) or any Unlock prompt.
Account deletion: Profile → Security & Privacy → Delete Account. Deletion
is confirmed via an emailed link to the account's address (24h expiry) —
the in-app flow completes with "Check your inbox."
Google Calendar sync (Core feature) uses Google OAuth in the system
browser and returns to the app; any Google account works. Optional.

## 8. Known-acceptable at submission

- Web app not yet at astrosetta.com (cutover follows approval; manual
  release holds the app until then). The deletion confirm email links to
  astrosetta.com — not exercisable by the reviewer (demo inbox is not
  monitored) and live by release day.
- Molly's round-2/3 polish continues on TestFlight; a rejected binary can
  be replaced with a later build number without losing metadata.
