# Better-Auth — Organization Plugin

Organization management with memberships, roles, and invitations. See [`index.md`](./index.md) first and read [`hooks.md`](./hooks.md) before this guide.

> **⚠️ Stale sections — pending issue #12 (last touched 2026-07-28)**
>
> Several sections below describe code that **does not exist** in `packages/auth/src/auth.ts` today:
>
> | Section | Describes | Real state (2026-07-28) |
> |---|---|---|
> | §"Auto-Create Org on Signup" | `databaseHooks.session.create.before` + `slugify()` | **No `databaseHooks` configured.** Auto-create on signup is intentionally NOT implemented (commit `73830a1` + `NO_ORG_RECOVERY.md`). |
> | §"Sending Invitations" + §"Invitation Email" | `sendInvitationEmail` callback hooked into plugin options | **No `sendInvitationEmail` configured.** Invitations will fail server-side email-send until wired. |
> | §"afterAcceptInvitation — Set Active Org" | `organizationHooks.afterAcceptInvitation` calling `setActiveOrganization` | **No `organizationHooks` configured.** |
> | §"Organization Lifecycle Hooks" | `organizationHooks.beforeCreateOrganization` / `afterCreateOrganization` / `beforeDeleteOrganization` | **No `organizationHooks` configured.** |
> | §"Slug generation" | Standalone `slugify()` function (40 char max, URL-safe) | **Function lives in this guide only** — not exported from any package. |
>
> What IS configured today in `packages/auth/src/auth.ts`: just `organization({ requireEmailVerificationOnInvitation: true })` + `nextCookies()`. Nothing else. The schema (`packages/database/src/schema/auth.ts`) does not yet contain the `organization` / `member` / `invitation` / `team` tables.
>
> **Do not treat this guide as documentation of current behavior.** It is a design draft pending the work in branch `impl/12-feat-auth-wire-organization-plugin-with-auto-creat`. After #12 lands (or is split into smaller issues), this guide should be rewritten to match the implemented surface. Tracked in `docs/internal/specs/organizations/` (7 sub-specs).
>
> Sections that ARE accurate today: §"Roles" (better-auth built-ins, no project-specific overrides yet), §"Custom Roles" (reference design, not yet wired), §"Email Verification Requirement" (matches `requireEmailVerificationOnInvitation: true`), §"Membership Limits" and §"Restrict Org Creation" (option reference — not configured, will be when plans/billing land).

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

## Auto-Create Org on Signup

We do **not** use `autoCreateOrganizationOnSignUp` — it was removed (see [`pitfalls.md`](./pitfalls.md) §1). Instead, the org is created in `databaseHooks.session.create.before`. See [`hooks.md`](./hooks.md) for the full implementation.

**Source:** [PR #4755](https://github.com/better-auth/better-auth/pull/4755) — removal of the unimplemented option. [Issue #4334](https://github.com/better-auth/better-auth/issues/4334) — original report.

Slug generation (40 char max, URL-safe):

```ts
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}
```

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

**Note on [#9710](https://github.com/better-auth/better-auth/issues/9710):** `setActiveOrganization` updates the server session row correctly, but `useActiveOrganization()` on the client may still return stale `null`. See [`pitfalls.md`](./pitfalls.md) §3 for the workaround.

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
