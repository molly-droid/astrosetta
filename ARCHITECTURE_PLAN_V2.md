# Astrosetta Architecture Plan V2
## Supabase + React Native + Shared Core

**Date:** 2026-07-24
**Status:** Migration from Fastify/Railway to Supabase/Vercel/Expo
**Based on:** Astrosetta_PRD.md

---

## Executive Summary

This document outlines the migration from the initial scaffold (Fastify/Railway/Capacitor) to the production architecture (Supabase/Vercel/React Native) while **preserving the excellent chart calculation engine** (`@astro/core`) we've already built.

### What We're Keeping
- ✅ `packages/core` - Chart calculation engine (astronomy-engine, houses, aspects)
- ✅ TypeScript + pnpm workspaces + Turborepo
- ✅ Tailwind design system
- ✅ Core chart math and algorithms

### What We're Replacing
- ❌ Fastify API → Supabase Edge Functions
- ❌ Prisma/PostgreSQL on Railway → Supabase Postgres
- ❌ Fastify Auth → Supabase Auth
- ❌ Vite SPA only → Vite (web) + React Native/Expo (mobile)
- ❌ Capacitor → React Native (Expo)

### What We're Adding
- ➕ XP/Tier system (Apprentice → Adept → Maestro)
- ➕ LLM-powered synthesis (Chart Navigator AI)
- ➕ RevenueCat (mobile) + Stripe (web) payments
- ➕ Calendar sync (Google Calendar integration)
- ➕ Daily/Weekly/Monthly email digests
- ➕ Interactive learning modules with quizzes

---

## 1. New Monorepo Structure

```
astrosetta/
├── apps/
│   ├── web/                      # Vite + React (Vercel deployment)
│   │   ├── src/
│   │   │   ├── features/
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   ├── mobile/                   # React Native (Expo)
│   │   ├── app/                  # Expo Router structure
│   │   ├── components/
│   │   └── package.json
│   │
│   └── [DEPRECATED] api/         # Keep for reference, will be replaced
│
├── packages/
│   ├── core/                     # ✅ KEEP - Chart calculation engine
│   │   ├── src/
│   │   │   ├── ephemeris/       # astronomy-engine (swap to Swiss Eph later)
│   │   │   ├── houses/
│   │   │   ├── aspects/
│   │   │   ├── chart/
│   │   │   └── transits/
│   │   └── package.json
│   │
│   ├── shared/                   # NEW - Shared business logic
│   │   ├── src/
│   │   │   ├── hooks/           # React hooks for both web + mobile
│   │   │   ├── stores/          # Zustand stores
│   │   │   ├── utils/           # XP calculations, date formatting
│   │   │   ├── types/           # Shared TypeScript types
│   │   │   └── supabase/        # Supabase client + helpers
│   │   └── package.json
│   │
│   ├── ui/                       # NEW - Shared UI components
│   │   ├── src/
│   │   │   ├── ChartWheel/      # Canvas/SVG chart wheel
│   │   │   ├── Planner/         # Calendar planner view
│   │   │   └── primitives/      # Radix UI wrappers
│   │   └── package.json
│   │
│   └── content/                  # ✅ KEEP - Interpretation library
│       ├── src/
│       │   ├── interpretations/
│       │   └── learning/        # NEW - Module content
│       └── package.json
│
├── supabase/                     # NEW - Supabase project
│   ├── functions/               # Edge Functions
│   │   ├── chart-calculator/   # Calculate charts
│   │   ├── synthesis-generator/ # LLM synthesis
│   │   ├── daily-digest/       # Email automation
│   │   ├── webhook-stripe/     # Stripe webhook
│   │   └── webhook-revenuecat/ # RevenueCat webhook
│   ├── migrations/              # Database migrations
│   └── config.toml
│
├── docs/
│   ├── ARCHITECTURE_PLAN_V2.md  # This file
│   ├── SWISS_EPHEMERIS_MIGRATION.md
│   ├── SUPABASE_SETUP.md
│   └── REVENUE_MODEL.md
│
└── [KEEP] tooling/, turbo.json, package.json
```

---

## 2. Technology Stack

### Frontend (Web)
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | React 18 + Vite | Keep existing |
| Styling | Tailwind CSS | Keep design tokens |
| UI Library | Radix UI + shadcn | Keep existing |
| State | Zustand | Move to `@astro/shared` |
| Router | React Router v6 | Keep existing |
| Deployment | **Vercel** | Replace Railway |

