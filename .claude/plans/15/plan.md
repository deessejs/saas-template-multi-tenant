---
issue: 15
title: "fix(app): pass session token (not id) to revokeSession in sessions-table"
author: martyy-code
generated: 2026-07-16
status: draft
reviewer:
reviewed:
branch: impl/15-sessions-table-revoke-token
labels: [bug, area:app, priority:high, status:ready]
priority: high
effort: low
---

## Outline

1. [Rename `handleRevoke` parameter and update call site](#step-1--rename-handlerevoke-parameter-and-update-call-site)
2. [Pass `session.token` from JSX](#step-2--pass-sessiontoken-from-jsx)
3. [Run typecheck/lint/test](#step-3--run-typechecklinttest)

---

## TL;DR

`apps/app/components/settings/sessions-table.tsx` passes `session.id` to `authClient.revokeSession({ token })`. better-auth expects the session token, not the row id. Rename the handler to accept a token, pass `session.token` from the JSX call site, and pass that token to `revokeSession`. Restores the « Sign out » button on other sessions.

---

## Issue summary

The local `Session` interface stores both `id` and `token` from `authClient.listSessions()`. The revoke handler receives a parameter named `id` and forwards it as `token` to the API — the wrong field. The "Sign out" button on other sessions currently sends a request that doesn't actually revoke the targeted session. The current-state computation (`s.token === currentToken`) is correct; only the revoke action is broken.

---

## Files to touch

| File | Action | Why |
|------|--------|-----|
| `apps/app/components/settings/sessions-table.tsx` | edit | Rename handler param, pass `session.token` from JSX |

---

## Step-by-step implementation

### Step 1 — Rename `handleRevoke` parameter and update call site

`apps/app/components/settings/sessions-table.tsx` (lines 66-76, JSX line 149)

- Rename `async function handleRevoke(id: string)` → `async function handleRevoke(token: string)`
- Inside the handler: `setRevoking(token)` and `authClient.revokeSession({ token })` (already passes the param; the rename makes the intent explicit)
- The filter in `setSessions((prev) => prev.filter((s) => s.id !== ...))` — since `token` is unique per session, the filter works correctly when we compare to `token` too. Use `s.token !== token` for consistency with the new param naming.
- In the JSX (around line 149), change `onClick={() => handleRevoke(session.id)}` → `onClick={() => handleRevoke(session.token)}`

#### 1.1 — Verify call site updates

After the edit, `grep handleRevoke sessions-table.tsx` should show:
- The declaration: `async function handleRevoke(token: string)`
- The JSX call: `onClick={() => handleRevoke(session.token)}`
- Nothing else.

### Step 2 — Optional: verify `setRevoking` UI flag works

The `setRevoking(token)` call uses the token for the loading state. The Button `disabled={revoking === session.id}` compares to `session.id`. This now becomes `disabled={revoking === session.token}` for consistency — update both lines in the JSX (around line 150).

---

## Verification checklist

- [ ] `pnpm --filter app typecheck` passes
- [ ] `pnpm --filter app lint` passes (with `--max-warnings=0`)
- [ ] Manual test: revoke another active session, confirm it's removed from the list and from the database (`psql` or Drizzle Studio)
- [ ] Comment in the code explains `revokeSession({ token })` expects the token, not the row id (to prevent regression)

---

## Risks / edge cases

- **Low risk.** Purely mechanical rename.
- The filter in `setSessions((prev) => prev.filter((s) => s.id !== ...))` will need updating from `s.id` to `s.token` to keep the local state in sync with the param naming.
- `setRevoking(token)` and `disabled={revoking === session.token}` must move together.

---

## PR metadata

| Field | Value |
|-------|-------|
| **Branch** | `impl/15-sessions-table-revoke-token` |
| **Base** | `main` (no `staging` branch in this repo) |
| **PR title** | `fix(app): pass session token (not id) to revokeSession in sessions-table` |
| **Labels** | `bug`, `area:app`, `priority:high` |
| **Assignee** | `martyy-code` |