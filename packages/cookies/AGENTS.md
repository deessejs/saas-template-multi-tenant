# `@workspace/cookies` — agent invariants

## Strictly client-only

The consent store uses browser-only persistence; at least one component
wraps a framework primitive that only exists in a browser context.

**Do not import this package from:**

- Route handlers.
- Server components.
- Next.js middleware.
- Any server-side package (`@workspace/database`, `@workspace/auth`,
  `@workspace/api`, `@workspace/email`).

If a server-side script needs to know what the user consented to, that
state is recorded separately on the server (via API or DB) — the
consent UI is not the enforcement. They are two concerns that happen to
share a name; conflating them quietly turns a UX preference into a
compliance claim that the codebase cannot back up.

## Store is a singleton per browser

One store per browser, not per consumer. Components subscribe to it.
Creating a second store instance means two sources of truth for the
same domain — re-implementing synchronisation that the singleton
already provides.

## Bump the version to re-prompt; never wipe the stored choice

The consent store carries a version number that reflects the current
set of categories. When categories change:

- **Do** bump the version. Existing users with a stale version are
  re-prompted on next visit.
- **Do not** reset the stored accepted state. A silent reset wipes
  consent without warning the user; a version bump is the explicit,
  user-visible signal that the choice needs to be re-made.
