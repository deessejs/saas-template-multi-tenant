---
issue: 17
title: "fix(app): login form should not require password min length (blocks legacy short passwords)"
author: martyy-code
generated: 2026-07-16
status: draft
reviewer:
reviewed:
branch: impl/17-split-login-schema
labels: [bug, area:app, priority:high, status:ready]
priority: high
effort: low
---

## Outline

1. [Split `loginSchema` from `signupSchema` in `schemas.ts`](#step-1--split-loginschema-from-signupschema-in-schemasts)
2. [Verify imports in login-form.tsx and signup-form.tsx](#step-2--verify-imports-in-login-formtsx-and-signup-formtsx)
3. [Run typecheck/lint/test](#step-3--run-typechecklinttest)

---

## TL;DR

`apps/app/components/auth/schemas.ts` defines a single schema reused by signup and login. The `password.min(8)` check is appropriate for signup (account-creation policy) but wrong for login — it locks out users with passwords shorter than 8 chars even though better-auth would accept them server-side. Split into two schemas.

---

## Issue summary

The `loginSchema` requires `password.min(8)`. better-auth hashes whatever the user types at signin and compares against the stored hash — it does NOT enforce a minimum length at login. The client-side check is a registration-only invariant mistakenly applied to login. A legacy user (signed up before the 8-char minimum was introduced, or via OAuth) is locked out of the login form.

---

## Server-side verification

This is a **client-only** fix. better-auth's `signIn.email` endpoint validates the email format and matches the password hash; it does not enforce a min length on the password. Confirmed by reading the better-auth source:

- `packages/better-auth/src/api/routes/sign-in.ts` — `signInEmail` accepts the password as-is and compares to the stored hash.
- The `emailAndPassword` config in `packages/auth/src/auth.ts` has `minPasswordLength` option (default 8), but it only applies at signup (registration flow), not at login.

So relaxing the client-side check is safe — there's no server-side minimum to violate.

---

## Files to touch

| File | Action | Why |
|------|--------|-----|
| `apps/app/components/auth/schemas.ts` | edit | Split `loginSchema` (drop `min(8)`) from `signupSchema` (keep it) |
| `apps/app/components/auth/login-form.tsx` | edit (verify only) | Already imports `loginSchema` — should keep working unchanged |

---

## Step-by-step implementation

### Step 1 — Split `loginSchema` from `signupSchema` in `schemas.ts`

`apps/app/components/auth/schemas.ts`

- Keep `signupSchema` exactly as-is (min-8 + `confirmPassword` refinement)
- Define a new `loginSchema`:
  ```ts
  export const loginSchema = z.object({
    email: z.email("Enter a valid email address"),
    password: z.string().min(1, "Enter your password"),
    remember: z.boolean().optional(),
  })
  ```
  - `min(1)` ensures the field is non-empty (the existing form had no client check at all for empty password — but the message is friendlier)
  - Drop `min(8)` — the user might have a shorter password and the server accepts whatever was set at signup
- `forgotPasswordSchema` and `resetPasswordSchema` are unaffected

### Step 2 — Verify imports in login-form.tsx and signup-form.tsx

- `login-form.tsx` already imports `loginSchema` from `@/components/auth/schemas`. After the split, it still resolves to the new (relaxed) `loginSchema`. No change needed.
- `signup-form.tsx` already imports `signupSchema`. After the split, it resolves to the unchanged `signupSchema`. No change needed.

Confirm with `grep -rn "loginSchema\|signupSchema" apps/app` after the edit.

---

## Verification checklist

- [ ] `pnpm --filter app typecheck` passes
- [ ] `pnpm --filter app lint` passes
- [ ] `pnpm --filter app test` passes (if any)
- [ ] Manual test (out-of-band): create a user with a 6-char password via `MAIL_TRANSPORT=console` and verify the login form accepts it

---

## Risks / edge cases

- **Empty password:** The new `min(1)` ensures the field is non-empty. Without it, an empty submit would fire an API call that better-auth rejects with a 400 — same end result but with a worse UX (network roundtrip before the user sees feedback).
- **Migration:** Existing users with passwords < 8 chars already exist. They are unaffected by this change (no DB migration needed).
- **Future policy changes:** If the team later wants a server-side minimum at signup, that's the `emailAndPassword.minPasswordLength` config in `packages/auth/src/auth.ts` — not this client schema.

---

## PR metadata

| Field | Value |
|-------|-------|
| **Branch** | `impl/17-split-login-schema` |
| **Base** | `main` |
| **PR title** | `fix(app): split login schema from signup schema (remove min-8 on login)` |
| **Labels** | `bug`, `area:app`, `priority:high` |
| **Assignee** | `martyy-code` |