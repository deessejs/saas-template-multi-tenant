---
name: packages-cookies
description: packages/cookies — client-side cookie-consent store (zustand) + React components, separated from packages/ui
metadata:
  type: reference
---

`packages/cookies` holds the **cookie-consent UX layer**: a zustand store + React components + content, all related to the consent banner / preferences modal.

**Exports:** `./store` (`src/store/cookie-consent.ts`), `./types`, `./components/*`, `./content/*`, and `.` (`src/index.ts`).

**Deps:** `lucide-react`, `next`, `react`, `react-dom`, `zustand`, plus `workspace:@workspace/ui` for shared primitives. **No** dependency on `@workspace/auth`, `@workspace/database`, or any server-side package — this is **client-only** and must stay that way.

**Has a `README.md`** (uncommon among the packages — `packages/api`, `packages/auth`, `packages/database`, `packages/utils`, `packages/env` do not). Read it before changing the public surface.

**Why separate from `packages/ui`:** cookie consent carries a domain model (consent state, categories, persistence) that doesn't belong in a generic UI library. The split matches the project's one-package-per-concern rule.

**How to apply:**
- New cookie-related concern (banner variant, settings screen, consent logging)? Add here.
- Pure visual primitive (button, dialog) with no consent semantics? Add to `packages/ui`.
- Don't pull `packages/cookies` into server code or route handlers — the zustand store assumes a browser.

Related: [[package-structure]], [[packages-ui-audit]].