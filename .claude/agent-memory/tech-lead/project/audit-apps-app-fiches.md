---
name: audit-apps-app-fiches
description: Audit 2026-07-10-apps-app intentionally skipped #02 and #04; understand references in #03 and #12 to those problem numbers
metadata:
  type: project
---

The `temp/audit/2026-07-10-apps-app/problems/` directory is non-contiguous: fiches 01, 03, 05–12, 14–15 exist, but **#02 and #04 are intentionally absent**.

- **#02** — was about refactoring `getSession`/`getHeaders` to use React `cache()` per-request memoization. Referenced by #03 (sequencing warning: "Apply #02 before #03").
- **#04** — was about deleting the dead `apps/app/hooks/use-mobile.ts` hook. Referenced by #12 (forbidden imports list) and by the README ("a dead hook to delete").

Both were **voluntarily removed** from the fiche set (per user, 2026-07-13). Likely reasons (not confirmed): #02 was deemed unnecessary or already addressed by an in-tree refactor (see [[apps/app-session-memoization-debunked]] — the project explicitly rejected React.cache() on getSession in favor of letting Next.js 16 dynamic rendering handle it); #04 was either applied (delete the hook) or absorbed into #12.

**Why:** When reading the audit, the missing #02/#04 are NOT an oversight or a bug — they are deliberate. Don't suggest "recreating" them as new work items without first checking whether the underlying concern is still open.

**How to apply:**
- Reading any fiche that references `#02` or `#04` — treat the reference as historical context, not a pending dependency.
- Recommending work in this audit — skip the sequencing constraint in #03 that depends on #02.
- Reviewing whether `apps/app/hooks/use-mobile.ts` should be deleted — that's still open as a side-effect of #04's removal (the file still exists, see [[apps/app-architecture]] rewrite task in #12).
- **Globbing files under `apps/app/app/(protected)/[org_slug]/...`** — standard `**` globs with bracketed segments can fail silently. When verifying file presence in dynamic-segment routes, fall back to `Grep` on a symbol (e.g., `MembersManager`, page export) rather than relying on glob results alone. Confirmed 2026-07-13: `app/(protected)/[org_slug]/settings/members/page.tsx` DOES exist and renders `MembersManager` — an Explore-agent glob initially returned no results, leading to a false negative in the audit verification pass.

Related: [[audit-apps-app-tl-dr]], [[apps/app-architecture]]