### Frontend (Mobile)
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | **React Native (Expo)** | NEW |
| Styling | **NativeWind** | Tailwind for RN |
| Navigation | **Expo Router** | File-based routing |
| Payments | **RevenueCat** | iOS + Android IAP |
| Build | **EAS Build** | Expo Application Services |

### Backend
| Component | Technology | Notes |
|-----------|-----------|-------|
| Database | **Supabase Postgres** | Replace Railway Postgres |
| Auth | **Supabase Auth** | Replace Fastify sessions |
| Storage | **Supabase Storage** | Chart images/exports |
| Functions | **Supabase Edge Functions** | Replace Fastify routes |
| Scheduled Jobs | **pg_cron** | Replace Railway cron |
| Realtime | **Supabase Realtime** | Optional for live updates |

### Payments
| Platform | Technology | Notes |
|----------|-----------|-------|
| Web | **Stripe** | Keep existing plan |
| iOS | **RevenueCat** → StoreKit | NEW |
| Android | **RevenueCat** → Google Play | NEW |
| Reconciliation | **Supabase `entitlements` table** | Single source of truth |

### AI/LLM
| Component | Technology | Notes |
|-----------|-----------|-------|
| Provider | Anthropic Claude | Via Supabase Edge Functions |
| Use Cases | - Chart synthesis<br>- Navigator AI<br>- Personalized insights | Queue-based with caching |

---

## 3. Database Schema (Supabase Postgres)

### Core Entities

```sql
-- User management (handled by Supabase Auth)
-- auth.users table is built-in

-- User profile and progress
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  current_tier text DEFAULT 'Apprentice', -- Apprentice | Adept | Maestro
  total_xp integer DEFAULT 0,
  level integer DEFAULT 1,
  streak_count integer DEFAULT 0,
  last_active_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Birth charts
CREATE TABLE saved_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_primary boolean DEFAULT false,

  -- Birth data
  birth_date date NOT NULL,
  birth_time time,
  time_known boolean DEFAULT true,
  place_name text NOT NULL,
  lat numeric NOT NULL,
  lon numeric NOT NULL,
  iana_timezone text NOT NULL,
  utc_datetime timestamptz NOT NULL,
  tz_confidence text, -- 'high' | 'medium' | 'low'

  -- Chart data (JSON from @astro/core)
  chart_data jsonb NOT NULL,
  chart_data_version text NOT NULL,
  house_system text DEFAULT 'Placidus',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- LLM-generated synthesis (cached interpretations)
CREATE TABLE synthesis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id uuid REFERENCES saved_charts(id) ON DELETE CASCADE,
  synthesis_type text NOT NULL, -- 'natal_overview' | 'placement' | 'transit' | 'synastry'
  placement_key text, -- e.g., 'sun_in_leo_house_10'
  content text NOT NULL,
  quality_rating integer, -- 1-5, user feedback
  bookmarked boolean DEFAULT false,

  llm_model text,
  generated_at timestamptz DEFAULT now(),
  cache_expires_at timestamptz
);

-- LLM usage tracking
CREATE TABLE llm_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  synthesis_id uuid REFERENCES synthesis(id),
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(10, 6),
  created_at timestamptz DEFAULT now()
);

-- Entitlements (single source of truth)
CREATE TABLE entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Active tier
  tier text NOT NULL, -- 'Interpret' | 'Calendar'

  -- Source of subscription
  source text NOT NULL, -- 'stripe' | 'revenuecat_ios' | 'revenuecat_android'
  external_id text, -- Stripe subscription ID or RevenueCat app_user_id

  -- Status
  status text NOT NULL, -- 'active' | 'canceled' | 'past_due' | 'expired'
  period_start timestamptz,
  period_end timestamptz,
  will_renew boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Learning modules
CREATE TABLE learning_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL, -- 'foundations' | 'planets' | 'signs' | 'houses' | 'aspects'
  title text NOT NULL,
  description text,
  order_index integer NOT NULL,
  xp_reward integer DEFAULT 50,

  content_path text, -- Path to MDX file in @astro/content
  quiz_data jsonb, -- Quiz questions

  created_at timestamptz DEFAULT now()
);

-- User learning progress
CREATE TABLE user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES learning_modules(id),

  completed boolean DEFAULT false,
  quiz_score integer, -- 0-100
  xp_earned integer DEFAULT 0,
  completed_at timestamptz,

  UNIQUE(user_id, module_id)
);

-- Daily quiz attempts
CREATE TABLE daily_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_date date NOT NULL,
  score integer NOT NULL, -- 0-100
  difficulty text, -- 'easy' | 'medium' | 'hard'
  xp_earned integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, quiz_date)
);

-- Synastry comparisons
CREATE TABLE synastry_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chart1_id uuid REFERENCES saved_charts(id) ON DELETE CASCADE,
  chart2_id uuid REFERENCES saved_charts(id) ON DELETE CASCADE,

  label text, -- e.g., "Me & Partner"
  synastry_data jsonb, -- Aspects, overlays, composite
  synthesis_id uuid REFERENCES synthesis(id),

  created_at timestamptz DEFAULT now()
);

-- Feedback & error reporting
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  feedback_type text, -- 'bug' | 'feature' | 'general'
  subject text,
  message text NOT NULL,
  screenshot_url text,
  device_info jsonb,

  status text DEFAULT 'new', -- 'new' | 'reviewed' | 'resolved'
  admin_notes text,

  created_at timestamptz DEFAULT now()
);

-- Calendar sync state
CREATE TABLE calendar_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  provider text NOT NULL, -- 'google'
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text, -- External calendar ID

  sync_enabled boolean DEFAULT true,
  last_sync_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Transit positions (precomputed daily)
CREATE TABLE transit_positions (
  date date NOT NULL,
  hour integer NOT NULL, -- 0 for daily, 0-23 for Moon hourly
  body text NOT NULL,
  lon numeric NOT NULL,
  lat numeric NOT NULL,
  speed numeric NOT NULL,
  retrograde boolean NOT NULL,

  PRIMARY KEY (date, hour, body)
);

-- Row Level Security policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synastry_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (repeat for other tables)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);
```

