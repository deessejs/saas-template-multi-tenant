---
name: packages-auth
description: Better Auth package workflow, generated-schema ownership, and the 2026-07-28 state of the Organization plugin (wired in code, schema not yet generated)
metadata:
  type: reference
---

# Better Auth Package Workflow

## Versions (2026-07-28)

`better-auth` and `@better-auth/drizzle-adapter` both resolve to `^1.6.23` from the workspace catalog. The `pnpm auth:generate` script uses `pnpm exec auth`, which resolves to the **local** install — also `1.6.23`. The earlier "CLI 1.4.21 vs runtime 1.6.23" mismatch is no longer present; do not re-flag it.

## Organization plugin — issue #12 in flight

The `organization()` plugin is wired in `packages/auth/src/auth.ts:68-73` with `requireEmailVerificationOnInvitation: true`. **No auto-create on signup** (commit `73830a1` dropped it per `NO_ORG_RECOVERY.md`).

The corresponding schema tables (`organization`, `member`, `invitation`, `team`, etc.) are **not yet in `packages/database/src/schema/auth.ts`** — that file still holds only the 4 base tables (`user`, `session`, `account`, `verification`). Until `pnpm auth:generate` runs against the updated config, `auth.api.*` calls that touch org state will fail at runtime.

**Active branch:** `impl/12-feat-auth-wire-organization-plugin-with-auto-creat`. Spec lives in `docs/internal/specs/organizations/` (subdirs: access-control, crud, flows, invitations, members, onboarding, teams).

## Generate Auth Schema

Since `auth.ts` is in `packages/auth/` (not root), use `--config`:

```bash
npx auth@<runtime-version> generate \
  --config ./packages/auth/src/auth.ts \
  --output ./packages/database/src/schema/auth.ts \
  --yes
```

In this monorepo, the intended entry point remains:

```bash
pnpm --filter @workspace/auth auth:generate
```

As of 2026-07-28, `packages/auth/package.json` maps that script to the local `better-auth` binary (catalog `^1.6.23`). Generation is safe to run.

The CLI searches for `auth.ts` in `./`, `./utils`, `./lib`, or `src/*` by default. Since our auth config is in `packages/auth/src/`, we must specify `--config` explicitly.

## After Generation

1. Review the generated `packages/database/src/schema/auth.ts` — **DO NOT EDIT BY HAND**. The file is owned by the better-auth CLI. Any manual edit will be wiped on the next `auth:generate`.
2. Generate drizzle migrations:
   ```bash
   pnpm --filter @workspace/database db:generate
   ```
3. Apply (dev): `pnpm --filter @workspace/database db:push`
4. Apply (prod): `pnpm --filter @workspace/database db:migrate`

## File Ownership Model (CRITICAL)

