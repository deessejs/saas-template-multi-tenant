import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

// ----------------------------------------------------------------------------
// Lazy `db` client — keeps the pool off the critical path.
//
// Pool defaults (Neon / PgBouncer tuned, do not change without cause):
//   prepare: false     extended-query protocol is incompatible with
//                      transaction-mode poolers — flipping it reintroduces
//                      `prepared statement "s1" already exists` errors.
//   max: 10            per Lambda/worker. Revisit if a higher Vercel
//                      maxExecutionDuration is opted in.
//   idle_timeout: 60   Neon serverless compute suspends after 5 min inactivity.
//                      20 s caused ECONNRESET from the pooler; 60 s is the fix.
//   max_lifetime: 1800 recycle connections every 30 min to stay fresh.
//
// Platform context (mid-2026):
//   - Vercel Functions default 5 min, opt up to 30 min on Pro/Enterprise
//     with Fluid Compute. Idle-connection hygiene is `attachDatabasePool`
//     from `@vercel/functions`, NOT the SIGTERM handler below — wire it
//     from apps/* entrypoints.
//   - Vercel graceful shutdown is 500 ms. `pool.end({ timeout: 0.3 })`
//     stays inside that budget on scale-down.
//   - ECS / Kubernetes: 30 s default terminationGracePeriodSeconds.
//   - AWS Lambda (non-active): runtime freezes; SIGTERM not relied on.
//
// Lazy initialization: the pool is only created on first access. When
// DATABASE_URL is missing (e.g. `pnpm auth:generate`), a stub Proxy throws
// on any property access — CLI tools can import `db` without crashing,
// while misuse fails loudly. See
// docs/internal/learnings/drizzle/client-init.md for the design rationale.
//
// Uses `require("@workspace/env/server")` (not `import`) to dodge an ESM
// circular dependency while still loading env at runtime. Allowed only
// for this module by the ESLint config.
// ----------------------------------------------------------------------------

type Drizzle = PostgresJsDatabase<typeof schema>

// `_pool` is tracked separately from `_db` so `closeDb()` can drain the
// underlying postgres-js pool on shutdown. Module-local state survives the
// lifetime of the Node process; dev-mode HMR uses `globalThis` to share the
// instance across module reloads (see `db` export below).
let _pool: ReturnType<typeof postgres> | null = null
let _db: Drizzle | null = null

// CLI passthrough: any non-inspector property access throws a clear error
// instead of failing with `undefined is not a function` (or worse, silently
// returning a Promise from `db.query.users.findMany()`). Future-proof
// against new Drizzle methods — we don't enumerate them, we just refuse
// every access except for probes the runtime / inspector machinery needs.
function buildStub(): Drizzle {
  return new Proxy({} as Drizzle, {
    get(_target, prop) {
      if (
        typeof prop === "symbol" ||
        prop === "then" ||
        prop === "catch" ||
        prop === "finally" ||
        prop === "toJSON" ||
        prop === "inspect" ||
        prop === "constructor" ||
        prop === "toString" ||
        prop === "valueOf"
      ) {
        return undefined
      }
      throw new Error(
        `[database] db.${String(prop)} accessed but DATABASE_URL is unset (CLI passthrough)`,
      )
    },
  })
}

function buildReal(url: string): Drizzle {
  _pool = postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 60,
    max_lifetime: 60 * 30,
  })
  return drizzle(_pool, { schema })
}

function getDb(): Drizzle {
  if (_db) return _db

  // This is allowed for @workspace/env/server in eslint-config.
  const envModule = require("@workspace/env/server") as {
    serverEnv: { DATABASE_URL: string | undefined }
  }
  const url = envModule.serverEnv.DATABASE_URL

  _db = url ? buildReal(url) : buildStub()
  return _db
}

declare global {
  // `var` is required inside `declare global`.
  var __workspace_db: PostgresJsDatabase<typeof schema> | undefined
}

// HMR guard: cache the db instance on globalThis during non-production
// environments so Next.js dev-mode HMR doesn't recreate the pool on every
// module reload. In production the module-local cache (handled by `_db`)
// is sufficient and avoids touching global state.
export const db: Drizzle =
  process.env.NODE_ENV !== "production"
    ? (globalThis.__workspace_db ??= getDb())
    : getDb()

/**
 * Close the underlying postgres-js pool. Drains in-flight queries with a
 * 300 ms grace period — fits Vercel's 500 ms graceful shutdown budget.
 * Safe to call multiple times. Safe from CLI passthrough (no-op when no
 * pool was ever opened).
 */
export const closeDb = async (): Promise<void> => {
  if (_pool) {
    await _pool.end({ timeout: 0.3 })
  }
  _pool = null
  _db = null
  if (process.env.NODE_ENV !== "production") {
    globalThis.__workspace_db = undefined
  }
}

// Graceful shutdown on SIGTERM / SIGINT for Vercel and other long-lived
// environments. `process.once` registers a one-shot listener that doesn't
// keep the event loop alive on its own.
process.once("SIGTERM", () => {
  void closeDb()
})
process.once("SIGINT", () => {
  void closeDb()
})
