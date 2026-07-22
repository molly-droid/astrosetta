# PRD — Natal Chart & Transit Learning App

**Version:** 0.1 (draft for local build with Claude Code)
**Status:** Approved for scaffolding — do not deviate from architecture decisions without flagging
**Deployment target:** Railway (standard deployment)
**Platform strategy:** Web-first SPA, architected for later native publication via Capacitor

---

## 1. Product Overview

A web application that computes a user's natal birth chart from an ephemeris, tracks daily planetary transits against that natal chart, and teaches astrology through structured learning modules and quizzes — including quizzes generated from the user's *own* chart, which is the core differentiator versus static astrology education content.

### 1.1 Core value propositions

1. **Accurate, transparent chart math.** Real ephemeris computation, not lookup tables. Users can see exact degrees, house cusps, and aspect orbs.
2. **Personalized daily relevance.** Every day, the app answers "what is the sky doing to *my* chart today" with applying/separating aspect detail, not generic sun-sign horoscopes.
3. **Learn on your own chart.** Modules and quizzes reference the user's actual placements ("Your Moon is in Scorpio in the 4th house — which of these keywords fits?"), converting abstract theory into retained knowledge.

### 1.2 Explicit non-goals (v1)

- No LLM-generated horoscope prose (deterministic content library only; LLM synthesis is a flagged Phase 2 experiment)
- No synastry/composite charts (v2)
- No solar returns, progressions, or other predictive techniques beyond transits (v2)
- No social features, chart sharing feeds, or community
- No payments/subscriptions in v1 (design the data model so gating can be added without migration pain)

---

## 2. Users & Personas

| Persona | Description | Primary jobs |
|---|---|---|
| **Curious beginner** | Knows their sun sign, maybe moon/rising. Wants to understand their full chart without jargon walls. | Generate chart, read plain-language interpretations, start Module 1 |
| **Intermediate student** | Understands planets/signs/houses, weak on aspects and transits. | Daily transit digest, aspect drills, chart-reading quizzes |
| **Practicing hobbyist** | Reads charts for friends. Wants precise data and configurable settings. | Multiple saved birth profiles, house system toggle, orb configuration, exact transit timing |

---

## 3. Architecture Decisions (locked)

These decisions are made. Claude Code should build against them, not re-litigate them.

### 3.1 Monorepo layout

pnpm workspaces + Turborepo:

```
/apps
  /api          — Fastify + TypeScript. REST API. Owns all DB access and ephemeris computation.
  /web          — Vite + React 18 + TypeScript SPA. No SSR. Talks to /api only via typed client.
/packages
  /core         — Pure-TS chart math: ephemeris adapter, houses, aspects, transits. Zero DOM/Node-API deps so it runs in API, web worker, and future native runtime.
  /content      — Interpretation library + learning module content (typed data + MDX), versioned.
  /api-client   — Generated/typed fetch client shared by web and future native apps.
  /ui           — (optional, add when needed) shared presentational components.
/tooling        — eslint config, tsconfig bases, test fixtures (known ephemeris values).
```

**Why no Next.js:** SSR complicates the Capacitor wrap and creates a second server runtime. A decoupled SPA + API keeps the native path trivial (Capacitor wraps `apps/web` dist as-is) and keeps Railway deployment to two clean services.

### 3.2 Ephemeris engine

- **Primary: `astronomy-engine` (MIT license).** Accuracy ±1 arcminute for Sun–Pluto over ±1000 years — more than sufficient for astrological work (orbs are measured in whole degrees).
- **Wrap it behind an `EphemerisAdapter` interface in `packages/core`** with methods like `getBodyPosition(body, jd)`, `getObliquity(jd)`. This makes Swiss Ephemeris (`swisseph`) a drop-in later if we need asteroids, fixed stars, or sub-arcsecond precision — without touching downstream code.
- **Licensing note (do not skip):** Swiss Ephemeris is AGPL-3.0 or paid commercial license. Do NOT add `swisseph` as a dependency in v1. If precision requirements change, this is a business decision, not an engineering one.
- Chiron and mean lunar nodes: astronomy-engine covers major bodies; nodes computed from lunar orbital elements in `core`. Chiron ships v1.1 only if we find a clean MIT-compatible source; otherwise deferred.

