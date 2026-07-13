---
id: 03
title: Distinguish personal settings from org-scoped settings (rename /settings/* to /account/settings/*)
tier: 2
status: complete
effort: 1h30
date: 2026-07-13
resolved: 2026-07-13
related: [../../2026-07-10-apps-app/problems/09-settings-pages.md, ../../docs/guides/better-auth/org.md]
---

## Resolution (2026-07-13)

Implemented Option A from the fiche. The personal `/settings/*` namespace is now `/account/settings/*`. The legacy `/settings/*` paths are preserved as 3-line server-side redirects. The sidebar is split into `AccountNav` (5 personal items) and `OrgNav` (org items), selected by URL scope. Two entry points in the sidebar are now distinct:

- `OrgSettingsShortcut` (bottom-pinned, hidden when no org) → `/${orgSlug}/settings/members`
- `NavUser → Account` (avatar dropdown, always available) → `/account/settings/account`

### Files changed

- Created 9 new route files under `apps/app/app/(protected)/account/settings/**`
- Replaced 9 legacy `/settings/*` routes with 3-line redirect files
- Created `components/sidebars/account-nav.tsx` (5 personal items)
- Created `components/sidebars/org-nav.tsx` (org items)
- Deleted `components/sidebars/settings-nav.tsx` (split into the two above)
- Updated `components/sidebars/app-sidebar.tsx` (new helpers, conditional shortcut, scope-aware rendering)
- Updated `components/sidebars/sidebar-back-action.tsx` (scope-aware href)
- Updated `components/sidebars/nav-user.tsx` (`accountHref` → `/account/settings/account`)
- Updated `components/sidebar-back-action.tsx` (helpers split)
- Updated `lib/user-menu-items.ts` (docstring update)
- Updated `components/settings/profile-form.tsx` (link to email change)
- Updated `apps/app/proxy.ts` (matcher extended for `/account/settings/*`)
- Updated `packages/ui/src/lib/config.ts` (`settings: "/account/settings"`)
- Updated `docs/guides/better-auth/{index,org}.md` (URLs)
- Updated `.claude/agent-memory/tech-lead/apps/app.md` (structure + sidebar split)

### Verification

- `pnpm typecheck` ✅ pass
- `pnpm lint` ✅ pass
- `pnpm test:run` ✅ 22 tests pass (13 slug + 9 org-gating)

Manual smoke tests documented in the fiche's Verification section (13 checks).

## Context

The current URL namespace conflates two different scopes under the `settings` segment:

- **Personal settings** at `/settings/{profile,security,sessions,connections,account}` — 5 categories, 8 sub-pages, 1 index = 9 destinations owned by the user account.
- **Org-scoped settings** at `/${org_slug}/settings/members` — owned by the active organization.

The split exists structurally (the proxy matcher distinguishes `/settings/:path*` from `/:org_slug/settings/:path*`, and the OrgLayout only matches the org-scoped pattern). But the URL `settings` segment is ambiguous: a user with multiple orgs cannot tell at a glance whether `/settings/members` means "members of my current org" or "members of some specific org" — the org context is implied by sidebar state, not the URL itself.

Other SaaS apps (Linear, Notion, Stripe) make this distinction explicit at the URL level:

- **Personal**: `/account/settings/*` or `/settings/account/*`
- **Org-scoped**: `/[org]/settings/*` (already what we have)

This fiche proposes renaming the personal namespace to `/account/settings/*` to make the user-vs-org split unambiguous in the URL itself.

### Sidebar entry-point distinction (key clarification, 2026-07-13)

The sidebar currently has **two distinct "settings" entry points**, each with a different intent that the rename must respect:

| Entry point | Location | Current behavior | Intended scope (post-rename) |
|---|---|---|---|
| **`SettingsShortcut`** | bottom-pinned, always visible in sidebar (`components/sidebars/app-sidebar.tsx:42-70`) | Links to `/settings` (currently **personal**) | Should link to **org-scoped** `/${orgSlug}/settings/members` (or to a future `/${orgSlug}/settings` index). The pinned entry-point is "settings of the current work context" — i.e., the active org. |
| **`NavUser → Account`** | inside the avatar dropdown in the sidebar footer (`components/sidebars/nav-user.tsx:107`) | Links to `/settings/account` (currently **personal**) | Should keep pointing to **personal** `/account/settings/account`. The avatar menu is unambiguously the user's own context. |

The current code has **the two pointing at the same URL namespace** (`/settings`), which collapses two distinct UX concepts into one. The split:

- **SettingsShortcut** = "I want to configure the org I'm currently working in" → org-scoped URL
- **NavUser → Account** = "I want to manage my own account" → personal URL

Concretely:

- `SettingsShortcut` should be renamed to `OrgShortcut` (or kept as `SettingsShortcut` since "settings" still implies the current org). Hidden when no active org exists. Target: `/${orgSlug}/settings/members`.
- `NavUser → Account` keeps its label. Target: `/account/settings/account`.

The `SettingsNav` component (rendered when `inSettings`) currently mixes personal + org items. After the rename, it should **split by scope** based on the URL prefix:

- When on `/account/settings/*` → render `AccountNav` (5 personal items: Profile, Security, Sessions, Connections, Account)
- When on `/${org_slug}/settings/*` → render `OrgNav` (org items: Members, future Billing/Integrations)
- The `isSettingsPath` helper in `app-sidebar.tsx:66-70` and `sidebar-back-action.tsx:14` (currently `/settings` and `/settings/`) needs to be replaced with two helpers: `isAccountSettingsPath` and `isOrgSettingsPath`.

## Investigation

### Current structure

**Personal (9 destinations)**:
- `/settings` (index)
- `/settings/profile`
- `/settings/security`
- `/settings/security/password`
- `/settings/sessions`
- `/settings/connections`
- `/settings/account`
- `/settings/account/email`
- `/settings/account/delete`

**Org-scoped (1 destination, room to grow)**:
- `/${org_slug}/settings/members`

### Files that reference `/settings/*`

| Category | Files | Count |
|---|---|---|
| URL hardcodes | `app-sidebar.tsx:53`, `nav-user.tsx:107`, `lib/user-menu-items.ts:38`, `components/settings/profile-form.tsx:97`, `app/(protected)/settings/page.tsx:6-40`, `app/(protected)/settings/security/page.tsx:23`, `app/(protected)/settings/account/page.tsx:23,37` | 7 files, ~12 URL strings |
| Proxy matcher | `apps/app/proxy.ts:21,28,57` | 1 file, 3 strings |
| SettingsNav data | `components/sidebars/settings-nav.tsx:39-72` | 1 file, ~9 URL strings |
| Sidebar logic | `app-sidebar.tsx:42,53,66-70`, `sidebar-back-action.tsx:14,19,23` | 2 files, ~6 strings |
| Shared config | `packages/ui/src/lib/config.ts:15` (`settings: "/settings"`) | 1 file, 1 string |
| Memory | `.claude/agent-memory/tech-lead/apps/app.md` (multiple mentions) | 1 file |
| Docs | `docs/guides/better-auth/index.md` and `org.md` (indirect), `apps/web/README.md:128` | 2-3 files |
| Audit | `temp/audit/2026-07-10-apps-app/problems/09-settings-pages.md`, `12-stale-memory-file.md`, `08-sidebar-back-action.md` | 3 fiches |

### What's NOT affected

- `components/settings/*.tsx` (form components) — file paths and component names stay; only the route URLs they receive as props change.
- `apps/app/lib/active-org.ts`, `apps/app/lib/session.ts` — no settings references.
- `apps/app/components/invitations/*` — separate flow.
- The `SettingsCard` component (`components/settings/index.ts`) — reusable, agnostic of route.

### Why this matters more after 2026-07-13

With multi-org UX shipped, users can belong to several orgs and switch between them via the OrgSwitcher. The sidebar's `SettingsNav` already does the right thing (`orgScoped: true` flag prepends `/${orgSlug}`). But the URL namespace `settings` doesn't encode this distinction — a bookmarked `/settings/members` becomes ambiguous in a multi-org context (which org's members?). The rename to `/account/settings/*` makes the personal namespace's account-scope unambiguous, and reinforces that the only org-scoped settings are under `/${org_slug}/settings/*`.

### Doc drift to fix

The 2026-07-10 audit fiches (#09, #12, #08) currently use the `/settings/*` URL extensively. Once the rename ships, those fiches should be updated for archival accuracy — not because they still describe the live state, but to keep the audit trail honest about the rename having happened.

## Solution

### Recommendation: Option A — Rename personal to `/account/settings/*`

**The structure**:
- **Personal**: `/account/settings/{profile,security,sessions,connections,account}` (and children) — unambiguously the user's own account
- **Org-scoped**: `/[org_slug]/settings/{members,billing,...}` (unchanged) — unambiguously the current org's settings

**Sidebar entry-points** (per the clarification above):

- **`SettingsShortcut`** (bottom-pinned, visible always when not on settings) → **`/${orgSlug}/settings/members`** when an active org exists. Hidden when no active org (the user is in onboarding). Renamed concept: this is the "current org's settings" entry-point.
- **`NavUser → Account`** (in avatar dropdown) → **`/account/settings/account`** (or `/account/settings/profile` — pick the most-frequently-used landing page for personal). Renamed concept: this is the user's own account.

**Sidebar nav split**: `SettingsNav` becomes two components, selected by which scope the current URL is in:

- **`AccountNav`** — rendered when on `/account/settings/*`. Shows 5 personal items: Profile, Security, Sessions, Connections, Account.
- **`OrgNav`** — rendered when on `/${org_slug}/settings/*`. Shows org items: Members (and future Billing, Integrations).

Two helpers replace `isSettingsPath`:

```ts
function isAccountSettingsPath(pathname: string): boolean {
  return pathname === "/account/settings" || pathname.startsWith("/account/settings/")
}
function isOrgSettingsPath(pathname: string): boolean {
  // Reuse the existing regex shape: /:org_slug/settings(/|$)
  return /^\/[^/]+\/settings(\/|$)/.test(pathname)
}
```

### Migration strategy: server-side redirects

To preserve bookmarks and external links, add a one-step server-side redirect at each old path. Next.js handles this naturally — a server component that calls `redirect("/account/settings/...")` produces a 307 with no client-side code.

Two patterns:

**Pattern 1 — One file per old path** (9 files):

```tsx
// app/(protected)/settings/page.tsx (now a redirect)
import { redirect } from "next/navigation"
export default function SettingsLegacyRedirect() {
  redirect("/account/settings")
}
```

Pros: explicit, easy to grep.
Cons: 9 tiny files of boilerplate.

**Pattern 2 — Dynamic catch-all redirect**:

```tsx
// app/(protected)/settings/[...slug]/page.tsx
import { redirect } from "next/navigation"
export default async function SettingsLegacyRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug = [] } = await params
  const rest = slug.length > 0 ? `/${slug.join("/")}` : ""
  redirect(`/account/settings${rest}`)
}
```

Pros: one file, handles all paths including future ones.
Cons: less explicit, conflicts with the existing route group structure.

**Recommendation**: Pattern 1 — explicit, low cost (9 files × 4 lines each ≈ 30 lines total), and the templates stay close to the canonical pages for future auditing.

### Affected files

| File | Change |
|---|---|
| **Routes — moved** | `app/(protected)/settings/{profile,security,sessions,connections,account}/*` → `app/(protected)/account/settings/*` (same content, new path) |
| **Routes — replaced with redirects** | 8 paths under `app/(protected)/settings/*` |
| **Components — sidebar** | `components/sidebars/settings-nav.tsx` → split into `account-nav.tsx` + `org-nav.tsx`; `components/sidebars/app-sidebar.tsx` (SettingsShortcut target → `/${orgSlug}/settings/members`, conditional on `orgSlug`; `isSettingsPath` → two helpers); `components/sidebars/sidebar-back-action.tsx` (same two helpers) |
| **Components — user** | `components/sidebars/nav-user.tsx` (accountHref → `/account/settings/account`), `lib/user-menu-items.ts` (default accountHref) |
| **Components — forms** | `components/settings/profile-form.tsx:97` (link href) |
| **Proxy** | `apps/app/proxy.ts:21,28,57` — match `/account/settings/:path*` instead of `/settings/:path*` (and add a fallback matcher for the legacy `/settings/*` that lets it pass through to the redirect files) |
| **Shared config** | `packages/ui/src/lib/config.ts:15` — `settings: "/account/settings"` (or split into `accountSettings` + `orgSettings`) |
| **Memory** | `.claude/agent-memory/tech-lead/apps/app.md` — update route group structure section |
| **Docs** | `docs/guides/better-auth/{index,org}.md` if they reference settings routes (verify during impl) |
| **Audit** | `temp/audit/2026-07-10-apps-app/problems/{08,09,12}-*.md` — archival accuracy update |

### Out of scope

- Renaming `/${org_slug}/settings/*` to something like `/${org_slug}/admin/*` — keeps current path, which is already unambiguous (the `:slug` makes org-scope explicit). Defer until someone proposes it.
- Adding more org-scoped settings pages (billing, integrations) — not part of this rename; do separately if needed.
- Changing `SettingsCard` component naming (e.g., to `AccountCard` / `OrgCard`) — over-scope; the component is reusable and agnostic of route.

---

### Alternative: Option B — Keep `/settings/*`, add visual disambiguation only

Update the `SettingsNav` to render an "Account settings" heading above personal items and an "Organization settings" heading above org items. No URL change.

**Pros**: zero migration cost, no redirect files.
**Cons**: URLs remain ambiguous; the user's stated goal ("avoir /account/settings et /[org]/settings") requires URL-level distinction.

**Not recommended** — doesn't address the user's concern.

---

### Alternative: Option C — Move both under explicit prefixes

- Personal → `/account/settings/*` (as Option A)
- Org → `/${org_slug}/org/*` or `/${org_slug}/admin/*` (instead of `${org_slug}/settings/*`)

**Pros**: fully explicit; `org` or `admin` keyword on every org-scoped URL.
**Cons**: doubles the migration surface; org-scoped URLs already unambiguous thanks to `:slug`; more disruptive for existing links (any `/${slug}/settings/members` bookmarks break).

**Not recommended** — extra churn for marginal gain.

## Verification (after implementation)

1. Visit `/settings` (old URL) → expect 307 redirect to `/account/settings` → index renders.
2. Visit `/settings/profile` → expect 307 redirect to `/account/settings/profile` → form renders.
3. Visit `/settings/security/password` → expect 307 redirect to `/account/settings/security/password`.
4. Visit `/account/settings` directly → expect 200, page renders normally.
5. **Sidebar bottom-pinned shortcut** (with active org) → expect target `/${orgSlug}/settings/members`, label "Settings", lands on org members page.
6. **Sidebar bottom-pinned shortcut** (without active org) → expect **hidden** (user is in onboarding flow; clicking Settings would be confusing).
7. **Avatar dropdown → Account** → expect target `/account/settings/account`, lands on personal account page.
8. Navigate to `/account/settings/profile` → sidebar shows `AccountNav` (Profile, Security, Sessions, Connections, Account).
9. Navigate to `/${orgSlug}/settings/members` → sidebar shows `OrgNav` (Members).
10. `SidebarBackAction` on `/account/settings/*` → "Back to home" links to `/` (dispatcher routes).
11. `SidebarBackAction` on `/${orgSlug}/settings/*` → "Back to home" links to `/${orgSlug}/home`.
12. DevTools → Network → confirm 307s on legacy URLs and 200s on new URLs.
13. Check that `proxy.ts` still allows access to legacy `/settings/*` URLs (the redirect files need to pass through the proxy).

## References

- `apps/app/proxy.ts:21,28,57` — current settings matchers
- `apps/app/components/sidebars/settings-nav.tsx` — current mixed-account+org sidebar nav data
- `apps/app/components/sidebars/app-sidebar.tsx:42-70` — `SettingsShortcut` (currently → `/settings`, should become → `/${orgSlug}/settings/members`) + `isSettingsPath` helper (to be split into two)
- `apps/app/components/sidebars/sidebar-back-action.tsx:14` — same `isSettingsPath` logic duplicated
- `apps/app/components/sidebars/nav-user.tsx:107` — accountHref (should remain personal: `/account/settings/account`)
- `apps/app/lib/user-menu-items.ts:38` — default accountHref
- `apps/app/components/settings/profile-form.tsx:97` — internal link to email change
- `packages/ui/src/lib/config.ts:15` — shared `settings` link (consider splitting into `accountSettings` + `orgSettings`)
- `apps/app/app/(protected)/settings/page.tsx:6-40` — settings index with hardcoded hrefs
- `temp/audit/2026-07-10-apps-app/problems/09-settings-pages.md` — audit that verified completeness
- `temp/audit/2026-07-10-apps-app/problems/08-sidebar-back-action.md` — references `/settings/*` paths
- `.claude/agent-memory/tech-lead/apps/app.md` — memory file (route group structure section)