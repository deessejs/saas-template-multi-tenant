# `@workspace/database`

Persistence layer. Owns the connection pool, the schema sources, the
migration journal, and the test-time database.

Built on **Drizzle ORM** against Postgres — `postgres-js` driver in prod,
**PGlite** (Postgres in WASM) for tests, so the same schema runs in both
without emulation drift.

## Why a separate package

Persistence is the layer with the most "things that go silently wrong
if not centralised": pool tuning, schema regeneration, migration
ordering, test isolation. Concentrating them in one package means
every consumer gets the same defaults and the same failure modes —
instead of three slightly different pools and three migration histories
that drift apart over time.

It also creates a natural boundary for platform hygiene: the package
owns the pool, the apps wire the per-runtime lifecycle (graceful
shutdown, idle hygiene) at their entrypoints.

## What this package owns

- The database client and its connection pool tuning.
- The schema sources (hand-written domain tables, plus any generated
  ones owned by another tool — never mix hand edits with generated
  edits).
- The migration journal — the source of truth for ordering. Hand-editing
  the journal should be a last resort.
- The test-time database, exposed as a typed client so test code does
  not have to know how it runs.

Domain extensions to generated schemas live in **satellite tables**
keyed on the generated table — never as inline columns, which would
get overwritten on the next regeneration.
