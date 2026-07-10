# Better-Auth — Organization Plugin

Organization management with memberships, roles, and invitations. See [`index.md`](./index.md) first and read [`hooks.md`](./hooks.md) before this guide.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — full plugin documentation.

---

## Plugin Registration

```ts
import { organization } from "better-auth/plugins"
import { organizationPluginOptions } from "./shared-options"

export const auth = betterAuth({
  plugins: [
    organization({
      ...organizationPluginOptions,
    }),
    nextCookies(), // must be last
  ],
})
```

---

## User-Created Org via Onboarding

The first organization is created explicitly by the user at `/onboarding` after sign-up, not via a `databaseHooks` server-side auto-create. This avoids the stale-`useActiveOrganization()` state described in [better-auth #9710](https://github.com/better-auth/better-auth/issues/9710): `authClient.organization.create` is a client-driven mutation that correctly invalidates `$activeOrgSignal` and `$sessionSignal`.

Flow: `/signup → /onboarding → authClient.organization.create({ name, slug }) → /home`.

The `slug` is required by better-auth's endpoint (`crud-org.mjs:14` — `slug: z.string().min(1)`) and is **not** derived server-side. Derivation lives in `apps/app/lib/slug.ts` (`deriveSlug(name)`), with collision detection via `authClient.organization.checkOrganizationSlug` and retry on race conditions. See `temp/reports/auth/2026-07-10-organization-create-requires-slug-400.md` for the full design.

The proxy guard at `apps/app/proxy.ts:68-75` redirects any signed-in user without `activeOrganizationId` (excluding `/accept-invitation`) to `/onboarding`. The routing is already in place; only the page itself is required.

**Why we don't auto-create server-side anymore:** the previous approach (`databaseHooks.session.create.before` calling `auth.api.createOrganization`) bypassed the client-side atom invalidation entirely, since the mutation never went through a better-auth client call. PRs [#9736](https://github.com/better-auth/better-auth/pull/9736) and [#9737](https://github.com/better-auth/better-auth/pull/9737) on the better-auth side would have fixed the invalidation; instead, we removed the auto-create and made the org creation a normal client-driven action.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `create` reference.

---

## Roles

Three default roles ship with the plugin:

| Role | Description |
|---|---|
| `owner` | Full control. Created the org. Cannot be deleted. |
| `admin` | Full control except deleting the org or changing the owner. |
| `member` | Read-only access to org data. |

Users can hold **multiple roles** (stored as a comma-separated string). The creator of an org gets the `owner` role.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — membership roles section.

### Custom Roles

For custom permissions, use `createAccessControl`:

```ts
import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements, adminAc } from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
  project: ["create", "share", "update", "delete"],
} as const

const ac = createAccessControl(statement)
const projectAdmin = ac.newRole({ project: ["create", "update"], ...adminAc.statements })
```

Pass to both server and client plugins:
```ts
organization({ ac, roles: { owner, admin, member, projectAdmin } })
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `createAccessControl` and custom permissions.

---

## Invitations

### Sending Invitations

Call `auth.api.createInvitation` (server-side) or `authClient.organization.invite` (client-side):

```ts
// Server
const invitation = await auth.api.createInvitation({
  body: {
    organizationId: "org-id",
    email: "invitee@example.com",
    role: "member",
  },
  headers: await headers(),
})
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `createInvitation` API.

### Invitation Email

Configure `sendInvitationEmail` in `organizationPluginOptions`:

```ts
sendInvitationEmail: async ({ email, organization: org, inviter, invitation }) => {
  const inviteLink = `${serverEnv.BETTER_AUTH_URL}/accept-invitation?id=${invitation.id}`
  void sendAuthEmail({
    to: email,
    subject: `Join ${org.name}`,
    react: templates.InvitationEmail({
      inviteLink,
      organizationName: org.name,
      inviterName: inviter.user?.name ?? inviter.user?.email ?? "Someone",
      inviterEmail: inviter.user?.email ?? "",
      role: invitation.role ?? "member",
      expiresAt: new Date(invitation.expiresAt),
    }),
    tags: [{ name: "flow", value: "invitation" }],
    idempotencyKey: invitation.id,
  })
},
```

`invitation.role` may be `undefined` — default to `"member"`.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `sendInvitationEmail` signature.

### Email Verification Requirement

We set `requireEmailVerificationOnInvitation: true`. This means:
- Accepting, rejecting, or viewing an invitation requires the session email to be verified
- The sender's email does not need to be verified (only the invitee's)

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `requireEmailVerificationOnInvitation` docs.

