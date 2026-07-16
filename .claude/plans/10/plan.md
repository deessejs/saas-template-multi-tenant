---
issue: 10
title: "fix(auth): use fire-and-forget pattern in sendVerificationEmail to prevent timing attacks"
author: martyy-code
generated: 2026-07-16
status: draft
reviewer:
reviewed:
branch: impl/10-send-verification-email-fire-and-forget
labels: [bug, area:auth, priority:high, status:ready]
priority: high
effort: low
---

## Outline

1. [Replace `await` with `void` in `sendVerificationEmail`](#step-1--replace-await-with-void-in-sendverificationemail)
   1.1. [Verify `sendResetPassword` is unchanged](#step-11--verify-sendresetpassword-is-unchanged)
2. [Update docs comment if needed](#step-2--update-docs-comment-if-needed)
3. [Run typecheck/lint/test](#step-3--run-typechecklinttest)

---

## TL;DR

`packages/auth/src/auth.ts` `sendVerificationEmail` returns the unawaited promise of `sendAuthEmail(...)` (using `void`), matching the sibling `sendResetPassword` callback. Closes the timing-attack surface and removes per-login Resend latency.

---

## Issue summary

Issue #10 documents an inconsistency between the two email callbacks in `betterAuth()`: `sendResetPassword` correctly uses `void sendAuthEmail(...)`, but `sendVerificationEmail` uses `await`. The official Better Auth docs (`https://better-auth.com/docs/concepts/email`) explicitly warn against awaiting — "Avoid awaiting the email sending to prevent timing attacks." With `sendOnSignIn: true`, the awaited path adds Resend roundtrip latency to every login.

---

## Files to touch

| File | Action | Why |
|------|--------|-----|
| `packages/auth/src/auth.ts` | edit | Change `await` to `void` in `sendVerificationEmail` (line 41) |
| `docs/guides/better-auth/email.md` | edit | Document the fire-and-forget requirement explicitly (acceptance criteria) |

---

## Step-by-step implementation

### Step 1 — Replace `await` with `void` in `sendVerificationEmail`

`packages/auth/src/auth.ts`

- Inside the `emailVerification.sendVerificationEmail` async callback, change `await sendAuthEmail({...})` to `void sendAuthEmail({...})`.
- The callback stays `async` (Better Auth types it as such) but its return value is now `undefined` (the discarded promise).
- No changes to the `sendAuthEmail` call itself — just the await/void prefix.

#### 1.1 — Verify `sendResetPassword` is unchanged

- Confirm `emailAndPassword.sendResetPassword` still uses `void sendAuthEmail(...)`. It should be unchanged.
- After the edit, both callbacks should follow the same pattern.

### Step 2 — Update docs comment if needed

`docs/guides/better-auth/email.md`

- Per acceptance criteria: add a sentence in the Email section explicitly stating that callbacks must use `void sendAuthEmail(...)`, never `await`.
- Cite the upstream Better Auth docs as the source of the rule.

### Step 3 — Run typecheck/lint/test

- `pnpm --filter @workspace/auth typecheck` — must pass.
- `pnpm --filter @workspace/auth lint` — must pass with `--max-warnings=0`.
- `pnpm --filter @workspace/auth test` — must pass (existing `email.test.ts` covers both callbacks).

---

## Verification checklist

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes

---

## Risks / edge cases

- **Email send errors become silent on the server side.** Already covered by issue #9 (Pino observability + request correlation). The mailer package's existing `[DEBUG]` log traces still fire in dev. Out of scope: switching to `waitUntil` on Vercel for guaranteed delivery.
- **No API surface change.** The Better Auth callback signature is unchanged; downstream consumers are unaffected.
- **Schema regeneration not needed.** This is a 1-word code change in the callback body.

---

## PR metadata

| Field | Value |
|-------|-------|
| **Branch** | `impl/10-send-verification-email-fire-and-forget` |
| **Base** | `main` (no `staging` branch in this repo; recent PR #25 followed the same pattern) |
| **PR title** | `fix(auth): use fire-and-forget pattern in sendVerificationEmail to prevent timing attacks` |
| **Labels** | `bug`, `area:auth`, `priority:high` |
| **Assignee** | `martyy-code` |