### 3.3 Datastore

- **PostgreSQL on Railway.** Prisma ORM (or Drizzle if Claude Code judges migration ergonomics better at scaffold time — pick one, document the choice in `/docs/decisions/`, never mix).
- Redis is **not** in v1. Ephemeris caching is in-process + Postgres tables (see §6.4). Add Redis only if transit digest fan-out demands it.

### 3.4 Auth

- Email + password (argon2id) plus optional Google OAuth.
- **Dual session mode from day one:** HTTP-only cookie sessions for web, bearer token issuance for the future native client. Same session table, two transport modes. This is the single most common native-migration failure point — solve it now.

### 3.5 Native publication path (constraints enforced in v1)

Target: **Capacitor** wrapping the built SPA (iOS + Android), with React Native as a fallback only if Capacitor performance disappoints.

Constraints every v1 PR must respect:

1. No SSR, no reliance on server-injected HTML.
2. API base URL from env/config, never hardcoded relative paths assumed same-origin (CORS configured properly on API).
3. Auth must work in bearer-token mode (cookies are unreliable in WKWebView).
4. Mobile-first responsive layouts; safe-area CSS env vars respected in the app shell.
5. No `localStorage` for anything critical — abstract storage behind a `StorageProvider` (web: localStorage; native: Capacitor Preferences).
6. Chart rendering must be SVG (scales, exports, prints) — no canvas dependency that fights WebView pixel ratios.
7. Push/local notifications abstracted behind a `NotificationProvider` no-op in web v1; wired to Capacitor Local Notifications for the daily transit digest at native time.

---

## 4. Feature Specification

### 4.1 Birth data intake & chart generation

**Flow:** date → time (with "unknown time" path) → place → confirm → chart.

- **Place input:** autocomplete geocoding. v1: OpenStreetMap Nominatim (free, rate-limited — proxy through API with caching and a proper User-Agent) resolving to lat/lon. Store the resolved place string + coordinates, never re-geocode.
- **Timezone resolution:** THE accuracy-critical step. Resolve lat/lon → IANA zone via `geo-tz`, then compute the historical UTC offset for the birth *datetime* using the IANA database (handles pre-1970 offsets, wartime DST, zone changes). Store: local datetime, IANA zone, resolved UTC datetime, and a `tzConfidence` flag. Surface the resolved offset to the user for confirmation ("Born 3:15 PM CST, UTC-6 — correct?").
- **Unknown birth time:** offer noon chart with houses/angles suppressed, Moon sign shown with "may be X or Y if born before/after HH:MM" boundary detection, and Whole Sign houses from the Sun as an optional "solar chart" view. Never show an Ascendant for unknown-time charts.
- **Multiple profiles:** each user can save unlimited birth profiles (self, partner, kids) with labels. One marked primary — drives the daily transit digest.

**Chart computation (packages/core):**

- Bodies v1: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, True Node (with South Node derived), Ascendant, Midheaven.
- Zodiac: tropical (sidereal + ayanamsa selection is v2; keep the zodiac mode as a parameter in core now).
- House systems: **Placidus (default)** and **Whole Sign**. Implement both in core with shared cusp→house assignment logic. Placidus requires the standard iterative semi-arc solution; include the polar-latitude failure case (|lat| > ~66.5°) with automatic fallback to Whole Sign + user notice.
- Aspects: conjunction 0°, opposition 180°, trine 120°, square 90°, sextile 60° (majors); quincunx 150° and semi-sextile 30° behind a "minor aspects" toggle. Default orbs: 8° conj/opp, 7° trine/square, 5° sextile, 3° minors; luminaries +2°. Orbs user-configurable in settings, persisted per user.
- Output: a canonical `ChartData` JSON (bodies with ecliptic lon/lat, speed, sign, degree-in-sign, house; cusps; aspects with exact orb and applying/separating) — this object is the contract between core, API, DB cache, and UI. Version it (`chartDataVersion`) so cached charts can be invalidated when core changes.

**Accuracy test suite (blocking requirement):** fixture tests in `packages/core` against published ephemeris values (e.g., Astro.com / Astrodienst published positions for known datetimes) for at least 12 datetimes spanning 1940–2030, all bodies within 0.05° tolerance, plus house cusp fixtures for 6 latitude/datetime combos. CI fails on drift.

