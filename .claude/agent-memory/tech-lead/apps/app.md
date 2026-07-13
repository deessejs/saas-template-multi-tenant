---
name: app-architecture
description: apps/app — authenticated app (login/signup/dashboard/settings) with org-scoped [org_slug] routes, separate Next.js deploy from apps/web
metadata:
  type: project
---

# apps/app — Authenticated app

**Role**: authenticated app only. Login, signup, dashboard, settings. Separate Next.js deploy from [[web-architecture]].

- Public marketing / blog / changelog / legal pages live in `apps/web`, NOT here.
- When `apps/web` links to `/login` or `/signup`, those routes live in this app.
- Both apps share `packages/ui` for components and `packages/ui/lib/config` for `APP_CONFIG`.

## Route group structure

```
app/
├── layout.tsx                    ← root: ThemeProvider + TooltipProvider + globals.css
├── page.tsx                      ← root dispatcher (5-state cascade, see below)
├── proxy.ts                      ← Next.js 16 middleware: auth gate + auth-page bounce only
├── (unprotected)/
│   ├── layout.tsx                ← SiteHeader wrapper (public pages)
│   ├── (auth)/
│   │   ├── layout.tsx            ← centered auth card (max-w-md)
│   │   ├── login/page.tsx        → /login
│   │   ├── signup/page.tsx       → /signup
│   │   ├── forgot-password/...
│   │   ├── reset-password/...
│   │   └── verify-email/...
└── (protected)/
    ├── layout.tsx                ← SidebarProvider + AppSidebar + SidebarInset + SidebarTrigger
    ├── onboarding/page.tsx       → /onboarding (first-org wizard only, since 2026-07-13)
    ├── organizations/new/page.tsx → /organizations/new (additional-org creation)
    ├── accept-invitation/page.tsx → /accept-invitation?id=...
    ├── account/settings/         ← PERSONAL settings (renamed 2026-07-13; legacy /settings/* still 307-redirects here)
    │   ├── page.tsx              → /account/settings (index)
    │   ├── profile/, security/ (with password/), sessions/, connections/
    │   └── account/ (with email/, delete/)
    ├── settings/                 ← LEGACY alias — server-side redirect to /account/settings/*
    │   └── ...                   (all 9 paths preserved as 3-line redirect files)
    └── [org_slug]/               ← ORG-SCOPED routes (URL = source of truth)
        ├── layout.tsx            ← 4-branch gating (auth / email / membership / alignment)
        ├── home/page.tsx         → /${slug}/home
        └── settings/
            └── members/page.tsx  → /${slug}/settings/members (MembersManager)
```

## Auth gate — `proxy.ts`

Next.js 16 middleware. Explicit matcher + two-question rule (signed in? email verified?). Sends traffic to `/login` or `/verify-email` as needed. Accept-invitation is exempt so unauth'd invitees can land and sign in.

## Root dispatcher — `app/page.tsx`

Session-aware 5-state cascade (since 2026-07-13):

| State | Redirect |
|---|---|
| No session | `/login` |
| Session + unverified email | `/verify-email` |
| Session + verified + active org in cookie | `/${activeOrgSlug}/home` |
| Session + verified + has orgs + no active pointer | `/${firstOrg.slug}/home` (OrgLayout aligns cookie via `setActiveOrganization`) |
| Session + verified + no orgs at all | `/onboarding` (first-org wizard) |

`/organizations/new` is **not** a dispatcher destination — only reachable via the OrgSwitcher's "Create new organization" entry point.

## Org-scoped layout — `[org_slug]/layout.tsx`

4-branch gating (`resolveOrgAccess` shape):

1. `!session?.user` → `/login`
2. `!session.user.emailVerified` → `/verify-email`
3. `listOrganizations` lookup; if no match for URL slug → `/onboarding` (re-onboard flow, also covers "user not member of this org")
4. URL ↔ cookie alignment: if active org ≠ URL slug, server-side `setActiveOrganization({ organizationSlug: slug })`. No redirect — layout renders children.

## Multi-org UX

**Template supports multi-org.** `allowUserToCreateOrganization` is at better-auth default (not disabled). `OrgSwitcher` lists all user's orgs and exposes a "Create new organization" entry that links to `/organizations/new`.

Two distinct routes serve two distinct contexts (since the 2026-07-13 fix — see `temp/audit/2026-07-13-apps-app-organizations-new/`):

- `/onboarding` — first-time setup wizard for users with no orgs. Page gates: if user has orgs, redirects to first org home.
- `/organizations/new` — additional-organization creation page for users who already have orgs. Reachable only via OrgSwitcher.

