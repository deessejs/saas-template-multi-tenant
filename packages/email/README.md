# `@workspace/email`

Transactional email transport and templates. The single place that knows
how to send emails in this workspace.

Built on **React Email** for templates (re-renderable in any preview)
and a **swappable transport** for sending — console in dev, an external
provider (Resend by default) in prod.

## Why a separate package

The mailer sits at a boundary that mixes:

- A **server-only side-effect** — network I/O to a third-party provider.
- A **pure-rendering side** — React Email components that need to look
  right in any preview (tests, design tools, client previews).

Splitting them keeps the rendering reusable in contexts that must not
trigger a real send, and concentrates the "what if this fails / retries /
duplicates" concerns in one place.

## What this package owns

- A single mailer singleton with a swappable transport (console in dev,
  the production provider in prod).
- React Email templates exposed under a namespace.
- One entry point — the send function — whose contract enforces
  fire-and-forget semantics so the rest of the codebase does not have to
  remember the rule.

Everything else (preferences UI for opting out, retries, queues,
unsubscribe links) belongs in the consuming app or a sibling package. This
package is the mail boundary, not the entire communications surface.