### 4.2 Natal chart presentation

- **Chart wheel:** SVG, rendered from `ChartData`. Zodiac ring, house cusps, glyphs at ecliptic positions with collision-avoidance nudging, aspect lines color-coded (harmonious/challenging/neutral) with opacity scaled by orb tightness. Tap/click any body or aspect line → detail panel.
- **Placements list:** table view (body, sign, degree, house, dignities v1.1) as the accessible/mobile-friendly alternative to the wheel.
- **Interpretation panels:** composed from `packages/content` layers:
  1. Planet-in-sign (12×13 entries)
  2. Planet-in-house (12×13 entries)
  3. Natal aspect texts (per aspect type × planet pair, majors only in v1)
  4. Ascendant/MC in sign
  - Each entry: `summary` (1–2 sentences, beginner voice), `expanded` (2–3 paragraphs), `keywords[]`. Content lives as typed TS/MDX in the repo — versioned, reviewable in PRs, seeded to DB at deploy. Writing this content is a real workstream; see §8 content milestone and stub-generation instruction.
- **Settings:** house system, minor aspects toggle, orb overrides, dark mode.

### 4.3 Daily transits

- **Computation model:** current planetary positions are identical for all users at a given timestamp — compute once, personalize cheaply.
  - `transit_positions` table: daily positions for all bodies at 00:00 UTC + hourly Moon positions, precomputed 30 days ahead by a Railway cron job hitting an internal API endpoint.
  - Per-user transit hits computed on request in core (transit body vs natal body/angle, within orb) and cached per (profile, date).
- **Transit orbs:** tighter than natal — default 3° applying / 2° separating for outer planets, 5° for luminaries/inner planets to natal; user-configurable.
- **"Today" screen (app home for logged-in users):**
  - Header: current sky summary (Moon sign + phase, any sign ingresses or stations/retrogrades today).
  - Ranked list of active transits to the primary profile's natal chart, sorted by a significance score: `weight(transiting body) × weight(aspect type) × orb tightness × applying bonus`. Slow-planet transits (Saturn+ to personal planets/angles) pinned to top with duration framing ("in effect roughly Mar–Sep, exact Apr 12 and Aug 30" — compute exact-hit dates including retrograde passes via sign-change root finding on the orb function).
  - Each transit: interpretation text from content library (transiting-planet × aspect × natal-planet matrix — large; v1 ships full coverage for Saturn/Jupiter/Uranus/Neptune/Pluto transits to all natal bodies and generic templated text for fast-mover transits).
- **Transit calendar:** month view marking exact-hit days; day tap → that day's transit list.
- **Daily digest (Phase 1.5):** opt-in email (Resend) at user-local 8:00 AM; the send job is the same Railway cron infrastructure. Native builds later swap to local notifications via the `NotificationProvider`.

### 4.4 Learning modules

- **Structure:** Tracks → Modules → Lessons. v1 ships one track, "Foundations," 8 modules:
  1. The chart as a map (wheel anatomy, ecliptic, houses vs signs)
  2. Planets: what each one *is*
  3. Signs: the 12 styles (elements, modalities, polarities)
  4. Houses: the 12 arenas
  5. Reading a placement (planet + sign + house synthesis) — **uses the user's own chart in worked examples**
  6. Aspects: how planets talk to each other
  7. The angles & chart shape
  8. Transits: the moving sky (bridges directly into the Today screen)
