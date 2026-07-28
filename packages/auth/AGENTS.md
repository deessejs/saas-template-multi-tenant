# `@workspace/auth` — agent invariants

## The schema file is not yours to edit

The Drizzle tables that mirror Better Auth's runtime model are regenerated
from this package's config every time the config changes. Manual edits
to that file are *overwritten*, not rejected — silently. Do not edit it,
do not commit defensive patches to it, do not "fix" the formatting.

When the generated table set is not enough, extend the domain with
satellite tables one-to-one keyed on the user table with cascading
delete. Hand-written migrations on Better Auth-owned tables break the
regeneration loop on the next CLI run.

## No client-side code lives here

The package depends on server-only modules and Better Auth's server
runtime. Pulling it into a browser bundle would force a constant tree-
shake battle to keep server-only dependencies out. Client-side auth
(sign-in forms, session readers, sign-out flows) lives in `apps/app`. This
package is server-only.

## This package is the config, not the feature

Auth *configuration* lives here. Auth *behavior* — org lifecycle,
invitations, custom roles, custom hooks — is implemented in the feature
packages and apps that consume this one. Do not let `@workspace/auth`
grow into a kitchen sink; split by concern and let the consumers
orchestrate.
