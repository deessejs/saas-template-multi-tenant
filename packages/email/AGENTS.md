# `@workspace/email` — agent invariants

## Never `await` the send

Awaiting the send turns the call site into a measurable timing oracle
that distinguishes valid from invalid recipients. The send function is
explicitly `async` to make the contract visible; the caller is
*responsible* for the `void` prefix. Forgetting it is a security bug, not
a performance bug — code review should treat `await send(...)` as a
rejection-worthy mistake.

For repeat-prone flows (resend verification, accept-invitation), pass an
idempotency key. The transport threads it through to whatever dedup
mechanism the active provider exposes. Without it, a misclick is a
duplicate send that costs quota.

## Server-only

The package depends on the server env, the provider SDK, and React-
Email's render pipeline. None of it belongs in a browser bundle.
Importing it from a client component does not just waste bytes — it
leaks server env reads into the build graph.

If you need to preview a template client-side, import the React
component directly. Do not call the send function from a client
component.

## The transport is a singleton — it swaps at module load

The mailer is a process-wide singleton built once from the active
transport at module load. Switching providers at runtime is not
supported; it requires a process restart. Tests assert on the call (via
a spy), not on swapping transports behind the singleton's back.

The provider requires a verified `from` address. Unverified sends fail
loudly in prod and silently in any environment whose transport does not
validate the field — so the failure shows up only after deploy, when it
is most expensive. Pick the `from` against a domain you control; do not
rely on sandbox defaults.
