---
name: orpc-api-layer
description: apps/app talks to the backend via oRPC (typed RPC over hono), not plain REST in apps/app/app/api/*. Catalog: @orpc/client + @orpc/server + hono.
metadata:
  type: project
---

The API surface in `apps/app` is **oRPC** end-to-end, not Next.js route handlers.

- `apps/app/package.json` depends on `@orpc/client`, `@orpc/server`, `hono`, plus `@workspace/api`.
- The contract lives in `packages/api` (exports `./router`); `apps/app/app/api/...` wires oRPC's HTTP transport (typically via hono) to that router.
- Catalog versions: `@orpc/client: ^1.14.7`, `@orpc/server: ^1.14.7`, `hono: ^4.12.28` (the hono pin is also a global `pnpm.overrides` — see [[stack]] for the duplicate-type-error rationale).

**Why oRPC over plain REST:** end-to-end type safety from router definition to client caller, zod-validated inputs by default, no separate OpenAPI generation step. Trade-off: couples the client to the same TS toolchain — fine for this monorepo, but a downstream consumer with a different language stack would need a different transport.

**How to apply:**
- New server endpoint? Add the procedure in `packages/api/src/router/...` and call it from `apps/app` via the oRPC client — do **not** add a new `apps/app/app/api/<thing>/route.ts`.
- Adding a new API consumer (e.g. a CLI in `apps/` or a worker in `packages/`)? Import the router from `@workspace/api/router` and use the oRPC client. Don't reimplement the contract locally.
- Schema drift: the router's zod schemas are the contract. When a Drizzle table changes, the change has to flow into the matching router input/output schemas — flag this in PRs that touch both `packages/database` and `packages/api`.
- hono version: the `pnpm.overrides` entry for `hono: ^4.12.28` exists specifically because MCP SDK → `@hono/node-server` pulls `hono@4.12.27` transitively. Don't drop the override — it'll reintroduce duplicate-type errors and subtle runtime mismatches.

Related: [[packages-api]], [[stack]], [[packages-auth]].