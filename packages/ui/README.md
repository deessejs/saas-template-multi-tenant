# `@workspace/ui`

Catalogue of shared visual primitives. The single place where the same
buttons, dialogs, and inputs live across the workspace.

Built on **shadcn primitives + Tailwind** with a single icon set, so
"what counts as a button" is a system-level decision — not a
per-screen choice that drifts.

## Why a separate package

UI primitives are the highest-churn code in any app. The cost of
letting them drift is not five duplicate components — it is five
different shades of "primary", five toast variants in the same
screenshot, and a design system that can never be unified after the
fact.

Centralising the catalogue buys three things:

- A single source for accessibility fixes, design tokens, and visual
  regressions to land in.
- A single point of enforcement for "no raw form controls in feature
  code" (see `AGENTS.md`).
- A single churn point that vendors and migrations have to touch once.

## What this package owns

- Every shared visual primitive.
- The skill / tooling that gates additions to the catalogue, so any new
  primitive is generated consistently and lands in the right place.
- The configuration that controls where new primitives land (paths,
  styling conventions, accessibility defaults).

This package does **not** own business components — settings layouts,
billing widgets, org pickers. Those live with the feature they serve.
