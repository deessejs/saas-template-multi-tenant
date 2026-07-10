# Better-Auth — Client Integration

React hooks, auth client setup, and the active organization signal. See [`index.md`](./index.md) first and read [`pitfalls.md`](./pitfalls.md) before implementing anything.

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — React client reference. [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — organization client plugin.

---

## Auth Client Setup

```ts
// apps/app/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [organizationClient()],
})
```

The client is instantiated in the Next.js app. It reads from:
- `NEXT_PUBLIC_APP_URL` (for `baseURL`)
- Browser cookies (for session token)

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — `createAuthClient`.

---

## useSession

```ts
import { useSession } from "better-auth/react"

const { data: session, isLoading } = useSession()
```

Returns:
- `session.user` — the user object
- `session.session` — the session object (includes `activeOrganizationId`)
- `session.session.expiresAt` — session expiry
- `isLoading` — `true` while fetching session state

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — `useSession`.

---

## useActiveOrganization — Core API

```ts
import { useActiveOrganization } from "better-auth/react"

const { activeOrganization, isLoading } = useActiveOrganization()
```

Returns:
- `activeOrganization` — the full org object if set, `null` otherwise
- `isLoading` — `true` while fetching

To set the active org:

```ts
await authClient.organization.setActive({
  organizationId: "org-id",
})
```

Or by slug:

```ts
await authClient.organization.setActive({
  organizationSlug: "my-workspace",
})
```

To unset:

```ts
await authClient.organization.setActive({
  organizationId: null,
})
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `setActiveOrganization` type and client API.

---

## useAuth

```ts
import { useAuth } from "better-auth/react"

const { user, session, isLoading } = useAuth()
```

Shorthand for `useSession()` + direct user access. `user` is `null` when not authenticated.

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — `useAuth`.

---

## Sign In / Sign Up

```ts
// Sign in with email + password
const { data, error } = await authClient.signIn.email({
  email: "alice@example.com",
  password: "...",
})

// Sign up
const { data, error } = await authClient.signUp.email({
  email: "alice@example.com",
  password: "...",
  name: "Alice",
})
```

With error handling (important when `requireEmailVerification: true`):

```ts
await authClient.signIn.email(
  { email, password },
  {
    onError: (ctx) => {
      if (ctx.error.status === 403) {
        // Email not verified
        toast.error("Please verify your email address first.")
      }
    },
  }
)
```

**Source:** [better-auth.com/docs/authentication/email-password](https://better-auth.com/docs/authentication/email-password) — `signIn.email`, `signUp.email`. [better-auth.com/docs/client](https://better-auth.com/docs/client) — `onError` callback pattern.

---

## Sign Out

```ts
await authClient.signOut({
  callbackUrl: "/",
})
```

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — `signOut`.

---

## Send Verification Email

```ts
await authClient.sendVerificationEmail({
  email: "alice@example.com",
  callbackURL: `${window.location.origin}/auth/verify-email`,
})
```

**Source:** [better-auth.com/docs/authentication/email-password](https://better-auth.com/docs/authentication/email-password) — `sendVerificationEmail`.

---

## Organization Membership

List the user's organizations:

```ts
const { data } = await authClient.organization.list()
```

Check permissions:

```ts
const canDelete = authClient.organization.checkRolePermission({
  permissions: { organization: ["delete"] },
  role: "admin",
})
```

Or server-side with `auth.api.hasPermission`:

```ts
await auth.api.hasPermission({
  headers,
  body: { permissions: { project: ["create"] } },
})
```

**Source:** [better-auth.com/docs/plugins/organization](https://better-auth.com/docs/plugins/organization) — `list`, `checkRolePermission`, `hasPermission`.

---

## Organization Switching

Provide a dropdown of the user's organizations with the active one highlighted. On selection:

```ts
const switchOrg = async (orgId: string) => {
  await authClient.organization.setActive({ organizationId: orgId })
  // Force router refresh to pick up the new active org context
  window.location.href = "/"
}
```

---

## Sign-out Signal

If other tabs need to react to sign-out (e.g., to close WebSocket connections):

```ts
authClient.$sessionSignal.subscribe((session) => {
  if (!session) {
    // User signed out — close connections, redirect, etc.
  }
})
```

**Source:** [better-auth.com/docs/client](https://better-auth.com/docs/client) — `$sessionSignal` reference.