---

## 4. Supabase Edge Functions Architecture

### Key Functions

#### 1. **chart-calculator** (POST)
```typescript
// Input: birth data
// Output: ChartData from @astro/core
// Uses: Imported @astro/core package
// Caches: Result in saved_charts table

import { buildChart } from '@astro/core';
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { birthData, options } = await req.json();
  const chart = buildChart(birthData, options);

  // Save to DB
  const supabase = createClient(...);
  await supabase.from('saved_charts').insert({...});

  return new Response(JSON.stringify(chart));
});
```

#### 2. **synthesis-generator** (POST)
```typescript
// Input: chart_id, synthesis_type
// Output: LLM-generated interpretation
// Uses: Anthropic Claude API
// Caches: Result in synthesis table with expiry

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Generate synthesis with structured prompts
// Track usage in llm_usage_log
```

#### 3. **daily-digest** (Scheduled via pg_cron)
```typescript
// Runs: Daily at 8 AM user local time
// Fetches: Users with digest enabled
// Sends: Email with today's transits via Resend

import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// For each user:
//   - Get primary chart
//   - Calculate today's transits
//   - Generate digest email
//   - Send via Resend
```

#### 4. **webhook-stripe** (POST)
```typescript
// Receives: Stripe webhook events
// Updates: entitlements table
// Validates: Webhook signature

import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

// Handle events:
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
```

#### 5. **webhook-revenuecat** (POST)
```typescript
// Receives: RevenueCat webhook events
// Updates: entitlements table
// Validates: Webhook signature

// Handle events:
//   - INITIAL_PURCHASE
//   - RENEWAL
//   - CANCELLATION
//   - EXPIRATION
```

### **Critical Technical Risk: Ephemeris in Edge Functions**

Supabase Edge Functions run on **Deno** (not Node.js). We need to verify:

1. Can `astronomy-engine` run in Deno? ✅ (Pure JS, should work)
2. Will Swiss Ephemeris work in Deno? ⚠️ (Needs investigation - may require native bindings)

