<!-- BEGIN:api-agent-rules -->
# `packages/api` — agent invariants

This package is the **single integration point** for `@workspace/auth` (better-auth), `@orpc/server` (oRPC), and Hono into the Next.js catch-all route. Every piece of code that handles an HTTP request inside `apps/*` should resolve through `api` exported from `src/index.ts`. Do not create parallel Hono instances or parallel catch-all files.

The patterns in this package are aligned with the **principal-level documentation** of each upstream library. See `docs/internal/learnings/api/patterns.md` (TODO) or the canonical verification above — no custom workarounds, no undocumented behaviors.

---

## Single source of truth — the `api` export

`packages/api/src/index.ts` is the **only** place where the Hono app is constructed.

```ts
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { db } from "@workspace/database"
import { serverEnv } from "@workspace/env/server"
import { appRouter } from "./router/index.js"

export const api: Hono<ApiEnv> = new Hono<ApiEnv>().basePath("/api")
//   ^^^ consumed by apps/app/app/api/[[...route]]/route.ts via `handle(api)`

export { appRouter }
export type { AppRouter } from "./router/index.js"
```

**Rule:** all route definitions, middleware, CORS, and oRPC mounting live in this file. Consumers import `api` (the Hono handler) or `appRouter` (the oRPC typed router). No other file in the workspace should instantiate `new Hono(...)`.

---

## Routing surface — three namespaces

`api.basePath('/api')` plus the Next.js catch-all mounted at `/api/[[...route]]/route.ts` means every route inside Hono is prefixed with `/api/`. The namespace layout is:

