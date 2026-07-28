# `@workspace/env` — agent invariants

## Use the exports, never raw `process.env`

The exported server / client accessors give you validation, alias
resolution, and (on the server side) a runtime guard that refuses to
resolve in a browser bundle. Reading `process.env` from a consumer
package skips all three. Forcing every read through this package is the
only way the bundle-safety guard can do its job.

`process.env` reads are reserved for this package and for the tooling
that has to talk to env directly (build scripts, migration tools, schema
generators).

## Server env must never reach a browser bundle

Even reading a single property pulls the server env module and its
validation pipeline into the bundle. The runtime guard catches the leak
at first access — but by then the bundle has shipped the dead code,
costing bytes and audit surface. Keep server-env imports on the server
side of the boundary; never re-export them from a `'use client'` module.

## Validation is lazy, and that is the point

`serverEnv` validates on first property access, not at import. This
lets `pnpm build`, migration tools, and test suites run without a
populated `.env`. Eager validation at the top of any consumer module
breaks all three workflows — and the failure mode is the worst kind: a
crash that only happens on CI or on a teammate's machine.

## Aliases are resolved here, not at call sites

When a package accepts both an old name and a new name for the same
value, the canonical read goes through this package. The fallback lives
inside the access layer so adding a new alias later is one schema edit,
not a sweep across the workspace.
