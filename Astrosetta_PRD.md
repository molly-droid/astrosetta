# Product Requirements Document: Astrosetta

## 1. Executive Summary

**Mission:** To provide a multi-platform, transit-responsive astrology ecosystem that blends professional-grade astronomical calculations with personalized, educational synthesis. The platform transforms astrology from a static horoscope into a dynamic, XP-driven personal journey — available on web, iOS, and Android.

---

## 2. Core Platform Capabilities

### A. Astrological Engine
- **Precision Calculation:** Standardized Swiss Ephemeris-based calculations (via `chartCalculator`) for planetary longitudes, house cusps, and angles.
- **Transit-Responsive System:** Real-time calculation of planetary transits (mundane), sign ingresses, and retrograde/direct stations relative to a user's unique natal chart.
- **Synastry & Interpersonal Analysis:** Cross-chart aspect detection, house overlays, and specialized interpretation of relationship dynamics.
- **Dynamic Synthesis:** DB-backed caching system for astrological synthesis, using a queue-based `preGenerateSynthesis` process for near-instant reads.

### B. Educational & Personal Journey
- **Foundational Curriculum:** A modular learning system (`LearningModule`) organized by section (foundations, planets, signs, etc.), rewarding users with XP for completing blocks and quizzes.
- **Daily Progression:** Interactive `DailyQuiz` engine with adaptive difficulty and consecutive streak tracking (`UserProgress`) to encourage habitual learning.
- **Personalized Insights:** Synthesis quality is tracked via `LLMUsageLog`, featuring personalized transit-to-natal interpretations.

### C. Planner & Calendar Integration
- **Visual Planner:** Integrated day/week/month views with dynamic phase-specific themes and ring-style solar return highlighting.
- **Calendar Sync:** `syncAstroToCalendar` connector (Google Calendar integration) projects personal sky events into external scheduling tools.
- **Interactive Wheel:** A custom, canvas/SVG-based `ChartWheel` for interactively exploring chart metrics.

### D. Communication & Engagement
- **System Emails:** Automated digest system (`sendDailyEmail`, `sendWeeklyEmail`, `sendMonthlyEmail`) with post-processed unicode-glyph highlighting (gold/white variants) and personalized transit alerts.
- **Navigator AI:** Evergreen agent (`chart_navigator`) acting as an in-app consultant for real-time questions about chart placement and transit mechanics.
- **Spotlight System:** Feature-awareness tool (`spotlightUtils`) guiding users through platform updates (new synastry features, interactive wheel capabilities, etc.).

---

## 3. Data Model Overview
- **Chart/SavedChart:** Birth data, raw calculation results, and derived placements.
- **Synthesis/Interpretation:** DB-backed objects ensuring consistent, high-quality readings; includes rating/bookmarking functionality.
- **UserProgress:** Tracks tiers (Apprentice → Adept → Maestro), streaks, and curriculum completion metrics.
- **Feedback/ErrorLog:** Administrative back-channel for MVP testing, bug reporting, and roadmap tracking.
- **Entitlement:** *(new)* Single source of truth for a user's active tier (`Interpret`, `Calendar`), reconciled across web (Stripe) and mobile (RevenueCat) purchase paths.

---

## 4. Technical Architecture

Astrosetta is migrating off Base44 to a Claude-Code-managed, standard web/mobile stack. Target end state: one shared backend (Supabase) serving a web app (Vercel) and native iOS/Android apps (React Native), with in-app purchases handled per-platform.

### Frontend
- **Web:** React + Vite, Tailwind CSS (existing Design Token System), Radix UI/shadcn — retained as-is, deployed on **Vercel**.
- **Mobile:** **React Native (Expo)** apps for iOS and Google Play, sharing business logic, hooks, and data models with the web app where possible. UI styling ported from Tailwind to **NativeWind** to preserve the existing design token system on mobile.
- **Shared code strategy:** Chart math, synthesis-fetching, and progress/XP logic should live in a platform-agnostic package consumed by both the Vite web app and the Expo app, so ephemeris and business logic aren't duplicated.

### Backend
- **Supabase** replaces the Base44 BaaS layer:
  - **Postgres** for all entities (Chart/SavedChart, Synthesis/Interpretation, UserProgress, Feedback/ErrorLog, LLMUsageLog, PlanetCorrection, Entitlement), with Row-Level Security policies replacing Base44's built-in access rules.
  - **Supabase Auth** replaces Base44 user auth.
  - **Supabase Storage** for any chart images/exports.
  - **Edge Functions + pg_cron / Scheduled Functions** replace Base44's scheduled/trigger automations (`preGenerateSynthesis`, `sendDailyEmail/Weekly/Monthly`).
- **Open technical risk:** the current Swiss-Ephemeris-based `chartCalculator` may depend on native (non-JS) bindings that don't run in Supabase's Deno-based Edge Functions. This needs a spike early in the rebuild to confirm whether ephemeris calculation can run at the edge, or whether it needs a Node-capable runtime (e.g., a Vercel serverless function with Node runtime) instead. Flagging now so it doesn't block later.

### Payments & Entitlements
- **Mobile (iOS/Android):** **RevenueCat** manages in-app purchases and subscriptions on top of StoreKit and Google Play Billing — handles entitlement state, receipt validation, and renewal/cancellation events.
- **Web:** **Stripe** is retained for the Vercel-hosted web app's purchase path (avoids the app-store revenue cut for web-acquired users).
- **Reconciliation:** Both RevenueCat and Stripe webhooks write to a single `Entitlement` table in Supabase, which is the source of truth the app reads from regardless of purchase origin. This avoids divergent tier state between platforms.

### Other Integrations
- **LLM Integration:** Same orchestrated prompt engineering and schema-enforced JSON output approach, hosted via Supabase Edge Functions (or Vercel serverless, depending on the ephemeris runtime spike above).
- **Google Calendar:** OAuth connector + ICS sync reimplemented directly (Base44's built-in connector goes away) — likely a Supabase Edge Function handling the OAuth flow and calendar writes.

### Migration Notes
- Base44 entities need a one-time export/import into Supabase Postgres tables, preserving IDs where feasible so existing SavedChart/Synthesis history isn't lost.
- Base44's built-in automations (scheduled emails, synthesis pre-generation) need to be rebuilt as Supabase functions before cutover — plan for a parallel-run period to validate parity.

---

## 5. Roadmap & Future Polish
- **Mobile Build-Out:** Port web UI to React Native/Expo + NativeWind; achieve UI parity with the existing interactive wheel and planner views on iOS/Android.
- **In-App Purchases:** Integrate RevenueCat for iOS/Android; keep Stripe live on web; build the Entitlement reconciliation layer.
- **Backend Migration:** Move all entities off Base44 to Supabase Postgres; rebuild scheduled automations as Edge Functions; validate ephemeris calculation runtime (edge vs. Node).
- **Data Accuracy:** Ongoing ephemeris validation via the `PlanetCorrection` entity.
- **Learn Integration:** Expand modules to cover advanced classical techniques and dynamics.
- **Export/Sync:** Strengthen ICS and Google Calendar syncing stability post-migration.

---

*This PRD reflects the target architecture for the Base44 → Claude Code/Vercel/Supabase migration, plus the existing product surface. No implementation has started — this document is for planning and alignment only.*