| Path prefix | Owner | File | Notes |
|---|---|---|---|
| `/api/health` | `api` | `src/index.ts` | Liveness — no DB access |
| `/api/ready` | `api` | `src/index.ts` | Readiness — pings Postgres before 200, returns 503 on failure |
| `/api/auth/*` | better-auth | `src/index.ts` | Three contracts — see [Better-auth integration surface](#better-auth-integration-surface--three-contracts) |
| `/api/rpc/*` | oRPC | `src/index.ts` | Body-parser Proxy + RPCHandler — see below |

When adding a new route family, **add it inside `src/index.ts`**, not in a new file. The Hono chain must be co-located so the middleware order stays reviewable as a unit.

---

## Routing decision rule — bare Hono vs oRPC

The `/api` chain holds **two co-existing routing styles**: bare Hono handlers (`/health`, `/ready`, `/auth/*`) and an **oRPC mount** at `/rpc/*`. The split is not stylistic — each style has a non-overlapping purpose. Putting a new endpoint on the wrong side fights the framework or breaks type safety. Use this rule when in doubt.

### Use bare Hono when the endpoint is…

**1. Infrastructure, not domain logic.** Health checks, readiness pings, Prometheus metrics, debug endpoints. They have no schema, no auth, no client. They return fast or fail open. The shape `{ status, timestamp }` on `/health` and the Postgres ping on `/ready` are the canonical examples — both stay Hono because adding oRPC there buys nothing.

**2. A binary or streaming response.** File downloads, PDF generation, image transformations, Server-Sent Events, video chunks. oRPC's RPC protocol is JSON-shaped (with native type extensions, but the wire format is JSON-typed); large or binary payloads are cheaper to serve directly through Hono's `c.body(stream)` and `c.newResponse(...)`.

**3. A third-party webhook receiver.** Stripe, GitHub, Resend inbound, OAuth callbacks — services that POST a fixed JSON signature without going through our typed client. oRPC would require round-tripping their schema into zod for no reason; Hono + the better-auth-style raw `Request` hand-off (`await request.text()` then `JSON.parse`) is simpler and lets us set the precise `Content-Type` they expect.

**4. A non-JSON success response.** HTML, plain text, redirects (`302`), empty bodies with specific status codes. oRPC's success path always encodes through the RPC protocol; producing a raw HTML page or a `Location: /login` redirect through it is a contortion.

**5. A proxy / passthrough.** Routing traffic to another subsystem (better-auth's `/auth/*` mounts `auth.handler(c.req.raw)` — exactly this pattern). The delegated handler owns the surface; Hono is just the mount.

### Use oRPC when the endpoint is…

**1. Domain logic consumed by the typed client.** Anything reachable from `apps/app/lib/orpc.ts` — `orpc.user.profile()`, `orpc.user.find(...)`, etc. The client-side type flow `RouterClient<typeof appRouter>` requires the procedure to be wired into `appRouter` (`packages/api/src/router/index.ts`). A bare Hono route would be invisible to the client and force React code back to plain `fetch(...)`.

**2. Input validation matters.** Zod schemas (`z.object({...})`) on `.input(...)` produce runtime validation **and** inference into the handler `input` type and the client call site. Hono doesn't have this — a bare Hono route would re-implement validation by hand and miss the client-side input type.

**3. Type-safe errors are part of the contract.** `throw new ORPCError("UNAUTHORIZED")`, `"NOT_FOUND"`, `"BAD_REQUEST"`, plus custom error codes, propagate through to `InferClientErrors<typeof client>` on the client. Bare Hono would only have HTTP status codes — useful for browsers but lossy for app code that wants to react to a specific failure mode.

**4. Composable middleware is needed.** Auth, rate-limiting, RBAC, audit logging. oRPC's `os.middleware(...)` composes with `.concat(...)` and propagates narrowed `context` types via `next({ context })`. Hono middleware can do similar things but loses the type-safe consumer pipeline — every step is a fresh `c.get(...)` chain rather than a typed argument.

**5. The endpoint will grow.** Once a feature has 3+ procedures, putting them in `appRouter.<feature>.<verb>` gives a typed URL space, structured errors, and a clear path to add `experimental.joins`-style future tools. Bare-Hono one-offs sprawl.

### Never use oRPC when…

- **The caller is not the typed client.** External services don't speak the oRPC RPC protocol. A public REST/OpenAPI surface belongs to OpenAPIHandler (a sibling of RPCHandler) — not to `RPCHandler`. Don't force oRPC on consumers that don't have a generated client.
- **The endpoint returns redirects, HTML, or non-200 with empty body in a way that matters.** Use Hono. oRPC encodes errors as JSON-RPC-style bodies even on 4xx.
- **The endpoint needs range requests, ETags, or other HTTP-level features.** oRPC's transport is opaque to those.

### Mixed case — what about endpoints that look domain-y but stream?

A "download the user's invoice" endpoint might *look* domain-y (lives in `billing/`, takes `{ invoiceId }`) but needs `Content-Type: application/pdf`. The pragmatic split:

- **The metadata fetch** (validate user owns the invoice, get signed URL) → oRPC procedure.
- **The actual download** → bare Hono route that takes the signed token and streams the PDF.

Both routes live in `packages/api`. The split keeps type safety on the lookup and HTTP control on the download.

### Quick checklist before adding a new route

```
[ ] Does the typed client need to call this?           → oRPC
[ ] Does input need runtime validation?                 → oRPC (zod schemas)
[ ] Is this a webhook / health / streaming / non-JSON?  → Hono
[ ] Will this throw typed errors?                       → oRPC
[ ] Will it grow into a router with siblings?           → oRPC
[ ] Is it a one-shot proxy to another handler?          → Hono
```

If two boxes are ticked in different columns, prefer **the higher one in the list** (the first `Yes` wins). When none apply, default to **bare Hono** — adding oRPC later is cheap (move the handler into `appRouter`), adding it prematurely is harder to undo.

---

## Better-auth integration surface — three contracts

better-auth and Hono wire together through **three primitives** that all live in `packages/api/src/index.ts`. Each one has a specific contract that must be preserved when the code changes. None of them is optional, none of them duplicates work.

### Contract 1 — The handler mount at `/api/auth/*`

```ts
api.on(["POST", "GET"], "/auth/*", (c) => {
  return auth.handler(c.req.raw)
})
```

better-auth ships its own HTTP surface (signin, signout, callback, get-session, OAuth providers, password reset, email verification, …). We do **not** re-implement any of these routes — we hand the raw Fetch `Request` to better-auth's own handler and let it do everything. This is the canonical pattern at <https://better-auth.com/docs/integrations/hono#mount-the-handler>.

Why `c.req.raw` and not `c.req`:

- `c.req` is Hono's wrapper. It exposes parsed getters (`c.req.json()`, `c.req.header(...)`, etc.) that have already begun reading the body — but better-auth needs an *untouched* Fetch `Request` to read body, headers, and method itself.
- `c.req.raw` is the underlying `Request` object. better-auth's `handler` is typed as `(request: Request) => Promise<Response>` and expects this exact shape.
- Substituting `c.req` would break endpoints that depend on `Request.clone()` semantics (e.g. CSRF tokens read twice, streaming).

**Rule:** when adding a better-auth endpoint, never add a parallel Hono route that mirrors what better-auth already does. better-auth's route surface is the source of truth. Cross-reference the docs before "exposing" a better-auth primitive.

### Contract 2 — The session middleware (runs ONCE per request)

```ts
api.use("*", async (c, next) => {
  const data = await auth.api.getSession({ headers: c.req.raw.headers })
  c.set("user", data?.user ?? null)
  c.set("session", data?.session ?? null)
  await next()
})
```

`auth.api.getSession({ headers })` is the canonical way to resolve the session on the server (per <https://better-auth.com/docs/integrations/hono#middleware>). It accepts a `Headers`-shaped value — we pass `c.req.raw.headers` for the same reason as Contract 1: better-auth reads headers it cares about (`Cookie`, custom session markers, …) and Hono may normalize them differently.

**Coercion contract — `?? null`, not `?? undefined`:**

`auth.api.getSession(...)` returns `{ user, session } | null` (not `undefined`). When the session is absent, `data?.user` would be `undefined`. We coerce to `null` via `?? null` so the Hono Variables type is `User | null` exactly, not `User | null | undefined`. This keeps downstream consumers (`c.get("user")`, oRPC context) free of `undefined` checks.

This middleware must run **before** any route or oRPC mount. It populates the Hono typed `Variables` (`ApiEnv`) so middleware and oRPC procedures can read `user`/`session` without re-issuing `auth.api.getSession` per request — which would multiply DB roundtrips.

**Rule:** in any new Hono middleware, read `c.get("user")` / `c.get("session")` instead of calling `auth.api.getSession` again. Same for oRPC procedures: `authMiddleware` already narrows the context, so `context.user` is the right path.

### Contract 3 — The `ApiEnv` type — bridging better-auth into Hono's `Variables` generic

Hono accepts a typed environment as a generic on its constructor (`new Hono<ApiEnv>()`). We use it to thread better-auth's `User` and `Session` types through `c.set` / `c.get`:

```ts
export type ApiEnv = {
  Variables: {
    user: NonNullable<
      Awaited<ReturnType<typeof auth.api.getSession>>
    >["user"] | null
    session: NonNullable<
      Awaited<ReturnType<typeof auth.api.getSession>>
    >["session"] | null
  }
}

const api = new Hono<ApiEnv>().basePath("/api")
```

**Why this derivation** (and not the simpler `typeof auth.$Infer.Session.user` form that the better-auth docs use):

- `auth.$Infer.Session` requires importing better-auth's `$Infer` namespace and assumes the auth instance uses `createAuth` with a specific config shape. We use a factory from `betterAuth(...)` and don't want to depend on the `$Infer` internal.
- `NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>` is **structural** — it reads the type directly from the function signature, so it auto-tracks any change to better-auth's return type (e.g. when we add custom fields via the `user.additionalFields` config). Adding a field to the auth user shape flows through into `ApiEnv` without any cast.
- The `| null` suffix preserves the Contract 2 coercion: the variable is *nullable by design*, not nullable-by-default.

**Rule:** when adding a new typed variable to the Hono context (e.g. request id, locale), derive it from `auth.api.getSession` if it depends on better-auth, or hand-type it in the `Variables` literal. Never use `declare module "hono" { interface ContextVariableMap … }` here — that's a global augmentation and would silence `undefined` runtime errors (see the warning at <https://hono.dev/docs/api/context#contextvariablemap>).

### How the three contracts compose

```
HTTP request
   │
   ▼
Next.js catch-all  ──→  handle(api)
                          │
                          ▼
                api.use("*", cors(...))         # read ALLOWED_ORIGINS from env
                          │
                          ▼
                api.use("*", logger())          # body-parsing-safe — no body access
                          │
                          ▼
                api.use("*", session middleware)  # Contract 2: c.set("user"/"session")
                          │
                          ▼
                api.on(["POST","GET"], "/auth/*", c => auth.handler(c.req.raw))   # Contract 1
                api.use("/rpc/*", body-parser Proxy + RPCHandler.handle(...))   # reads c.get("user"/"session")
                          │
                          ▼
                       route handler / oRPC proc
```

The chain order matters. **CORS → logger → session → routes.** Reordering breaks Contract 2 (oRPC sees `null` user) or CORS preflight handling.

---

## oRPC — body-parser Proxy is required, not optional

The `api.use('/rpc/*', ...)` block uses the body-parser Proxy pattern documented verbatim in <https://orpc.dev/docs/adapters/hono#body-already-used-error>:

```ts
const BODY_PARSER_METHODS = new Set([
  "arrayBuffer", "blob", "formData", "json", "text",
] as const)
```

If any middleware (logger, rate limiter, etc.) reads the request body **before** oRPC, the Proxy is what saves the request from a "Body Already Used" error. The Proxy is not optional and should never be removed "for simplicity."

**Rule:** if you add middleware between `api.use('*', logger())` and `api.use('/rpc/*', ...)`, and that middleware calls `c.req.json()` / `c.req.text()` / `c.req.formData()`, the Proxy must still cover all `BODY_PARSER_METHODS`. Audit every addition.

---

## Context typing — `BaseContext` vs `AuthContext`

`packages/api/src/router/context.ts` defines two interfaces:

```ts
export interface BaseContext {
  headers: Headers
  user: User | null
  session: Session | null
}

export interface AuthContext extends BaseContext {
  session: Session   // non-null
  user: User         // non-null
}

export const base = os.$context<BaseContext>()
```

**Why this split** (per <https://orpc.dev/docs/middleware#middleware-context>): `BaseContext.user` is nullable so public procedures can read it cheaply. `AuthContext` is the narrowed shape that `authMiddleware` provides after verification — oRPC infers `context.user: User` (not `User | null`) on any procedure built from `protectedBase`.

**Rule:** new procedures that need auth must be built from `protectedBase = base.use(authMiddleware)`, **not** from `base` with a manual `if (!context.user) throw ...` check inside the handler. The middleware is the type-narrowing mechanism; bypassing it makes procedures public.

---

## Middleware composition

```ts
// Auth guard, per orpc.dev/docs/middleware (Middleware Context section)
export const authMiddleware = base.middleware(async ({ context, next }) => {
  if (!context.user || !context.session) {
    throw new ORPCError("UNAUTHORIZED")
  }
  return next({
    context: {
      ...context,
      user: context.user,
      session: context.session,
    } as AuthContext,
  })
})
```

The `as AuthContext` cast at the end is the canonical pattern: oRPC infers the narrowed type via the `next({ context })` return, but TypeScript needs help to bridge the `BaseContext` literal into the `AuthContext` shape.

**Rule:** new guards (rate limiting, RBAC, feature flags) follow the same pattern — `base.middleware(...)` with `throw new ORPCError(...)` on failure, `next({ context: { ... } })` on success. Combine multiple guards with `aMiddleware.concat(bMiddleware)` (per `/middleware#concatenation`).

---

## CORS — single source of truth at the env-package boundary

```ts
api.use(
  "*",
  cors({ origin: serverEnv.ALLOWED_ORIGINS, credentials: true }),
)
```

Origins come from `serverEnv.ALLOWED_ORIGINS` only. Do **not** hardcode `localhost:3000`, `[3000, 3001]`, or environment-specific URLs anywhere in this file. The env package is the validation boundary (`z.string().transform(splitCsv)` in `packages/env/src/schema.ts`).

**Rule:** if you need a new CORS exception (e.g. a staging origin), add it to `.env` (`ALLOWED_ORIGINS=...`) — never to the source code.

The `credentials: true` flag is required so cookies from `better-auth` flow on cross-origin requests (per <https://better-auth.com/docs/integrations/hono#client-side-configuration>). Do not remove it.

---

## Next.js catch-all consumer

`api` is mounted at `apps/app/app/api/[[...route]]/route.ts`:

```ts
import { handle } from "hono/vercel"
import { api } from "@workspace/api"

export const dynamic = "force-dynamic"        // required — see comment in file

export const GET = handle(api)
export const POST = handle(api)
```

**Three rules tied to this file** (the comments inside it explain each, but they bear repeating):

1. **`force-dynamic` is required.** Without it, Next.js attempts build-time page-data collection which imports `@workspace/database` and fails because `DATABASE_URL` is unset at build. The directive defers evaluation to request time.
2. **`handle(api)` from `hono/vercel` is the canonical mount.** Do not duplicate dispatch logic on `request.url` substrings (the previous regex-based version was already removed — it's in git history if you need to see the anti-pattern).
3. **No parallel route files.** All `/api/*` traffic in `apps/app` flows through `[[...route]]/route.ts`. If you add a new app (e.g. `apps/web`), create its own catch-all under the same convention.

---

## Tests — `tests/`

`packages/api/tests/` is the canonical Vitest harness. Pattern:

- `setup.ts` exposes a test-only `RPCHandler` constructed with `appRouter` and a re-exported `auth` helper from `@workspace/auth/tests/setup.js`.
- `routes.test.ts` exercises the Hono patterns (health, ready, CORS, error handling) **in-process** via `app.request(...)` — no HTTP server, no `force-dynamic` needed.

**Rule:** new tests import `createRPCHandler` from `tests/setup.ts` instead of constructing `new Hono()` themselves. Don't write tests that spin up a real Postgres connection — use the same `@workspace/database/test-utils` (PGlite) the database package uses.

---

## Router composition — adding a new feature

`packages/api/src/router/index.ts`:

```ts
export const appRouter = {
  user: userRouter,
}
export type AppRouter = typeof appRouter
```

When adding a new domain (e.g. `billing`, `org`), create `src/router/<feature>.ts` that exports a router object, then re-export it from `index.ts`. **Nested router objects are the canonical pattern** — both oRPC and Hono understand them without configuration.

**Rule:** don't export routers individually across packages. The typed `AppRouter` must stay a single source for `RouterClient<typeof appRouter>` on the client side (`apps/app/lib/orpc.ts`).

---

## Build output — `.js` extensions required

Relative imports in `src/` **MUST** include the `.js` suffix:

```ts
// ✅ correct — what tsc rewrites to .d.ts and .js
import { appRouter } from "./router/index.js"

// ❌ breaks consumers — won't resolve in plain Node ESM
import { appRouter } from "./router/index"
```

Plain Node ESM requires explicit extensions. The `--rewriteRelativeImportExtensions` flag (or its absence — see `packages/database` for the explicit variant) only kicks in for imports that already have `.js` in source. Skipping the suffix breaks `dist/` portability.

`apps/app` re-exports work fine because Next.js / Hono consumers go through `package.json#exports` (which point to `dist/`), not through TypeScript source. So this rule is enforced at the package boundary, not at the import site.

---

## Code style — arrow functions for new TS exports

For new exported functions in TS files, use the **arrow style**:

```ts
// ✅ preferred
export const someHelper = () => { /* ... */ }

// ❌ avoid (legacy convention)
export function someHelper() { /* ... */ }
```

Matches the global preference captured in `feedback-ts-arrow-style` memory. Apply this rule to **new code**; refactoring existing exports is optional but encouraged when touching the file.

---

## When in doubt

1. Check `docs/guides/better-auth/integrations/hono` (better-auth) and `docs/guides/orpc/adapters/hono` (oRPC equivalent) first — the patterns here are deliberately aligned with their canonical examples.
2. If something needs to deviate, document it inside the source file as an inline comment AND mirror the deviation in `docs/internal/learnings/api/`. Drift between code and docs is the bug we want to prevent.
3. Run `pnpm --filter @workspace/api typecheck` and `pnpm --filter @workspace/api lint` before considering a change done. Both must pass with zero warnings (`--max-warnings=0`).
<!-- END:api-agent-rules -->
