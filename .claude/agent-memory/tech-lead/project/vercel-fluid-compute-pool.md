---
name: vercel-fluid-compute-pool
description: Vercel Fluid Compute 30-min functions (post-2026-06-15) reshape pool hygiene for postgres-js in packages/database. attachDatabasePool from @vercel/functions is the canonical mechanism, not SIGTERM.
metadata:
  type: project
---

# Vercel Fluid Compute + Postgres Pool Hygiene (post-2026-06)

Pro/Enterprise Vercel Functions can now run up to **30 minutes** with Fluid Compute (announced 2026-06-15). The old "serverless = short-lived, no persistent pool" reflex is wrong for those plans. Pools can persist across many invocations inside one function execution.

**Why:** Affects how `packages/database/src/client.ts` pool lifecycle is reasoned about. Don't suggest fixes based on "Vercel is short-lived" — that's no longer true on Pro/Enterprise.

**How to apply** when designing pool lifecycle in any `apps/*` Vercel entrypoint (e.g. `apps/app/proxy.ts`, route handlers, server actions):

1. **Wire `attachDatabasePool(pool)` from `@vercel/functions`** at the route entrypoint. It uses `waitUntil` to keep the instance alive long enough to close **idle** connections after a request — that's the hygiene mechanism. SIGTERM is **not** the right tool here.

2. **Keep `process.once("SIGTERM")` / `process.once("SIGINT")` in `client.ts`** for ECS/K8s targets (30 s default `terminationGracePeriodSeconds`) and clean CLI exit. On Vercel graceful shutdown is **500 ms** total — too short for serious drain, so `client.ts`'s `pool.end({ timeout: 0.3 })` stays inside the budget but doesn't claim to drain in-flight work.

3. **Drain timeout 0.3 s** (not the 5 s we started with). Fits Vercel 500 ms grace; unaffected on ECS/K8s.

4. **`globalThis.__workspace_db` HMR cache** in `client.ts` stays. Fluid Compute dev instances are *more* long-lived than before, so the cache matters more, not less.

## Vercel Functions duration limits (mid-2026)

| Plan | Default | Max (normal) | Extended (Fluid Compute) |
|---|---|---|---|
| Hobby | 300 s | 300 s | — |
| Pro | 300 s | 800 s (≈13 min) | **1800 s = 30 min** |
| Enterprise | 300 s | 800 s | **1800 s = 30 min** |

Above 800 s requires Fluid Compute (default on Pro/Enterprise since April 2025). Beta: Node.js 20/22/24 only. Per-function opt-in via `export const maxDuration = 1800` (App Router) or `vercel.json` `functions.<path>.maxDuration`. Source: `vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes`.

## Common mistake to flag

A reviewer or future agent suggests "increase the SIGTERM drain timeout to fix Vercel issues" → that's wrong. The right tool for Vercel idle hygiene is `attachDatabasePool`, not signal handlers.

## Outstanding follow-up

- Issue to file: wire `attachDatabasePool(pool)` in `apps/app/proxy.ts` (the route entrypoint on Vercel). NOT in `packages/database/src/client.ts` — that's a library, and tying it to `@vercel/functions` would scope-creep the package.
- Audit: which `apps/*` routes need `export const maxDuration = 1800` (long DB work, streamed responses, batch processing)?

## Related

- [[vercel-platform]] — Vercel catalog snapshot (mentions 30-min in passing under Vercel Services)
- [[deploy]] — our `vercel.json`, engines.node >=24, dashboard overrides
- `docs/internal/learnings/drizzle/client-init.md` — design rationale behind the current Proxy + SIGTERM wiring