**Contingency Plan:**
- If ephemeris won't run in Deno Edge Functions → Deploy chart-calculator as a **Vercel Serverless Function** (Node.js runtime) instead
- Keep synthesis/webhooks/digests in Supabase Edge Functions (don't need ephemeris)

---

## 5. Shared Package Strategy

### `packages/shared` - Cross-Platform Business Logic

```typescript
// src/hooks/useChart.ts
export function useChart(chartId: string) {
  // Works on web + mobile
  // Fetches from Supabase
  // Returns ChartData
}

// src/hooks/useXP.ts
export function useXP() {
  const addXP = (amount: number) => { /* ... */ };
  const checkLevelUp = () => { /* ... */ };
  return { totalXP, level, addXP, checkLevelUp };
}

// src/stores/authStore.ts
import { create } from 'zustand';
import { supabase } from '../supabase/client';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  signIn: async (email, password) => { /* ... */ },
  signOut: async () => { /* ... */ },
}));

// src/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// src/utils/xp.ts
export function calculateXP(action: string): number {
  const XP_VALUES = {
    complete_module: 50,
    daily_quiz: 20,
    quiz_perfect: 10,
    streak_bonus: 5,
  };
  return XP_VALUES[action] || 0;
}

export function calculateLevel(totalXP: number): number {
  // XP curve: Level = floor(sqrt(XP / 100))
  return Math.floor(Math.sqrt(totalXP / 100));
}

export function getTierForXP(totalXP: number): 'Apprentice' | 'Adept' | 'Maestro' {
  if (totalXP >= 5000) return 'Maestro';
  if (totalXP >= 2000) return 'Adept';
  return 'Apprentice';
}
```

---

## 6. Mobile App Structure (React Native + Expo)

### Stack
- **React Native** via Expo managed workflow
- **Expo Router** for file-based navigation
- **NativeWind** for Tailwind-style styling
- **RevenueCat** for in-app purchases
- **Supabase JS client** for backend

### Project Structure
```
apps/mobile/
├── app/                        # Expo Router (file-based routing)
│   ├── (tabs)/                # Tab navigation
│   │   ├── index.tsx          # Today screen (transits)
│   │   ├── charts.tsx         # Saved charts
│   │   ├── learn.tsx          # Learning modules
│   │   └── profile.tsx        # User profile
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── chart/[id].tsx         # Chart detail
│   ├── synthesis/[id].tsx     # Synthesis view
│   └── _layout.tsx
│
├── components/
│   ├── ChartWheel.tsx         # Native canvas chart
│   ├── TransitCard.tsx
│   └── XPProgress.tsx
│
├── hooks/                      # Import from @astro/shared
├── stores/                     # Import from @astro/shared
│
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
└── package.json
```

### Key Expo Packages
```json
{
  "dependencies": {
    "expo": "~50.x",
    "expo-router": "^3.x",
    "react-native": "0.73.x",
    "nativewind": "^4.x",
    "@supabase/supabase-js": "^2.x",
    "react-native-purchases": "^7.x",  // RevenueCat SDK
    "@react-native-async-storage/async-storage": "^1.x",
    "react-native-svg": "^14.x"
  }
}
```

---

## 7. Revenue Model & Entitlements

### Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | - 1 saved chart<br>- Basic interpretations<br>- Daily quiz |
| **Interpret** | $9.99/mo | - Unlimited charts<br>- LLM-powered synthesis<br>- Chart Navigator AI<br>- Synastry analysis |
| **Calendar** | $19.99/mo | - Everything in Interpret<br>- Calendar integration<br>- Advanced planner<br>- Transit alerts<br>- Email digests |

### Purchase Flow

#### Web (Stripe)
```
User clicks "Upgrade" → Stripe Checkout → Success → Stripe webhook → Update entitlements table
```

#### Mobile (RevenueCat)
```
User clicks "Upgrade" → RevenueCat paywall → StoreKit/Google Play → Purchase → RevenueCat webhook → Update entitlements table
```

### Entitlement Reconciliation Logic

```typescript
// Supabase Edge Function: check-entitlement
export async function checkUserEntitlement(userId: string): Promise<Entitlement> {
  const { data } = await supabase
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data || data.status !== 'active' || new Date(data.period_end) < new Date()) {
    return { tier: 'Free', active: false };
  }

  return {
    tier: data.tier,
    active: true,
    source: data.source,
    renewsAt: data.period_end
  };
}
```

---

## 8. Migration Steps

### Phase 1: Supabase Setup (Week 1)
1. Create Supabase project
2. Run database migrations
3. Configure Row Level Security policies
4. Set up Supabase Auth
5. Deploy initial Edge Functions (chart-calculator)

### Phase 2: Shared Packages (Week 2)
1. Create `packages/shared` with hooks/stores
2. Create `packages/ui` with ChartWheel component
3. Port existing web app to use Supabase client
4. Test chart generation via Edge Function

### Phase 3: Mobile App (Week 3-4)
1. Initialize Expo project
2. Set up Expo Router navigation
3. Implement NativeWind styling
4. Build core screens (Today, Charts, Learn, Profile)
5. Integrate Supabase Auth
6. Test chart rendering on iOS/Android

### Phase 4: Payments (Week 5)
1. Set up Stripe on web (keep existing)
2. Integrate RevenueCat in mobile app
3. Build entitlements reconciliation
4. Implement webhook handlers
5. Test purchase flows

### Phase 5: LLM Features (Week 6-7)
1. Build synthesis-generator Edge Function
2. Implement Chart Navigator AI (conversational agent)
3. Create synthesis caching layer
4. Build quality rating system
5. Track LLM usage/costs

### Phase 6: Learning & XP (Week 8)
1. Port learning modules from old PRD
2. Implement XP system
3. Build daily quiz engine
4. Create streak tracking
5. Add tier progression

### Phase 7: Calendar & Digests (Week 9)
1. Implement Google Calendar OAuth
2. Build calendar sync Edge Function
3. Create daily/weekly/monthly digest templates
4. Set up pg_cron for scheduled sends
5. Test email delivery

### Phase 8: Polish & Launch (Week 10)
1. Full testing (web + iOS + Android)
2. App Store submission (iOS)
3. Google Play submission (Android)
4. Deploy to production
5. Marketing site on Vercel

---

## 9. Environment Variables

### Shared (Web + Mobile)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
```

### Web Only (Vercel)
```env
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Mobile Only (Expo)
```env
REVENUECAT_IOS_KEY=appl_xxx
REVENUECAT_ANDROID_KEY=goog_xxx
```

### Edge Functions Only
```env
ANTHROPIC_API_KEY=sk-ant-xxx
RESEND_API_KEY=re_xxx
STRIPE_SECRET_KEY=sk_xxx
REVENUECAT_WEBHOOK_SECRET=xxx
GOOGLE_OAUTH_CLIENT_ID=xxx
GOOGLE_OAUTH_CLIENT_SECRET=xxx
```

---

## 10. Swiss Ephemeris Migration Path

**Current:** astronomy-engine (MIT)
**Future:** Swiss Ephemeris (commercial license)

### When to Migrate
- After launch, based on user feedback about accuracy
- When adding advanced features (midpoints, harmonics, asteroids)
- Budget allocated for ~$1500 commercial license

### Migration Steps
1. Purchase Swiss Ephemeris commercial license from Astrodienst
2. Create `packages/core/src/ephemeris/swiss-ephemeris.ts` adapter
3. Swap implementation in `EphemerisAdapter`
4. Test against existing fixtures (should improve accuracy to sub-arcsecond)
5. Update `CHART_DATA_VERSION` to invalidate cached charts
6. Deploy

**No other code changes needed** - the adapter pattern isolates the ephemeris engine!

---

## 11. Success Metrics

### Technical
- ✅ Chart calculation accuracy: <0.05° (current: ~1 arcminute with astronomy-engine)
- ✅ API latency: <200ms for chart generation
- ✅ Edge Function cold starts: <500ms
- ✅ Mobile app size: <30MB
- ✅ Web Lighthouse score: >90 (performance, a11y, SEO)

### Product
- 📊 DAU/MAU ratio >30%
- 📊 Daily quiz completion rate >50%
- 📊 Paid conversion rate >5%
- 📊 Churn rate <10%/month
- 📊 NPS >40

---

## 12. Open Questions & Risks

### Technical Risks
1. **Ephemeris in Deno** - Need to spike whether astronomy-engine/Swiss Ephemeris works in Supabase Edge Functions
   - **Mitigation:** Fall back to Vercel Serverless Functions (Node.js) for chart-calculator if needed

2. **LLM Costs** - Claude API costs could scale quickly with usage
   - **Mitigation:** Aggressive caching, rate limiting, tier gating

3. **RevenueCat + Stripe Sync** - Potential race conditions in entitlement updates
   - **Mitigation:** Idempotent webhook handlers, transaction logs

### Product Risks
1. **Content Creation** - Learning modules require significant writing
   - **Mitigation:** AI-assisted content generation, phased rollout

2. **Calendar Sync Complexity** - Google OAuth + ICS generation can be brittle
   - **Mitigation:** Clear error messages, manual export fallback

---

**Next Steps:** Set up Supabase project and verify ephemeris runtime compatibility.
