---
id: 02
title: Active organization not restored after sign-in (dispatcher routes to /onboarding)
tier: 2
status: complete (resolved-by-proxy)
effort: 0 (no extra work — see Resolution)
date: 2026-07-13
resolved: 2026-07-13
related: [./01-create-organization-route.md, ../../docs/guides/better-auth/org.md, ../../apps/app/app/page.tsx, ../../apps/app/lib/active-org.ts]
---

## Resolution (2026-07-13)

**The bug is resolved in practice, but not by the option recommended in this fiche (Option B lazy restore in the dispatcher).** It was resolved *as a side-effect* of the 2026-07-13 dispatcher refactor for fiche #01.

### What changed

`apps/app/app/page.tsx` now routes the "verified + has orgs + no active" case to `/${firstOrg.slug}/home` instead of `/onboarding`. When the request reaches `apps/app/app/(protected)/[org_slug]/layout.tsx`, the OrgLayout alignment step calls `auth.api.setActiveOrganization({ organizationSlug: <slug> })` server-side (line 66-77 of the layout), which updates the session row and the cookie. After that, the user lands on `/${slug}/home` with a valid `activeOrganizationId` in their session — same end-state as Option B, achieved by a different path.

### Why this is acceptable

- The OrgLayout alignment pattern was already validated by the 2026-07-10 audit (fiche #03 and the OrgLayout doc at `temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5`).
- No extra DB call vs. Option B (Option B would also list organizations).
- The fix lives in code that already runs on this path — fewer surface area changes.

### What we deliberately did NOT do

- Option A (hook `databaseHooks.session.create.after` in `packages/auth/src/auth.ts`) — not pursued, see this fiche's "Solution / Alternative" section.
- Option C ("/select-org" page for multi-org users) — out of scope.

### Verification

1. Log out.
2. Log in with a user who already has at least one org.
3. **Expected**: land directly on `/${firstOrg.slug}/home`. No detour through `/onboarding` or `/organizations/new`.
4. Inspect DevTools → Application → Cookies → the session cookie should now include `activeOrganizationId` (set by the OrgLayout alignment).

### Known limitations

- For users with multiple orgs, "first org" is determined by `listOrganizations` ordering (likely creation-date DESC or alphabetical by slug — verify in the dev DB). A user with multiple orgs who wants a *different* org active after login must use the OrgSwitcher. This matches the design deferred to a future "select-org" UX.

## Context

User report (2026-07-13): after a successful `POST /api/auth/sign-in/email`, the dispatcher (`apps/app/app/page.tsx`) redirects to `/onboarding` even though the user already belongs to one or more organizations.

Observed log chain (paraphrased from dev server):

```
GET /login 200
POST /api/auth/sign-in/email → 200  (login succeeds)
GET / 200
GET / 307           ← dispatcher redirect
GET /onboarding 200 ← user lands on /onboarding despite having orgs
GET /api/auth/organization/get-full-organization → 200 (returns null)
GET /api/auth/organization/list → 200 (returns the user's orgs)
GET /api/auth/get-session → 200
```

User is stuck on `/onboarding` even though they have at least one organization. The 2026-07-13 fix (`./01-create-organization-route.md`) made this **less destructive** (no longer a silent bounce-back — they now see the create form), but the underlying redirect is still wrong: this user already has an org.

## Investigation

### Why the dispatcher routes to `/onboarding`

`apps/app/app/page.tsx:30` does:

```tsx
const activeOrgSlug = await getActiveOrgSlug()
if (!activeOrgSlug) {
  redirect("/onboarding")
}
```

`getActiveOrgSlug()` (in `apps/app/lib/active-org.ts:35-50`) reads `session.session.activeOrganizationId`, then resolves it to a slug via `auth.api.listOrganizations`. If `activeOrganizationId` is `null` or doesn't match any org the user is a member of, it returns `null`.

So the question becomes: **what does the new session contain for `activeOrganizationId` after sign-in?**

### Tracing `activeOrganizationId` lifecycle in better-auth 1.4.21

Grep on `node_modules/.pnpm/better-auth@.../dist/plugins/organization/`:

| Source | Effect on `activeOrganizationId` |
|---|---|
| `routes/crud-org.mjs:299` (`setActiveOrganization` route) | **SET** to the requested org ID |
| `routes/crud-members.mjs:198` (leaving the active org) | **SET** to `null` |
| `routes/crud-members.mjs:391` (member removed from active org) | **SET** to `null` |
| Schema declaration only (`organization.mjs:401-404`) | defines column, doesn't set values |

**No path sets `activeOrganizationId` on sign-in.** The `signInEmail` flow creates a new session row but never queries the user's previous session or organization membership to restore the pointer.

### Our own code only sets it in one place

`packages/auth/src/auth.ts:107-117`:

```ts
organizationHooks: {
  afterAcceptInvitation: async ({ organization: org }) => {
    await (auth.api as any).setActiveOrganization({
      body: { organizationId: org.id },
      headers: new Headers(),
    })
  },
},
```

This handles the accept-invitation case. **No equivalent for sign-in.**

### Why this didn't surface in earlier audits

- **2026-07-10 audit #06** verified the first-org flow (`/signup → /verify-email → /onboarding → create → /home`). It did NOT exercise logout + login.
- **2026-07-10 audit #03** tested the dispatcher in isolation with mocked session (no integration with better-auth's session lifecycle).
- **2026-07-13 audit #01** fixed the symptom (silent no-op for users-with-orgs hitting /onboarding) but not the root cause (the dispatcher shouldn't be sending them there in the first place).

The user who reported this was the **first person to log out and log back in** during testing — every prior testing path was a fresh sign-up or a session that never expired.

### Drift between docs and code

`docs/guides/better-auth/org.md:35` claims:

> "The proxy guard at `apps/app/proxy.ts:68-75` redirects any signed-in user without `activeOrganizationId` (excluding `/accept-invitation`) to `/onboarding`."

This is **incorrect**. `apps/app/proxy.ts:35-43` explicitly says:

> "Anything beyond these two questions (e.g. 'is the email verified?', 'do they have an org?') is application state, not auth, and lives in the page that needs it."

The actual redirect to `/onboarding` lives in the dispatcher (`app/page.tsx:30`), not the proxy. The guide has drifted from the implementation. The proxy only enforces: "must be signed in" + "don't show auth pages when signed in".

### Why the symptom is now visible (and worse than before)

Before 2026-07-13 fix: a user-with-orgs hitting `/onboarding` was bounced back to `/${slug}/home` instantly. They never noticed anything wrong.

After 2026-07-13 fix: they land on `/onboarding` and see a "Create a new workspace" form. **They might actually create a duplicate org.** This is the immediate reason the user reported the bug.

## Solution

### Recommendation: Option B — Lazy restore in the dispatcher

The cleanest place to restore the active org is in the **dispatcher** (`apps/app/app/page.tsx`), right before the redirect-to-onboarding decision. The dispatcher already runs on every cold visit to `/`, so the restore happens once per session, on demand.

```tsx
// apps/app/app/page.tsx (new dispatch flow)
export default async function RootPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect("/login")
  }

  if (!session.user.emailVerified) {
    redirect("/verify-email")
  }

  const orgs = await authApi.listOrganizations({ headers: await headers() })

  // NEW: if the user has orgs but the session has no activeOrganizationId,
  // restore the most-recently-created org as active. Better-auth does not
  // do this automatically on sign-in (verified against better-auth 1.4.21
  // source: no `databaseHooks.session.create` call to setActiveOrganization).
  // Without this restore, every post-login visit to / sends the user to
  // /onboarding — see problems/02-login-active-org-not-restored.md.
  if (orgs.length > 0) {
    const sessionOrgId = (session.session as unknown as {
      activeOrganizationId?: string | null
    }).activeOrganizationId

    if (!sessionOrgId || !orgs.some((o) => o.id === sessionOrgId)) {
      const fallback = orgs[0]  // first org by listOrganizations order
      await (auth.api as unknown as AuthApiWithSetActive).setActiveOrganization({
        body: { organizationId: fallback.id },
        headers: await headers(),
      })
      redirect(`/${fallback.slug}/home`)
    }

    const active = orgs.find((o) => o.id === sessionOrgId)!
    redirect(`/${active.slug}/home`)
  }

  redirect("/onboarding")
}
```

**Pros**:
- Server-side, single file change.
- Idempotent: only restores when needed (no active org, or stale active org).
- Preserves the existing `OrgLayout` URL → state alignment pattern (which also calls `setActiveOrganization` server-side — see `apps/app/app/(protected)/[org_slug]/layout.tsx:66-77`).
- No client-side workaround needed; no risk of #9710 stale atom (we're not using `authClient.organization.create`).

**Cons**:
- One extra DB call per cold `/` visit (listOrganizations). Already happens today, so no net new cost.
- For users with multiple orgs, picks "first" — which depends on `listOrganizations` ordering. Verify ordering is stable + sensible (likely creation-date DESC or alphabetical by slug).

---

### Alternative: Option A — Hook on session create in `packages/auth/src/auth.ts`

Add a `databaseHooks.session.create.after` hook that auto-restores. **Not recommended** because:

- The hook fires AFTER the session row is inserted and the cookie has been set. We'd have to update both the DB row and the cookie in the hook, which is non-trivial (the response writer is already in flight).
- `afterAcceptInvitation` (the existing pattern) works because the hook runs server-side BEFORE the response is sent. There's no equivalent timing for sign-in that we can hook cleanly.
- Server-side restore in the dispatcher is observably the same effect, with a much smaller blast radius.

---

### Alternative: Option C — "Select your organization" page

If the team wants better UX for users with multiple orgs (let them pick), add `/select-org` that lists `listOrganizations` and posts to `setActiveOrganization`. The dispatcher routes there when `orgs.length > 1 && !activeOrgSlug`.

**Pros**: better UX for multi-org users (Slack, Linear, Notion all do this).
**Cons**: more code; a new page; a new state machine. Out of scope for fixing the bug.

**Recommended**: defer until users actually complain about the "always pick first" behavior.

---

## Files affected

- `apps/app/app/page.tsx` — dispatcher (Option B): add the lazy-restore branch
- `apps/app/lib/active-org.ts` — possibly expose `getActiveOrgWithFallback()` helper that does the restore and returns the active slug (DRY between dispatcher and OrgLayout)

## Documentation drift to fix

- `docs/guides/better-auth/org.md:35` — wrong attribution of the redirect (says proxy.ts, actually dispatcher). Update to reflect the dispatcher + the lazy restore.
- `docs/guides/better-auth/index.md:70` — verify the redirect chain description matches the new dispatcher flow.
- `.claude/agent-memory/tech-lead/apps/app.md` — Root dispatcher section currently says "Session + verified + no active org → /onboarding". Should now say "Session + verified + no active org + no orgs → /onboarding; Session + verified + no active org + has orgs → restore first + redirect to /${slug}/home".

## Verification (after fix)

1. Sign up a fresh user → create "Org A" → land on `/org-a/home`.
2. Logout.
3. Login again with same credentials.
4. **Expected**: land on `/org-a/home` (no detour through `/onboarding`).
5. Verify in DevTools → Application → Cookies → the session cookie now includes `activeOrganizationId` after login.
6. Repeat for a user with 2 orgs → login → lands on first org by listOrganizations order.
7. Verify the proxy.ts is NOT doing the redirect (still only enforces auth, not org state).

## References

- `apps/app/app/page.tsx` — dispatcher (where the fix goes)
- `apps/app/lib/active-org.ts` — `getActiveOrgSlug()` (helper to update)
- `packages/auth/src/auth.ts:107-117` — `afterAcceptInvitation` pattern (reference for server-side setActiveOrganization)
- `apps/app/app/(protected)/[org_slug]/layout.tsx:66-77` — existing server-side `setActiveOrganization` call (URL → state alignment pattern)
- `apps/app/proxy.ts:35-43` — proxy scope (does NOT do org checks; the guide is wrong)
- `docs/guides/better-auth/org.md:35` — doc drift to fix
- `node_modules/.pnpm/better-auth@1.4.21_.../dist/plugins/organization/routes/crud-org.mjs:299` — `setActiveOrganization` route handler (source of truth for the cookie update)
- `node_modules/.pnpm/better-auth@1.4.21_.../dist/plugins/organization/adapter.mjs:273` — adapter `setActiveOrganization` implementation (updates DB session row)
- `temp/audit/2026-07-13-apps-app-organizations-new/problems/01-create-organization-route.md` — the adjacent fix that surfaced this bug
- `temp/audit/2026-07-10-apps-app/problems/06-onboarding-flow.md` — the earlier audit that missed this