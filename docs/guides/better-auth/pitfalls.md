# Better-Auth — Known Pitfalls

**Read this before any implementation.** These are behavioral bugs, non-obvious defaults, and removed features that have caused issues in this repo.

---

## 1. `autoCreateOrganizationOnSignUp` Does Not Exist

**Removed in [PR #4755](https://github.com/better-auth/better-auth/pull/4755) (September 2025, merged into canary).**

The TypeScript option existed in types but had no runtime implementation. It was silently removed rather than implemented. Do not search for it in the docs — it is gone.

**What we do instead:** see [`org.md`](./org.md) — the first organization is created explicitly by the user at `/onboarding`.

**Source:** [Issue #4334](https://github.com/better-auth/better-auth/issues/4334) — original report of the non-functional option.

---

## 2. `localhost` in `trustedOrigins` Risks Prod Leak

`trustedOrigins` currently includes hardcoded `http://localhost:3000` and `http://localhost:3001`. This is fine in development, but if `ALLOWED_ORIGINS` is empty in production, localhost origins are still trusted — a potential security issue.

**Fix:** guard with `NODE_ENV`:

```ts
trustedOrigins: [
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
  ...serverEnv.ALLOWED_ORIGINS,
],
```

**Source:** [better-auth.com/docs/reference/options](https://better-auth.com/docs/reference/options) — `trustedOrigins` config.

---

## 3. Auth Middleware Throws Plain `Error`, Not `ORPCError`

In `packages/api/src/router/middlewares/auth.ts`:

```ts
throw new Error("Authentication required")
```

oRPC's error handling may not map a plain `Error` to the correct HTTP status code. The correct throw should be:

```ts
import { ORPCError } from "@orpc/server"
throw new ORPCError({ code: "UNAUTHORIZED", message: "Authentication required" })
```

This is tracked as a minor issue since oRPC may still surface the message, but the status code may be wrong (500 instead of 401).
