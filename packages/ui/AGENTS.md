# `@workspace/ui` — agent invariants

## No raw HTML form elements in feature code

Every form control — buttons, inputs, selects, textareas, forms — has a
counterpart in this catalogue. Inline any of them in feature code and
the catalogue silently drifts: the design system becomes a suggestion
instead of a contract.

If a primitive does not exist yet, add it to the catalogue first (via
the configured generation workflow) and **then** consume it from the
feature. Do not write a one-off for a single screen and "clean it up
later" — that later never comes, and the one-off becomes a permanent
fork in the design system.

## Don't proliferate dependencies

The catalogue imports from a fixed stack. Adding a new icon set, a new
date library, or a new animation primitive means every consumer pays
for it. Prefer extending what is already in the workspace over
introducing a new dependency, and if a new one is unavoidable, justify
the cross-workspace cost in the PR.

## Keep client boundaries as small as possible

Most primitives can stay server-compatible. Adding `'use client'` to a
parent silently turns its children into client components too,
including the ones that were fine as server components. Keep client
boundaries at the smallest sensible component — the cost of a misplaced
boundary is invisible until the bundle audit, by which time the audit is
expensive.