The "active org not restored after login" symptom (better-auth does not auto-restore `activeOrganizationId` on sign-in) is currently masked by the dispatcher routing "has-orgs + no-active" → `/${firstOrg.slug}/home`, where the OrgLayout alignment step calls `setActiveOrganization` server-side.

## Sidebar

Built from **shadcn sidebar-07 block**.

### Files

```
apps/app/components/sidebars/
├── app-sidebar.tsx           ← main wrapper, data provider; renders AccountNav/OrgNav/NavMain based on URL scope; hides OrgSettingsShortcut when no orgSlug
├── org-switcher.tsx          ← multi-org dropdown (logo, name, list, "Create new organization")
├── account-nav.tsx           ← personal items (Profile, Security, Sessions, Connections, Account); rendered on /account/settings/*
├── org-nav.tsx               ← org items (Members); rendered on /${org_slug}/settings/*
├── sidebar-back-action.tsx   ← "Back to home" on /account/settings/* or /${org_slug}/settings/* (scope-aware)
├── nav-main.tsx              ← collapsible nav sections
├── nav-projects.tsx          ← project list with actions
└── nav-user.tsx              ← avatar dropdown (Account → /account/settings/account, Log out)
```

**Two distinct settings entry-points** (since the 2026-07-13 rename):

- **`OrgSettingsShortcut`** (bottom-pinned, in `app-sidebar.tsx`) → `/${orgSlug}/settings/members`. **Hidden when no active org.** This is "settings of the current work context".
- **`NavUser → Account`** (in avatar dropdown) → `/account/settings/account`. Always available. This is "manage my own account".

### Key patterns

- `SidebarHeader className="flex h-14 flex-row items-center border-b p-0"` — h-14 + flex-row overrides shadcn default `flex-col gap-2 p-2`
- `SidebarFooter className="border-t"` — same override pattern
- Sidebar swaps content based on pathname: `OrgSwitcher + SidebarBackAction + SettingsNav` on settings; `NavMain + NavProjects + NavUser` otherwise
- OrgSwitcher logo: `Image` from `next/image` (not Radix Avatar)
- NavUser: builds Vercel avatar URL from `username`

### Vercel avatar URL pattern

```
https://vercel.com/api/www/avatar?s=40&u=${username}
```

Required `next.config.ts` flags: `dangerouslyAllowSVG: true`, `dangerouslyAllowLocalIP: true`, `images.remotePatterns: [{ hostname: "vercel.com", pathname: "/api/www/avatar" }]`. All justified by Vercel avatar endpoint.

## Shared helpers — `apps/app/lib/`

| File | Purpose |
|---|---|
| `session.ts` | `getSession()` — server-only, calls `auth.api.getSession` with `headers()` |
| `auth-client.ts` | `createAuthClient` + `organizationClient()` — exposes `useSession`, `useActiveOrganization`, `useListOrganizations` |
| `active-org.ts` | `getActiveOrgSlug()` — server-only, resolves active org's slug. `listUserOrganizations()` — server-only, returns the user's orgs |
| `use-active-org-slug.ts` | client-side hook variant for `OrgSwitcher` / `SettingsNav` |
| `slug.ts` | `deriveSlug`, `isSlugAvailable`, `findAvailableSlug` (with retry-on-collision) |
| `orpc.ts` | oRPC client setup |
| `user-menu-items.ts` | shared nav items for NavUser |

## API

`apps/app/app/api/[[...route]]/route.ts` — Hono catch-all. Currently has `export const dynamic = "force-dynamic"`; will be removable when `nextConfig.cacheComponents: true` (project-wide decision, tracked in 2026-07-10 audit #11).

## Shared config

`packages/ui/src/lib/config.ts` — consumed as `import { APP_CONFIG, APP_NAME } from "@workspace/ui/lib/config"`.

## Shared imports to avoid

- `@/lib/config` — deprecated, use `@workspace/ui/lib/config`
- `@/hooks/use-mobile` — exists in `apps/app/hooks/use-mobile.ts` but has no callers in `apps/app/` (verified 2026-07-13). **Explicitly NOT tracked for deletion** per user decision — the prior fiche #04 that proposed deletion was removed, the hook stays as-is. When `useIsMobile` is needed, import from `@workspace/ui/hooks/use-mobile` instead.
- `lucide-react` must be in catalog (`packages/ui` and `apps/app` both have it)

## Tests

`apps/app/vitest.config.ts` — minimal: alias `@`, glob `lib/**/*.test.ts`. Setup file and app/component globs TBD (see 2026-07-10 audit #03). Current tests: `lib/slug.test.ts` covers `deriveSlug` and `findAvailableSlug`.

Related: [[stack]] (Tailwind v4 + pnpm allowBuilds gotchas), [[package-structure]], [[better-auth]] (decision log)