# `apps/app` Audit — 2026-07-13 — Multi-org UX gap

> **Branch**: `feat/apps-app-completeness`
> **Status**: Investigation complete, awaiting scope decision.
> **Trigger**: User flagged during post-audit review (2026-07-10 audit marked `apps/app` as ship-ready; this gap was missed).

This audit captures **one specific gap** discovered after the 2026-07-10 audit was finalized: `apps/app` advertises a "Create new organization" action in the sidebar but provides no working route for users who already have an organization.

## TL;DR

`apps/app/components/sidebars/org-switcher.tsx:133-142` renders a `<Link href="/organizations/new">Create new organization</Link>` (after the 2026-07-13 fix). Two distinct routes now serve two distinct contexts:

- **`/onboarding`** — first-time setup wizard for users with no organizations (gates on `listUserOrganizations().length > 0` → redirects to first org home).
- **`/organizations/new`** — additional-organization creation page for users who already have orgs. No first-org gating.

The dispatcher (`apps/app/app/page.tsx`) routes:
- Has active org → `/${activeOrgSlug}/home`
- Has orgs but no active → `/${firstOrg.slug}/home` (OrgLayout aligns the cookie)
- No orgs → `/onboarding`

## Outline

- [Why a separate audit?](#why-a-separate-audit)
- [Relationship to 2026-07-10 audit](#relationship-to-2026-07-10-audit)
- [Decision needed](#decision-needed)
- [Problems index](#problems-index)
- [Proposed sequence](#proposed-sequence)

## Outline

- [Why a separate audit?](#why-a-separate-audit)
- [Relationship to 2026-07-10 audit](#relationship-to-2026-07-10-audit)
- [Decision needed](#decision-needed)
- [Problems index](#problems-index)
- [Proposed sequence](#proposed-sequence)

## Why a separate audit?

The 2026-07-10 audit (`temp/audit/2026-07-10-apps-app/`) verified `/onboarding` as "complete for template scope" (fiche #06). That verification was correct **for the first-org case**. It did not consider the multi-org UX because:

- Fiche #06 only traced the post-signup flow (`/signup → /verify-email → /onboarding → /home`).
- The `OrgSwitcher`'s "Create new organization" entry point was not in the audit's investigation surface.
- Multi-org support is enabled by default in better-auth (`allowUserToCreateOrganization` is not set to `false`), so the system *can* handle it — the template just doesn't expose the UI.

This audit captures the gap, the decision tree, and the implementation options.

## Relationship to 2026-07-10 audit

| Fiche | Status after this finding |
|---|---|
| `2026-07-10-apps-app/problems/06-onboarding-flow.md` | Incomplete — verify status needs update: "complete for first-org only; multi-org UX missing" |
| `2026-07-10-apps-app/problems/09-settings-pages.md` | Incomplete — no "Create organization" entry; the `OrgSwitcher` link is the de-facto entry point and is broken |
| `2026-07-10-apps-app/problems/12-stale-memory-file.md` | Should mention the missing `/organizations/new` route in the rewrite |
| `2026-07-10-apps-app/research-findings.md` | No update needed (no new external research) |

## Decision needed

**Resolved: Yes — multi-org is in scope.**

Both fiches shipped on 2026-07-13. See the resolution sections in each fiche for the implementation details.

## Problems index

### Tier 2 — investigated, complete

- [01-create-organization-route](./problems/01-create-organization-route.md) — **complete (2026-07-13)**. Created `/organizations/new`, restored `/onboarding` as first-org wizard, updated dispatcher, OrgSwitcher link, docs.
- [02-login-active-org-not-restored](./problems/02-login-active-org-not-restored.md) — **complete (2026-07-13, resolved-by-proxy)**. The dispatcher now routes "has-orgs-no-active" to `/${firstOrg.slug}/home`, where the OrgLayout aligns the cookie via `setActiveOrganization`. The user no longer gets stuck on `/onboarding` after login.

## Proposed sequence

All implementation is done. Remaining work (post-ship) is verification (manual smoke tests) and follow-up audits:

1. Manual smoke tests (see verification sections in each fiche).
2. Follow-up audit tickets: consider a `/select-org` page for multi-org users (currently auto-picks the first org from `listOrganizations` ordering — likely fine, may need UX refinement).

## Cross-cutting notes

- **The fix preserves the anti-#9710 property**: `<CreateWorkspaceForm />` calls `orgClient.organization.create` (client-side), which correctly invalidates `$activeOrgSignal` and `$sessionSignal`. See `apps/app/lib/auth-client.ts:6-15` and `docs/guides/better-auth/org.md:27-37` for the rationale.
- **The fix is orthogonal to the `app-architecture` agent memory**: `apps/app.md` was rewritten on the same day (see `temp/audit/2026-07-10-apps-app/problems/12-stale-memory-file.md`) to document the new structure including the two distinct routes.
- **Doc drift fixed**: `docs/guides/better-auth/org.md` previously claimed `proxy.ts` redirects users without `activeOrganizationId` to `/onboarding`. That was wrong (proxy only enforces auth + auth-page bounce). The doc now correctly attributes the redirect to the dispatcher and explains the two-route architecture.
- **No new external research needed**: the better-auth docs referenced in the 2026-07-10 `research-findings.md` cover everything. This audit reuses that context.