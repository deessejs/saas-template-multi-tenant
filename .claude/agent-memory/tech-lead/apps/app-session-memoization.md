---
name: app-session-memoization-debunked
description: Problem #02 in the apps/app audit claimed duplicate getSession() calls were a perf issue. Research showed React.cache() violates Next.js 16 dynamic data rules, calls are sequential not parallel, and a potential better-auth bug (#7008) would need verification first. The fiche was deleted from the audit. Do not reopen without checking cookieCache config in packages/auth/src/auth.ts first.
metadata:
  type: reference
---

# Session memoization in apps/app — investigated, not a problem

## What was investigated

Problem #02 in `temp/audit/2026-07-10-apps-app/problems/02-duplicate-session-reads.md` claimed that `getSession()` was called multiple times per request (root dispatcher + `getActiveOrgSlug()` + `OrgLayout`), creating redundant DB reads.

## What research showed

### React.cache() on getSession() violates Next.js 16 rules
`auth.api.getSession()` internally calls `headers()`. Since `headers()` is a **dynamic API**, wrapping `getSession()` in `React.cache()` would violate Next.js 16's rule against accessing dynamic data inside a `'use cache'` scope. The correct pattern would require passing `headers()` as an argument (caller resolves it, cached function receives resolved value). This is more complex than the original issue.

Source: [better-auth issue #5584](https://github.com/better-auth/better-auth/issues/5584) — closed "not planned" by better-auth maintainers.

### Calls are sequential, not parallel
Between `proxy.ts` (middleware), `app/page.tsx` (root dispatcher), `getActiveOrgSlug()`, and `OrgLayout`, calls happen in series — not parallel renders triggering the same async function multiple times. There is no redundant DB call from parallel renders.

### The real potential issue: better-auth cookieCache bug
[Issue #7008](https://github.com/better-auth/better-auth/issues/7008) — `auth.api.getSession` returns `null` in server components when `cookieCache` is enabled. If this affects the project, it would cause auth failures, not perf issues. Verify `cookieCache` config in `packages/auth/src/auth.ts` before investigating session memoization further.

## Decision

**Fichi deleted from the audit.** Reopen only if:
1. `cookieCache` is confirmed off (or bug #7008 is fixed), AND
2. A profiler shows actual DB calls from parallel renders

## References

- `apps/app/app/page.tsx` — root dispatcher, calls `getSession()` + `getActiveOrgSlug()`
- `apps/app/app/(protected)/[org_slug]/layout.tsx` — calls `getSession()` + `listOrganizations()`
- `apps/app/lib/active-org.ts` — `getActiveOrgSlug()` calls `getSession()` internally
- `packages/auth/src/auth.ts` — verify `cookieCache` config here
