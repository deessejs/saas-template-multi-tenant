# Drizzle client init — the Proxy + lazy singleton pattern

> Scope: annotated walkthrough of `packages/database/src/client.ts` and its `Proxy`-wrapped lazy Drizzle client, cross-referenced against Drizzle's official connection-management guidance, the porsager/postgres API, and a survey of senior alternatives. Sister file: the env Proxy at `packages/env/src/server.ts` (see §10).
>
> Author: research sub-agent. Sources: web-search/fetch via the `fresh` CLI (Exa), listed in §13.

---

## 1. TL;DR

The Drizzle client in this repo is **not** a module-level `const db = drizzle(pool)` as the Drizzle "Serverless" page sketches it. It is a `new Proxy({}, …)` whose `get` trap lazily constructs a `postgres-js` pool on first property access, then caches it in a module-level `_db` slot. The Proxy pattern is doing four jobs at once: (a) deferring pool construction until a query is actually issued so bare imports (`pnpm auth:generate`, `drizzle-kit generate`) do not require a live `DATABASE_URL`; (b) routing around an ESM circular dependency between `@workspace/database` and `@workspace/env/server` by `require()`-ing env at runtime rather than importing it at module top; (c) returning a typed-but-passthrough stub object in the CLI context (`{} as ReturnType<typeof drizzle>`) so import-statements never crash; (d) acting as a single, hot-cache singleton across all call sites within one process.

The current code is correct for this repo's constraints, but the existing `{} as ReturnType<typeof drizzle>` cast is type-unsafe in a subtle way: it makes the passthrough stub indistinguishable from a real Drizzle client at compile time, so a typo in a CLI script that calls `db.select(...)` will compile and only blow up at runtime (and `db.select` is `undefined` on `{}`, so it actually throws `TypeError: Cannot read properties of undefined`). The Proxy can be made strictly typed with a small `getDb()` annotation or a `PostgresJsDatabase<typeof schema>` explicit type; see §7.

