# Technical Implementation Plan — Astrology Learning App

**Document Version:** 1.0
**Based on PRD:** v0.1
**Last Updated:** 2026-07-22
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure & Setup](#3-project-structure--setup)
4. [Milestone Breakdown](#4-milestone-breakdown)
5. [Core Package Specifications](#5-core-package-specifications)
6. [API Design Specifications](#6-api-design-specifications)
7. [Web Application Specifications](#7-web-application-specifications)
8. [Database Schema Details](#8-database-schema-details)
9. [Content System Architecture](#9-content-system-architecture)
10. [Authentication & Security](#10-authentication--security)
11. [Deployment Strategy](#11-deployment-strategy)
12. [Testing Strategy](#12-testing-strategy)
13. [Development Workflow](#13-development-workflow)
14. [Implementation Order](#14-implementation-order)

---

## 1. Executive Summary

This document provides the technical blueprint for implementing the natal chart and transit learning application defined in `astrology-app-prd.md`. The application uses a monorepo architecture with separated API and web layers, designed from day one for future native publication via Capacitor.

**Key Technical Decisions:**
- Monorepo: pnpm workspaces + Turborepo
- API: Fastify + TypeScript + Prisma/Drizzle ORM
- Web: Vite + React 18 + TypeScript SPA
- Ephemeris: astronomy-engine wrapped in adapter pattern
- Database: PostgreSQL on Railway
- Deployment: Railway with cron jobs for transit precomputation

**Critical Path:** M0 Scaffold → M1 Chart Engine → M2 Natal MVP → M3 Transits → M4 Learning → M5 Retention → M6 Native

---

## 2. Technology Stack

### 2.1 Core Dependencies

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Package Manager** | pnpm | ≥8.x | Efficient monorepo, fast installs, strict node_modules |
| **Build Orchestration** | Turborepo | ≥1.x | Task caching, parallel builds, optimized CI |
| **Language** | TypeScript | ≥5.x | Type safety across monorepo, shared interfaces |
| **Node Runtime** | Node.js | ≥20.x LTS | Modern JS features, Railway compatibility |

### 2.2 API Layer (`apps/api`)

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Framework** | Fastify | Fast, schema-based, OpenAPI generation |
| **ORM** | Prisma or Drizzle | **Decision point at M0**: Prisma for tooling vs Drizzle for SQL control |
| **Validation** | Zod | Schema validation, shared with frontend |
| **Auth** | Fastify sessions + JWT | Dual transport: cookies + bearer tokens |
| **Password Hashing** | argon2 | Modern, secure (vs bcrypt) |
| **OAuth** | Google OAuth 2.0 | Official Node.js client |
| **Email** | Resend | Transactional email for digests |
| **Caching** | Node in-memory + DB | No Redis in v1 |

### 2.3 Web Layer (`apps/web`)

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Build Tool** | Vite | Fast HMR, native ESM, optimized builds |
| **Framework** | React 18 | Concurrent features, widest ecosystem |
| **Router** | React Router v6 | Standard SPA routing |
| **State** | Zustand or Jotai | Lightweight (avoid Redux complexity) |
| **Forms** | React Hook Form + Zod | Type-safe validation |
| **Styling** | Tailwind CSS | Mobile-first utility framework |
| **UI Components** | Radix UI primitives | Accessible, unstyled, composable |
| **Charts/SVG** | Custom + d3-scale | Full control over chart wheel rendering |
| **Date/Time** | Luxon | IANA timezone support, Julian conversions |
| **HTTP Client** | Generated from OpenAPI | Type-safe API calls |

### 2.4 Core Packages

| Package | Purpose | Key Dependencies |
|---------|---------|------------------|
| `@astro/core` | Chart math, ephemeris, transits | astronomy-engine, luxon |
| `@astro/content` | Interpretation library, lessons | MDX, Zod schemas |
| `@astro/api-client` | Generated typed API client | openapi-typescript, ky |
| `@astro/ui` | (Future) Shared components | React, Tailwind |

### 2.5 Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting with TypeScript, React, Fastify rules |
| **Prettier** | Code formatting |
| **Vitest** | Unit/integration testing (Vite-native) |
| **Playwright** | E2E testing |
| **Husky** | Git hooks for pre-commit checks |
| **Changesets** | Version management (optional, defer to M5) |

---

## 3. Project Structure & Setup

### 3.1 Monorepo Layout

```
astrosetta/
├── apps/
│   ├── api/                          # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/               # Route handlers by domain
│   │   │   ├── services/             # Business logic
│   │   │   ├── lib/                  # DB client, auth, utils
│   │   │   ├── schemas/              # Zod request/response schemas
│   │   │   ├── cron/                 # Cron job handlers
│   │   │   ├── server.ts             # Fastify app setup
│   │   │   └── index.ts              # Entry point
│   │   ├── prisma/                   # If using Prisma
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── drizzle/                  # If using Drizzle
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── test/                     # API tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # React SPA
│       ├── src/
│       │   ├── features/             # Feature-based organization
│       │   │   ├── auth/
│       │   │   ├── charts/
│       │   │   ├── transits/
│       │   │   ├── learning/
│       │   │   └── quiz/
│       │   ├── components/           # Shared UI components
│       │   ├── lib/                  # Utils, API client, storage
│       │   ├── hooks/                # Custom React hooks
│       │   ├── stores/               # State management
│       │   ├── routes/               # Route components
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/                   # Static assets
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   ├── core/                         # Pure TS chart math
│   │   ├── src/
│   │   │   ├── ephemeris/
│   │   │   │   ├── adapter.ts        # EphemerisAdapter interface
│   │   │   │   ├── astronomy-engine.ts  # Implementation
│   │   │   │   └── types.ts
│   │   │   ├── houses/
│   │   │   │   ├── placidus.ts
│   │   │   │   ├── whole-sign.ts
│   │   │   │   └── types.ts
│   │   │   ├── aspects/
│   │   │   │   ├── calculator.ts
│   │   │   │   └── types.ts
│   │   │   ├── chart/
│   │   │   │   ├── builder.ts        # ChartData construction
│   │   │   │   ├── types.ts          # ChartData interface
│   │   │   │   └── version.ts        # chartDataVersion constant
│   │   │   ├── transits/
│   │   │   │   ├── calculator.ts
│   │   │   │   ├── exact-hit.ts      # Root finding for exact dates
│   │   │   │   └── types.ts
│   │   │   ├── quiz/
│   │   │   │   └── personalized-generator.ts
│   │   │   ├── utils/
│   │   │   │   ├── coordinates.ts    # Deg/min/sec, normalization
│   │   │   │   ├── julian.ts
│   │   │   │   └── zodiac.ts
│   │   │   └── index.ts              # Public API
│   │   ├── test/
│   │   │   ├── fixtures/             # Known ephemeris values
│   │   │   │   ├── bodies.json       # 12 test datetimes
│   │   │   │   └── houses.json       # 6 lat/datetime combos
│   │   │   └── accuracy.test.ts      # CI-blocking suite
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── content/                      # Interpretation & learning
│   │   ├── src/
│   │   │   ├── interpretations/
│   │   │   │   ├── planet-in-sign/   # 12×13 entries
│   │   │   │   ├── planet-in-house/  # 12×13 entries
│   │   │   │   ├── aspects/          # Aspect matrix
│   │   │   │   ├── angles/           # ASC/MC in signs
│   │   │   │   ├── transits/         # Transit interpretations
│   │   │   │   └── index.ts          # Type-safe getters
│   │   │   ├── learning/
│   │   │   │   ├── tracks/
│   │   │   │   │   └── foundations/  # Track 1: 8 modules
│   │   │   │   │       ├── module-01-chart-map/
│   │   │   │   │       │   ├── meta.ts
│   │   │   │   │       │   └── lessons/
│   │   │   │   │       │       ├── 01-wheel-anatomy.mdx
│   │   │   │   │       │       └── ...
│   │   │   │   │       └── ...
│   │   │   │   └── components/       # MDX components
│   │   │   │       ├── MiniWheel.tsx
│   │   │   │       └── ConceptCheck.tsx
│   │   │   ├── quizzes/
│   │   │   │   └── question-bank.ts  # Static quiz questions
│   │   │   ├── schemas/
│   │   │   │   └── content-types.ts  # Zod schemas
│   │   │   └── index.ts
│   │   ├── scripts/
│   │   │   └── coverage-report.ts    # Content coverage check
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/                   # Generated API client
│   │   ├── src/
│   │   │   ├── generated/            # Auto-generated from OpenAPI
│   │   │   ├── client.ts             # Wrapper with auth/error handling
│   │   │   └── index.ts
│   │   ├── scripts/
│   │   │   └── generate.ts           # Codegen from api/openapi.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                           # (Optional, defer to M4)
│       └── ...
│
├── tooling/
│   ├── eslint-config/                # Shared ESLint config
│   ├── typescript-config/            # Base tsconfig.json files
│   └── test-fixtures/                # Symlinked to packages/core/test/fixtures
│
├── docs/
│   ├── decisions/                    # ADRs (Architecture Decision Records)
│   │   └── 001-orm-choice.md         # Example: Prisma vs Drizzle
│   ├── deploy.md                     # Railway deployment guide
│   ├── privacy.md                    # Privacy policy (plain language)
│   └── api.md                        # API documentation (generated)
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, typecheck, test on PR
│       └── deploy.yml                # Railway deploy on push to main
│
├── .env.example                      # Template for local .env
├── .gitignore
├── .prettierrc
├── package.json                      # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 3.2 Initial Setup Commands

```bash
# M0 Scaffold - Step-by-step setup
mkdir astrosetta && cd astrosetta
pnpm init
pnpm add -D turbo prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin

# Create workspace file
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tooling/*'
EOF

# Create turbo.json
cat > turbo.json << EOF
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# Create directory structure
mkdir -p apps/api apps/web packages/core packages/content packages/api-client tooling/eslint-config tooling/typescript-config docs/decisions

# Create .env.example (populated in API section below)
touch .env.example
```

---

## 4. Milestone Breakdown

### M0: Scaffold (Week 1)

**Goal:** Deployable hello-world with CI/CD pipeline.

**Tasks:**
1. **Monorepo Setup**
   - Initialize pnpm workspace + Turborepo
   - Configure root package.json scripts (`pnpm dev`, `pnpm build`, `pnpm test`)
   - Set up shared tooling configs (ESLint, Prettier, tsconfig bases)

2. **API Hello World**
   - Initialize `apps/api` with Fastify
   - Add health check route: `GET /v1/health` returns `{ status: "ok", timestamp }`
   - Add OpenAPI plugin (e.g., `@fastify/swagger`)
   - Choose ORM (Prisma or Drizzle) and document in `/docs/decisions/001-orm-choice.md`
   - Connect to local Postgres (Docker Compose for dev)
   - Create initial migration (users table stub)
   - Add dev script with hot reload (tsx watch)

3. **Web Hello World**
   - Initialize `apps/web` with Vite + React + TypeScript
   - Configure Tailwind CSS
   - Add basic routing (React Router): home, about, 404
   - Add API_URL env var handling (from import.meta.env)
   - Fetch /v1/health from API and display on page

4. **CI Pipeline**
   - GitHub Actions workflow: `ci.yml`
     - Install deps (cache pnpm store)
     - Turbo: `pnpm turbo lint typecheck test`
     - Run on PR + push to main
   - Add `test` script to each package (initially `vitest run --passWithNoTests`)

5. **Railway Setup**
   - Create Railway project
   - Add Postgres plugin
   - Create two services: `api`, `web`
   - `api`: Auto-detect Nixpacks, env vars `DATABASE_URL`, `PORT`
   - `web`: Static buildpack, `VITE_API_URL` build-time var
   - Configure `railway.json` for services (or use UI)
   - Deploy from `main` branch
   - Verify: both services healthy, web can call api health endpoint

6. **Local Dev Experience**
   - Root `pnpm dev` starts both api and web in parallel (Turborepo persistent tasks)
   - API on localhost:3000, web on localhost:5173
   - Docker Compose for Postgres:
     ```yaml
     # docker-compose.yml at root
     services:
       postgres:
         image: postgres:16-alpine
         environment:
           POSTGRES_DB: astrosetta_dev
           POSTGRES_USER: astro
           POSTGRES_PASSWORD: devpassword
         ports:
           - "5432:5432"
         volumes:
           - pgdata:/var/lib/postgresql/data
     volumes:
       pgdata:
     ```

**Exit Criteria:**
- `pnpm dev` starts api + web locally
- `pnpm turbo build` succeeds
- `pnpm turbo lint typecheck test` passes in CI
- Railway deploys both services; web displays API health status
- README documents setup steps

---

### M1: Chart Engine (Week 2-3)

**Goal:** Accurate chart computation with passing fixture tests.

**Tasks:**

1. **Ephemeris Adapter Setup**
   - Install `astronomy-engine` in `packages/core`
   - Define `EphemerisAdapter` interface:
     ```typescript
     interface EphemerisPosition {
       longitude: number;      // Ecliptic longitude in degrees
       latitude: number;       // Ecliptic latitude in degrees
       distance: number;       // AU from Earth
       speed: number;          // Degrees per day
       retrograde: boolean;
     }

     interface EphemerisAdapter {
       getBodyPosition(body: AstroBody, jd: number): EphemerisPosition;
       getObliquity(jd: number): number;
     }
     ```
   - Implement `AstronomyEngineAdapter` with conversions:
     - astronomy-engine uses equatorial → convert to ecliptic
     - Body enum mapping (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)

2. **Julian Date & Coordinate Utils**
   - `julian.ts`: Luxon DateTime ↔ Julian Day conversions
   - `coordinates.ts`: Ecliptic ↔ equatorial, degree normalization (0–360), DMS formatting
   - `zodiac.ts`: Longitude → sign + degree (0° Aries = 0° ecliptic longitude)

3. **House Calculations**
   - `houses/placidus.ts`:
     - RAMC (Right Ascension of MC) from sidereal time + longitude
     - Iterative semi-arc solution for cusps 11, 12, 2, 3
     - Polar latitude check: if |lat| > 66.5°, return `null` (fallback signal)
   - `houses/whole-sign.ts`:
     - Cusp 1 = Ascendant degree floored to 0° of sign
     - Each subsequent house = +30° ecliptic longitude
   - `houses/calculator.ts`:
     - Try Placidus; if null, use Whole Sign + set `houseSystemUsed` flag
   - Calculate Ascendant and MC:
     - Ascendant: ecliptic point rising on eastern horizon (requires iteration on local sidereal time + obliquity)
     - MC: ecliptic point at upper meridian (direct from RAMC)

4. **Aspects Calculator**
   - Define aspect types with orbs:
     ```typescript
     const ASPECT_DEFINITIONS = [
       { type: 'conjunction', angle: 0, baseOrb: 8, luminariesBonus: 2 },
       { type: 'opposition', angle: 180, baseOrb: 8, luminariesBonus: 2 },
       { type: 'trine', angle: 120, baseOrb: 7, luminariesBonus: 2 },
       { type: 'square', angle: 90, baseOrb: 7, luminariesBonus: 2 },
       { type: 'sextile', angle: 60, baseOrb: 5, luminariesBonus: 2 },
       { type: 'quincunx', angle: 150, baseOrb: 3, luminariesBonus: 0, minor: true },
       { type: 'semisextile', angle: 30, baseOrb: 3, luminariesBonus: 0, minor: true },
     ];
     ```
   - For each body pair, check all aspects:
     - Calculate exact orb: `abs(normalize(lon1 - lon2) - aspectAngle)`
     - Within orb? → create aspect entry
     - Applying/separating: compare speeds (if faster body's orb is decreasing, it's applying)
   - Return array of aspects sorted by orb tightness

5. **True Node Calculation**
   - astronomy-engine doesn't provide Moon's node directly
   - Compute from lunar orbital elements:
     - Use astronomy-engine's Moon position + velocity
     - Node longitude = longitude where Moon crosses ecliptic (lat = 0)
     - Implementation: use astronomy-engine's `MoonNode` function or derive from orbital parameters
     - True Node (not Mean Node) for accuracy
   - South Node = True Node + 180°

6. **ChartData Builder**
   - `chart/builder.ts`: Main function `buildChart(birthData, options)`
   - Input: `{ utcDatetime: Date, lat: number, lon: number, houseSystem: 'placidus' | 'whole-sign', includeMinorAspects: boolean, orbOverrides?: {...} }`
   - Steps:
     1. Convert datetime → Julian Day
     2. Get positions for all bodies (Sun–Pluto + True Node)
     3. Calculate houses + ASC/MC (handle unknown birth time: suppress houses/angles)
     4. Assign bodies to houses
     5. Calculate all aspects (apply orb config)
     6. Package into `ChartData` with metadata
   - Output: `ChartData` JSON (versioned with `CHART_DATA_VERSION` const)
   - `ChartData` interface:
     ```typescript
     interface ChartData {
       version: string;          // e.g., "1.0.0"
       birthData: {
         utcDatetime: string;    // ISO 8601
         lat: number;
         lon: number;
         timeKnown: boolean;
       };
       bodies: Array<{
         body: AstroBody;
         longitude: number;
         latitude: number;
         speed: number;
         retrograde: boolean;
         sign: ZodiacSign;
         degreeInSign: number;
         house: number | null;   // null if time unknown
       }>;
       angles: {
         ascendant: { longitude: number; sign: ZodiacSign; degreeInSign: number } | null;
         mc: { longitude: number; sign: ZodiacSign; degreeInSign: number } | null;
       };
       houseCusps: Array<{ house: number; longitude: number; sign: ZodiacSign }> | null;
       houseSystemUsed: 'placidus' | 'whole-sign' | 'none';
       aspects: Array<{
         body1: AstroBody;
         body2: AstroBody;
         type: AspectType;
         exactOrb: number;
         applying: boolean;
       }>;
       metadata: {
         computedAt: string;     // ISO 8601
         houseSystemRequested: string;
         includesMinorAspects: boolean;
       };
     }
     ```

7. **Fixture Tests**
   - Create `test/fixtures/bodies.json`:
     - 12 test cases: datetimes spanning 1940–2030, varied latitudes
     - For each: expected positions from Astro.com/Swiss Ephemeris
     - Format: `{ datetime: "...", bodies: { Sun: { lon: 123.456, lat: 0.001, ... }, ... } }`
   - Create `test/fixtures/houses.json`:
     - 6 test cases: 3 latitudes (0°, 45°N, 68°N) × 2 datetimes
     - Expected Placidus cusps + ASC/MC from reference
   - `test/accuracy.test.ts`:
     - For each body fixture, call `buildChart`, compare positions
     - Tolerance: 0.05° (3 arcminutes) for longitude
     - Speed tolerance: 0.01°/day
     - For house fixtures, compare cusps within 0.1°
     - **CI-blocking:** test must pass for merge

8. **Export Public API**
   - `packages/core/src/index.ts` exports:
     - `buildChart`
     - `ChartData` type
     - `CHART_DATA_VERSION` constant
     - Enums: `AstroBody`, `ZodiacSign`, `AspectType`, `HouseSystem`
     - Utils: `zodiacSignName`, `bodyGlyph`, `formatDMS`, etc.

**Exit Criteria:**
- `packages/core` has 0 dependencies on DOM/Node APIs (runs in any JS env)
- All 12 body fixture tests pass at 0.05° tolerance
- All 6 house fixture tests pass at 0.1° tolerance
- CI runs fixture suite on every commit
- Can call `buildChart(...)` and get accurate `ChartData` JSON

---

### M2: Natal MVP (Week 4-6)

**Goal:** New user can sign up, enter birth data, see accurate chart with interpretations.

**Tasks:**

1. **Database Schema (Prisma/Drizzle)**
   - Schema definition:
     ```prisma
     // Prisma example
     model User {
       id            String    @id @default(cuid())
       email         String    @unique
       passwordHash  String?
       oauthProvider String?   // "google"
       oauthSub      String?   // Google user ID
       createdAt     DateTime  @default(now())
       settings      Json      @default("{}")
       sessions      Session[]
       birthProfiles BirthProfile[]
       lessonProgress LessonProgress[]
       quizAttempts  QuizAttempt[]
       srsCards      SrsCard[]
     }

     model Session {
       id        String   @id @default(cuid())
       userId    String
       user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
       tokenHash String   @unique
       transport String   // "cookie" | "bearer"
       expiresAt DateTime
       createdAt DateTime @default(now())
     }

     model BirthProfile {
       id            String   @id @default(cuid())
       userId        String
       user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
       label         String   // "Me", "Partner", etc.
       isPrimary     Boolean  @default(false)
       birthDate     DateTime @db.Date
       birthTime     DateTime? @db.Time
       timeKnown     Boolean
       placeName     String
       lat           Float
       lon           Float
       ianaTimezone  String
       utcDatetime   DateTime
       tzConfidence  String   // "high" | "medium" | "low"
       createdAt     DateTime @default(now())
       chartsCache   ChartCache[]
       transitHitsCache TransitHitCache[]
     }

     model ChartCache {
       id              String       @id @default(cuid())
       profileId       String
       profile         BirthProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
       houseSystem     String
       chartData       Json
       chartDataVersion String
       computedAt      DateTime     @default(now())
       @@unique([profileId, houseSystem])
     }

     // Additional tables for M3+
     model TransitPosition {
       date      DateTime @db.Date
       hour      Int      // 0 for daily, 0-23 for Moon hourly
       body      String
       lon       Float
       lat       Float
       speed     Float
       retrograde Boolean
       @@unique([date, hour, body])
     }

     // ... (rest of schema in sections below)
     ```

2. **Auth System (apps/api)**
   - Install dependencies: `@fastify/session`, `@fastify/cookie`, `argon2`, `jsonwebtoken`, Google OAuth client
   - Session plugin configuration:
     - Cookie transport: HTTP-only, secure in prod, SameSite=Lax
     - Bearer transport: JWT with 30-day expiry, stored in `sessions` table
   - Routes:
     - `POST /v1/auth/register` — email/password, returns session
     - `POST /v1/auth/login` — email/password, optional `?transport=bearer`
     - `POST /v1/auth/logout` — invalidate session
     - `GET /v1/auth/oauth/google` — OAuth initiation
     - `GET /v1/auth/oauth/google/callback` — Handle callback, create/link user
   - Auth middleware: `requireAuth` hook checks cookie session or `Authorization: Bearer <token>`

3. **User Settings Management**
   - `GET /v1/me` — current user + settings
   - `PATCH /v1/me/settings` — update settings JSON:
     ```json
     {
       "houseSystem": "placidus",
       "orbs": { "conjunction": 8, "trine": 7, ... },
       "includeMinorAspects": false,
       "theme": "dark",
       "digestOptIn": false,
       "digestHour": 8
     }
     ```
   - Validation: Zod schema for settings

4. **Geocoding Service**
   - `GET /v1/geo/search?q=Los Angeles` — proxied Nominatim search
   - Caching: Postgres table `geocode_cache` (query → lat/lon/display_name, TTL 90 days)
   - Rate limiting: 1 req/sec per user
   - User-Agent header: "AstroApp/1.0 (contact@example.com)" (update with real domain)
   - Returns: `[{ displayName, lat, lon }, ...]`

5. **Timezone Resolution**
   - Install `geo-tz` for lat/lon → IANA zone
   - Function: `resolveTimezone(lat, lon, localDatetime) → { ianaZone, utcDatetime, tzConfidence }`
   - Steps:
     1. Call `geo-tz` to get IANA zone (e.g., "America/Los_Angeles")
     2. Use Luxon to parse local datetime in that zone → UTC datetime
     3. Confidence scoring:
        - High: single zone result, no ambiguity
        - Medium: multiple zones, picked closest
        - Low: pre-1970 or zone boundary edge case
   - Surface to user: "Resolved to PST (UTC-8) — confirm?"

6. **Birth Profile CRUD**
   - `POST /v1/profiles` — create profile
     - Input: label, birthDate, birthTime (optional), placeName, lat, lon
     - Server: resolve timezone, store all fields + utcDatetime
     - Return: profile ID
   - `GET /v1/profiles` — list user's profiles
   - `GET /v1/profiles/:id` — single profile
   - `PATCH /v1/profiles/:id` — update (invalidates chart cache)
   - `DELETE /v1/profiles/:id`
   - `POST /v1/profiles/:id/set-primary` — make primary for transit digest

7. **Chart Generation API**
   - `GET /v1/profiles/:id/chart?houseSystem=placidus`
   - Logic:
     1. Check `charts_cache` for (profileId, houseSystem, chartDataVersion)
     2. If cached and fresh → return
     3. Else: call `@astro/core/buildChart` with profile data + user settings
     4. Save to cache
     5. Return `ChartData` JSON
   - Handle unknown birth time: `timeKnown=false` → suppress angles/houses in ChartData

8. **Content Stubs (packages/content)**
   - Create directory structure for interpretations
   - Define schema:
     ```typescript
     interface Interpretation {
       id: string;
       summary: string;     // 1-2 sentences
       expanded: string;    // 2-3 paragraphs, MDX
       keywords: string[];
     }
     ```
   - Planet-in-sign: 12 signs × 13 bodies = 156 entries
     - Stub with `TODO(content)` marker
     - Example: `sun-in-aries.ts`:
       ```typescript
       export const sunInAries: Interpretation = {
         id: 'sun-aries',
         summary: 'TODO(content): Sun in Aries interpretation',
         expanded: 'TODO(content)',
         keywords: ['initiative', 'courage', 'independence']
       };
       ```
   - Planet-in-house: 12 houses × 13 bodies = 156 entries (same stub pattern)
   - ASC/MC in signs: 12 + 12 = 24 entries
   - Aspect interpretations: deferred to M3 (transit focus)
   - Content coverage script:
     ```bash
     pnpm --filter @astro/content run coverage
     # Output: "Planet-in-sign: 23/156 (14.7%)"
     ```

9. **Web: Auth UI**
   - Pages: `/login`, `/register`, `/logout`
   - Forms: React Hook Form + Zod validation
   - Store session in Zustand: `useAuthStore` with `{ user, isAuthenticated, login(), logout() }`
   - Protected routes: redirect to login if not authenticated

10. **Web: Birth Data Intake Flow**
    - Route: `/chart/new`
    - Steps (wizard UI):
      1. Date picker (birth date)
      2. Time input with "I don't know my birth time" checkbox
      3. Place autocomplete (calls `/v1/geo/search`, debounced)
      4. Confirmation screen showing resolved timezone + UTC datetime
      5. Label input ("Me", "My chart", etc.)
      6. Submit → `POST /v1/profiles`
    - Redirect to `/chart/:profileId` on success

11. **Web: Chart Wheel Rendering**
    - Component: `<ChartWheel chartData={...} />`
    - SVG structure:
      - Outer zodiac ring (12 signs, glyphs, 30° segments)
      - House cusps (radial lines)
      - Body glyphs positioned at ecliptic longitude
      - Collision avoidance: if bodies within 10° longitude, nudge radially outward
      - Aspect lines: color-coded (blue=harmonious, red=challenging, grey=neutral), opacity by orb tightness
    - Interactive: click body → highlight related aspects, show detail panel
    - Responsive: min 300px width, scales to container

12. **Web: Placements List View**
    - Table: Body | Sign | Degree | House | Retrograde
    - Sortable, filterable
    - Mobile-friendly alternative to wheel

13. **Web: Interpretation Panels**
    - Fetch interpretations from `@astro/content` (bundled, not API call in v1)
    - Tabs: Overview | Planets | Houses | Aspects
    - Each placement: summary visible, "Read more" expands to full text
    - If `TODO(content)`, show: "Interpretation coming soon"

14. **Web: Settings Page**
    - Route: `/settings`
    - Form: house system, orb overrides, minor aspects toggle, theme
    - Save to API: `PATCH /v1/me/settings`
    - Clear chart cache on save (server-side invalidation)

**Exit Criteria:**
- User can register, log in (email/password), log out
- User can create birth profile with geocoded place + TZ resolution
- Chart wheel renders accurately, matches fixture test cases visually
- Placements list displays all bodies/aspects
- Interpretation panels show content (even if mostly TODO stubs)
- Settings persist and affect chart computation
- Bearer token auth works (test with curl/Postman for future native)

---

### M3: Transits (Week 7-9)

**Goal:** Daily transit tracking, personalized "Today" screen, exact hit dates.

**Tasks:**

1. **Transit Positions Precomputation**
   - Database table: `transit_positions` (see M2 schema)
   - Cron job handler: `apps/api/src/cron/precompute-transits.ts`
   - Logic:
     - Compute daily positions (00:00 UTC) for Sun–Pluto + True Node
     - Compute hourly Moon positions (Moon moves ~13°/day)
     - Insert 30 days ahead, rolling window
     - Idempotent: upsert on (date, hour, body)
   - Railway cron config: daily at 02:00 UTC
   - Endpoint: `POST /internal/cron/precompute-transits` (cron-secret header auth)

2. **Transit Hit Calculation (packages/core)**
   - Function: `calculateTransitHits(transitPositions, natalChart, orbConfig)`
   - Input: today's precomputed positions, natal ChartData, orb config
   - Output: array of transit hits:
     ```typescript
     interface TransitHit {
       transitBody: AstroBody;
       transitLon: number;
       transitSpeed: number;
       natalBody: AstroBody;
       natalLon: number;
       aspectType: AspectType;
       exactOrb: number;
       applying: boolean;
       significance: number;  // Weighted score
     }
     ```
   - Orbs: tighter than natal (3° applying / 2° separating for outer, 5° for inner)
   - Applying/separating: compare transit speed to orb change rate

3. **Transit Significance Scoring**
   - Formula: `weight(transitBody) × weight(aspectType) × orbTightness × applyingBonus`
   - Weights (example):
     - Bodies: Pluto=10, Neptune=9, Uranus=8, Saturn=7, Jupiter=6, Mars=3, Venus=2, Sun/Mercury/Moon=1
     - Aspects: conjunction=10, opposition=9, square=8, trine=5, sextile=3
     - Orb tightness: `(maxOrb - exactOrb) / maxOrb` (1 = exact, 0 = edge)
     - Applying bonus: ×1.2
   - Slow-planet transits (Saturn+) to personal planets/angles: pin to top regardless

4. **Exact Hit Date Finding**
   - For slow transits (orbital period > 1 year), compute exact hit dates
   - Method: root finding on `orb(jd) = 0` function
   - Steps:
     1. Find range: today ± 6 months
     2. Detect zero-crossings (applying enters orb, goes exact, separates, exits)
     3. Use bisection to find exact-hit JD within ±1 hour
     4. Handle retrogrades: 3 passes (direct, retrograde, direct again)
   - Output: `{ exactDates: [Date, ...], effectiveRange: { start: Date, end: Date } }`

5. **Transit API Endpoints**
   - `GET /v1/profiles/:id/transits?date=YYYY-MM-DD`
     - Default: today in user's timezone (infer from profile's IANA zone)
     - Return: array of transit hits, sorted by significance
     - Check cache: `transit_hits_cache` table (profileId, date)
     - Cache TTL: 1 day (invalidate on settings change)
   - `GET /v1/profiles/:id/transits/calendar?month=YYYY-MM`
     - Return: array of dates with significant transits (score > threshold)
     - For each date: count of transits, any exact hits

6. **Transit Content Library (packages/content)**
   - Interpretations: transiting-body × aspect × natal-body matrix
   - Priority: full coverage for Saturn/Jupiter/Uranus/Neptune/Pluto → all natal bodies
   - Generic templates for fast-mover transits (Sun/Moon/Mercury/Venus/Mars)
   - Example: `transit-saturn-square-natal-sun.ts`:
     ```typescript
     export const transitSaturnSquareNatalSun: Interpretation = {
       id: 'tr-saturn-square-sun',
       summary: 'A challenging period for self-expression and confidence.',
       expanded: `Saturn's square to your natal Sun brings tests to your sense of authority and purpose. This is a time to build resilience... (2-3 paragraphs)`,
       keywords: ['discipline', 'challenge', 'maturity', 'responsibility']
     };
     ```
   - Templated fallback for uncovered combinations:
     - "{{TransitBody}} {{aspect}} your natal {{NatalBody}}: a time of {{aspect-quality}} in the area of {{NatalBody-domain}}."

7. **Web: Today Screen**
   - Route: `/` (home for authenticated users)
   - Layout:
     - **Header:** "Today: {{date}}" + sky summary
       - Current Moon sign + phase (fetch from precomputed positions)
       - Any sign ingresses today (planet entering new sign)
       - Stations/retrogrades today (detect speed sign change in transit positions)
     - **Transit List:**
       - Ranked by significance
       - Each item: "{{Transit icon}} {{Aspect}} {{Natal icon}}" + interpretation summary
       - Expand → full interpretation + exact dates + orb info
       - Slow transits: "In effect {{startMonth}}–{{endMonth}}, exact {{dates}}"
     - **Daily Drill (M5):** Placeholder for now

8. **Web: Transit Calendar**
   - Route: `/transits/calendar`
   - Month view (React Big Calendar or custom)
   - Mark days with significant transits (dot/color coding)
   - Click day → navigate to `/transits/day/YYYY-MM-DD` showing that day's transit list

9. **Web: Transit Detail View**
   - Route: `/transits/:transitId` (or inline expansion in Today screen)
   - Show:
     - Transit + aspect + natal body
     - Interpretation (full expanded text)
     - Exact hit dates (if slow transit)
     - Effective date range
     - Chart visualization: mini-wheel with transit overlay (transit bodies in outer ring)

**Exit Criteria:**
- Precompute cron runs successfully, populates 30 days ahead
- Today screen shows accurate transits matching Astro.com for test profiles
- Exact hit dates within ±1 hour of reference
- Transit content library has full Saturn–Pluto coverage (50+ interpretations)
- Calendar view navigable, days clickable

---

### M4: Learning (Week 10-12)

**Goal:** 8-module Foundations track, personalized chart quizzes, progress tracking.

**Tasks:**

1. **Learning Content Structure (packages/content)**
   - Tracks/modules/lessons hierarchy:
     ```
     learning/
       tracks/
         foundations/
           meta.ts → { trackId, title, modules: [...] }
           modules/
             01-chart-map/
               meta.ts → { moduleId, title, lessons: [...], quizId }
               lessons/
                 01-wheel-anatomy.mdx
                 02-ecliptic.mdx
                 ...
             02-planets/
             ...
             08-transits/
     ```
   - Each lesson: MDX file with frontmatter (title, order, estimated minutes)
   - MDX components: `<MiniWheel>`, `<ConceptCheck>`, `<Highlight>`, etc.

2. **MDX Rendering Setup**
   - Install `@mdx-js/react`, Vite plugin for MDX
   - Create MDX components provider in web app
   - `<MiniWheel>`: accepts `highlight` prop (body/sign/house), renders simplified chart wheel from user's ChartData
   - `<ConceptCheck>`: inline single-question quiz (MCQ), checks answer, shows explanation

3. **Lesson Content Writing**
   - Write full content for Track 1: Foundations (8 modules, ~40 lessons)
   - Module 5 ("Reading a placement") MUST use user's own chart in examples:
     - "Your {{planet}} in {{sign}} in the {{house}} house combines..."
     - Template engine: replace placeholders with actual user chart data at render time
   - Tone: grounded, warm, jargon-defined-on-first-use, no fatalism

4. **Database Schema: Learning**
   - Tables:
     ```prisma
     model Track {
       id        String   @id
       title     String
       order     Int
       modules   Module[]
     }

     model Module {
       id         String   @id
       trackId    String
       track      Track    @relation(fields: [trackId], references: [id])
       title      String
       order      Int
       lessons    Lesson[]
       quizId     String?
       quiz       Quiz?    @relation(fields: [quizId], references: [id])
     }

     model Lesson {
       id              String   @id
       moduleId        String
       module          Module   @relation(fields: [moduleId], references: [id])
       title           String
       order           Int
       contentPath     String   // Path to MDX file
       estimatedMinutes Int
       lessonProgress  LessonProgress[]
     }

     model LessonProgress {
       id          String   @id @default(cuid())
       userId      String
       user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
       lessonId    String
       lesson      Lesson   @relation(fields: [lessonId], references: [id])
       completedAt DateTime @default(now())
       @@unique([userId, lessonId])
     }

     model Quiz {
       id        String   @id
       moduleId  String
       module    Module[]
       questions QuizQuestion[]
       attempts  QuizAttempt[]
     }

     model QuizQuestion {
       id          String   @id @default(cuid())
       quizId      String
       quiz        Quiz     @relation(fields: [quizId], references: [id])
       type        String   // "static_mcq" | "personalized_mcq" | "glyph"
       conceptTags String[] // ["planets", "signs"]
       payload     Json     // Question data (varies by type)
       order       Int
     }

     model QuizAttempt {
       id        String   @id @default(cuid())
       userId    String
       user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
       quizId    String
       quiz      Quiz     @relation(fields: [quizId], references: [id])
       score     Float    // Percentage
       answers   Json     // Array of { questionId, selectedAnswer, correct }
       createdAt DateTime @default(now())
     }
     ```
   - Seed script: populate tracks/modules/lessons from content package metadata

5. **Content API Endpoints**
   - `GET /v1/content/tracks` — list all tracks with modules
   - `GET /v1/content/modules/:id` — module detail + lessons list
   - `GET /v1/content/lessons/:id` — lesson metadata + content (MDX string or rendered HTML)
   - `POST /v1/lessons/:id/complete` — mark lesson complete, record timestamp

6. **Quiz Question Types**
   - **Static MCQ:** stored in DB, fixed question/answers
   - **Personalized MCQ:** generated at runtime via `@astro/core/quiz` module
     - Templates: "Which house is your natal {{planet}} in?" → replace {{planet}} with actual user planet, generate 4 options (1 correct + 3 plausible distractors from adjacent houses)
     - Function: `generatePersonalQuestions(chartData, conceptTags, count) → QuizQuestion[]`
   - **Glyph identification:** show planet/sign glyph image, ask "What is this?"

7. **Quiz API Endpoints**
   - `GET /v1/quizzes/module/:id` — fetch quiz questions (mix of static + personalized runtime-generated)
   - `POST /v1/quizzes/module/:id/attempts` — submit answers, return score + correct answers
   - Passing threshold: 80%
   - Unlimited retakes, questions shuffled

8. **Personalized Question Generator (packages/core)**
   - `quiz/personalized-generator.ts`
   - Question templates:
     ```typescript
     const templates = [
       {
         id: 'natal-planet-house',
         conceptTags: ['planets', 'houses'],
         template: 'Which house is your natal {{planet}} in?',
         generateOptions: (chart, planet) => {
           const correct = chart.bodies.find(b => b.body === planet).house;
           const distractors = [correct - 1, correct + 1, correct + 6].map(h => (h % 12) + 1);
           return shuffle([correct, ...distractors.slice(0, 3)]);
         }
       },
       // ... more templates
     ];
     ```
   - Ensure answerability: only generate questions for aspects/placements that exist in user's chart

9. **Web: Learning UI**
   - Route: `/learn` — track list
   - Route: `/learn/modules/:id` — module detail, lessons list, progress %
   - Route: `/learn/lessons/:id` — lesson viewer (MDX rendered)
     - "Next" button at bottom → next lesson or quiz
   - Route: `/learn/quizzes/:id` — quiz interface (MCQ cards, submit, results)

10. **Progress Tracking**
    - Lesson completion: `POST /v1/lessons/:id/complete` on "Next" click or explicit "Mark complete"
    - Module completion: calculated server-side (all lessons complete + quiz ≥80%)
    - Progress display:
      - Per module: "3/5 lessons, quiz not started"
      - Per track: "Module 2/8, 34% complete"

11. **Streak Counter (M5 preview)**
    - Track daily engagement: lesson completion or quiz attempt counts as activity
    - Timezone-aware: use user's IANA zone to determine "today"
    - Display on profile: "🔥 5 day streak"

**Exit Criteria:**
- All 8 modules of Foundations track have complete lesson content
- At least 2 modules have personalized chart examples
- Quizzes generate personalized questions correctly
- User can complete a module: lessons → quiz → pass → next module
- Progress % accurate across sessions

---

### M5: Retention & Polish (Week 13-14)

**Goal:** Spaced repetition, email digest, settings, accessibility pass.

**Tasks:**

1. **Spaced Repetition System (SRS)**
   - Algorithm: SM-2 (SuperMemo 2)
   - Database table: `srs_cards` (see schema in M2)
   - Each quiz question becomes an SRS card after first attempt
   - Track: ease, interval (days), due date, lapse count
   - On correct answer: interval increases (ease-based), due date pushed
   - On incorrect: lapse++, interval resets to 1 day, card re-enters queue

2. **Daily Drill**
   - `GET /v1/drill/today` — fetch up to 10 due cards for user
   - `POST /v1/drill/answers` — submit answers, update card states
   - Web: `/drill` route
     - Card interface: question, 4 options, submit
     - After answer: show correct answer + brief explanation
     - Progress: "3/10 cards reviewed today"
   - Display on Today screen: "💪 Daily Drill: 7 cards due"

3. **Stats Dashboard**
   - Route: `/stats`
   - Display:
     - Accuracy by concept tag (planets: 85%, signs: 78%, houses: 92%, aspects: 65%)
     - Weakest concept: link to relevant lesson
     - Streak counter
     - Total quizzes taken, average score

4. **Email Digest**
   - Cron job: `POST /internal/cron/send-digests` daily at 00:00 UTC
   - Logic:
     1. Query users with `settings.digestOptIn = true`
     2. For each: compute digest hour in their IANA timezone
     3. If current UTC hour matches their local 8:00 AM → send email
   - Email content (Resend):
     - Subject: "Your daily astrology digest for {{date}}"
     - Body:
       - Sky summary (Moon sign, ingresses, stations)
       - Top 3 transits to their primary profile
       - Link to Today screen
       - "Review Daily Drill: X cards due" (if any)
   - Template: plain text (v1), HTML in M5.5

5. **Settings Expansion**
   - Add to `/v1/me/settings`:
     - `digestOptIn: boolean`
     - `digestHour: number` (0–23, local time)
     - `notifications: { transits: boolean, drill: boolean }`
   - Web: `/settings` form updates

6. **Accessibility (A11y) Pass**
   - Run Lighthouse audit on key screens: Today, Chart, Lesson, Quiz
   - Target: ≥90 a11y score
   - Fixes:
     - All glyphs have `aria-label`
     - Chart wheel: placements list as accessible alternative
     - Color-coding not sole channel: aspect lines also use dash patterns (dashed=challenging, solid=harmonious)
     - Keyboard navigation: tab through chart bodies, enter to expand
     - Focus indicators visible
     - Contrast ratios: text ≥4.5:1, large text ≥3:1

7. **Empty & Error States**
   - Empty states:
     - No birth profiles: "Create your first chart" CTA
     - No transits today: "No major transits today — a quiet sky"
     - No drill cards due: "You're all caught up! 🎉"
   - Error states:
     - API error: "Something went wrong. Please try again."
     - Geocode fail: "Location not found. Try a different search."
     - Chart computation fail: "Unable to compute chart. Check birth data."

8. **Performance Optimization**
   - Chart computation: server-side <150 ms (already achieved in M1 tests)
   - Today screen TTI: <2.5 s on 3G
     - Lazy-load transit interpretations (expand on demand)
     - Prefetch precomputed positions
   - SVG chart wheel: optimize for 60 fps on mobile
     - Limit aspect lines rendered (only tight orbs by default, "Show all" toggle)

9. **Dark Mode**
   - Tailwind dark mode strategy: `class` (user-controlled, stored in settings)
   - Add toggle in settings, persist to `settings.theme`
   - Ensure chart wheel SVG colors respect dark mode

10. **Privacy Page**
    - Route: `/privacy`
    - Plain-language content:
      - What data is collected (birth data, email, usage stats)
      - How it's used (chart computation, learning progress, digest)
      - Not shared with third parties
      - Account deletion: hard-delete all profiles + caches
    - Link in footer

**Exit Criteria:**
- Daily Drill functional, cards update on SM-2 schedule
- Email digest sends to opted-in users at correct local time
- Lighthouse a11y ≥90 on Today, Chart, Lesson, Quiz screens
- Empty/error states present and helpful
- Dark mode works across all screens
- Privacy page published

---

### M6: Native Wrap (Week 15-16)

**Goal:** iOS + Android TestFlight/internal builds, native features functional.

**Tasks:**

1. **Capacitor Setup**
   - Install Capacitor in `apps/web`:
     ```bash
     cd apps/web
     pnpm add @capacitor/core @capacitor/cli
     pnpm add @capacitor/ios @capacitor/android
     npx cap init
     ```
   - Configure `capacitor.config.ts`:
     ```typescript
     import { CapacitorConfig } from '@capacitor/cli';
     const config: CapacitorConfig = {
       appId: 'com.astroapp.app',
       appName: 'AstroApp',
       webDir: 'dist',
       server: {
         androidScheme: 'https',
         iosScheme: 'capacitor',
         allowNavigation: ['https://api.astroapp.com'] // prod API
       },
       plugins: {
         SplashScreen: { launchAutoHide: false },
       }
     };
     export default config;
     ```

2. **iOS Project**
   - Add iOS platform: `npx cap add ios`
   - Open in Xcode: `npx cap open ios`
   - Configure:
     - Bundle ID: `com.astroapp.app`
     - Team: select dev team for signing
     - Deployment target: iOS 14+
   - Build: `npx cap build ios`
   - Run on simulator/device

3. **Android Project**
   - Add Android platform: `npx cap add android`
   - Open in Android Studio: `npx cap open android`
   - Configure:
     - Package name: `com.astroapp.app`
     - Min SDK: 22 (Android 5.1+)
   - Build: `npx cap build android`
   - Run on emulator/device

4. **Bearer Auth Verification**
   - In native builds, cookies may not work (WKWebView restrictions)
   - Ensure `?transport=bearer` login flow works
   - Store JWT in Capacitor Preferences (not localStorage)
   - Attach `Authorization: Bearer <token>` to all API requests

5. **StorageProvider Abstraction**
   - Create `lib/storage.ts`:
     ```typescript
     interface StorageProvider {
       get(key: string): Promise<string | null>;
       set(key: string, value: string): Promise<void>;
       remove(key: string): Promise<void>;
     }
     ```
   - Web implementation: localStorage wrapper
   - Native implementation: Capacitor Preferences
   - Detect platform: `Capacitor.isNativePlatform()`

6. **NotificationProvider Abstraction**
   - Install `@capacitor/local-notifications`
   - Create `lib/notifications.ts`:
     ```typescript
     interface NotificationProvider {
       schedule(notification: { title, body, date }): Promise<void>;
       cancel(id: string): Promise<void>;
     }
     ```
   - Web: no-op (digests via email)
   - Native: use Local Notifications for daily transit digest
   - Schedule at user's `digestHour` local time

7. **Daily Digest as Local Notification**
   - Replace email with local notification in native builds
   - Notification content: "Your daily astrology digest" + top transit summary
   - Tap → open app to Today screen
   - Scheduling: compute next occurrence of `digestHour`, schedule 30 days ahead (iOS limit)

8. **Safe Area Handling**
   - Add CSS env vars for notch/home indicator:
     ```css
     .app-header {
       padding-top: env(safe-area-inset-top);
     }
     .app-footer {
       padding-bottom: env(safe-area-inset-bottom);
     }
     ```
   - Test on iPhone X+ and Android devices with notches

9. **CORS Configuration Verification**
   - API CORS allowlist must include:
     - Web origin: `https://app.astroapp.com`
     - Capacitor iOS: `capacitor://localhost`
     - Capacitor Android: `http://localhost` (with `androidScheme: 'https'`, this may be `https://localhost`)
   - Test API calls from native builds

10. **App Store Assets**
    - Icon: 1024×1024 PNG, alpha-free
    - Splash screen: adaptive for iOS (LaunchScreen.storyboard) and Android (res/drawable)
    - Screenshots: 6.5" iPhone, 12.9" iPad, Android phone
    - Privacy manifest (iOS): declare data usage

11. **TestFlight / Internal Testing**
    - iOS: upload to TestFlight via Xcode or `fastlane`
    - Android: upload to Internal Testing track in Play Console
    - Invite testers, verify:
      - Login works (bearer auth)
      - Chart renders correctly
      - Notifications fire at correct time
      - No crashes on chart wheel interaction

**Exit Criteria:**
- iOS and Android builds run without crashes
- Bearer auth works in WKWebView
- Local notifications fire at correct time
- StorageProvider works on both platforms
- Safe area insets respected
- TestFlight + internal Android build distributed to testers

---

## 5. Core Package Specifications

### 5.1 packages/core

**Purpose:** Pure TypeScript chart mathematics. Zero DOM/Node-API dependencies.

**Public API:**

```typescript
// Main export
export { buildChart } from './chart/builder';
export type { ChartData, BirthData, ChartOptions } from './chart/types';
export { CHART_DATA_VERSION } from './chart/version';

// Enums
export { AstroBody, ZodiacSign, AspectType, HouseSystem } from './types';

// Utils
export { zodiacSignName, zodiacSignGlyph } from './utils/zodiac';
export { bodyGlyph, bodyName } from './utils/bodies';
export { formatDMS } from './utils/coordinates';

// Transit functions (M3)
export { calculateTransitHits } from './transits/calculator';
export { findExactHitDates } from './transits/exact-hit';
export type { TransitHit } from './transits/types';

// Quiz generator (M4)
export { generatePersonalQuestions } from './quiz/personalized-generator';
```

**Key Files:**

- `ephemeris/adapter.ts`: `EphemerisAdapter` interface
- `ephemeris/astronomy-engine.ts`: Implementation using astronomy-engine
- `houses/placidus.ts`: Placidus house calculator with polar fallback
- `houses/whole-sign.ts`: Whole Sign calculator
- `aspects/calculator.ts`: Aspect detection with orbs
- `chart/builder.ts`: Main `buildChart` function
- `transits/calculator.ts`: Transit hit detection
- `transits/exact-hit.ts`: Root finding for exact transit dates
- `quiz/personalized-generator.ts`: Question template engine

**Tests:**

- `test/fixtures/`: JSON files with reference ephemeris values
- `test/accuracy.test.ts`: CI-blocking accuracy suite
- `test/houses.test.ts`: House calculation edge cases (polar latitudes)
- `test/aspects.test.ts`: Aspect orb calculations
- `test/transits.test.ts`: Transit hit detection accuracy

**Dependencies:**

- `astronomy-engine`: Ephemeris calculations
- `luxon`: Date/time + Julian conversions (peer dependency)

**No dependencies on:** React, Node APIs, DOM, file system

---

### 5.2 packages/content

**Purpose:** Interpretation library + learning module content. Versioned, reviewable.

**Structure:**

```typescript
// Interpretations
export function getPlanetInSign(planet: AstroBody, sign: ZodiacSign): Interpretation;
export function getPlanetInHouse(planet: AstroBody, house: number): Interpretation;
export function getAspectInterpretation(body1: AstroBody, aspect: AspectType, body2: AstroBody): Interpretation;
export function getAngleInSign(angle: 'ASC' | 'MC', sign: ZodiacSign): Interpretation;
export function getTransitInterpretation(transitBody: AstroBody, aspect: AspectType, natalBody: AstroBody): Interpretation;

// Learning content
export function getTracks(): Track[];
export function getModule(id: string): Module;
export function getLesson(id: string): Lesson;

// Coverage reporting
export function reportCoverage(): { [category: string]: { written: number; total: number; percent: number } };
```

**Interpretation Schema:**

```typescript
interface Interpretation {
  id: string;
  summary: string;        // 1-2 sentences, beginner-friendly
  expanded: string;       // 2-3 paragraphs, MDX format
  keywords: string[];     // 3-5 keywords
  isStub: boolean;        // true if TODO(content)
}
```

**Learning Schema:**

```typescript
interface Track {
  id: string;
  title: string;
  order: number;
  modules: Module[];
}

interface Module {
  id: string;
  trackId: string;
  title: string;
  order: number;
  lessons: Lesson[];
  quizId: string | null;
}

interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  contentPath: string;    // Path to MDX file
  estimatedMinutes: number;
}
```

**MDX Components:**

- `<MiniWheel highlight="moon" />`: Renders user's chart wheel, highlights specified body
- `<ConceptCheck question="..." options={[...]} correctIndex={0} />`: Inline quiz
- `<Highlight term="retrograde">`: Glossary term with hover definition

**Content Coverage Script:**

```bash
pnpm --filter @astro/content run coverage
# Output:
# Planet-in-sign: 156/156 (100%)
# Planet-in-house: 89/156 (57%)
# Aspects (natal): 78/78 (100%)
# Transits (outer): 60/60 (100%)
# Lessons: 40/40 (100%)
```

**Dependencies:**

- MDX parser/renderer (for type checking only; runtime rendering in web app)
- Zod: schemas for validation

---

### 5.3 packages/api-client

**Purpose:** Type-safe generated API client, shared by web + future native.

**Generated from:** OpenAPI spec exported by `apps/api` (Fastify Swagger)

**Structure:**

```typescript
// Generated (do not edit manually)
import type { paths } from './generated/api-types';
import createClient from 'openapi-fetch';

// Wrapper with auth/error handling
export class ApiClient {
  private client: ReturnType<typeof createClient<paths>>;

  constructor(baseUrl: string, getAuthToken: () => string | null) {
    this.client = createClient<paths>({ baseURL: baseUrl });
    // Interceptor: add Authorization header if token exists
  }

  // Typed methods
  async getMe() { return this.client.GET('/v1/me'); }
  async updateSettings(settings: UserSettings) { return this.client.PATCH('/v1/me/settings', { body: settings }); }
  async createProfile(data: CreateProfileDto) { return this.client.POST('/v1/profiles', { body: data }); }
  async getChart(profileId: string, houseSystem?: HouseSystem) {
    return this.client.GET('/v1/profiles/{id}/chart', { params: { path: { id: profileId }, query: { house_system: houseSystem } } });
  }
  // ... all endpoints
}
```

**Code Generation:**

```bash
# In apps/api: generate openapi.json
pnpm --filter api run build:openapi

# In packages/api-client: generate types + client
pnpm --filter @astro/api-client run generate
```

**Dependencies:**

- `openapi-fetch`: Type-safe fetch client
- `openapi-typescript`: Type generator

**Usage in Web:**

```typescript
// apps/web/src/lib/api.ts
import { ApiClient } from '@astro/api-client';

export const apiClient = new ApiClient(
  import.meta.env.VITE_API_URL,
  () => localStorage.getItem('auth_token') // Or Capacitor Preferences
);
```

---

## 6. API Design Specifications

### 6.1 Route Organization

```
apps/api/src/routes/
  auth/
    register.ts          POST /v1/auth/register
    login.ts             POST /v1/auth/login
    logout.ts            POST /v1/auth/logout
    oauth-google.ts      GET /v1/auth/oauth/google, /callback
  users/
    me.ts                GET /v1/me, PATCH /v1/me/settings
  geo/
    search.ts            GET /v1/geo/search
  profiles/
    create.ts            POST /v1/profiles
    list.ts              GET /v1/profiles
    get.ts               GET /v1/profiles/:id
    update.ts            PATCH /v1/profiles/:id
    delete.ts            DELETE /v1/profiles/:id
    set-primary.ts       POST /v1/profiles/:id/set-primary
  charts/
    get-chart.ts         GET /v1/profiles/:id/chart
  transits/
    get-transits.ts      GET /v1/profiles/:id/transits
    calendar.ts          GET /v1/profiles/:id/transits/calendar
  content/
    tracks.ts            GET /v1/content/tracks
    modules.ts           GET /v1/content/modules/:id
    lessons.ts           GET /v1/content/lessons/:id
  learning/
    complete-lesson.ts   POST /v1/lessons/:id/complete
  quizzes/
    get-quiz.ts          GET /v1/quizzes/module/:id
    submit-attempt.ts    POST /v1/quizzes/module/:id/attempts
  drill/
    get-today.ts         GET /v1/drill/today
    submit-answers.ts    POST /v1/drill/answers
  internal/
    cron-precompute.ts   POST /internal/cron/precompute-transits
    cron-digest.ts       POST /internal/cron/send-digests
```

### 6.2 Authentication Middleware

```typescript
// apps/api/src/lib/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt';
import { findSessionByToken } from './db/sessions';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // Check cookie session first
  if (request.session.userId) {
    request.user = { id: request.session.userId };
    return;
  }

  // Check Authorization header for bearer token
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = await findSessionByToken(token);
    if (session && session.expiresAt > new Date()) {
      request.user = { id: session.userId };
      return;
    }
  }

  reply.code(401).send({ error: 'Unauthorized' });
}
```

### 6.3 OpenAPI Schema Generation

```typescript
// apps/api/src/server.ts
import fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

const server = fastify({ logger: true });

await server.register(fastifySwagger, {
  openapi: {
    info: { title: 'AstroApp API', version: '1.0.0' },
    servers: [{ url: 'https://api.astroapp.com' }],
  },
});

await server.register(fastifySwaggerUI, {
  routePrefix: '/docs',
});

// Routes...

await server.ready();
server.swagger(); // Export openapi.json for codegen
```

### 6.4 Rate Limiting

```typescript
// apps/api/src/lib/rate-limit.ts
import rateLimit from '@fastify/rate-limit';

export const authRateLimit = rateLimit({
  max: 5,              // 5 requests
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({ error: 'Too many attempts. Try again later.' }),
});

export const geoRateLimit = rateLimit({
  max: 10,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.user?.id || request.ip,
});
```

---

## 7. Web Application Specifications

### 7.1 Routing

```typescript
// apps/web/src/routes.tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <TodayScreen /> },              // Authenticated home
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'chart/new', element: <BirthDataIntake /> },
      { path: 'chart/:profileId', element: <ChartView /> },
      { path: 'transits/calendar', element: <TransitCalendar /> },
      { path: 'transits/day/:date', element: <TransitDay /> },
      { path: 'learn', element: <LearnHome /> },
      { path: 'learn/modules/:moduleId', element: <ModuleView /> },
      { path: 'learn/lessons/:lessonId', element: <LessonView /> },
      { path: 'learn/quizzes/:quizId', element: <QuizView /> },
      { path: 'drill', element: <DailyDrill /> },
      { path: 'stats', element: <StatsView /> },
      { path: 'settings', element: <Settings /> },
      { path: 'privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

### 7.2 State Management

**Zustand Stores:**

```typescript
// apps/web/src/stores/auth.ts
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email, password) => { /* ... */ },
  logout: async () => { /* ... */ },
  fetchUser: async () => { /* ... */ },
}));

// apps/web/src/stores/profiles.ts
export const useProfilesStore = create<ProfilesStore>((set) => ({
  profiles: [],
  primaryProfile: null,
  fetchProfiles: async () => { /* ... */ },
  createProfile: async (data) => { /* ... */ },
  setPrimary: async (id) => { /* ... */ },
}));

// apps/web/src/stores/chart.ts
export const useChartStore = create<ChartStore>((set) => ({
  currentChart: null,
  loadChart: async (profileId, houseSystem) => { /* ... */ },
  clearChart: () => set({ currentChart: null }),
}));
```

### 7.3 Key Components

**ChartWheel.tsx:**

```typescript
interface ChartWheelProps {
  chartData: ChartData;
  size?: number;
  onBodyClick?: (body: AstroBody) => void;
}

export function ChartWheel({ chartData, size = 500, onBodyClick }: ChartWheelProps) {
  // SVG rendering logic
  // - Outer zodiac ring (12 signs)
  // - House cusps (radial lines)
  // - Body glyphs positioned at ecliptic longitude
  // - Aspect lines (color-coded, opacity by orb)
  // - Click handlers
}
```

**BirthDataIntake.tsx:**

Multi-step wizard with validation at each step.

**TransitCard.tsx:**

```typescript
interface TransitCardProps {
  transit: TransitHit;
  interpretation: Interpretation;
  onExpand: () => void;
}

export function TransitCard({ transit, interpretation, onExpand }: TransitCardProps) {
  // Display: transit icon, aspect, natal icon, summary
  // Expand button → full interpretation
}
```

**LessonViewer.tsx:**

```typescript
interface LessonViewerProps {
  lesson: Lesson;
  chartData: ChartData | null;
}

export function LessonViewer({ lesson, chartData }: LessonViewerProps) {
  // Render MDX content
  // Inject chartData into MDX context for <MiniWheel> components
  // "Next" button at bottom
}
```

### 7.4 Styling

**Tailwind Config:**

```javascript
// apps/web/tailwind.config.js
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { /* ... */ },
        accent: { /* ... */ },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

**Safe Area CSS:**

```css
/* apps/web/src/index.css */
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
}

.app-header {
  padding-top: var(--safe-area-inset-top);
}
```

---

## 8. Database Schema Details

### 8.1 Full Prisma Schema

```prisma
// apps/api/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id              String           @id @default(cuid())
  email           String           @unique
  passwordHash    String?
  oauthProvider   String?
  oauthSub        String?
  createdAt       DateTime         @default(now())
  settings        Json             @default("{}")
  sessions        Session[]
  birthProfiles   BirthProfile[]
  lessonProgress  LessonProgress[]
  quizAttempts    QuizAttempt[]
  srsCards        SrsCard[]

  @@index([email])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  transport String   // "cookie" | "bearer"
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([tokenHash])
  @@index([userId])
}

model BirthProfile {
  id              String             @id @default(cuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  label           String
  isPrimary       Boolean            @default(false)
  birthDate       DateTime           @db.Date
  birthTime       DateTime?          @db.Time
  timeKnown       Boolean
  placeName       String
  lat             Float
  lon             Float
  ianaTimezone    String
  utcDatetime     DateTime
  tzConfidence    String             // "high" | "medium" | "low"
  createdAt       DateTime           @default(now())
  chartsCache     ChartCache[]
  transitHitsCache TransitHitCache[]

  @@index([userId])
}

model ChartCache {
  id              String       @id @default(cuid())
  profileId       String
  profile         BirthProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  houseSystem     String
  chartData       Json
  chartDataVersion String
  computedAt      DateTime     @default(now())

  @@unique([profileId, houseSystem])
  @@index([profileId])
}

model TransitPosition {
  date       DateTime @db.Date
  hour       Int      // 0 for daily, 0-23 for Moon hourly
  body       String
  lon        Float
  lat        Float
  speed      Float
  retrograde Boolean

  @@unique([date, hour, body])
  @@index([date, body])
}

model TransitHitCache {
  profileId  String
  profile    BirthProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  date       DateTime     @db.Date
  hits       Json
  computedAt DateTime     @default(now())

  @@unique([profileId, date])
  @@index([profileId, date])
}

model GeocodeCache {
  query       String   @id
  results     Json
  cachedAt    DateTime @default(now())
  expiresAt   DateTime
}

model Track {
  id      String   @id
  title   String
  order   Int
  modules Module[]
}

model Module {
  id      String   @id
  trackId String
  track   Track    @relation(fields: [trackId], references: [id])
  title   String
  order   Int
  lessons Lesson[]
  quizId  String?  @unique
  quiz    Quiz?
}

model Lesson {
  id               String           @id
  moduleId         String
  module           Module           @relation(fields: [moduleId], references: [id])
  title            String
  order            Int
  contentPath      String
  estimatedMinutes Int
  lessonProgress   LessonProgress[]
}

model LessonProgress {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id])
  completedAt DateTime @default(now())

  @@unique([userId, lessonId])
  @@index([userId])
}

model Quiz {
  id        String         @id
  moduleId  String         @unique
  module    Module         @relation(fields: [moduleId], references: [id])
  questions QuizQuestion[]
  attempts  QuizAttempt[]
}

model QuizQuestion {
  id          String   @id @default(cuid())
  quizId      String
  quiz        Quiz     @relation(fields: [quizId], references: [id])
  type        String   // "static_mcq" | "personalized_mcq" | "glyph"
  conceptTags String[]
  payload     Json
  order       Int
}

model QuizAttempt {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  quizId    String
  quiz      Quiz     @relation(fields: [quizId], references: [id])
  score     Float
  answers   Json
  createdAt DateTime @default(now())

  @@index([userId])
}

model SrsCard {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  questionRef  String   // Reference to quiz question or concept
  ease         Float    @default(2.5)
  intervalDays Int      @default(1)
  dueDate      DateTime
  lapses       Int      @default(0)
  lastReviewed DateTime?

  @@index([userId, dueDate])
}
```

### 8.2 Migrations

```bash
# Create initial migration
cd apps/api
pnpm prisma migrate dev --name init

# Deploy to Railway (in railway.json pre-deploy hook)
pnpm prisma migrate deploy
```

### 8.3 Seeding

```typescript
// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { getTracks } from '@astro/content';

const prisma = new PrismaClient();

async function main() {
  // Seed learning content structure from packages/content
  const tracks = getTracks();
  for (const track of tracks) {
    await prisma.track.upsert({
      where: { id: track.id },
      update: {},
      create: {
        id: track.id,
        title: track.title,
        order: track.order,
        modules: {
          create: track.modules.map((module) => ({
            id: module.id,
            title: module.title,
            order: module.order,
            lessons: {
              create: module.lessons.map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
                order: lesson.order,
                contentPath: lesson.contentPath,
                estimatedMinutes: lesson.estimatedMinutes,
              })),
            },
            quiz: module.quizId ? { create: { id: module.quizId } } : undefined,
          })),
        },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run: `pnpm --filter api prisma db seed`

---

## 9. Content System Architecture

### 9.1 Content Organization

All content lives in `packages/content/src/`, versioned in Git.

**Interpretations:** TypeScript modules exporting typed `Interpretation` objects.

**Lessons:** MDX files with frontmatter + custom components.

**Quizzes:** Static questions in TypeScript; personalized templates in `@astro/core`.

### 9.2 Content Workflow

1. **Writing:** Contributors write interpretations/lessons in IDE with type checking.
2. **Review:** PR review ensures tone, accuracy, completeness.
3. **Coverage:** `pnpm content:coverage` script tracks completion %.
4. **Seeding:** Deploy script seeds DB with content structure (not full text — text bundled in frontend for now; move to DB in v2 if CMS needed).

### 9.3 MDX Component Library

**MiniWheel:**

```typescript
// packages/content/src/components/MiniWheel.tsx
interface MiniWheelProps {
  highlight?: AstroBody | ZodiacSign | number; // Body, sign, or house
  size?: number;
}

export function MiniWheel({ highlight, size = 200 }: MiniWheelProps) {
  const chartData = useUserChart(); // Hook provides user's chart
  // Render simplified wheel, highlight specified element
}
```

**ConceptCheck:**

```typescript
interface ConceptCheckProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export function ConceptCheck({ question, options, correctIndex, explanation }: ConceptCheckProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Render MCQ, check answer, show feedback
}
```

---

## 10. Authentication & Security

### 10.1 Password Security

- **Hashing:** argon2id with default parameters (memory cost, iterations, parallelism).
- **Validation:** min 8 chars, no common passwords (check against list).

### 10.2 Session Management

- **Cookie sessions:** HTTP-only, Secure (prod only), SameSite=Lax, 30-day expiry.
- **Bearer tokens:** JWT with 30-day expiry, stored in `sessions` table (allows revocation).
- **Refresh flow:** not in v1; user re-authenticates after 30 days.

### 10.3 OAuth (Google)

- **Library:** Official Google OAuth Node.js client.
- **Flow:**
  1. User clicks "Sign in with Google"
  2. Redirect to Google consent screen
  3. Google redirects to `/v1/auth/oauth/google/callback` with code
  4. Exchange code for tokens, get user profile (email, sub)
  5. Upsert user (match on `oauthProvider='google', oauthSub=...`)
  6. Create session, return cookie/token

### 10.4 API Security

- **CORS:** Allowlist web origin + Capacitor schemes.
- **Rate limiting:** 5 req/min on auth, 10 req/min on geo.
- **SQL injection:** Parameterized queries via Prisma (automatic protection).
- **XSS:** React escapes by default; MDX content sanitized.
- **Cron auth:** `X-Cron-Secret` header must match `CRON_SECRET` env var.

### 10.5 Data Privacy

- **Birth data:** sensitive — no logging, no third-party analytics.
- **Account deletion:** hard-delete user, cascade to profiles/sessions/caches.
- **GDPR:** privacy page, deletion on request (email support).

---

## 11. Deployment Strategy

### 11.1 Railway Configuration

**Services:**

1. **postgres**: Railway Postgres plugin.
2. **api**: Fastify app.
   - Buildpack: Nixpacks auto-detect (Node.js).
   - Start command: `pnpm --filter api start` (or `node dist/index.js` after build).
   - Env vars:
     - `DATABASE_URL`: from Postgres plugin.
     - `PORT`: Railway-provided.
     - `SESSION_SECRET`: generate secure random.
     - `CRON_SECRET`: generate secure random.
     - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`: from Google Console.
     - `RESEND_API_KEY`: from Resend.
     - `WEB_ORIGIN`: e.g., `https://app.astroapp.com`.
     - `NOMINATIM_USER_AGENT`: `AstroApp/1.0 (contact@astroapp.com)`.
   - Pre-deploy command: `pnpm prisma migrate deploy`.
   - Healthcheck: `GET /v1/health`.

3. **web**: Static SPA.
   - Buildpack: static (or Caddy/serve).
   - Build command: `pnpm --filter web build`.
   - Output: `apps/web/dist`.
   - Env vars (build-time):
     - `VITE_API_URL`: `https://api.astroapp.com/v1`.

4. **cron**: Railway cron service (or separate service with cron schedule).
   - Schedule: daily at 02:00 UTC → `POST /internal/cron/precompute-transits`.
   - Schedule: hourly → `POST /internal/cron/send-digests` (checks which users need digest at current hour).

**railway.json (optional):**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm --filter api start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 11.2 Environment Variables

**.env.example (root):**

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/astrosetta_dev

# API
PORT=3000
SESSION_SECRET=generate_with_openssl_rand_hex_32
CRON_SECRET=generate_with_openssl_rand_hex_32
WEB_ORIGIN=http://localhost:5173

# OAuth
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...

# Geocoding
NOMINATIM_USER_AGENT=AstroApp/1.0 (your-email@example.com)

# Web (frontend)
VITE_API_URL=http://localhost:3000/v1
```

### 11.3 CI/CD Pipeline

**.github/workflows/ci.yml:**

```yaml
name: CI

on: [pull_request, push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck
      - run: pnpm turbo test
```

**.github/workflows/deploy.yml:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: api
      # Repeat for web service
```

### 11.4 Monitoring

- **Healthchecks:** Railway pings `/v1/health` every 60s.
- **Logging:** Fastify logs to stdout → Railway log aggregation.
- **Errors:** Fastify error handler logs stack traces (sanitize sensitive data).

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

**packages/core:**

- Fixture accuracy tests (CI-blocking).
- House calculation edge cases.
- Aspect detection logic.
- Transit hit detection.

**apps/api:**

- Service functions (business logic).
- Utility functions (TZ resolution, orb calculations).

**Example:**

```typescript
// packages/core/test/accuracy.test.ts
import { describe, test, expect } from 'vitest';
import { buildChart } from '../src';
import fixtures from './fixtures/bodies.json';

describe('Ephemeris Accuracy', () => {
  fixtures.forEach((fixture) => {
    test(`${fixture.datetime} positions within 0.05°`, () => {
      const chart = buildChart({ utcDatetime: new Date(fixture.datetime), lat: 0, lon: 0 }, {});
      fixture.bodies.forEach((expected) => {
        const body = chart.bodies.find((b) => b.body === expected.body);
        expect(body.longitude).toBeCloseTo(expected.longitude, 1); // 0.1° tolerance = 6 arcmin
      });
    });
  });
});
```

### 12.2 Integration Tests

**apps/api:**

- End-to-end route tests (Fastify `.inject()`).
- Auth flow (register → login → protected route).
- Chart generation (profile creation → chart API → verify ChartData).

**Example:**

```typescript
// apps/api/test/auth.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../src/server';

describe('Auth', () => {
  let app;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  test('POST /v1/auth/register', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'test@example.com', password: 'SecurePass123' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('user');
  });
});
```

### 12.3 E2E Tests (Playwright)

**apps/web:**

- Critical flows: sign up → create profile → view chart.
- Transit flow: view Today screen → click transit → expand interpretation.
- Learning flow: start lesson → complete → quiz → pass.

**Example:**

```typescript
// apps/web/e2e/chart.spec.ts
import { test, expect } from '@playwright/test';

test('create birth profile and view chart', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name=email]', 'test@example.com');
  await page.fill('input[name=password]', 'SecurePass123');
  await page.click('button[type=submit]');

  await page.goto('/chart/new');
  await page.fill('input[name=date]', '1990-01-15');
  await page.fill('input[name=time]', '14:30');
  await page.fill('input[name=place]', 'Los Angeles');
  await page.click('text=Los Angeles, CA, USA'); // Autocomplete result
  await page.click('button:has-text("Create Chart")');

  await expect(page.locator('.chart-wheel')).toBeVisible();
  await expect(page.locator('text=Sun in Capricorn')).toBeVisible();
});
```

### 12.4 Test Coverage

**Target:** ≥80% for `packages/core` (critical chart math), ≥60% for `apps/api` business logic.

**Run:**

```bash
pnpm turbo test -- --coverage
```

---

## 13. Development Workflow

### 13.1 Branch Strategy

- **main**: production-ready, auto-deploys to Railway.
- **Feature branches**: `feature/chart-wheel`, `feature/transit-calendar`.
- **PR review**: required before merge, CI must pass.

### 13.2 Commit Conventions

**Conventional Commits:**

- `feat: add transit calendar view`
- `fix: correct Placidus house calculation for polar latitudes`
- `docs: update deployment guide`
- `test: add fixture for 1975 chart`

### 13.3 Code Review Checklist

- [ ] Tests added/updated.
- [ ] Types are correct (no `any`).
- [ ] Accessibility: keyboard nav, aria labels.
- [ ] Mobile responsive.
- [ ] Content tone matches style guide (if content PR).
- [ ] No secrets in code.
- [ ] Capacitor constraints respected (if UI PR).

### 13.4 Local Development Setup

```bash
# Clone repo
git clone https://github.com/your-org/astrosetta.git
cd astrosetta

# Install deps
pnpm install

# Start local Postgres
docker compose up -d

# Migrate DB
pnpm --filter api prisma migrate dev

# Seed content
pnpm --filter api prisma db seed

# Start dev servers
pnpm dev
# → API on http://localhost:3000
# → Web on http://localhost:5173

# Run tests
pnpm turbo test

# Lint & typecheck
pnpm turbo lint typecheck
```

---

## 14. Implementation Order

### 14.1 Week-by-Week Plan

**Week 1: M0 Scaffold**

1. Day 1-2: Monorepo setup, tooling configs, CI.
2. Day 3-4: API hello world, Postgres, ORM choice.
3. Day 5: Web hello world, Vite + React + Tailwind.
4. Day 6-7: Railway setup, deploy both services, verify health.

**Week 2-3: M1 Chart Engine**

1. Day 8-10: Ephemeris adapter, Julian utils, coordinate transforms.
2. Day 11-13: House calculations (Placidus + Whole Sign), edge cases.
3. Day 14-16: Aspects calculator, True Node.
4. Day 17-19: ChartData builder, integrate all pieces.
5. Day 20-21: Fixture tests, debug accuracy, CI integration.

**Week 4-6: M2 Natal MVP**

1. Day 22-24: Auth system (email/password + OAuth), sessions.
2. Day 25-26: User settings, geocoding service.
3. Day 27-28: TZ resolution, birth profile CRUD.
4. Day 29-31: Chart generation API, caching.
5. Day 32-34: Web auth UI, birth data intake flow.
6. Day 35-37: Chart wheel SVG rendering.
7. Day 38-39: Placements list, interpretation panels (stubs).
8. Day 40-42: Settings page, polish, end-to-end testing.

**Week 7-9: M3 Transits**

1. Day 43-45: Precompute cron, transit positions table.
2. Day 46-48: Transit hit calculator, significance scoring.
3. Day 49-51: Exact hit date finding.
4. Day 52-54: Transit API endpoints, caching.
5. Day 55-57: Transit content library (outer planets).
6. Day 58-60: Today screen UI, transit list.
7. Day 61-63: Transit calendar, day view, detail panel.

**Week 10-12: M4 Learning**

1. Day 64-66: Learning content structure, MDX setup.
2. Day 67-70: Write Track 1 lessons (40 lessons = ~8 per day = heroic; realistic: 2 weeks).
3. Day 71-73: DB schema for learning, seed script.
4. Day 74-76: Content API, lesson completion tracking.
5. Day 77-79: Quiz system (static + personalized).
6. Day 80-82: Personalized question generator.
7. Day 83-84: Web learning UI (track/module/lesson views).
8. Day 85: Progress tracking, polish.

**Week 13-14: M5 Retention & Polish**

1. Day 86-88: SRS system (SM-2), Daily Drill API + UI.
2. Day 89-90: Stats dashboard.
3. Day 91-92: Email digest cron, Resend integration.
4. Day 93-94: Settings expansion (digest opt-in).
5. Day 95-96: A11y pass, Lighthouse audits.
6. Day 97-98: Empty/error states, dark mode.
7. Day 99: Privacy page, performance optimization.

**Week 15-16: M6 Native Wrap**

1. Day 100-102: Capacitor setup, iOS + Android projects.
2. Day 103-104: Bearer auth verification in native.
3. Day 105-106: StorageProvider + NotificationProvider abstractions.
4. Day 107-108: Local notification digest.
5. Day 109-110: Safe area handling, CORS verification.
6. Day 111-112: TestFlight + internal Android build, testing.

### 14.2 Critical Path

The longest dependency chain:

1. **M0 Scaffold** (required for all).
2. **M1 Chart Engine** (blocks M2, M3).
3. **M2 Natal MVP** (blocks M3, M4 personalized features).
4. **M3 Transits** (blocks M5 digest).
5. **M4 Learning** (blocks M5 SRS).
6. **M5 Retention** (polish, can parallelize with M4 content writing).
7. **M6 Native** (final, depends on M2-M5 stability).

**Parallelization opportunities:**

- M4 content writing can start during M3 (different skill set).
- M5 SRS + digest can be built concurrently.
- M6 Capacitor setup can start during M5 polish.

### 14.3 Risk Mitigation Tasks

- **Timezone accuracy:** Dedicate extra time in M2, fixture tests with pre-1970 dates.
- **Content volume:** Prioritize personal planets (Sun–Mars) interpretations, template-fill outer planets initially.
- **Polar latitude Placidus:** Test fixtures at 68°N, ensure fallback works.
- **Capacitor auth:** Test bearer tokens on iOS simulator in M2 (early validation).

---

## 15. Success Criteria

At the end of M6, the application should:

1. **Compute accurate charts:** All fixture tests passing at 0.05° tolerance.
2. **Support multiple users:** Auth works (email + Google OAuth), multiple profiles per user.
3. **Display natal charts:** Wheel + placements list, interpretations (full or stub).
4. **Track daily transits:** Today screen shows accurate transits, exact dates for slow transits.
5. **Teach astrology:** 8-module Foundations track complete, quizzes gate progress.
6. **Reinforce learning:** SRS Daily Drill, stats dashboard, personalized chart quizzes.
7. **Notify users:** Email digest (web) or local notification (native).
8. **Run natively:** iOS + Android builds functional, bearer auth works, notifications fire.
9. **Meet quality bars:** Lighthouse ≥90 a11y, no critical bugs, privacy page published.
10. **Deploy smoothly:** Railway auto-deploys on push to main, cron jobs run reliably.

---

## Appendix A: Key Files Checklist

At completion, verify these files exist:

### Monorepo Root

- [x] `pnpm-workspace.yaml`
- [x] `turbo.json`
- [x] `package.json` (root scripts)
- [x] `.env.example`
- [x] `.gitignore`
- [x] `.prettierrc`
- [x] `docker-compose.yml` (local Postgres)
- [x] `README.md`

### Apps

- [x] `apps/api/src/index.ts`
- [x] `apps/api/src/server.ts`
- [x] `apps/api/src/routes/...` (all endpoints)
- [x] `apps/api/prisma/schema.prisma`
- [x] `apps/api/prisma/seed.ts`
- [x] `apps/api/test/...` (integration tests)
- [x] `apps/web/src/main.tsx`
- [x] `apps/web/src/routes.tsx`
- [x] `apps/web/src/components/ChartWheel.tsx`
- [x] `apps/web/index.html`
- [x] `apps/web/capacitor.config.ts` (M6)

### Packages

- [x] `packages/core/src/index.ts`
- [x] `packages/core/src/chart/builder.ts`
- [x] `packages/core/src/ephemeris/adapter.ts`
- [x] `packages/core/src/houses/placidus.ts`
- [x] `packages/core/src/aspects/calculator.ts`
- [x] `packages/core/test/fixtures/bodies.json`
- [x] `packages/core/test/accuracy.test.ts`
- [x] `packages/content/src/interpretations/...`
- [x] `packages/content/src/learning/tracks/foundations/...`
- [x] `packages/api-client/src/client.ts`

### Docs

- [x] `docs/decisions/001-orm-choice.md`
- [x] `docs/deploy.md`
- [x] `docs/privacy.md`

### CI/CD

- [x] `.github/workflows/ci.yml`
- [x] `.github/workflows/deploy.yml`

---

## Appendix B: External Resources

### Documentation

- [Fastify](https://www.fastify.io/)
- [Vite](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [Prisma](https://www.prisma.io/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [astronomy-engine](https://github.com/cosinekitty/astronomy)
- [Capacitor](https://capacitorjs.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Railway](https://docs.railway.app/)

### Astrology References

- [Astro.com](https://www.astro.com/) — for fixture verification
- [Placidus house system](https://en.wikipedia.org/wiki/House_(astrology)#Placidus)
- [Ephemeris accuracy discussion](https://www.astro.com/swisseph/)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-22 | Initial comprehensive technical plan |

---

**End of Technical Implementation Plan**

This document should be updated as architectural decisions are refined or new challenges emerge during implementation. All deviations from the PRD architecture decisions must be flagged and documented in `/docs/decisions/`.
