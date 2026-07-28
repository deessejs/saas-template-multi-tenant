# Better-Auth — Known Pitfalls

**Read this before any implementation.** These are behavioral bugs, non-obvious defaults, and removed features that have caused issues in this repo.

> **Reading guide.** Sections marked `— ✅ Implemented` describe defects that were open at one point and are now closed in the codebase. They are kept as historical records so future contributors don't re-introduce the regression and so reviewers can spot the fix going backwards. Open risks (sections without the `Implemented` marker) still apply.

---

## 1. `autoCreateOrganizationOnSignUp` Does Not Exist

**Removed in [PR #4755](https://github.com/better-auth/better-auth/pull/4755) (September 2025, merged into canary).**

The TypeScript option existed in types but had no runtime implementation. It was silently removed rather than implemented. Do not search for it in the docs — it is gone.

**What we do instead:** see [`org.md`](./org.md) — the auto-create is implemented manually in `databaseHooks.session.create.before`.

**Source:** [Issue #4334](https://github.com/better-auth/better-auth/issues/4334) — original report of the non-functional option.

---

## 2. `session.create.before` Cannot Query Membership Rows on First Signup

**Status: [open bug #9070](https://github.com/better-auth/better-auth/issues/9070)**

The [documented pattern](https://better-auth.com/docs/plugins/organization) for setting `activeOrganizationId` in `session.create.before` fails on the **first signup** because the organization plugin creates the membership row *after* the session row.

Our current code creates the org inside `session.create.before` itself (not in a separate query), which may sidestep this — but it has not been tested end-to-end with the full membership flow.

**Test plan when touching this code:**
1. Sign up a brand new user
2. Verify `activeOrganizationId` is set in the `session` DB row
3. Verify `useActiveOrganization()` on the client returns the org (not `null`)
4. Sign out, sign back in — confirm it still works

If step 3 fails, fall back to the workaround in [`client.md`](./client.md).

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — official docs that recommend this pattern.

---

## 3. `useActiveOrganization` Returns Stale `null` After Sign-in

**Status: [open bug #9710](https://github.com/better-auth/better-auth/issues/9710), fix PRs [#9736](https://github.com/better-auth/better-auth/pull/9736) + [#9737](https://github.com/better-auth/better-auth/pull/9737) pending**

`$activeOrgSignal` invalidates only on `/sign-out` and `/organization/*` paths. It does **not** invalidate on `/sign-in/email`. So after sign-in, `useActiveOrganization()` keeps its pre-session cached value (typically `null`) until a hard page refresh.

**Workaround (apply in `auth-client.ts` or a client-side wrapper):**

```ts
// apps/app/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [organizationClient()],
})

// Workaround for #9710: useActiveOrganization returns stale null after sign-in
let initialized = false
authClient.$sessionSignal.subscribe(() => {
  if (initialized) {
    authClient.$activeOrgSignal.value = null
  }
  initialized = true
})
```

Until the upstream fix lands, this workaround is required for a correct UX.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — official `setActiveOrganization` docs.

---

## 4. `advanced.useSecureCookies` Breaks Local Dev — ✅ Implemented

Setting `useSecureCookies: true` forces the `Secure` cookie attribute in **all environments**, including `NODE_ENV=development`. Without HTTPS in local dev, cookies are silently rejected by the browser and sessions never work.

**State (2026-07-28):** `packages/auth/src/auth.ts:60-62` guards the option:

```ts
advanced: {
  useSecureCookies: process.env.NODE_ENV === "production",
},
```

Implemented. Local HTTP sessions on `localhost:3000` / `:3001` work without browser workarounds.

**Source:** [better-auth.com/docs/concepts/cookies](https://better-auth.com/docs/concepts/cookies) — "cookies are secure only in production by default."

---

## 5. `localhost` in `trustedOrigins` Risks Prod Leak — ✅ Implemented (deploy-config caveat remains)

Including `http://localhost:3000` / `:3001` in `trustedOrigins` without a NODE_ENV gate is a security issue: an attacker who can reach localhost on the deployment host passes the CSRF check unconditionally.

**State (2026-07-28):** `packages/auth/src/auth.ts:13-18` is now NODE_ENV-gated:

```ts
trustedOrigins: [
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
  ...serverEnv.ALLOWED_ORIGINS,
],
```

Implemented. The code defect is closed.

**Residual deploy-config risk (NOT a code defect):** `packages/env/src/schema.ts` defines `ALLOWED_ORIGINS` with `csv.default([])`. If a deployer forgets to set it in production, every origin is rejected and login breaks entirely (no CSRF, just blanket denial). Add `ALLOWED_ORIGINS` to the deploy checklist explicitly.

**Source:** [better-auth.com/docs/reference/options](https://better-auth.com/docs/reference/options) — `trustedOrigins` config.

---

## 6. `sendOnSignUp` Was Temporarily `false` — ✅ Implemented

Email verification on signup was disabled at one point as a temporary bypass (commit message: "disable email verification (temp bypass)"). The risk: while verification was required, no verification email was sent, leaving unverified users with session cookies that could mutate per-user state.

**State (2026-07-28):** `packages/auth/src/auth.ts:38-53` sets both `sendOnSignUp: true` and `sendOnSignIn: true`. The fire-and-forget pattern (`void sendAuthEmail(...)`) is in place — see [`email.md`](./email.md). Implemented.

**Do not re-disable.** If a future change needs to bypass verification, it should be gated on a feature flag with an explicit expiry — not silently flipped back to `false`.

**Source:** [better-auth.com/docs/authentication/email-password](https://better-auth.com/docs/authentication/email-password) — `sendOnSignUp` options documented under email verification config.

---

## 7. Auth Middleware Should Throw `ORPCError`, Not Plain `Error` — ✅ Implemented (signature note)

Throwing `new Error("Authentication required")` from a oRPC middleware does not surface the correct HTTP status code — oRPC defaults to `500` for plain `Error`. The correct type is `ORPCError` from `@orpc/server`.

**State (2026-07-28):** `packages/api/src/router/middlewares/auth.ts` throws `ORPCError`:

```ts
import { ORPCError } from "@orpc/server"
import { base } from "../context.js"
import type { AuthContext } from "../context.js"

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

Implemented. Status code is now `401` as expected. The string-code form (`new ORPCError("UNAUTHORIZED")`) is equivalent to `new ORPCError({ code: "UNAUTHORIZED" })`; the explicit `message` field is optional.
