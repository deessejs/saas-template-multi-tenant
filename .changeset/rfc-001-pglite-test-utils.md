---
"@workspace/database": minor
---

refactor(database): replace pg-mem test infrastructure with PGlite-backed helpers exposed as the new `@workspace/database/test-utils` sub-path export. `setupTestDb()` (async) lazily builds an in-memory PGlite instance and pushes the same Drizzle schema the production runtime uses via `pushSchema` from `drizzle-kit/api`. `cleanup()` is idempotent. Real PG semantics, no Docker, no schema drift. Drops the legacy `tests/setup.ts` pg-mem path; consumers like `packages/auth/tests/setup.ts` now consume `setupTestDb` instead of building their own `postgres(...)` pool. `tests/setup.ts` deleted.