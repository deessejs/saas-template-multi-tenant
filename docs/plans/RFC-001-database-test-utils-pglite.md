---
issue: RFC-001
title: "refactor(database): PGlite-based test-utils sub-path export"
author: martyy-code
generated: 2026-07-16
status: approved
reviewer: martyy-code
reviewed: 2026-07-16
branch: refactoring/database
labels: [refactor, area:database, area:tests, priority:medium, effort:medium]
priority: Medium
effort: Medium
---

## Outline

1. [Add PGlite dependency to `packages/database`](#step-1--add-pglite-dependency)
   1.1. [Verify `drizzle-orm/pglite` is reachable from the existing catalog dep](#step-1-sub-step-verify-drizzle-orm-pglite-subpath)
2. [Expose `./test-utils` from `@workspace/database`](#step-2--expose-test-utils-sub-path-export)
3. [Remove `src/test-utils.ts` from `tsconfig.json` exclude](#step-3--remove-test-utils-from-tsconfig-exclude)
4. [Rewrite `src/test-utils.ts` on top of PGlite](#step-4--rewrite-test-utils-on-pglite)
   4.1. [`setupTestDb(): Promise<Drizzle>` — lazy PGlite + Drizzle + pushSchema](#step-4-sub-step-setuptestdb)
   4.2. [`cleanup(): Promise<void>` — idempotent PGlite shutdown](#step-4-sub-step-cleanup)
5. [Delete `packages/database/tests/setup.ts`](#step-5--delete-legacy-setup)
6. [Rewrite `packages/database/tests/schema.test.ts` against the new API](#step-6--rewrite-schema-test)
7. [Replace placeholder in `packages/database/tests/queries.test.ts` with a real PGlite-backed test](#step-7--rewrite-queries-test)
8. [Refactor `packages/auth/tests/setup.ts` to consume `@workspace/database/test-utils`](#step-8--refactor-auth-test-setup)
9. [Verify (lint, typecheck, tests, build)](#step-9--verify)

---

## TL;DR

Replace the dead-and-duplicated `pg-mem` test infrastructure in `packages/database` with a typed PGlite-backed helper exposed as `@workspace/database/test-utils`, and consume it from `packages/auth` so the duplicated `postgres(pool)` construction disappears.

---

## Issue summary

`packages/database/src/test-utils.ts` is an orphan: zero importers, excluded from `tsc`, not in `package.json` `exports`. Meanwhile, `packages/database/tests/setup.ts` re-implements pg-mem with the better-auth schema duplicated in raw SQL — a known drift liability. `packages/auth/tests/setup.ts` builds its own `postgres-js` pool (`max: 1`, no fallback) instead of consuming shared helpers. The long-term fix is PGlite (real Postgres compiled to WASM, first-class Drizzle support via `drizzle-orm/pglite`) — endorsed in [drizzle-team/drizzle-orm#4205](https://github.com/drizzle-team/drizzle-orm/issues/4205). Background analysis: `temp/reports/analysis/database-test-utils-pglite-refactor.md`.

---

## Files to touch

| File | Action | Why |
|------|--------|-----|
| `packages/database/package.json` | edit | Add `@electric-sql/pglite` devDep + `./test-utils` to `exports` |
| `packages/database/tsconfig.json` | edit | Remove `src/test-utils.ts` from `exclude` so it compiles to `dist/` |
| `packages/database/src/test-utils.ts` | rewrite | PGlite-based `setupTestDb` + `cleanup` (replaces the re-export shim) |
| `packages/database/tests/setup.ts` | **delete** | No more pg-mem; the file becomes a single source of false signals |
| `packages/database/tests/schema.test.ts` | rewrite | Use the new `setupTestDb` and add a real PGlite-backed assertion |
| `packages/database/tests/queries.test.ts` | rewrite | Replace `expect(1 + 1).toBe(2)` with a real CRUD roundtrip |
| `packages/auth/tests/setup.ts` | edit | Drop `postgres(...)` + `drizzle(pool)`, import `setupTestDb` from the shared sub-path |

No changes needed in: `packages/database/src/client.ts`, `packages/database/src/schema/**`, `packages/api/**`, `apps/**`.

---

## Step-by-step implementation

### Step 1 — Add PGlite dependency

`packages/database/package.json`

Add to `devDependencies`:

```jsonc
"@electric-sql/pglite": "^0.3.0"
```

PGlite is workspace-only (not added to the catalog) — only `@workspace/database` imports it directly. Consumers (`auth`, `api`, …) reach it transitively via the sub-path export.

#### 1.1 — Verify `drizzle-orm/pglite` subpath

`@electric-sql/pglite` is a new external dep. The `drizzle-orm/pglite` driver is **already** shipped as a sub-export of `drizzle-orm` (catalog `^0.45.2`). No new catalog entry needed — just import it. Verify with `node -e "console.log(require.resolve('drizzle-orm/pglite'))"`.

If the import path has changed in a future catalog bump, fall back to importing from `@electric-sql/pglite` directly and wrapping manually (one-time hit).

### Step 2 — Expose `./test-utils` sub-path export

`packages/database/package.json`

Add a third entry alongside `.` and `./schema`:

```jsonc
"./test-utils": {
  "types": "./dist/test-utils.d.ts",
  "import": "./dist/test-utils.js",
  "default": "./dist/test-utils.js"
}
```

The build (`pnpm --filter @workspace/database build` runs `tsc`) must emit `dist/test-utils.js` and `dist/test-utils.d.ts`. Verified by Step 3 + Step 9.

### Step 3 — Remove `test-utils` from tsconfig exclude

`packages/database/tsconfig.json`

Remove `"src/test-utils.ts"` from the `exclude` array. Without this, the file is skipped by `tsc --noEmit` and by `tsc` build, so it never lands in `dist/`.

Current:
```jsonc
"exclude": ["node_modules", "dist", "vitest.config.ts", "drizzle.config.ts", "src/test-utils.ts", "tests/**/*"]
```

After:
```jsonc
"exclude": ["node_modules", "dist", "vitest.config.ts", "drizzle.config.ts", "tests/**/*"]
```

`tests/**/*` stays excluded — those are test fixtures, not library source.

### Step 4 — Rewrite `test-utils.ts` on top of PGlite

`packages/database/src/test-utils.ts`

Replace the re-export shim with the real implementation:

```ts
import { PGlite } from "@electric-sql/pglite"
import { drizzle, type PGLiteDatabase } from "drizzle-orm/pglite"
// `drizzle-kit/api` is the 0.31 path. Bump to `drizzle-kit/api-postgres`
// when drizzle-kit >= 1.0 (see drizzle-team/drizzle-orm#4205).
import { pushSchema } from "drizzle-kit/api"
import * as schema from "./schema/index.js"

export type Drizzle = PGLiteDatabase<typeof schema>

let _testDb: Drizzle | null = null
let _pglite: PGlite | null = null

/**
 * Build an isolated in-memory test database backed by PGlite (real Postgres
 * compiled to WASM — not emulation). Lazy: the PGlite + Drizzle client are
 * created on first call and reused for the rest of the test run.
 *
 * Schema is pushed programmatically via `pushSchema`, reading the same
 * `schema/index.ts` the production runtime uses. No manual SQL, no drift.
 *
 * Limitations: PGlite has a single WASM connection. Running transactions
 * in parallel (`Promise.all([tx1, tx2])`) will deadlock. Serialize them.
 *
 * Pattern: call once in `beforeAll`, clean up in `afterAll` via `cleanup()`.
 */
export async function setupTestDb(): Promise<Drizzle> {
  if (_testDb) return _testDb
  _pglite = new PGlite()
  _testDb = drizzle(_pglite, { schema })
  const { apply } = await pushSchema(
    schema,
    _testDb as unknown as Parameters<typeof pushSchema>[1],
  )
  await apply()
  return _testDb
}

/** Close the PGlite instance. Idempotent. Safe to call from `afterAll`. */
export async function cleanup(): Promise<void> {
  if (_pglite) {
    await _pglite.close()
    _pglite = null
  }
  _testDb = null
}
```

#### 4.1 — `setupTestDb()` rationale

- **Async** because `pushSchema(...).apply()` is async and the test file pattern `beforeAll(async () => { db = await setupTestDb() })` is the natural shape.
- **Lazy** so a test file that imports `test-utils` but never calls `setupTestDb` doesn't pay the WASM boot cost.
- **Module-local state** (`_testDb`, `_pglite`) is fine — each Vitest worker has its own module instance.

#### 4.2 — `cleanup()` rationale

- Idempotent so multiple `afterAll` (or a stray second call) don't blow up.
- Resets module state so a subsequent `setupTestDb()` in the same process starts fresh (useful for Vitest's default `--isolate=true` workflow).

### Step 5 — Delete legacy setup

`packages/database/tests/setup.ts`

**Delete the file entirely.** It has no consumers after Steps 6 + 7 rewire to `../src/test-utils.js`. The pg-mem fallback path goes with it.

### Step 6 — Rewrite `schema.test.ts`

`packages/database/tests/schema.test.ts`

Replace with:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sql } from "drizzle-orm"
import * as schema from "../src/schema/index.js"
import { setupTestDb, cleanup, type Drizzle } from "../src/test-utils.js"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})

describe("database schema", () => {
  describe("table definitions", () => {
    it("exports user with required columns", () => {
      expect(schema.user.id).toBeDefined()
      expect(schema.user.email).toBeDefined()
      expect(schema.user.name).toBeDefined()
      expect(schema.user.emailVerified).toBeDefined()
    })

    it("exports session, account, verification", () => {
      expect(schema.session.id).toBeDefined()
      expect(schema.session.token).toBeDefined()
      expect(schema.session.userId).toBeDefined()
      expect(schema.account.id).toBeDefined()
      expect(schema.account.providerId).toBeDefined()
      expect(schema.verification.identifier).toBeDefined()
      expect(schema.verification.value).toBeDefined()
    })
  })

  describe("relations", () => {
    it("exports user/session/account relations", () => {
      expect(schema.userRelations).toBeDefined()
      expect(schema.sessionRelations).toBeDefined()
      expect(schema.accountRelations).toBeDefined()
    })
  })

  describe("runtime sanity (PGlite-backed)", () => {
    it("runs a SELECT 1 against PGlite", async () => {
      await expect(db.execute(sql`SELECT 1 as ok`)).resolves.toBeDefined()
    })
  })
})
```

### Step 7 — Replace placeholder in `queries.test.ts`

`packages/database/tests/queries.test.ts`

Replace the `expect(1 + 1).toBe(2)` placeholder with a real CRUD roundtrip:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { setupTestDb, cleanup, type Drizzle } from "../src/test-utils.js"
import * as schema from "../src/schema/index.js"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})

describe("user CRUD against PGlite", () => {
  it("inserts and reads a user back", async () => {
    const id = "user_test_1"
    await db.insert(schema.user).values({
      id,
      name: "Alice",
      email: "alice@example.com",
      emailVerified: false,
    })

    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id))
    expect(row?.email).toBe("alice@example.com")
    expect(row?.name).toBe("Alice")
    expect(row?.emailVerified).toBe(false)
  })

  it("enforces email uniqueness", async () => {
    const email = "bob@example.com"
    await db.insert(schema.user).values({
      id: "user_test_2",
      name: "Bob",
      email,
      emailVerified: false,
    })

    await expect(
      db.insert(schema.user).values({
        id: "user_test_3",
        name: "Bob2",
        email,
        emailVerified: false,
      }),
    ).rejects.toThrow()
  })
})
```

Two tests. They prove the schema is queryable end-to-end and that the unique constraint on `email` actually works in PGlite (drift sentinel).

### Step 8 — Refactor `auth/tests/setup.ts`

`packages/auth/tests/setup.ts`

Before:
```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "@workspace/database/schema"
import { serverEnv } from "@workspace/env/server"

const pool = postgres(serverEnv.TEST_DATABASE_URL, { max: 1 })
const db = drizzle(pool)
```

After:
```ts
import { setupTestDb, cleanup, type Drizzle } from "@workspace/database/test-utils"
import { afterAll, beforeAll } from "vitest"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})
```

Other imports (`betterAuth`, `drizzleAdapter`, `testUtils`, `* as schema`, `sendAuthEmail`, `templates`) stay. The `auth = betterAuth({ ... })` block is unchanged — it just receives `db` from the outer scope instead of constructing its own pool.

The `max: 1` foot-gun disappears. So does the dependency on `TEST_DATABASE_URL`. So does the `pg-mem` memory import. Net: -3 imports, -1 module-local variable, +2 lifecycle calls.

### Step 9 — Verify

Run in order, from repo root:

```bash
# Lint (must pass with --max-warnings=0)
pnpm --filter @workspace/database lint
pnpm --filter @workspace/auth lint

# Typecheck (must pass)
pnpm --filter @workspace/database typecheck
pnpm --filter @workspace/auth typecheck

# Tests (database must pass; auth depends on TEST_DATABASE_URL being absent)
pnpm --filter @workspace/database test
pnpm --filter @workspace/auth test

# Build (proves the sub-path export resolves)
pnpm --filter @workspace/database build
```

Expected:
- Lint: clean.
- Typecheck: clean. `setupTestDb` returns `Promise<Drizzle>`, all consumers type-check.
- Database tests: green (schema + queries).
- Auth tests: green or skipped (`session.test.ts` already gates on `hasDatabase`).
- Build: produces `packages/database/dist/test-utils.js` + `test-utils.d.ts`.

---

## Verification checklist

- [ ] `pnpm --filter @workspace/database lint` passes (max-warnings=0)
- [ ] `pnpm --filter @workspace/database typecheck` passes
- [ ] `pnpm --filter @workspace/auth lint` passes
- [ ] `pnpm --filter @workspace/auth typecheck` passes
- [ ] `pnpm --filter @workspace/database test` passes (schema + queries)
- [ ] `pnpm --filter @workspace/auth test` passes (or skips correctly when no `TEST_DATABASE_URL`)
- [ ] `pnpm --filter @workspace/database build` produces `dist/test-utils.js` and `dist/test-utils.d.ts`
- [ ] `grep -r "tests/setup" packages/database/src packages/auth/src packages/api/src` returns zero (legacy file is gone)
- [ ] `grep -r "pg-mem" packages/database packages/auth packages/api --include="*.ts" --include="*.json"` returns zero
- [ ] Manual: `node -e "import('@workspace/database/test-utils').then(m => console.log(Object.keys(m)))"` prints `["setupTestDb", "cleanup", "Drizzle"]`

---

## Risks / edge cases

- **PGlite single-connection → parallel transaction deadlock.** Tests must serialize transactions (`await tx1; await tx2;`). Documented in `setupTestDb` JSDoc. If a future test genuinely needs concurrency, switch that single test to a real Postgres via Vitest `projects` (out of scope here).
- **`drizzle-kit/api` rename post-1.0.** Pinned to `drizzle-kit ^0.31.10` today. At the next bump, the import becomes `drizzle-kit/api-postgres`. Code comment captures this; one-line change when needed.
- **Type mismatch between `PostgresJsDatabase` (prod) and `PGLiteDatabase` (tests).** `auth/tests/setup.ts` used to type `db` as `PostgresJsDatabase`. After this change, it types as `PGLiteDatabase<typeof schema>` (the type re-exported from `test-utils.ts`). The runtime `auth` config doesn't care because `drizzleAdapter` is structurally compatible. Lint + typecheck will catch any consumer that explicitly types `db` as the postgres-js variant.
- **Vitest worker isolation.** PGlite's in-memory state is per-process. With Vitest's default `pool: 'threads'`, each worker gets its own module instance → own `_testDb`. No cross-test pollution. If we ever switch to `pool: 'forks'`, the same isolation holds.
- **`pushSchema` is undocumented.** It's the only programmatic way to push a Drizzle schema to a test DB without invoking the CLI. The Drizzle team has acknowledged the request to keep it (issue #4205). Risk: it could disappear in 1.0. Mitigation: fallback is `drizzle-kit push` via `child_process.execSync` — uglier but works. Not a blocker today.
- **`@electric-sql/pglite` bundle size.** Adds ~3 MB to `node_modules`. Workspace-only (not in catalog), so only the database package pulls it. Consumers don't pay transitively because the sub-path export doesn't re-export the dep.
- **First-time `pnpm test` is slower.** ~228 ms boot for PGlite (vs ~80 ms for pg-mem). Acceptable; tests run serially per file anyway. If we ever need to optimize, lazy `pushSchema` (skip if schema hash matches) is an option.

---

## PR metadata

| Field | Value |
|-------|-------|
| **Branch** | `refactoring/database` |
| **PR title** | `refactor(database): PGlite-based test-utils sub-path export` |
| **Labels** | `refactor`, `area:database`, `area:tests`, `priority:medium`, `effort:medium` |
| **Assignee** | `martyy-code` |
| **Spec source** | `temp/reports/analysis/database-test-utils-pglite-refactor.md` |
| **Breaking change** | Yes — drops pg-mem path. Anyone running `pnpm test` without `TEST_DATABASE_URL` was relying on pg-mem; after this PR they get PGlite transparently (no env var needed, no Docker needed). |
