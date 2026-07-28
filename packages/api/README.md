# `@workspace/api`

Typed RPC layer. The single source of truth for the contract between
client apps and server data.

Built on **oRPC over hono** for transport, with **Zod** for input/output
schemas — so the same definitions validate on the client and the server.

## Why a separate package

Two concerns:

1. **Contract stability.** The RPC shape is the public surface that
   front-ends depend on. It must not move every time the auth layer or
   the storage layer changes shape.
2. **Concern separation.** Identity, sessions, and auth plugins belong
   to `@workspace/auth`. Application data and business logic belong
   here.

Mixing them ties every auth plugin update to a breaking change for
every caller, and the same goes for storage migrations.

## What this package owns

- The router — the canonical contract. Every input, every output, every
  auth requirement is declared here and nowhere else.
- The auth boundary: procedures that require a session either run
  through the auth middleware or fail with the standard "no session"
  response.
- Type re-exports that flow back into the apps and any future client
  (CLI, edge workers, SDKs).

The router does not own storage shapes — those stay in
`@workspace/database`. The router owns the *contract* between client and
server, which is a different layer.
