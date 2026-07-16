---
"app": patch
---

fix(app): `sessions-table` now passes `session.token` (not `session.id`) to `authClient.revokeSession`. The better-auth endpoint requires the session token in `body.token` (verified in `packages/better-auth/src/api/routes/session.ts`); passing the row id caused a silent no-op because `findSession(token)` and `deleteSession(token)` look up by token. The "Sign out" button on non-current sessions now actually revokes the targeted session.