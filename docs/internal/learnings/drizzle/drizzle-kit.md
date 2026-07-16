# drizzle-kit — internal deep-dive

> Companion to [`README.md`](./README.md), which covers schema authoring, relations v1/v2, the better-auth CLI pipeline, and the postgres-js connection pool. **This doc is about the `drizzle-kit` CLI tool itself**: every command, the full config surface, snapshot/journal internals, CI integration, multi-environment patterns, and the open pitfalls that bite us specifically at our pinned versions.
>
> Repo pins: `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`, dialect `postgresql` (postgres-js driver, not `pg`). Current repo wiring (`packages/database/package.json`):
>
> | Script | Command |
> |---|---|
> | `db:generate` | `drizzle-kit generate` |
> | `db:migrate` | `drizzle-kit migrate` |
> | `db:push` | `drizzle-kit push` |
> | `db:studio` | `drizzle-kit studio` |
> | `db:check` | `drizzle-kit check` |
>
> Not currently wired: `up`, `drop`, `export`, `pull`, `--config`, multi-env configs.

---

## 1. TL;DR

`drizzle-kit` is the migration *engine*: it diffs TypeScript schema declarations against a stored JSON snapshot and emits SQL migrations plus an updated snapshot. **The kit does not talk to your application at runtime** — the runtime side is `drizzle-orm`'s `migrate()` function (or the `drizzle-kit migrate` CLI, which is a thin wrapper around it). For this repo the kit runs only at dev-time and in CI; production schema changes ship as committed `drizzle/*.sql` files applied via `pnpm db:migrate`.