- **Lesson format:** MDX content in `packages/content` — prose, inline chart-fragment components (e.g., `<MiniWheel highlight="moon" />` rendering from the user's ChartData), and inline check-understanding questions.
- **Progress:** lesson completion, module completion %, streak counter (calendar-day based, timezone-aware to user profile TZ).

### 4.5 Quizzes & retention

- **Question types:**
  1. Multiple choice (static bank, tagged by module + concept)
  2. **Personalized MCQ:** generated at runtime from the user's `ChartData` via question templates ("Which house is your natal Venus in?", "Your Sun and Moon form which aspect?") — template engine in `packages/core` (`generatePersonalQuestions(chart, conceptTags)`), guaranteeing answerability and generating plausible distractors (adjacent houses/signs, wrong-but-related aspect).
  3. Glyph identification (image-based MCQ).
  4. Chart-reading drills (v1.1): shown a rendered anonymous chart, answer structural questions.
- **Module quizzes:** gate module completion at ≥80%, retakes unlimited, question order + distractors shuffled.
- **Spaced repetition ("Daily Drill"):** lightweight SM-2. Every quiz question doubles as an SRS card; misses re-enter the queue. Daily Drill session = up to 10 due cards, surfaced on the Today screen beneath transits. Store per-card ease/interval/due in `srs_cards`.
- **Stats:** accuracy by concept tag (planets/signs/houses/aspects), weakest-concept callout linking back to the relevant lesson.

---

## 5. Data Model (Postgres)

```
users              id, email, password_hash, oauth_provider/oauth_sub, created_at, settings jsonb
                   (settings: house_system, orbs, minor_aspects, theme, digest_opt_in, digest_hour)
sessions           id, user_id, token_hash, transport (cookie|bearer), expires_at, created_at
birth_profiles     id, user_id, label, is_primary,
                   birth_date, birth_time, time_known bool,
                   place_name, lat, lon, iana_tz, utc_datetime, tz_confidence,
                   created_at
charts_cache       id, profile_id, house_system, chart_data jsonb, chart_data_version, computed_at
transit_positions  date, hour (0 for daily rows; 0–23 for Moon), body, lon, lat, speed, retrograde
transit_hits_cache profile_id, date, hits jsonb, computed_at
tracks/modules/lessons   content structure + ordering (seeded from packages/content)
lesson_progress    user_id, lesson_id, completed_at
quiz_questions     id, module_id, type, concept_tags[], payload jsonb (static bank; personalized are runtime-only)
quiz_attempts      id, user_id, module_id, score, answers jsonb, created_at
srs_cards          id, user_id, question_ref, ease, interval_days, due_date, lapses
```

- All timestamps `timestamptz`. Birth local datetime stored as date + time columns alongside resolved `utc_datetime` — never store only one representation.
- `charts_cache` invalidation: on profile edit, settings change affecting computation, or `chart_data_version` bump.

## 6. API Surface (v1)

REST, JSON, versioned under `/v1`. OpenAPI spec generated from Fastify schemas; `packages/api-client` generated from the spec.

```
POST   /v1/auth/register | /login | /logout | /oauth/google/...      (cookie or ?transport=bearer)
GET    /v1/me                          PATCH /v1/me/settings
GET    /v1/geo/search?q=               (proxied, cached Nominatim)
POST   /v1/profiles                    GET/PATCH/DELETE /v1/profiles/:id
GET    /v1/profiles/:id/chart?house_system=placidus
GET    /v1/profiles/:id/transits?date=YYYY-MM-DD
GET    /v1/profiles/:id/transits/calendar?month=YYYY-MM
GET    /v1/content/tracks | /modules/:id | /lessons/:id
POST   /v1/lessons/:id/complete
GET    /v1/quizzes/module/:id          POST /v1/quizzes/module/:id/attempts
GET    /v1/drill/today                 POST /v1/drill/answers
POST   /internal/cron/precompute-transits   (cron-secret header auth)
POST   /internal/cron/send-digests
```

- Rate limiting on auth + geo endpoints. CORS allowlist: web origin + `capacitor://localhost` + `http://localhost` (Android WebView) — configured via env.

## 7. Deployment (Railway)

- **Services:**
  1. `api` — Fastify, Nixpacks/Railpack auto-detect, `pnpm --filter api build && start`. Healthcheck `/v1/health` (checks DB + ephemeris self-test: computes a known fixture and compares).
  2. `web` — static build of the SPA served via Caddy/serve buildpack (or Railway static). `VITE_API_URL` injected at build.
  3. `postgres` — Railway Postgres plugin.
  4. **Cron:** Railway cron schedule on the api service (or a dedicated cron service) hitting `/internal/cron/*` with `CRON_SECRET`.
- **Env vars (documented in `/docs/deploy.md` + `.env.example`):** `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `GOOGLE_OAUTH_*`, `RESEND_API_KEY`, `WEB_ORIGIN`, `NOMINATIM_USER_AGENT`.
- Migrations run as a Railway pre-deploy command (`prisma migrate deploy`), never at server boot.
- PR environments via Railway preview deploys if the plan supports it; otherwise a single `staging` environment.

## 8. Milestones

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| M0 | Scaffold | Monorepo, CI (typecheck/lint/test), Railway services deploying hello-world api + web, Postgres + migrations | Green deploy on push to main |
| M1 | Chart engine | `packages/core` complete: ephemeris adapter, houses, aspects, ChartData; fixture accuracy suite | All fixtures pass at 0.05° tolerance in CI |
| M2 | Natal MVP | Auth (both transports), profile intake w/ geocode+TZ resolution, chart wheel + placements + interpretation panels, **content: full planet-in-sign/house + ASC/MC coverage** | New user → accurate rendered chart with readable interpretations, end to end |
| M3 | Transits | Precompute cron, Today screen, transit calendar, exact-hit date finding, transit content (outer planets full, inner templated) | Today screen matches Astro.com transit listings for test profiles |
| M4 | Learning | 8 Foundations modules, MDX lesson renderer w/ personalized chart fragments, module quizzes, personalized question templates | Beginner can complete Track 1 gated by quizzes |
| M5 | Retention & polish | SRS Daily Drill, streaks, stats, email digest, settings, a11y pass, empty/error states | Lighthouse ≥90 a11y/perf on key screens |
| M6 | Native wrap | Capacitor iOS+Android projects, bearer auth verified in WKWebView, StorageProvider/NotificationProvider native impls, local notification digest, store asset checklist | TestFlight + internal Android build functional |

**Content workstream note for Claude Code:** interpretation and lesson content should be scaffolded as typed stubs with `TODO(content)` markers and machine-readable coverage report (`pnpm content:coverage`) so writing progress is trackable. Do not ship lorem ipsum to production paths — unwritten entries render a clean "interpretation coming soon" state.

## 9. Non-Functional Requirements

- **Accuracy:** fixture suite per §4.1; any core change re-runs it. Transit exact-hit dates within ±1 hour of reference sources.
- **Performance:** chart computation <150 ms server-side; Today screen TTI <2.5 s on mid-tier mobile; chart wheel SVG interactive at 60 fps on tap/highlight.
- **Accessibility:** placements table as first-class equivalent to the wheel; all glyphs have text labels/aria; color-coding never the sole channel (aspect lines also patterned).
- **Privacy:** birth data is sensitive personal data — encrypt at rest is handled by Railway Postgres, but add: no birth data in logs, no third-party analytics receiving birth data, account deletion hard-deletes profiles + caches, documented in a plain-language privacy page.
- **Tone of content:** grounded, warm, jargon-defined-on-first-use; no fatalism, no medical/financial/legal predictions; frame astrology as a symbolic/reflective system. This is a content style guide requirement enforced in PR review, and it also keeps app-store review (M6) smooth.

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Historical timezone errors silently corrupt charts | tz resolution surfaced to user for confirmation; fixture tests include pre-1970 + DST-edge births |
| Content volume (planet×sign×house×aspect matrices) balloons timelines | Coverage tooling, templated fallbacks for low-priority cells, prioritized writing order (personal planets first) |
| Placidus edge cases (polar latitudes) crash chart gen | Explicit fallback to Whole Sign + user notice; fixtures at 68°N |
| Nominatim rate limits | Server-side proxy + aggressive caching of query→result; swap-ready geocoder interface |
| Capacitor cookie/auth failures at M6 | Bearer transport built and integration-tested from M2, not retrofitted |
| Ephemeris precision complaints from advanced users | Documented ±1′ accuracy statement; Swiss Ephemeris adapter path defined (licensing decision gate) |

## 11. Open Questions (answer before M2)

1. **App name + domain** — needed for OAuth consent screen, email digest sender, and store listings later.
2. Sidereal zodiac demand: keep as core parameter only, or expose a toggle earlier than v2?
3. Digest email design: plain-text-first or branded HTML from day one?
4. Should quiz content gating (80%) be strict or advisory? (Recommendation: advisory with "mastered" badge at 80%, to avoid frustration churn.)
5. Chiron/asteroids: how loud is user demand before we take the Swiss Ephemeris licensing question seriously?