| File | Owner | Mutable by us? |
|---|---|---|
| `packages/auth/src/auth.ts` | us | ✅ yes — drives what gets generated |
| `packages/database/src/schema/auth.ts` | **better-auth CLI** | ❌ no — regenerated each time |
| `packages/database/src/schema/index.ts` | us | ✅ yes — barrel, re-exports |
| `packages/database/src/tables/index.ts` | us | ✅ yes — for app-domain tables |
| `packages/database/drizzle/*.sql` | drizzle-kit | ⚠️ only hand-write for off-tree changes |
| `packages/database/drizzle/meta/_journal.json` | drizzle-kit | ❌ no (unless you know what you're doing) |

## What the generator emits (verified in `better-auth@1.6.23` dist)

The legacy generator (`generators-Ht8QYIi_.mjs:133-140`) emits a Drizzle column with:

- `.defaultNow()` **only if** `attr.defaultValue` is a function whose `.toString()` includes `"new Date()"`
- `.$onUpdate(fn)` if `attr.onUpdate` is set and the field type is `date`

**Consequence:** the choice of which tables get `defaultNow()` on `updatedAt` is **hardcoded in better-auth's internal field config**. In 1.6.23:

- `user.updatedAt` → has `.defaultNow()`
- `verification.updatedAt` → has `.defaultNow()`
- `session.updatedAt` → **no** `.defaultNow()` (only `.$onUpdate`)
- `account.updatedAt` → **no** `.defaultNow()` (only `.$onUpdate`)

This inconsistency is intentional from better-auth's side. There is **no public hook** to customize the generated schema.

## Implication for Schema Customization

When you want to add or change a column on a better-auth table:

- **Add a new column** → use the `additionalFields` plugin or write a custom plugin
- **Change a default** → not possible via config; either accept the default, or hand-write a SQL migration
- **Add `withTimezone` or other column options** → not possible via config; would need a post-process script or a hand-written migration

The `additionalFields` plugin allows you to add new fields to user/session tables (see `db/field.d.mts:32`). It does **not** modify the schema of the core auth tables (user, session, account, verification).

## Hand-Written Migrations for Better-Auth Tables

If a change is needed on a better-auth table that the generator doesn't support, the options are:

1. **Don't change** — accept the limitation, document why.
2. **Post-process script** — a script that runs after `auth:generate` and patches the generated file (fragile, regex-based).
3. **Hand-written SQL migration** — write `0001_*.sql` with `ALTER TABLE …` directly, manually add entry to `_journal.json`. Lives outside drizzle-kit's snapshot system, so `db:check` may flag it.

## Drizzle workflow (companion to better-auth)

The better-auth schema lives in a Drizzle ORM layer. Here are the daily-driver commands and where things live.

### Scripts (from `packages/database/package.json`)

| Script | Purpose | When |
|---|---|---|
| `db:generate` | `drizzle-kit generate` — diff schema → write new SQL migration in `drizzle/` | After schema change in `src/schema/index.ts` or `src/tables/` |
| `db:migrate` | `drizzle-kit migrate` — apply pending migrations in order | **Production deploys** |
| `db:push` | `drizzle-kit push` — sync schema directly without migration file | **Dev only** — never in prod |
| `db:studio` | `drizzle-kit studio` — launch web UI for browsing data | Ad-hoc inspection |
| `db:check` | `drizzle-kit check` — verify migration journal consistency | CI + before commits that touched schema |

In monorepo form: `pnpm --filter @workspace/database db:<cmd>`.

### drizzle.config.ts (`packages/database/drizzle.config.ts`)

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

Requires `DATABASE_URL` in env (loaded via `dotenv/config`).

### Schema directory layout

```
packages/database/src/
├── schema/
│   ├── auth.ts        ← better-auth CLI OWNS this (see File Ownership above)
│   └── index.ts       ← barrel: `export * from "./auth"`
└── tables/
    └── index.ts       ← APP-OWNED domain tables — `export * from "./your-table"`
```

Convention: auth tables flow through `src/schema/`, app tables through `src/tables/`. The drizzle config points at `src/schema/index.ts` only, so adding a new app table requires either:
- Re-exporting from `src/schema/index.ts` (and possibly inverting the drizzle config), or
- Adding `src/tables/index.ts` to the `schema` array in drizzle config

The current setup uses the second pattern in spirit but only one is wired in drizzle.config — **when adding the first app table, decide which path to take and update drizzle config accordingly**.

### Migrations output

`./drizzle/` contains:
- `0000_<random_slug>.sql` — actual SQL, hand-readable
- `meta/_journal.json` — ordered list of applied migrations
- `meta/0000_snapshot.json` — schema state at that migration (drizzle-kit's diff basis)

**NEVER hand-edit `_journal.json`** unless you know exactly what you're doing — it desyncs from the SQL files and `db:check` will flag it.

### Tests

- Runner: `vitest` (`pnpm test` / `pnpm test:run`)
- Database: **`@electric-sql/pglite`** — real Postgres in WASM, not `pg-mem`. The earlier pg-mem setup was a drift liability; PGlite reads the same `schema/index.ts` the prod runtime uses, so tests and prod share the schema source-of-truth.
- Test utilities: `packages/database/src/test-utils.ts` — exposes `setupTestDb()`, `cleanup()`, typed `Drizzle` client. **Critical limitation:** PGlite has a single WASM connection — parallel transactions deadlock. Serialize `Promise.all([tx1, tx2])` calls in tests.
- One `setupTestDb` per process. Sharing across Vitest workers requires one module instance per worker.

### Production vs dev — pick the right command

- Local hacking: `db:push` (fast, no migration file written, can lose data)
- PRs / shared env: `db:generate` → review the SQL → `db:migrate`
- Production: `db:migrate` ONLY. `db:push` bypasses migration history.

## Related

- [[stack]] — pnpm workspace setup
- [[template-strategy]] — monorepo distribution strategy
- [[packages-ui-audit]] — note: `@better-auth/drizzle-adapter` and `better-auth` are separate packages