The two cross-cutting risks that the pattern deliberately ignores are: (1) graceful shutdown — there is no `pool.end()` on `SIGTERM`, so the postgres-js pool can keep the Node process alive (a documented design wart, see porsager/postgres #869); (2) a theoretical init race under async code, which is harmless here because `getDb()` is synchronous — Node's single-threaded event loop makes the `if (!_db) { _db = … }` block effectively atomic.

If this code is being written today rather than 18 months ago, the recommended senior alternative is a **typed cache proxy + `globalThis` HMR guard**, the canonical pattern the Next.js team and most production Drizzle templates have converged on (`peal.dev`, vercel/next.js Discussion #68572). For this specific repo the existing Proxy is acceptable; the only spec-only suggestions are tightening the type and exposing a `closeDb()` for tests/shutdown.

---

## 2. The current pattern (annotated walkthrough)

Reference: `packages/database/src/client.ts:1-53`. We walk it top to bottom.

### 2.1 Imports — `client.ts:1-3`

```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
```

Three things. The Drizzle binding is the postgres-js variant (`drizzle-orm/postgres-js`), not `pg`. The driver `postgres` from `porsager/postgres` is a fully-featured alternative to `node-postgres` that supports `prepare: false`, `max`, `idle_timeout`, `max_lifetime` directly via its `postgres(url, opts)` factory. `* as schema` collects every `pgTable(...)` declaration so the relational query builder (`db.query.user.findMany({ with: { … } })`) knows about them.

### 2.2 The inline comment block — `client.ts:5-15`

The four `postgres()` options are documented inline:

- `prepare: false` — required behind PgBouncer / Neon transaction-mode pooler (the extended-query protocol used by prepared statements is incompatible with transaction-mode multiplexing; Drizzle's Supabase connect page says "ensure to turn off prepare, as prepared statements are not supported").
- `max: 10` — cap per Lambda/worker. Tune to provider limits. Justified by serverless math: each function instance opens `max` connections, and the DB's hard limit (Postgres default 100) is hit fast when many Lambdas are warm.
- `idle_timeout: 60` — Neon serverless compute suspends after ~5 min inactivity; an earlier 20 s was too aggressive (ECONNRESET from the pooler). 60 s is the documented value.
- `max_lifetime: 60 * 30` (1800 s, 30 min) — recycle connections periodically so the pool stays fresh across a pooler restart.

The "lazy initialization" comment is the second story arc: the pool is not built until `db` is actually used, and a dummy object is returned when `DATABASE_URL` is missing so CLI imports never crash.

### 2.3 The cache and `getDb()` — `client.ts:17-44`

```ts
let _db: ReturnType<typeof drizzle> | null = null

function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    const envModule = require("@workspace/env/server") as {
      serverEnv: { DATABASE_URL: string | undefined }
    }
    const url = envModule.serverEnv.DATABASE_URL
    if (!url) {
      _db = {} as ReturnType<typeof drizzle>           // CLI passthrough
    } else {
      const pool = postgres(url, { prepare: false, max: 10, idle_timeout: 60, max_lifetime: 60 * 30 })
      _db = drizzle(pool, { schema })
    }
  }
  return _db
}
```

Three deliberate choices:

1. `let _db: … | null = null` is a **module-local cache slot**, not exported. This is the singleton. Since Node caches evaluated ESM modules per process, this slot lives for the lifetime of the process (or until HMR recreates the module — which the current code does not guard against with `globalThis`).
2. `require("@workspace/env/server")` is a CommonJS-style dynamic require inside an ESM file. The comment notes this is "dynamic import to avoid ESM circular dependency issues while still loading env vars at runtime (not build time)." `require()` is allowed in the lint config for that path. A bare `import { serverEnv } from "@workspace/env/server"` would hoist evaluation; that is the entire point of not importing it eagerly — `validateServerEnv()` runs on `getDb()`, and the whole env validation chain (Zod safe-parse, `process.exit(1)` on failure) is hidden behind the lazy threshold.
3. `{} as ReturnType<typeof drizzle>` is a **type-unsafe escape hatch** that buys CLI passthrough without writing a mock class. It is the most fragile line in the file; see §7 for a typed alternative.

### 2.4 The Proxy — `client.ts:46-52`

```ts
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>]
  },
})
```

The Proxy's purpose is to **hide the lazy threshold from every call site**. A consumer writes `db.select().from(user)`; the Proxy intercepts `.select`, calls `getDb()` to materialise the real client (and pay the construction cost), then forwards the property read. The empty `{}` target is never observed by user code — every property read goes through the trap. There is no `set`, `has`, `apply`, or `ownKeys` trap, which means the Proxy does not behave like the real client under `Reflect.ownKeys`, `'select' in db`, or any non-`get` reflection. For the call sites the repo actually has (`db.select/insert/update/delete/transaction/query`), this is irrelevant.

The single `get` trap is enough to make the Lazy Singleton pattern feel like a normal exported constant to every caller, including TypeScript type-checking (modulo the cast).

---

## 3. Why a Proxy?

### 3.1 The lazy initialization pattern

A lazy singleton is a singleton whose construction is deferred until first use. Three pieces: a module-level slot, a getter that creates the instance if absent, and an export that triggers the getter on access. The classical forms in JS are:

| Form | Constructor runs when… | Trade-off |
|---|---|---|
| Eager module const | At import time | Crashes if deps missing at import |
| Top-level `await` | When the module is awaited | Hoists await through importers |
| Pure factory `getDb()` | When the caller invokes it | Callers must import & call |
| Lazy getter with closure | At first property access | Closures are not ergonomic across re-exports |
| `Proxy({}, { get })` over a lazy getter | At first property access (any depth) | Magic; runtime indirection on every read |

The Proxy form is the only one that lets the rest of the codebase write `import { db } from "@workspace/database"` and then `db.select(...)` as if it were an eager singleton, while keeping the actual construction atomic and deferred. The MDN `handler.get()` reference is the load-bearing API surface here.

### 3.2 JS Proxy traps at the level we need

A Proxy in JS intercepts up to 13 operations via traps (`handler.get` is the read; `set`, `has`, `ownKeys`, `getOwnPropertyDescriptor`, `apply`, `construct`, etc., are the rest). The Drizzle client Proxy uses **only** `get`, because every call site is a property read: `db.select`, `db.insert`, `db.update`, `db.delete`, `db.transaction`, `db.query`. This is the minimum-viable trap set. Adding `has` for `'select' in db` would be a 4-line addition but is not currently needed by the repo.

Why is `get` enough for tree-shaking? Tree-shaking happens at module-graph time (Webpack/Rollup/tsc), based on imports and `import * as` shapes, **not** at runtime on the Proxy. So a Proxy does not help or hurt tree-shaking on its own — what helps tree-shaking is the named-export shape `export const db = …` vs `export default new Proxy(…)`. We export a named const, so side-effect-free imports remain side-effect-free even with the Proxy in place.

### 3.3 What the Proxy buys us, concretely

1. **Deferred construction.** `db.select` is the first thing that triggers `getDb()`. Importing `db` does not open a pool.
2. **Single fly-by of initialization.** Once `_db` is set, every subsequent `get` is `getDb()[prop]`, which still re-enters `getDb()` but returns the cached value in one branch. The cost is one function call + one branch.
3. **A typed façade.** The Proxy's `as ReturnType<typeof drizzle>` cast lets TypeScript see `db` as a full Drizzle client without exposing internals.

### 3.4 What it costs

- Every property read goes through a JS engine-level trap. Modern V8 is fast (the trap inlines once monomorphic), but it is not free in a hot query path.
- The Proxy is **not** instance-of-equivalent to `PostgresJsDatabase<typeof schema>`. `db instanceof PostgresJsDatabase` is `false`, and so are any `Reflect.ownKeys`-based checks (third-party libs that introspect ORM clients can break).
- The type cast `as ReturnType<typeof drizzle>` is a lie when `DATABASE_URL` is unset: the runtime object is `{}` and `db.select` is `undefined`. The brand is erased by design.

---

## 4. Junior alternatives that fail

The simplest alternatives all carry a real failure mode in this codebase.

### 4.1 Plain `getDb()` factory

```ts
export function getDb() { /* same body */ }
```

Consumers write `getDb().select(...)`. **Fails** because: (a) every call site touches the function instead of the static export, which the rest of `@workspace/auth`, `@workspace/api`, and Better Auth's adapter import as `db`; (b) a `db` constant is expected by the better-auth `drizzleAdapter(db, { provider, schema })` call; (c) it loses the single-point-of-init ergonomics: `import { db }` reads as a value, `getDb()` reads as a service-locator.

### 4.2 Eager module-level singleton

```ts
const pool = postgres(env.serverEnv.DATABASE_URL, { ... })
export const db = drizzle(pool, { schema })
```

**Fails** for the same reason `client.ts` exists: this throws at import time if `DATABASE_URL` is unset. `pnpm auth:generate` (which runs `drizzle-kit generate` against `packages/auth/src/auth.ts`) imports `packages/database` for the schema barrel but **does not** need a live DB. Same for `drizzle-kit check`. The Drizzle Serverless page shows exactly this form — and exactly the failure this repo avoids.

### 4.3 Top-level `await`

```ts
const { serverEnv } = await import("@workspace/env/server")
const pool = postgres(serverEnv.DATABASE_URL!, { ... })
export const db = drizzle(pool, { schema })
```

**Fails** because top-level `await` (TC39 stage 4 in Node ≥14.8) makes the importing module **wait** for this module to resolve before its own evaluation. That propagates the `await` through transitive importers — V8's documentation and the TC39 proposal warn that TLA causes performance penalties and can deadlock cycles. For a database module that is imported transitively from request handlers, this is the wrong shape; the import-time pause would slow cold-start measurably.

### 4.4 IIFE that throws

```ts
export const db = (() => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required")
  return drizzle(postgres(process.env.DATABASE_URL, { … }), { schema })
})()
```

**Fails** the CLI-passthrough test for the same reason as 4.2 — it throws at import time, killing `pnpm auth:generate`.

### 4.5 Branded `Symbol`-stamped singleton

```ts
const DB = Symbol("db")
let _instance: typeof DB | null = null
export const db = Object.create(null, { [DB]: { value: () => _instance ??= getDb() }, … })
```

**Fails** ergonomically — the brand is invisible at the call site, and you still need a Proxy or a getter to expose `.select`. Not worth the indirection.

---

## 5. Senior alternatives (with code)

These are the senior-shaped options considered when writing a fresh client.ts today.

### 5.1 Pure factory function with explicit error

```ts
// packages/database/src/client.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { serverEnv } from "@workspace/env/server"

let _pool: ReturnType<typeof postgres> | null = null
let _db:    ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (_db) return _db
  if (!serverEnv.DATABASE_URL) {
    throw new Error("[database] DATABASE_URL is required (CLI tool? use createStubDb)")
  }
  _pool ??= postgres(serverEnv.DATABASE_URL, { prepare: false, max: 10, idle_timeout: 60, max_lifetime: 1800 })
  _db = drizzle(_pool, { schema })
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, p) { return (getDb() as any)[p] }
})

export const closeDb = async () => {
  if (_pool) await _pool.end({ timeout: 5 })
  _pool = null; _db = null
}
```

Differences vs. current: typed generics on `drizzle`, eager import of `serverEnv` (still lazy at runtime — serverEnv is itself a Proxy — see §10), explicit `getDb()` export, explicit `closeDb()`.

### 5.2 Eager module singleton with `globalThis` cache (HMR-safe)

This is the canonical pattern in the Vercel/Next.js community (see vercel/next.js Discussion #68572 and peal.dev):

```ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

declare global { var __workspace_db: PostgresJsDatabase<typeof schema> | undefined }

function createDb(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL!
  const pool = postgres(url, { prepare: false, max: 10, idle_timeout: 60, max_lifetime: 1800 })
  return drizzle(pool, { schema })
}

export const db: PostgresJsDatabase<typeof schema> =
  globalThis.__workspace_db ?? createDb()

if (process.env.NODE_ENV !== "production") {
  globalThis.__workspace_db = db
}
```

**Why it matters.** Without `globalThis`, Next.js/Turbopack dev-server HMR creates a fresh module instance on every save, which means a fresh `postgres()` call, which means a fresh pool — across a dev session, this leaks connections until Postgres refuses new ones. The `peal.dev` post-mortem on this is explicit: "In development, use global to prevent hot-reload from creating new connections." The repo's Next.js apps under `apps/*` are exposed to this exact failure mode in dev if/when this client is imported.

**Trade-off.** `globalThis` is the right tool for dev safety but means the module is no longer side-effect-free — saving `client.ts` in dev mutates a global. The convention is to gate the assignment behind `NODE_ENV !== "production"`.

### 5.3 Async-init cache (no race)

```ts
let _pInit: Promise<PostgresJsDatabase<typeof schema>> | null = null
export const db = new Proxy({} as any, {
  get(_t, p) {
    if (!_pInit) _pInit = createDb()
    // Note: a real async-safe Proxy requires an await barrier at every read.
    return (...args: unknown[]) => (_pInit as Promise<any>).then(real => real[p](...args))
  },
})
```

**Why it matters.** The current synchronous `if (!_db) { _db = … }` block is "atomic" in JS only because Node is single-threaded. As soon as you make initialization async (e.g. the pool needs a startup query), a callable would observe `_db = null` twice and trigger two constructions. The Promise-cache pattern (cache the in-flight Promise) is the canonical fix. For *this* repo, where `getDb()` is fully synchronous, this is unnecessary — but if the pool ever grows to need warm-up (PING, schema check, advisory lock), the cache-the-Promise pattern is the upgrade path.

### 5.4 Bridge pattern: explicit `createDb()` per request entry

Used in libraries that expose a connection factory to the consumer:

```ts
export function createDb(opts: { url: string; schema: typeof schema }): PostgresJsDatabase<typeof schema> { … }
```

The consumer decides where the pool lives. **Wrong** for this repo — we want one pool per process, not one pool per request.

### 5.5 DI container

A 40-line `Container` (cf. kibadist.com/blog/dependency-injection-typescript-without-framework) with `register`/`resolve` semantics:

```ts
container.register("db", (c) => createDb({ url: env.DATABASE_URL }), { singleton: true })
export const db = container.resolve<PostgresJsDatabase<typeof schema>>("db")
```

**Why it doesn't pay off here.** DI containers shine when you have many services that share dependencies and you want testability via `resolve`-time swapping. Here we have one service (the Drizzle client) and no tests that swap it. A container introduces a non-trivial API surface for zero gain; the Proxy pattern already gives us the lazy/singleton/testable triple.

### 5.6 Two-phase init (build-time generator + runtime registry)

A generated `client.gen.ts` materialised by `pnpm db:generate` that imports each table and exports a typed `_db`, plus a runtime wrapper. **Overkill** for a single database connection; useful for codegen layers that produce per-feature service bundles.

---

## 6. Connection pool tuning

The four options passed to `postgres(url, { … })` (`client.ts:34-39`) deserve more than the inline comment because each one is a response to a documented failure mode.

### 6.1 `prepare: false`

The load-bearing option for serverless. `postgres-js` prepares extended-query statements by default (named, pre-parsed, reusable). Transaction-mode poolers like PgBouncer, Neon pooler, and Supabase pooler route each transaction to a different backend connection — which means a prepared statement created on connection A may be invoked on connection B, where it doesn't exist. The error surfaces as `prepared statement "s1" already exists` (collision) or `function does not exist` (binary mismatch). Drizzle's Supabase connect page is explicit: "if you decide to use connection pooling via Supabase, and have 'Transaction' pool mode enabled, then ensure to turn off prepare, as prepared statements are not supported." `peal.dev` reports a 45-minute debugging session caused by leaving `prepare: true` on.

### 6.2 `max: 10`

Cap on simultaneous open sockets in this pool. Serverless math: each warm Lambda holds `max` connections to the pooler; if you have 50 concurrent Lambdas and `max: 10`, that's 500 client-side connections all fanning into the pooler. The pooler demultiplexes onto `max_pooler_conns` real Postgres backends (Neon default 100). For this repo, `max: 10` is conservative; peal.dev argues `max: 1` is better when each Lambda is a single-tenant request: "If you let each function instance open 5 connections to the pooler, and you have 50 concurrent functions, you're back to 250 connections. The pooler handles the multiplexing; you just need one lane into it per function."

The repo's choice of 10 reflects a different topology: long-lived server processes and single-tenant test setups, not AWS Lambda concurrency. That is fine — but docs/AGENTS should explicitly say "if you ship this to Vercel Lambdas, change this to 1."

### 6.3 `idle_timeout: 60`

Idle socket closes after 60 s. The repo's comment says an earlier 20 s caused `ECONNRESET` from the Neon pooler (the pooler's idle detection is more aggressive than yours; your client closes, but the pooler kept a backend alive and considers yours gone, then the pooler tries to reuse the dead backend and you see ECONNRESET on the next request). 60 s sits comfortably above the pooler's idle-detection threshold.

### 6.4 `max_lifetime: 60 * 30` (30 min)

Absolute cap on socket age. Forces periodic recycling so the pool does not hold a socket across an upstream pooler restart. 30 min is short enough to react to a pooler maintenance but long enough that the steady-state cost is one reconnect every 30 min per connection. The peal.dev article does not discuss `max_lifetime` directly but Postgres docs recommend a fraction of the pooler's idle timeout as a baseline.

### 6.5 Graceful shutdown (currently missing)

porsager/postgres #869 is the canonical reference: "if PostgresJS has been used at all, the process won't exit naturally, as it has some number of pooled connections still open." The library will not call `socket.unref()` on idle sockets, so each pooled socket keeps the event loop alive. Workarounds:

- For one-shot CLIs: call `await pool.end({ timeout: 5 })` before exit.
- For long-lived servers: register `process.on("SIGTERM", () => pool.end())`.
- For tests: a Vitest global teardown that calls `closeDb()` (the spec-suggested export).

The repo's `client.ts` does none of this. For `pnpm auth:generate` (CLI, exits when done) postgres-js leaking sockets means Node waits for the keepalive to time out before exiting, which is benign but slow. For `apps/api` (long-lived Next.js server) the issue is masked by Next's own process lifetime, but a deploy that triggers an early SIGTERM in the middle of in-flight queries will lose them. **Spec-only suggestion:** add `closeDb()` and wire it into a `process.once("SIGTERM", closeDb)` guard — explicitly test the route through §11.

---

## 7. Type-safe Proxy

### 7.1 The current cast

```ts
export const db = new Proxy({} as ReturnType<typeof drizzle>, { get(_t, prop) { … } })
```

`ReturnType<typeof drizzle>` is the *whole* `drizzle()` factory return, which is `PostgresJsDatabase<TSchema> | …` (the postgres-js variant). The empty `{}` is structurally compatible with everything (TS sees it as `{}`, and `PostgresJsDatabase` is a class type, not an interface, so the cast works). This buys correct *call sites* (`db.select(...)` typechecks) at the cost of hiding the passthrough behaviour (`{}` has no `.select`).

### 7.2 Tightening: explicit generic

```ts
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
type TSchema = typeof schema
type Drizzle = PostgresJsDatabase<TSchema>

const stub: Drizzle = new Proxy({} as Drizzle, {
  get(_t, prop) {
    if (prop === "select" || prop === "insert" || prop === "update" || prop === "delete" || prop === "transaction") {
      throw new Error("[database] Called db.* without DATABASE_URL — this is a CLI-passthrough context.")
    }
    return Reflect.get({} as Drizzle, prop)
  },
})
```

Now `db.select()` in a CLI context throws a clear error instead of `TypeError: Cannot read properties of undefined`. The Proxy types as `Drizzle` end-to-end; `db` is a real `PostgresJsDatabase<typeof schema>` from TypeScript's perspective. The behaviour split between "real" and "stub" is preserved at compile time **and** runtime.

### 7.3 Alternative: branded type

A `__brand = "DrizzleClient"` symbol on the type would let you narrow `db` in tests, but brands are erased at runtime, so all they buy is a compile-time distinction in tests that want to assert "this is a stub, not a real client." Likely more machinery than needed.

### 7.4 Alternative: a typed getter function

```ts
export function getDb(): PostgresJsDatabase<typeof schema> { … }
```

Trade-off: every call site is `getDb().select(...)` instead of `db.select(...)`. Loses the magic. Worth it only if tests need to distinguish "no DB" from "real DB" frequently — which this repo does not.

---

## 8. Race conditions & concurrency

The `if (!_db) { _db = … }` pattern looks racy. It isn't, in this codebase, for three reasons.

### 8.1 Node is single-threaded

JavaScript's execution model is one-call-stack-per-thread. Inside a synchronous block (`getDb`'s body), no other JavaScript code runs. The check-then-set is therefore atomic relative to *all* JS code. The classic SO question at stackoverflow.com/questions/58919867 nails this: the answers point out that the apparent race in concurrent Promise examples is not Promise-level concurrency but interleaving of async tick boundaries. As long as `getDb()` is fully synchronous, two callers will never observe `_db = null` after the first has committed `≠ null`.

### 8.2 Async init: cache the Promise

The moment `getDb()` adds `await`, the race opens up. Two callers racing on `await asyncCreate()` each see `_db = null`, each spawn a Promise, and each construct a separate pool. This is the case the SO thread warns about and where "Singleton Promises" become the upgrade (jonmellman.com/posts/singleton-promises). The fix is to cache the in-flight Promise, not the resolved value:

```ts
let _pInit: Promise<Drizzle> | null = null
function getDb(): Promise<Drizzle> {
  if (!_pInit) _pInit = createDb()
  return _pInit
}
```

`async-init` (github.com/ert78gb/async-init) is one npm-grade implementation; same idea appears in every DI container.

### 8.3 Worker threads & Node `cluster`

If this repo ever forks workers (e.g. `node:worker_threads` for CPU-bound migrator work, or `cluster` for a worker queue), the module-level `_db` slot is per-worker — each worker builds its own pool. The Postgres-side cap (100) then multiplies by N workers. The Proxy itself stays correct within each worker; cross-worker pooling needs a separate process-level singleton (a TCP forwarder, or a sidecar PgBouncer process). Not in scope for this doc, but worth noting when/if the `apps/api` deploy topology changes.

---

## 9. CLI passthrough pattern

### 9.1 The problem

The repo runs `pnpm auth:generate` at the workspace root. That command invokes `pnpm --filter @workspace/auth auth:generate`, which runs `pnpm exec auth generate --config ./src/auth.ts --output ../database/src/schema/auth.ts --yes`. The CLI walks the better-auth config and emits the four schema tables — it never queries the live database. But the workflow file (in `packages/auth/src/auth.ts`) imports `db` from `@workspace/database` for `drizzleAdapter`. That import pulls in `client.ts`, which pulls in `postgres`, which **connects** if `DATABASE_URL` is set. In CI or local dev where the operator hasn't populated `.env`, this throws.

The same issue applies to `drizzle-kit generate` (walks the schema via `drizzle.config.ts` → `schema: "./src/schema/index.ts"`; doesn't need a DB but the `client.ts` does need to import). And to any test that imports a module which transitively imports `db` without setting up `TEST_DATABASE_URL`.

### 9.2 Why `require()` instead of `import`

```ts
const envModule = require("@workspace/env/server") as { serverEnv: { DATABASE_URL: string | undefined } }
```

An `import { serverEnv } from "@workspace/env/server"` at the top of `client.ts` would force evaluation at module load — which is exactly the eager behaviour the Proxy is built to defeat. The `require()` is CommonJS, but Node.js supports `require()` inside ESM with a name path that resolves through the same module graph (`nodejs.org/api/modules.html`). Critically, the lint config allows it for `@workspace/env/server` only — the inline comment is explicit about that. The reason: `require()` does **not** hoist `serverEnv.DATABASE_URL` access into the importer; the access happens inside `getDb()`, lazy-aligned with the Proxy threshold.

### 9.3 Why `{} as DrizzleClient` is type-unsafe but OK

In every CLI context, the script does **not** call `db.select(...)`. It only imports `db` so the static chain resolves. So the runtime property never matters — the only thing that matters is that `db` *is something*, and `{}` is something. The type cast makes TypeScript cooperate. The risk surfaces only if a future CLI script accidentally calls a query — at which point the failure is loud (`TypeError: Cannot read properties of undefined (reading 'from')`), not silent. Defensive improvement: §7.2's stub-Proxy that throws a domain-specific error.

---

## 10. Sister env Proxy

`packages/env/src/server.ts:65-97` exports `serverEnv` through a Proxy that is structurally similar to `db` but with more traps. Cross-reference, not duplication.

```ts
export const serverEnv: Readonly<ServerEnv> = new Proxy({} as Readonly<ServerEnv>, {
  get(_target, prop) {
    if (prop === "toJSON")   return undefined
    if (prop === "then")     return undefined
    if (prop === "Symbol(\"[object Object]\")") return undefined
    if (prop === "getPrototypeOf") return undefined
    if (prop === "propertyIsEnumerable") return undefined
    if (prop === "toString" || prop === "valueOf" || typeof prop === "symbol") {
      const value = validateServerEnv()
      const desc  = Object.getOwnPropertyDescriptor(value, prop as string)
      if (desc?.value) return desc.value
    }
    const value = validateServerEnv()
    return (value as Record<string, unknown>)[prop as string]
  },
  has(_target, prop)                 { … validateServerEnv(); return prop in value },
  ownKeys()                          { return Reflect.ownKeys(validateServerEnv() as Record<string, unknown>) },
  getOwnPropertyDescriptor(_t, prop) { … Object.getOwnPropertyDescriptor(value, prop) },
})
```

Same shape as `db`: a Proxy wrapping a deferred "real value" slot, returning through the trap. Three traps the env Proxy carries that the db Proxy omits:

- **`has`** supports `'FOO' in serverEnv`. Used by tools that introspect. The db Proxy doesn't need this; Drizzle never asks `if ('select' in db)`.
- **`ownKeys`** supports `Object.keys(serverEnv)` / `Reflect.ownKeys`. The db Proxy doesn't need this either.
- **`getOwnPropertyDescriptor`** supports `Object.getOwnPropertyDescriptor(serverEnv, 'DATABASE_URL')`. Same story.

And one design choice the env Proxy carries that the db Proxy does not: the `toJSON`/`then`/`valueOf` browser-leak guard. The reasoning in the inline comment: "Runtime guard: detect browser bundle leaks." If a bundler mistakenly pulls `serverEnv` into a client bundle, the Proxy will respond to JSON-serialise / Promise-coerce checks at first reference and let the runtime guard throw. The db Proxy does not need this guard — `db` is module-private to the API layer in practice (it never reaches a browser bundle; if it did, it would just throw the much louder `Cannot read properties of undefined`).

The patterns are intentionally parallel. A future consolidation could lift a shared `lazy<T>(init: () => T, traps?: ProxyHandler<T>): T` helper into `@workspace/utils`, but for two call sites the indirection isn't worth it. (For a third consumer — say `@workspace/redis` — it is.)

---

## 11. Recommendation for THIS repo

**Keep the existing Proxy.** Three specific changes if/when this file is next touched:

1. **Tighten the type.** Replace `as ReturnType<typeof drizzle>` with `as PostgresJsDatabase<typeof schema>` (import the type explicitly). Inside the stub branch, return a Proxy whose trap throws a `[database] db.* called without DATABASE_URL` error rather than `undefined`. Cost: 5 lines. Benefit: a CLI script that mistakenly calls a query gets a clear error.

2. **Add `closeDb()` for tests and shutdown.** Match the spec suggested in §5.1. Wire it into a `process.once("SIGTERM", closeDb)` at the bottom of the file. Cost: 8 lines. Benefit: clean Vitest teardown, fast CLI exit, deploy-time in-flight draining on Vercel.

3. **Consider `globalThis` for HMR.** If `apps/*` Next.js apps under this repo begin importing `db` directly (rather than through `packages/auth`), the HMR-leak failure mode is real. Gate behind `if (process.env.NODE_ENV !== "production")`. Cost: 6 lines. Benefit: dev-time connection stability when running `pnpm dev` against a real DB.

Do **not** migrate to a DI container. Do **not** move to async init. Do **not** change the pool options without a documented reason (`packages/database/AGENTS.md` says so explicitly, and rightly — those numbers were tuned against the Neon pooler's behaviour). The current code is one small type-safety tightening and one small shutdown addition away from being fully correct for the next year.

Code sketch for the recommended final state:

```ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

declare global {
  // eslint-disable-next-line no-var
  var __workspace_db: PostgresJsDatabase<typeof schema> | undefined
}

type Drizzle = PostgresJsDatabase<typeof schema>

let _pool: ReturnType<typeof postgres> | null = null
let _db:   Drizzle | null = null

function buildStub(): Drizzle {
  return new Proxy({} as Drizzle, {
    get(_t, prop) {
      if (typeof prop === "string" && /^(select|insert|update|delete|transaction|query)$/.test(prop)) {
        throw new Error(`[database] db.${prop}() called but DATABASE_URL is unset (CLI passthrough)`)
      }
      return undefined
    },
  })
}

function buildReal(url: string): Drizzle {
  _pool = postgres(url, { prepare: false, max: 10, idle_timeout: 60, max_lifetime: 60 * 30 })
  return drizzle(_pool, { schema })
}

export function getDb(): Drizzle {
  if (_db) return _db
  const { serverEnv } = require("@workspace/env/server") as { serverEnv: { DATABASE_URL: string | undefined } }
  _db = serverEnv.DATABASE_URL ? buildReal(serverEnv.DATABASE_URL) : buildStub()
  return _db
}

export const db: Drizzle = (globalThis.__workspace_db ??= getDb())

export const closeDb = async () => {
  if (_pool) await _pool.end({ timeout: 5 })
  _pool = null; _db = null; globalThis.__workspace_db = undefined
}

process.once("SIGTERM", closeDb)
process.once("SIGINT",  closeDb)
```

---

## 12. Pitfalls & gotchas

- **Don't import at module top.** A bare `import { serverEnv } from "@workspace/env/server"` re-introduces the eager-init failure the Proxy exists to avoid. Use `require()` if you must.
- **`{} as ReturnType<typeof drizzle>` is a lie.** A future maintainer could call `db.select(...)` in a CLI script and only learn at runtime. Tighten per §7.
- **`db instanceof PostgresJsDatabase` is `false`.** Any code (e.g. a Drizzle plugin) that introspects the client through `instanceof` will misclassify. None today; check before adding.
- **`Reflect.ownKeys(db)` returns `[]`.** The single `get` trap means there are no own keys and no enumeration. Drizzle's relational query builder does not enumerate; a future feature might.
- **No graceful shutdown.** porsager/postgres #869: the pool keeps Node alive past natural exit. For one-shot CLIs the process eventually exits via keepalive timeout; for long-lived servers you need explicit `SIGTERM` wiring.
- **`max: 10` is not Lambda-safe.** If `apps/*` deploy as Vercel server functions with high concurrency, change to `max: 1` per the peal.dev recommendation. The current value is tuned for long-lived processes.
- **`prepare: false` is mandatory behind transaction-mode poolers.** Switching it to `true` will reintroduce `prepared statement "s1" already exists` errors. There is no Drizzle-side diagnosis that says "your pool mode changed"; the error message looks like a code bug.
- **HMR leaks.** Without `globalThis`, Next.js dev server recreates `client.ts`'s module on every save, which recreates the pool. Slow Postgres connection errors are the symptom.
- **Async init has a race.** If you ever `await` inside `getDb()`, two simultaneous calls can build two pools. Switch to Promise-caching.
- **Workers don't share.** `node:worker_threads` and `cluster` each build their own `_db`. Cross-worker pooling needs process-level isolation; not solved in-file.
- **`require()` is allowed in lint only for `@workspace/env/server`.** Adding other `require()` calls will fail lint, by design.
- **TypeScript cache false sense.** `db.select(...)` typechecks even in the stub branch. The new error-throwing stub Proxy (§11) is what surfaces misuse.

---

## 13. Sources

1. [Drizzle ORM — Serverless (declare pool outside handler, `prepare`, reuse prepared statements)](https://orm.drizzle.team/docs/perf-serverless)
2. [Drizzle ORM — Connect to Supabase (`prepare: false` with transaction-mode pooler)](https://orm.drizzle.team/docs/connect-supabase)
3. [Drizzle ORM — Connect to Neon](https://orm.drizzle.team/docs/connect-neon)
4. [Drizzle ORM — Best Practices](https://drizzle-team-drizzle-orm.mintlify.app/guides/best-practices)
5. [Drizzle ORM — Database Connection (core)](https://drizzle-team-drizzle-orm.mintlify.app/core/database-connection)
6. [Drizzle ORM — Postgres connection slots & pool exhaustion (Discussion #947)](https://github.com/drizzle-team/drizzle-orm/discussions/947)
7. [porsager/postgres — README (postgres-js API, `prepare`, `max`, `idle_timeout`, `max_lifetime`)](https://github.com/porsager/postgres)
8. [porsager/postgres Issue #869 — pool prevents natural process exit, `pool.end()`](https://github.com/porsager/postgres/issues/869)
9. [porsager/postgres Issue #861 — `pool.end()` semantics](https://github.com/porsager/postgres/issues/861)
10. [peal.dev — Connection Pooling with Serverless Databases (`max: 1`, `prepare: false`, `globalThis` HMR cache, PgBouncer transaction mode)](https://www.peal.dev/blog/connection-pooling-serverless-databases-why-it-matters)
11. [MDN — `handler.get()` (Proxy trap semantics)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get)
12. [MDN — `Proxy` (handler trap reference, no-trap fallback)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global%5FObjects/Proxy)
13. [Node.js — CommonJS Modules (dynamic `require()` semantics from ESM)](https://nodejs.org/api/modules.html)
14. [Node.js — ECMAScript Modules (module caching, top-level await behaviour)](https://nodejs.org/docs/latest-v26.x/api/esm.html)
15. [TC39 — Top-level `await` proposal (hoisting / performance caveats)](https://github.com/tc39/proposal-top-level-await/)
16. [V8 — Top-level `await` feature article (cold-start penalty, cycle risk)](https://v8.dev/features/top-level-await)
17. [StackOverflow — "Is it impossible to create a reliable async singleton pattern in JavaScript?" (Bergi on single-threaded JS, `Promise.all` non-concurrency)](https://stackoverflow.com/questions/58919867/is-it-impossible-to-create-a-reliable-async-singleton-pattern-in-javascript)
18. [Jon Mellman — Singleton Promises (Promise-cache pattern for async init)](https://www.jonmellman.com/posts/singleton-promises/)
19. [ert78gb/async-init — npm implementation of promise-cached singleton](https://github.com/ert78gb/async-init)
20. [vercel/next.js Discussion #68572 — Canonical approach to instantiating singletons in NextJS (`globalThis`, dev vs prod, webpack bundling)](https://github.com/vercel/next.js/discussions/68572)
21. [Kibadist — Dependency Injection in TypeScript Without a Framework (40-line container, factory functions, composition root)](https://www.kibadist.com/blog/dependency-injection-typescript-without-framework)
22. [Quý Minh Huỳnh — Solving Circular Dependencies in TypeScript with Proxies (lazy-Proxy pattern for DI)](https://medium.com/@quminhhunh/solving-circular-dependencies-in-typescript-with-proxies-a-deep-dive-87571c64f8d7)
23. [Microsoft tsyringe — README (decorator-based DI alternative)](https://github.com/microsoft/tsyringe/blob/e033769d/README.md)
24. [node-postgres — Pool API (graceful shutdown reference for sibling driver)](https://node-postgres.com/apis/pool)
25. [DEV — "Node.js Graceful Shutdown in Production: SIGTERM, In-Flight Draining" (cross-referenced process-lifecycle pattern)](https://dev.to/axiom_agent/nodejs-graceful-shutdown-in-production-sigterm-in-flight-draining-and-zero-downtime-deploys-2a7h)
26. [Supabase Docs — Drizzle ORM guide (PgBouncer / transaction-mode pooler note)](https://supabase.com/docs/guides/database/drizzle)

### Notes on contradictions in the literature

- **`max` setting.** Drizzle Serverless guidance is silent on numeric `max`. peal.dev argues `max: 1` is correct for Vercel Lambdas; this repo uses `max: 10` for long-lived processes. Both are correct for their target. The repo's value is "fine" for the current `apps/*` topology; the spec suggestion flags it as the single change to make if the deployment shape shifts to AWS Lambda/Vercel functions.
- **`idle_timeout` values.** Sources variously cite 20 s, 30 s, and 60 s. The repo's inline comment narrates the 20→60 upgrade (ECONNRESET). The Drizzle docs do not pin a number; only the Postgres-side keepalive & the upstream pooler's idle-detection time interact. The 60 s choice is the conservative outcome of that interaction.
- **TLA vs Proxy.** TC39 and V8 characterise top-level `await` as supported but with cycle and cold-start penalties. Some community guides still reach for TLA in module init; the consensus in production ORM templates (peal.dev, Vercel Discussion #68572) is to avoid TLA for DB init. The repo's Proxy + `require()` agrees with the consensus.
- **`Proxy` vs `getter`.** Most JS singleton tutorials reach for `Object.defineProperty` getters or closures. The Proxy form is less common but materially better when many properties are accessed (it avoids per-property definitions). No source argues against Proxy; the consensus is "use whichever makes the call sites cleanest."
