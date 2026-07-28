# `@workspace/utils`

Framework-agnostic TypeScript helpers. Pure functions only.

Built as a TypeScript-only contract — no runtime dependencies of its
own — and tested with **vitest**.

## Why a separate package

Three dependencies the rest of the workspace must be able to import
*without* dragging in a runtime: React, Node APIs, and any feature-
specific domain. This package's contract is that it owns none of
those — which is the only way the server-only packages can rely on
shared helpers without growing their own accidental surfaces.

## What this package owns

Functions that fit on a line or two, are generally useful, and pass the
"would I import this in two unrelated packages?" test.

Everything else — feature-specific math, business-domain formatters,
helpers tied to a single package's data shape — lives with the
feature it serves. This package is a **last resort, not a kitchen
sink**. When in doubt, put the helper with the feature, not here.

## Constraints

- No React, no JSX, no framework primitives.
- No Node-only APIs (so workers, edge runtimes, and browsers stay
  first-class consumers).
- No side effects at module top level.
- No external runtime dependencies that the workspace does not
  already use.
