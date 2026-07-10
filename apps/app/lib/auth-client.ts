"use client"

import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { clientEnv } from "@workspace/env/client"

// Org creation happens at /onboarding via `authClient.organization.create`.
// That path matches the organization plugin's atomListeners and correctly
// invalidates both `$activeOrgSignal` and `$sessionSignal`, so no client
// workaround is needed. The previous in-repo workaround (forwarding
// `$sessionSignal` invalidations to `$activeOrgSignal`) was a workaround
// for better-auth issue #9710 and is no longer required.
//
// See: temp/reports/auth/2026-07-09-session-signal-404-and-9710-investigation.md
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
})

// Re-export the React hooks provided by the client plugins. These are
// attached to the auth client at runtime (createAuthClient's return
// type doesn't expose them in TS without a cast) but they are real,
// runtime-available React hooks. The `useActiveOrganization` hook
// reads from the same atom that `useActiveOrgSlug()` wraps in
// `apps/app/lib/active-org.ts`.
export const { useSession, useActiveOrganization, useListOrganizations } =
  authClient as unknown as {
    useSession: () => ReturnType<typeof createAuthClient>["useSession"]
    useActiveOrganization: () => {
      data: { id: string; slug: string; name: string } | null
      isPending: boolean
      error: unknown
    }
    useListOrganizations: () => {
      data: Array<{ id: string; slug: string; name: string }> | null
      isPending: boolean
      error: unknown
    }
  }