The single most load-bearing fact about `drizzle-kit` at our pins: **`generate` derives the next migration index from the journal alone — not from on-disk `drizzle/*.sql` — and writes both `meta/NNNN_snapshot.json` and `NNNN_*.sql` without an existence check.** A stale journal (partial rebase, manual repair, or two parallel branches each running `generate`) produces a colliding prefix and silently overwrites a snapshot. This is drizzle-orm issue [#5774](https://github.com/drizzle-team/drizzle-orm/issues/5774), filed 2026-05-17 against our exact pins, still open. The mitigations are mechanical: `db:check` in CI, `git diff drizzle/meta/` before commit, and a hand-rolled wrapper if we want author-time protection.

For day-to-day work the operational split is clear: `generate` authors SQL files (commit-only, never executes against a DB), `migrate` applies them (staging/prod), `push` is schema-vs-DB direct sync with no artifact (dev only), `studio` is a local GUI that talks directly to the DB with credentials in the clear, and `check` is the only thing standing between us and the #5774-class failures at PR time. The remaining commands (`up`, `export`, `pull`, `drop`) are situational and currently unwired in this repo.

---

## 2. Command reference

Every command reads `dialect` from the config (or `--dialect=` CLI flag). Commands that touch a database (`migrate`, `push`, `studio`, `pull`) also need `dbCredentials`. Commands that need schema files (`generate`, `push`, `pull`, `studio`, `export`) also need `schema`. Below, defaults are `drizzle-kit@0.31.10` against `drizzle-orm@0.45.2`.

### 2.1 `drizzle-kit generate`

Diffs the schema files against the latest snapshot, writes a numbered `.sql` + a matching `meta/NNNN_snapshot.json`, and appends an entry to `meta/_journal.json`. **Never executes SQL.**

Flags (types and defaults from the [CLI commands index](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/commands) and the [generate docs](https://orm.drizzle.team/docs/drizzle-kit-generate)):

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--config` | `string` | `drizzle.config.ts` | Path to a config file |
| `--dialect` | enum | from config | `postgresql \| mysql \| sqlite \| turso \| singlestore \| mssql \| cockroach` |
| `--schema` | `string \| string[]` | from config | Glob over `.ts` schema files |
| `--out` | `string` | from config (`./drizzle`) | Migration folder |
| `--name` | `string` | random-words tag | Sets the migration tag (e.g. `0000_<name>.sql`) |
| `--custom` | `boolean` | `false` | Scaffold an **empty** SQL file for hand-written migrations/seeds |
| `--breakpoints` | `boolean` | `true` | Emit `--> statement-breakpoint` between statements |
| `--prefix` | enum | from config | `index \| timestamp \| supabase \| unix \| none` |

Exit codes: `0` on success; `1` on schema parse errors or invalid config. Internal-file collisions under #5774 are silent (exit `0`, but on-disk state is wrong — the catch is `git diff`).

### 2.2 `drizzle-kit migrate`

Reads `*.sql` files in `out`, queries the `__drizzle_migrations` table in the DB for the last applied entry, and applies any pending files in order. Records applied migrations in the same table.

Flags:

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--config` | `string` | `drizzle.config.ts` | |
| `--dialect` | enum | from config | required if no config |
| `--out` | `string` | `./drizzle` | |
| `--url` | `string` | from config | Connection URL (CLI override for `dbCredentials.url`) |

Exit codes: `0` on success; `1` if any SQL fails. The [`migrate` docs](https://orm.drizzle.team/docs/drizzle-kit-migrate) show the per-step sequence: read folder → query history → pick unapplied → apply → log. The internal tracking table is configurable via `migrations.table` and `migrations.schema` (see §3); defaults are `__drizzle_migrations` in the `drizzle` schema.

A known pain point: issues [#5601](https://github.com/drizzle-team/drizzle-orm/issues/5601), [#5521](https://github.com/drizzle-team/drizzle-orm/issues/5521), and [#5816](https://github.com/drizzle-team/drizzle-orm/issues/5816) describe SQL-failure cases where the CLI exits `1` but prints nothing because `MigrateProgress` swallows the rejection. Diagnose by running the generated SQL by hand against the same `DATABASE_URL` to surface the actual error.

### 2.3 `drizzle-kit push`

Schema-vs-DB direct sync. Reads schema files, introspects the live DB, generates a diff, and applies it. **Writes no SQL file** and leaves no migration artifact.

Flags:

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--config` | `string` | `drizzle.config.ts` | |
| `--dialect` | enum | from config | |
| `--schema` | `string \| string[]` | from config | |
| `--url` | `string` | from config | |
| `--host` / `--port` / `--user` / `--password` / `--database` | string/number | from config | Individual connection params |
| `--ssl` | enum | from config | `require \| allow \| prefer \| verify-full` |
| `--tablesFilter` | `string \| string[]` | from config | Glob filter on table names |
| `--schemaFilters` | `string \| string[]` | from config | Postgres schema filter (note the plural — `push` uses `schemaFilters`, while the *config* field is singular `schemaFilter`) |
| `--verbose` | `boolean` | `false` | Print every SQL statement |
| `--force` | `boolean` | `false` | **Auto-approve data-loss statements** (TRUNCATE / DROP) — use with extreme care |
| `--strict` | `boolean` | `false` | Always prompt before applying |

Exit codes: `0` on success, `1` on connection failure or rejected prompt, prompts return non-zero on Ctrl-C. See the [push docs](https://orm.drizzle.team/docs/drizzle-kit-push) for the full prompt-and-confirm UX.

### 2.4 `drizzle-kit pull` (alias `introspect`)

Round-trips an existing DB into a Drizzle schema file. Connects, introspects, and writes `schema.ts` (and, on the v1.0 RC, a `relations.ts` for the v2 relations API).

Flags: `--dialect`, `--url`/`dbCredentials`, `--out`, `--config`, `--introspect-casing` (`camel` or `preserve`), `--breakpoints`. Exit codes are `0` on success, `1` on connection or driver errors.

Lossiness caveats: per issues [#2530](https://github.com/drizzle-team/drizzle-orm/issues/2530), [#1306](https://github.com/drizzle-team/drizzle-orm/issues/1306), [#4239](https://github.com/drizzle-team/drizzle-orm/issues/4239), and [#5730](https://github.com/drizzle-team/drizzle-orm/issues/5730), the introspect output is **not deterministic** across runs (FK ordering, CHECK constraints, etc.) and several features (`CHECK`, certain column defaults) are dropped or corrupted ([#4979](https://github.com/drizzle-team/drizzle-orm/issues/4979)). Treat `pull` output as a starting point, then hand-edit and commit; do **not** re-run `pull` over the same DB and expect a no-op diff.

### 2.5 `drizzle-kit studio`

Spins up a local web server that proxies to the database and renders a GUI at `local.drizzle.studio`. **Requires a config file with `dbCredentials`** — there is no CLI override path for credentials.

Flags:

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--port` | `number` | `4983` | |
| `--host` | `string` | `127.0.0.1` | Set to `0.0.0.0` to expose externally — **do not do this in prod** |
| `--verbose` | `boolean` | `false` | Log every SQL statement |

Exit codes: `0` on clean shutdown (Ctrl-C), `1` on port-bind failure. There is no production mode — [discussion #3149](https://github.com/drizzle-team/drizzle-orm/discussions/3149) and the [studio docs](https://orm.drizzle.team/docs/drizzle-kit-studio) make it clear: `studio` is dev tooling. Auth is the OS-level bound address + whatever auth sits in front of the DB.

### 2.6 `drizzle-kit check`

Walks `meta/_journal.json`, walks `meta/*.json` snapshots, and verifies that every snapshot's `prevId` resolves to a real snapshot, that no two snapshots claim the same `prevId` (collision), and that the chain is intact. It is **purely a journal/snapshot integrity check** — it does not validate the schema files, does not run any SQL, and does not connect to the database.

Flags:

| Flag | Type | Default | Notes |
|---|---|---|---|
| `--config` | `string` | `drizzle.config.ts` | |
| `--dialect` | enum | from config | |
| `--out` | `string` | `./drizzle` | |
| `--ignore-conflicts` | `boolean` | `false` | Skip commutativity checks; the docs explicitly say "If there is a situation you want to use it, then there is a big chance that drizzle-kit didn't check migrations right and it's a bug. Please report us your case." |

Exit codes: `0` on a clean history, `1` on chain collision or missing parent (the canonical message: `[drizzle/0014_snapshot.json, drizzle/0015_snapshot.json] are pointing to a parent snapshot: … which is a collision.`).

See [drizzle-orm #3935](https://github.com/drizzle-team/drizzle-orm/issues/3935) for the canonical "same parent snapshot" error message and §6 for what `check` does and does **not** catch.

### 2.7 `drizzle-kit up`

Upgrades snapshot files to a newer internal version when the kit bumps its snapshot schema (e.g. v6 → v7). Required **once** per snapshot-format change.

Flags: `--config`, `--dialect`. Exit `0` if every snapshot upgraded cleanly, non-zero on parse error. This repo is already on `version: "7"` per [`packages/database/drizzle/meta/_journal.json`](../../../../packages/database/drizzle/meta/_journal.json) and per the [v6→v7 upgrade notes](https://www.answeroverflow.com/m/1250760003367993345) — there is nothing to migrate to. **Wiring `db:up` is not necessary today**, but adding a script makes the next upgrade one line away.

### 2.8 `drizzle-kit export`

Reads schema files, computes a single SQL DDL for the **current** schema state, and prints it to stdout. Does not write files and does not connect to a DB. Designed for "I want to hand the DDL to Atlas / Sqitch / a DBA." Exit `0` always for valid schema, `1` on parse error.

Flags: `--config`, `--dialect`, `--schema`. Not wired in this repo. **Not a substitute for `generate`** — it cannot produce a diff because it has no previous snapshot to compare against.

### 2.9 `drizzle-kit drop`

Postgres-only utility that drops everything in the public schema (or the configured schema). Intended for ephemeral dev databases. **Irreversible** — never run against a database with data you care about.

Flags: `--config`, `--dialect`, `--schemaFilters` (Postgres). Not wired here, and we should not wire it — local dev wipes go through `pnpm supabase db reset` or equivalent, which the kit cannot orchestrate.

---

## 3. `drizzle.config.ts` reference

The complete surface for the config file ([full API reference](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/configuration)):

| Option | Type | Default | Recommended value here |
|---|---|---|---|
| `dialect` | `'postgresql' \| 'mysql' \| 'sqlite' \| 'turso' \| 'singlestore' \| 'mssql' \| 'cockroach' \| 'gel'` | — | `'postgresql'` (matches `src/schema/*.ts` and the postgres-js pool) |
| `schema` | `string \| string[]` (glob) | — | `"./src/schema/index.ts"` (barrel over `auth.ts` + satellite tables) |
| `out` | `string` | `'./drizzle'` | `'./drizzle'` (the current value) |
| `driver` | `'aws-data-api' \| 'd1-http' \| 'expo' \| 'pglite' \| 'durable-sqlite'` | — | **omit** — we use postgres-js and the kit's default driver dispatch works |
| `dbCredentials` | object (dialect-specific) | — | `{ url: serverEnv.DATABASE_URL }` (current value; pulled from `@workspace/env/server` so the kit reads it lazily) |
| `dbCredentials.ssl` | `boolean \| 'require' \| 'allow' \| 'prefer' \| 'verify-full' \| ConnectionOptions` | `false` | `false` for local; if the prod URL embeds `?sslmode=require`, omit the field |
| `extensionsFilters` | `string[]` | — | `['postgis']` only if we add PostGIS columns |
| `schemaFilter` | `string \| string[]` | — | omit — we keep everything in `public`; on multi-schema projects this is `[ 'public', 'auth', … ]` |
| `tablesFilter` | `string \| string[]` (glob) | — | omit — defaults to all tables |
| `introspect.casing` | `'camel' \| 'preserve'` | `'camel'` | `'camel'` keeps TS keys matching what we already author |
| `migrations.table` | `string` | `'__drizzle_migrations'` | leave default |
| `migrations.schema` | `string` | `'drizzle'` | leave default — moving it to `public` pollutes the public schema |
| `breakpoints` | `boolean` | `true` | `true` — we already see it on the journal entry (`"breakpoints": true` in `meta/_journal.json`); keeps MySQL/SQLite-compatible SQL if we ever cross-target |
| `verbose` | `boolean` | `false` | `true` in dev; `false` in CI logs |
| `entities.roles` | `{ provider?: string; exclude?: string[]; include?: string[] }` | — | omit unless we manage roles through migrations (we don't) |

A subtle gotcha on `dialect: 'cockroach'`: as of 0.31.x, `cockroach` is recognized in the config and commands but some operations (`pull`, certain introspection paths) have parity gaps. Stay on `postgresql` until we have a concrete Cockroach target.

The `driver` field is only required for **non-Node-postgres** drivers (`aws-data-api` for RDS Data API, `d1-http` for Cloudflare D1, `expo` for React Native, `pglite` for in-process Postgres, `durable-sqlite` for Cloudflare Durable Objects). Our postgres-js pool is hit by `drizzle-orm/postgres-js/migrator`; the kit's introspect path uses `pg` directly — both are Node-postgres family, so the default dispatch works and we should **not** set `driver`.

---

## 4. Snapshot & journal internals

`drizzle-kit` stores two artifacts per migration in `out/meta/`:

### 4.1 `_journal.json`

A flat append-only list of migration entries. The full source for this repo is:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    { "idx": 0, "version": "7", "when": 1783351219509, "tag": "0000_boring_steel_serpent", "breakpoints": true }
  ]
}
```

The fields ([Migrations API](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/migrations)):

- `version` — kit's internal snapshot format version (currently `"7"`).
- `dialect` — the dialect used to author the entry.
- `idx` — 0-based monotonic index; **`generate` computes the next one as `lastEntry.idx + 1` with no on-disk cross-check** — the root cause of #5774.
- `tag` — filename minus `.sql` (e.g. `0000_boring_steel_serpent`).
- `when` — epoch milliseconds the entry was authored; purely informational.
- `breakpoints` — whether the SQL file is split with `--> statement-breakpoint` markers.

### 4.2 `NNNN_snapshot.json`

The diff base. Each migration writes one of these containing the **complete** schema state at that point. The fields are:

- `id` — UUID generated on every `generate` (new `id` per entry).
- `prevId` — the `id` of the previous snapshot (`"00000000-0000-0000-0000-000000000000"` for the first).
- `version`, `dialect` — mirror the journal.
- `tables` — keyed by `"{schema}.{name}"` or `"{name}"` for the default schema; each table holds `columns`, `indexes`, `foreignKeys`, `compositePrimaryKeys`, `uniqueConstraints`, `checkConstraints`.
- `enums`, `schemas`, `sequences` — parallel maps.
- `_meta` — internal `{ schemas, tables, columns }` carry-over for stable ordering.

### 4.3 How the diff is computed

Per the [DeepWiki schema-serialization page](https://deepwiki.com/drizzle-team/drizzle-orm/3.2.1-schema-serialization-and-snapshots) and [`drizzle-kit/src/snapshotsDiffer.ts`](https://github.com/drizzle-team/drizzle-orm/blob/48e54060/drizzle-kit/src/snapshotsDiffer.ts):

1. The schema files are loaded → `generatePgSnapshot` produces an in-memory `PgSchemaInternal`.
2. `PgSquasher` "squashes" complex objects (foreign keys, indexes, composite PKs, uniques) into deterministic `name;…`-separated string hashes so diffing is stable.
3. The latest committed `NNNN_snapshot.json` is loaded and squashed the same way.
4. `snapshotsDiffer` walks both, emitting `JsonStatement[]` (each becomes a SQL fragment via `sqlgenerator.ts`).
5. Statements are joined with `--> statement-breakpoint` if `breakpoints: true` (default), then written to `out/<tag>.sql`.
6. A fresh `id` is minted, the new snapshot is written to `meta/<tag>_snapshot.json`, and the journal gets a new entry.

The squasher is what makes the diff stable: indexes, FKs, etc. are serialized into canonical strings before comparison. Without it, FK order or whitespace would produce false-positive diffs.

### 4.4 What this means for us

- **Never hand-edit `meta/_journal.json` or `meta/NNNN_snapshot.json`.** Snapshots are the canonical diff base — a manual edit will misalign the next diff.
- **The journal is the source of truth for `idx`.** That is the bug (#5774): when the journal drifts from on-disk SQL, `generate` writes a colliding prefix and silently overwrites the existing snapshot. See §6 and §11.
- **The chain is linear.** Two snapshots pointing at the same `prevId` is the exact `check` error from #3935.

---

## 5. Multi-environment config

`drizzle-kit` supports multiple config files per project via `--config=<path>`. From the [config docs](https://orm.drizzle.team/docs/drizzle-config-file):

```bash
pnpm drizzle-kit generate --config=drizzle-dev.config.ts
pnpm drizzle-kit migrate  --config=drizzle-prod.config.ts
```

Use this when:

- Different DBs per environment (dev Postgres vs preview Turso vs prod Neon).
- Different `out` folders (so dev schema churn never pollutes prod migration history).
- Different `dbCredentials` sources (dev reads `.env.local`, prod reads `process.env.DATABASE_URL`).

Example for this repo:

```ts
// drizzle-dev.config.ts
import { defineConfig } from "drizzle-kit"
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DEV_DATABASE_URL! },
  verbose: true,
})

// drizzle-prod.config.ts
import { defineConfig } from "drizzle-kit"
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
})
```

Why we have not done this yet: dev and prod share the same Postgres (Neon branch per environment in our deploy model), so a single config pointed at `@workspace/env/server`'s `DATABASE_URL` is enough. Revisit if we adopt per-env DB engines.

**Note on dotenv:** `drizzle-kit` does not auto-load `.env`. The current config uses `import "@workspace/env/server"` at the top, which loads env before the config is evaluated — that is the right escape hatch (Discussion [#3405](https://github.com/drizzle-team/drizzle-orm/discussions/3405), Feature Request [#4588](https://github.com/drizzle-team/drizzle-orm/issues/4588)). If we add multi-env configs, replicate the same import at the top of each.

---

## 6. `check` & migration quality

`drizzle-kit check` ([docs](https://orm.drizzle.team/docs/drizzle-kit-check), [source](https://github.com/drizzle-team/drizzle-orm/blob/4aa6ecfe/drizzle-kit/src/cli/commands/check.ts)) is intentionally narrow. It validates:

- Every snapshot's `prevId` resolves to an existing snapshot.
- No two snapshots claim the same `prevId` (the canonical collision message from #3935).
- The journal's `entries` agree with the on-disk snapshot files.
- When `--output json` ships (per [Discussion #5876](https://github.com/drizzle-team/drizzle-orm/discussions/5876)), it will also detect parallel migrations from the same parent that touch the same database objects.

What `check` does **not** catch:

- **Stale journal vs on-disk SQL** when the journal itself parses cleanly (#5774). The journal says `idx=1`, `meta/0001_snapshot.json` exists, but `out/0001_*.sql` is missing or vice versa — `check` walks the journal.
- **Schema vs snapshot drift**: there is no schema-file awareness in `check`. The "schema differs from last snapshot" check is implicit in `generate` and missing from `check`.
- **Destructive SQL inside a migration**: `check` does not parse the `.sql` body.
- **Migration that succeeds locally but fails on prod** (e.g. requires `CREATE INDEX CONCURRENTLY` on a populated table): unrelated to `check`.

The recommended pattern, given the gap:

1. `db:check` in CI on every PR (catches #3935 and the `--output json` parallel-merge conflicts).
2. Hand-rolled wrapper around `db:generate` that cross-checks `journalMaxIdx >= onDiskMaxPrefix` before allowing `generate` to write — the proposed fix shape in #5774.
3. `git diff drizzle/meta/` review on every PR (catches in-place snapshot overwrite).

---

## 7. CI integration

Minimum viable CI gate (GitHub Actions, monorepo-aware):

```yaml
# .github/workflows/db-check.yml
name: db
on:
  pull_request:
    paths:
      - "packages/database/**"
      - "packages/database/drizzle.config.ts"
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: packages/database
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:check

      # Optional: regen and fail if the tree changed.
      # Catches schema edits that forgot to run `db:generate`.
      - run: pnpm db:generate
      - run: git diff --exit-code drizzle
```

The "regen-and-diff" pattern is the strongest gate: it fails the PR if the schema changed but no migration was generated. The trade-off is a slower job and the need to teach contributors to regenerate before pushing. **Recommended** for the database package specifically.

When `--output json` lands on npm (per Discussion #5876), wire the [community check action](https://github.com/drizzle-team/drizzle-orm/discussions/5522) and make it a required status check. Until then, the diff-step is the closest substitute.

For the multi-config case, repeat the step per config file with `--config=drizzle-<env>.config.ts`.

---

## 8. Pitfalls & gotchas

- **#5774 — stale journal + silent overwrite.** `generate` uses `lastEntryInJournal.idx + 1` without checking on-disk SQL. Two parallel PRs that each run `generate` off the same parent produce colliding prefixes and the second run **silently overwrites** `meta/NNNN_snapshot.json`. The fix shape (from the issue):

  ```js
  const onDiskMaxPrefix = fs.readdirSync(outFolder)
    .filter(f => /^\d{4}_/.test(f))
    .map(f => parseInt(f.slice(0, 4), 10))
    .reduce((m, n) => Math.max(m, n), -1)
  const journalMaxIdx = journal.entries.length === 0
    ? -1
    : journal.entries[journal.entries.length - 1].idx
  if (onDiskMaxPrefix > journalMaxIdx) {
    throw new Error("Journal stale: …")
  }
  ```

  Mitigation today: `db:check` in CI + `git diff drizzle/meta/` review + manual `generate` only when the working tree is clean.
- **#3935 — same parent collision.** Two snapshots both pointing at the same `prevId` is the exact failure `db:check` was built to catch. Closed without a kit fix; the resolution is on the operator (`prevId` repair).
- **#5601 / #5521 / #5816 — silent SQL failures in `migrate`.** Exit `1` with no printed error. Run the failing SQL manually against the same `DATABASE_URL` to surface the error; patch the migration by hand if needed.
- **`breakpoints: true` is the default and we keep it.** The journal in this repo already records `"breakpoints": true`. Without breakpoints, MySQL / SQLite / SingleStore would fail to apply multi-statement migrations. Even on Postgres (which supports transactions), the per-statement split makes partial failures cleaner to diagnose.
- **`breakpoints` ordering caveat.** Because each statement is its own block, **DDL order matters** — e.g. `CREATE INDEX` referencing a column that has not been added yet fails. The diff engine tries to order statements correctly, but cross-table references (FKs) can produce sequences the engine does not always linearize cleanly. Always read the generated `.sql` before committing.
- **Windows path separators in embedded migrations.** PR [#5518](https://github.com/drizzle-team/drizzle-orm/pull/5518) fixed #5514: `entry.split('/')[entry.split('/').length - 2]` returned `undefined` on Windows because paths used backslashes. The fix uses `path.basename(path.dirname(entry))`. **Status: open on the beta branch**, not yet in 0.31.10. If a Windows contributor reports `./undefined/migration.sql` in `migrations.js`, that is the bug.
- **Schema glob on Windows.** The `schema` option is glob-expanded by the kit's loader; backslashes in the glob pattern can misbehave. Use forward slashes (`./src/**/schema.ts`) — Node treats them as separators on Windows.
- **`push` does not generate SQL files** → no review trail, no rollback path. `push` in prod means the only record of the change is in the DB itself. Per the [push docs](https://orm.drizzle.team/docs/drizzle-kit-push), `push` is designed for rapid prototyping; the official guidance for production is "pairs exceptionally well with blue/green deployment strategy and serverless databases" — i.e. only when the DB itself is disposable.
- **`studio` with `--host 0.0.0.0`** exposes the GUI on every interface and the DB credentials sit in the process. Bind to `127.0.0.1` (the default) outside an isolated VM.
- **`db:check` does not parse the `.sql` body.** A migration can be a no-op (e.g. `--> statement-breakpoint` followed by nothing) and pass. The CI regen-and-diff step is the only thing that catches schema drift without a migration.
- **Two parallel PRs each adding a migration.** The git merge is conflict-free (different filenames), but the journal now has two entries pointing at the same `prevId`. This is #3935 territory — caught by `db:check` after the fact. The forthcoming `--output json` (Discussion #5876) is the pre-merge detector.
- **Pushing without `notNull()`** silently makes columns nullable and infers `T | null` on the TS side. Always be deliberate with `notNull()`.

---

## 9. Pinned version considerations

We are pinned to **`drizzle-kit@^0.31.10` / `drizzle-orm@^0.45.2`** as of mid-2026. The 0.31.10 release ([changelog](https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/changelogs/drizzle-kit/0.31.10.md), [release notes](https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit@0.31.10)) shipped three load-bearing changes:

1. `hanji@0.0.8` for native `bun stringWidth` / `stripANSI` support + non-TTY error behavior.
2. Migration from `esbuild-register` to the `tsx` loader — works for both ESM and CJS.
3. Native `bun` and `deno` launch paths that bypass `tsx` and use the runtime's own import system (faster cold start).

What is **not** in 0.31.10 but lives on the `main` / `beta` branches:

- The v1.0 relations-v2 schema (`defineRelations`, `from`/`to`, `alias`, `through`) and the `drizzle({ relations })` config shape. See the companion `README.md` §4 for the v1-vs-v2 matrix and the migration path.
- The `drizzle-kit check --output json` machine-readable conflict report (Discussion #5876) — the GitHub Action that consumes it lives on the `rc4` branch.
- The Windows path-separator fix (#5518 → PR #5518) is still in the `beta` merge queue.
- `drizzle-kit` v1.0 will *require* the v2 relations API in many paths; the kit config will gain a `relations` field that replaces `schema` for relations.

What to watch:

- **drizzle-orm #5774** — open against our exact pins. The PR fixing it will likely either refuse `generate` when on-disk max prefix > journal max idx, or change the formula to `max(journal, on-disk) + 1`. Track the PR.
- **drizzle-orm #3935** — closed, but the same failure mode resurfaces under stale-journal conditions. `db:check` is the catch.
- **PR #5518** — Windows path fix. Will land in the next 0.31.x or in v1.0. Important if anyone on the team uses Windows for local dev.
- **v1.0 release.** When drizzle-orm / drizzle-kit v1.0 ships, the better-auth CLI must emit v2-compatible relations before we can adopt (see companion `README.md` §4 and §8). Treat the v1.0 upgrade as a whole-repo migration, coordinated with `@better-auth/cli`.
- **Feature #4588** — multiple `--env-file` flags. If we ever drop the `@workspace/env/server` shim from the config, this becomes load-bearing.
- **Issue #5730** — MySQL `--config` + `--out` false collision, CHECK constraint drops. Irrelevant to us today (we are Postgres-only) but worth knowing if we cross-target.

In short: stay on `0.31.10` for now. The next bump should be coordinated with the better-auth CLI version and should include a regen-and-diff dry run as the verification step.

---

## 10. Sources

1. [Drizzle Kit — `generate` command](https://orm.drizzle.team/docs/drizzle-kit-generate)
2. [Drizzle Kit — `migrate` command](https://orm.drizzle.team/docs/drizzle-kit-migrate)
3. [Drizzle Kit — `push` command](https://orm.drizzle.team/docs/drizzle-kit-push)
4. [Drizzle Kit — `studio` command](https://orm.drizzle.team/docs/drizzle-kit-studio)
5. [Drizzle Kit — `check` command](https://orm.drizzle.team/docs/drizzle-kit-check)
6. [Drizzle Kit — `up` command](https://orm.drizzle.team/docs/drizzle-kit-up)
7. [Drizzle Kit — `export` command](https://orm.drizzle.team/docs/drizzle-kit-export)
8. [Drizzle Kit — Custom migrations (`--custom`)](https://orm.drizzle.team/docs/kit-custom-migrations)
9. [Drizzle Kit — `drizzle.config.ts` reference](https://orm.drizzle.team/docs/drizzle-config-file)
10. [Drizzle Kit — CLI commands index (Mintlify)](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/commands)
11. [Drizzle Kit — Migrations / snapshot + journal internals](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/migrations)
12. [Drizzle Kit — Configuration API reference](https://drizzle-team-drizzle-orm.mintlify.app/api/kit/configuration)
13. [DeepWiki — Schema Serialization and Snapshots](https://deepwiki.com/drizzle-team/drizzle-orm/3.2.1-schema-serialization-and-snapshots)
14. [drizzle-orm #5774 — `generate` derives idx from journal alone, silent snapshot overwrite](https://github.com/drizzle-team/drizzle-orm/issues/5774)
15. [drizzle-orm #3935 — Snapshot parent collision (closed)](https://github.com/drizzle-team/drizzle-orm/issues/3935)
16. [drizzle-orm #5601 — `migrate` SQL failure, no printed error](https://github.com/drizzle-team/drizzle-orm/issues/5601)
17. [drizzle-orm #5521 — `migrate` CLI silent SQL failure](https://github.com/drizzle-team/drizzle-orm/issues/5521)
18. [drizzle-orm #5816 — `MigrateProgress` swallows rejection](https://github.com/drizzle-team/drizzle-orm/issues/5816)
19. [drizzle-orm #5514 / PR #5518 — Windows path separators in `embeddedMigrations`](https://github.com/drizzle-team/drizzle-orm/pull/5518)
20. [drizzle-orm Discussion #5876 — `drizzle-kit check` + the `check` GitHub Action](https://github.com/drizzle-team/drizzle-orm/discussions/5876)
21. [drizzle-orm Discussion #3405 — dotenv support in Drizzle Kit](https://github.com/drizzle-team/drizzle-orm/discussions/3405)
22. [drizzle-orm #4588 — multiple `--env-file` flags](https://github.com/drizzle-team/drizzle-orm/issues/4588)
23. [drizzle-orm #5730 — MySQL introspect false collision; CHECK dropped](https://github.com/drizzle-team/drizzle-orm/issues/5730)
24. [drizzle-orm #4979 — column default value corrupted on `pull`](https://github.com/drizzle-team/drizzle-orm/issues/4979)
25. [drizzle-orm Discussion #3149 — deploying Studio to production?](https://github.com/drizzle-team/drizzle-orm/discussions/3149)
26. [drizzle-orm release: drizzle-kit@0.31.10](https://github.com/drizzle-team/drizzle-orm/releases/tag/drizzle-kit@0.31.10)
27. [drizzle-kit@0.31.10 changelog (in repo)](https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/changelogs/drizzle-kit/0.31.10.md)
28. [Answer Overflow — snapshot v6 → v7 upgrade notes](https://www.answeroverflow.com/m/1250760003367993345)
29. [DEV — Drizzle ORM Migrations: push vs migrate](https://dev.to/dev_encyclopedia/drizzle-orm-migrations-push-vs-migrate-and-what-actually-belongs-in-production-5cm7)
30. [drizzle-kit source — `cli/schema.ts`](https://github.com/drizzle-team/drizzle-orm/blob/e8e6edfe/drizzle-kit/src/cli/schema.ts)
31. [drizzle-kit source — `cli/commands/check.ts`](https://github.com/drizzle-team/drizzle-orm/blob/4aa6ecfe/drizzle-kit/src/cli/commands/check.ts)
32. [drizzle-kit source — `cli/commands/migrate.ts`](https://github.com/drizzle-team/drizzle-orm/blob/e8e6edfe/drizzle-kit/src/cli/commands/migrate.ts)
33. [drizzle-kit source — `snapshotsDiffer.ts`](https://github.com/drizzle-team/drizzle-orm/blob/48e54060/drizzle-kit/src/snapshotsDiffer.ts)
34. [drizzle-kit source — `serializer/pgSerializer.ts`](https://github.com/drizzle-team/drizzle-orm/blob/48e54060/drizzle-kit/src/serializer/pgSerializer.ts)
35. [drizzle-orm source — `cli/views.ts` (table key format)](https://github.com/drizzle-team/drizzle-orm/blob/48e54060/drizzle-kit/src/cli/views.ts)