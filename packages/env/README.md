# `@workspace/env`

Single source of truth for environment variables. Every var the
workspace reads is declared here; nowhere else.

Built on **Zod** for schema validation and **@next/env** for loading
the repo-root `.env` files.

## Why a separate package

Two reasons:

1. **Bundle safety.** Some env vars must never reach a browser bundle.
   A Proxy-based access pattern can enforce that at runtime, where a raw
   `process.env.X` check at each call site cannot.
2. **Lazy validation.** Import-time validation breaks the build when env
   files are missing. Validation on first access lets `pnpm build`,
   migration tools, and test suites all run without a populated `.env`.

Together they remove a class of "works on my machine" failures that
otherwise leak through every consumer package.

## What this package owns

- The contracts (schemas) that declare every env var the workspace reads.
- The lazy access layer that validates on first read.
- The bundle-safety guard that refuses to resolve a server-only var on
  the client.
- Alias resolution (so consumers always read a single canonical name).
- The repo-root `.env` loader with the workarounds the monorepo layout
  requires.

Reading `process.env.X` from anywhere else is reserved for this package
and for the tooling scripts that have to talk to env directly.
