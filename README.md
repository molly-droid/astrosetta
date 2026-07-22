# Astrosetta

A natal chart and transit learning application. Compute accurate birth charts, track daily planetary transits, and learn astrology through personalized lessons and quizzes.

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo:

```
astrosetta/
├── apps/
│   ├── api/          # Fastify REST API
│   └── web/          # Vite + React SPA
├── packages/
│   ├── core/         # Pure TS chart math & ephemeris
│   ├── content/      # Interpretation library & lessons
│   ├── api-client/   # Generated typed API client
│   └── ui/           # Shared UI components (future)
└── tooling/          # Shared configs (ESLint, TypeScript)
```

## Getting Started

### Prerequisites

- Node.js ≥20.0.0
- pnpm ≥8.0.0
- Docker (for local Postgres)

### Installation

```bash
# Install dependencies
pnpm install

# Start local Postgres
docker compose up -d

# Run database migrations (once API is set up)
pnpm --filter api prisma migrate dev

# Seed content
pnpm --filter api prisma db seed

# Start dev servers (API + Web)
pnpm dev
```

The API will be available at `http://localhost:3000` and the web app at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

See `.env.example` for all required and optional variables.

## Development

### Available Scripts

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages
pnpm format       # Format all files with Prettier
```

### Running Individual Apps

```bash
pnpm --filter api dev      # API only
pnpm --filter web dev      # Web only
pnpm --filter core test    # Test core package only
```

## Architecture

See [TECHNICAL_PLAN.md](./TECHNICAL_PLAN.md) for detailed technical specifications and [astrology-app-prd.md](./astrology-app-prd.md) for product requirements.

### Key Decisions

- **No SSR**: Pure SPA architecture for simple Capacitor wrapping
- **Dual auth transport**: Cookie sessions (web) + bearer tokens (future native)
- **Ephemeris adapter**: astronomy-engine wrapped, Swiss Ephemeris swap-ready
- **No Redis in v1**: In-process + Postgres caching

## Milestones

- [x] M0: Scaffold (monorepo, CI/CD, Railway setup)
- [ ] M1: Chart Engine (ephemeris, houses, aspects, fixtures)
- [ ] M2: Natal MVP (auth, profiles, chart UI, interpretations)
- [ ] M3: Transits (precompute, Today screen, calendar)
- [ ] M4: Learning (8-module track, quizzes, personalized questions)
- [ ] M5: Retention & Polish (SRS, stats, digest, a11y)
- [ ] M6: Native Wrap (Capacitor iOS/Android)

## License

ISC

## Contributing

This is a work in progress. Contributions will be accepted once v1 is complete.
