# ADR 001: ORM Choice - Prisma

**Date:** 2026-07-22
**Status:** Accepted

## Context

The application requires an ORM for PostgreSQL database access. The two main candidates were:

1. **Prisma**: Schema-first, excellent TypeScript support, powerful migrations, introspection, and great DX with Prisma Studio
2. **Drizzle**: SQL-first, lighter weight, more control over raw SQL, newer but growing community

## Decision

We chose **Prisma** for the following reasons:

1. **Type Safety**: Prisma's generated client provides excellent TypeScript types with autocomplete
2. **Migration System**: Battle-tested migration system with good rollback support
3. **Tooling**: Prisma Studio for DB inspection, comprehensive CLI
4. **Documentation**: Extensive docs and large community
5. **Railway Integration**: First-class support on Railway
6. **Team Familiarity**: More developers know Prisma, easier onboarding

## Consequences

### Positive
- Fast development with great DX
- Type-safe database queries
- Easy to onboard new developers
- Prisma Studio for debugging

### Negative
- Slightly heavier runtime compared to Drizzle
- Less control over raw SQL (though raw queries are supported)
- Generated client adds build step

### Mitigations
- Use raw queries when performance is critical
- Keep schema.prisma well-documented
- Regular Prisma version updates for improvements