---

## afterAcceptInvitation — Set Active Org

After accepting an invitation, set the invited org as the active org:

```ts
organizationHooks: {
  afterAcceptInvitation: async ({ organization: org }) => {
    await (auth.api as any).setActiveOrganization({
      body: { organizationId: org.id },
      headers: new Headers(),
    })
  },
},
```

The `acceptInvitation` path matches the organization plugin's atomListeners (`path === "/organization/accept-invitation"`), which invalidates `$activeOrgSignal` and `$sessionSignal` on the client. No hard reload is needed after accepting.

## URL as the Source of Truth (Org-Scoped Routing)

Once the dashboard is org-scoped (see `temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md`), the **URL is the authoritative org selector**. `useActiveOrganization()` must agree with `params.org_slug`. Mismatches are resolved in one direction only:

- **URL → state:** when the user navigates to `/${someOrgSlug}/home` and `someOrgSlug` differs from the active org, `app/(protected)/[org_slug]/layout.tsx` calls `auth.api.setActiveOrganization({ organizationSlug: someOrgSlug })` server-side to bring the cookie in line. The user is allowed through only if they are a member of `someOrgSlug`; otherwise they are redirected to `/onboarding`.
- **State → URL:** when `OrgSwitcher` switches the active org, it calls `router.push(`/${newOrg.slug}/home`)` (via `useRouter`) so the URL stays in sync. Without this, the sidebar items and breadcrumb-style UI updates would race against the URL.

Helper functions:
- Server: `getActiveOrgSlug()` in `apps/app/lib/active-org.ts` (resolves `session.session.activeOrganizationId` → `slug` via `auth.api.listOrganizations`).
- Client: `useActiveOrgSlug()` in `apps/app/lib/active-org.ts` (wraps `useActiveOrganization()` and extracts `.slug`).

Both return `null` when the user has no active org.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `afterAcceptInvitation` hook.

---

## Organization Lifecycle Hooks

Use `organizationHooks` (not the legacy `organizationCreation` hooks):

```ts
organizationHooks: {
  beforeCreateOrganization: async ({ organization, user }) => {
    // Enrich or validate before creation
    return { data: { ...organization, metadata: { source: "signup" } } }
  },
  afterCreateOrganization: async ({ organization, member, user }) => {
    // Setup resources, send notifications
  },
  beforeDeleteOrganization: async ({ organization, user, member }) => {
    // Guard: only owners can delete
    import { APIError } from "better-auth/api"
    if (member.role !== "owner") {
      throw new APIError("FORBIDDEN", { message: "Only owners can delete an org" })
    }
  },
},
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `organizationHooks` section with full hook list.

---

## Membership Limits

Default: 100 members per org. Configurable per organization:

```ts
organization({
  membershipLimit: async (organization) => {
    const plan = await getPlan(organization.id)
    return plan === "pro" ? 1000 : 100
  },
})
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `membershipLimit`.

---

## Restrict Org Creation

Control which users can create orgs:

```ts
organization({
  allowUserToCreateOrganization: async (user) => {
    const subscription = await getSubscription(user.id)
    return subscription.plan !== "free"
  },
})
```

When set to `false`, only server-side `auth.api.createOrganization` (without session headers) can create orgs on behalf of a user.

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `allowUserToCreateOrganization`.
