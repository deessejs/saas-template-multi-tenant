---
name: feedback-builds
description: Always rebuild workspace packages after modifying their TS source — consumers (apps/app) load dist/, not src/
metadata:
  type: feedback
---

# Rebuild Workspace Packages After `src/` Changes

Workspace packages in this monorepo (`packages/auth`, `packages/email`, `packages/database`, `packages/api`, `packages/ui`, `packages/utils`, `packages/env`, `packages/cookies`, `packages/logger`, `packages/eslint-config`, `packages/typescript-config`) all export their **compiled** `dist/` output, not the TypeScript source.

Example from `packages/auth/package.json`:
```json
"exports": {
  ".": {
    "types": "./dist/auth.d.ts",
    "import": "./dist/auth.js",
    "default": "./dist/auth.js"
  }
}
```

So `apps/app` (via the Hono catch-all `app/api/[[...route]]/route.ts` and via direct imports of `@workspace/auth`, `@workspace/email`, etc.) loads `packages/*/dist/*.js` at runtime. Editing `src/auth.ts` has **zero runtime effect** until `pnpm --filter @workspace/X build` runs.

**Why:** I lost ~20 min on 2026-07-09 debugging a 403 → cookie-drop → missing /onboarding redirect chain. The fix was correct in `src/`, but the dev server was still serving the old `dist/`. Restarting `next dev` was not enough — the package needed to be rebuilt first. The user flagged this with "note de pas oublier les builds".

**How to apply:**

1. **After any `src/` change in a workspace package**, run before testing:
   ```bash
   pnpm --filter @workspace/<name> build
   ```
   Then restart `next dev` in the consuming app.

2. **Cheaper alternative for `apps/app`**: add a `predev` script that rebuilds the auth package automatically:
   ```json
   // apps/app/package.json
   "scripts": {
     "predev": "pnpm --filter @workspace/auth build",
     "dev": "next dev"
   }
   ```
   Adds ~3-5s to dev startup but eliminates the manual rebuild step. Not yet implemented (open follow-up).

3. **Verification before debugging a "fix that didn't work"**: when a code change appears to have no effect, first check whether the consuming app loads the package via `dist/`. If yes, the dist needs rebuilding — your source change is fine, the runtime is just stale.

**Detection shortcut:**
```bash
# See what the runtime actually uses
grep "useSecureCookies\|sendOnSignUp" packages/auth/dist/auth.js
# If this shows the OLD values while src/auth.ts has the new ones, you forgot the build
```

**Affected packages** (anything with `"build": "tsc"` in `scripts` and `dist/` in `exports`):
- `@workspace/auth` (most commonly edited — better-auth config)
- `@workspace/api` (Hono router)
- `@workspace/database` (Drizzle schema, but consumers use src/ via drizzle-kit)
- `@workspace/email` (mailer, react-email templates)
- `@workspace/ui` (shadcn components — but `transpilePackages` in `apps/app/next.config.ts:4` re-transpiles this at runtime, so it doesn't need a build for app consumption)
- `@workspace/env`, `@workspace/cookies`, `@workspace/logger`, `@workspace/utils` — less frequently edited

**Related:**
- [[packages-auth]] — better-auth config + CLI workflow
- [[stack]] — pnpm workspace setup
- [[feedback-long-term-solutions]] — prefer systemic fixes; the `predev` hook above is one
