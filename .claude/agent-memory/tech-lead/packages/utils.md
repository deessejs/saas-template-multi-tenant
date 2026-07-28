---
name: packages-utils
description: packages/utils — generic, framework-agnostic TS utilities with vitest coverage; distinct from packages/ui
metadata:
  type: reference
---

`packages/utils` is the **generic utility** package: framework-agnostic TS helpers (date, string, type guards, small algorithms) that don't belong to any feature area.

**Deps:** none at runtime — only `@types/node` + the shared `eslint-config` / `typescript-config` / `vitest` for dev.

**Why a separate package from `packages/ui`:** `packages/ui` is React + Tailwind + shadcn primitives. Mixing pure functions into it forces consumers to drag React + JSX runtime even when they only need `formatDate`. The split keeps `packages/utils` safe to import from server-only packages (`@workspace/auth`, `@workspace/database`, `@workspace/api`, route handlers).

**How to apply:**
- Pure function that runs on server AND client? Add here.
- React hook or JSX component? Add to `packages/ui`.
- Feature-specific helper (org-scoped query, billing math)? Add to its feature package (`packages/api`, future `packages/billing`, etc.) — don't leak domain logic into `utils`.

**No `AGENTS.md` or `CLAUDE.md` yet** — keep the surface small enough that they aren't needed. If this package starts owning opinionated conventions, add one rather than letting drift accumulate.

Related: [[package-structure]].