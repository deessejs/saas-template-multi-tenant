---
name: packages-api
description: packages/api — oRPC + hono + zod API layer, separate from packages/auth; consumed by apps/app via @workspace/api
metadata:
  type: reference
---

`packages/api` is the project's **API layer** package, distinct from `packages/auth` (which owns the Better Auth instance).

**Stack:** oRPC (`@orpc/client` + `@orpc/server`) + hono + zod. Drizzle as the data source via `@workspace/database`. Better Auth integration via `@workspace/auth` and `@better-auth/drizzle-adapter`.

**Exports:** `.` (root), `./router` — confirms a router pattern is in use.

**Already documented in-package:** `packages/api/AGENTS.md` and `packages/api/CLAUDE.md` exist. Read those first before editing; they capture the package's own conventions.

**Consumers:** `apps/app/package.json` depends on `@workspace/api`, `@orpc/client`, `@orpc/server`, `hono`. The API surface in `apps/app/app/api/...` is wired through oRPC, not plain Next.js route handlers.

**Why separate from `packages/auth`:** one-package-per-concern. Auth owns identity + session lifecycle; API owns the typed RPC contract consumed by clients. Mixing them couples the public RPC shape to Better Auth's internal plugin surface.

**How to apply:**
- New typed RPC? Add to `packages/api/src/router/...` and re-export. Don't add auth-specific endpoints here — those belong in Better Auth's plugin system and surface via `auth.api.*` in `apps/app`.
- New API consumer? Import from `@workspace/api/router`, not from `packages/auth` directly.
- Cross-cutting changes (auth contract drift, Drizzle schema for an app table): touch `packages/database` and `packages/api` together; `packages/auth` only when the auth config itself changes.

Related: [[packages-auth]], [[package-structure]].