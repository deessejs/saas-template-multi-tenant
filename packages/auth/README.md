# `@workspace/auth`

Authentication package. Owns the Better Auth instance for the workspace
and serves as the single source of truth for what gets generated into
the persistence layer.

Built on **Better Auth + drizzle-adapter** against the workspace
Postgres database.

## Why a separate package

Two concerns live at different layers of the stack:

- `@workspace/auth` — identity, sessions, pluggable auth surfaces (org,
  invitations, OAuth, email verification).
- `@workspace/api` — application RPC contracts over hono + oRPC.

Mixing them couples the public RPC shape to Better Auth's plugin surface,
making every plugin update a breaking change for downstream callers.

## What this package owns

- The `betterAuth({...})` configuration.
- The schema-generation workflow: the CLI produces the Drizzle tables from
  this config, and the schema file is *owned by the CLI*, not by hand.
- Type re-exports consumed by apps and feature packages.

Everything else — sign-in forms, route guards, error toasts — belongs in
the apps. This package is the contract; the apps are the implementation.
