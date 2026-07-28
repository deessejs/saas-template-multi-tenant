---
name: trusted-origins-fix
description: 2026-07-28 verification: trustedOrigins localhost entries ARE gated by NODE_ENV in packages/auth/src/auth.ts; P1 framing obsolete, residual deploy-config risk only
metadata:
  type: project
---

As of 2026-07-28, `packages/auth/src/auth.ts:13-18` gates the localhost entries:

```ts
trustedOrigins: [
  ...(process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : []),
  ...serverEnv.ALLOWED_ORIGINS,
],
```

The previous P1 framing ("localhost always trusted; conditional CSRF risk") is **obsolete** — the gate is in place. The pitfalls guide `docs/guides/better-auth/pitfalls.md` should be checked: if it still describes the old behavior, update it to reflect the implemented state.

**Why this matters:** the original P1 was the right diagnosis but the fix has shipped without an explicit memory entry to record the closure. Future audits risk re-flagging a fixed defect.

**Residual risk** (low, deployment-only, NOT a code defect): `packages/env/src/schema.ts:46` defines `ALLOWED_ORIGINS` as `csv.default([])` — empty list in prod rejects every origin. If a deployer forgets to set it, login breaks entirely (no CSRF, just origin rejection). Treat as an `env:check` doc item rather than an auth config defect.

**How to apply:**
- When reviewing auth config: confirm the dev-only spread is still present. If someone removes the conditional, this defect returns silently.
- When onboarding a new deployer, add `ALLOWED_ORIGINS` to the deploy checklist explicitly — its empty default is the only remaining foot-gun.

Related: [[packages-auth]], [[feedback-verify-high-severity-findings]].