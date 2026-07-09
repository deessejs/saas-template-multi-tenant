"use client"

import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { clientEnv } from "@workspace/env/client"

// TS2883: the inferred type of authClient references internal better-auth types
// that are not portable. A cast through Parameters<> is necessary.
export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient()],
})

// Workaround for better-auth issue #9710:
// `$activeOrgSignal` only invalidates on `/sign-out` and `/organization/*` paths,
// so `useActiveOrganization()` returns stale `null` after sign-in. We forward
// `$sessionSignal` invalidations to the active-org signal to force a refetch.
// Once #9736 / #9737 land upstream, this can be removed.
//
// See: docs/guides/better-auth/client.md §"Workaround for #9710"
//   and docs/guides/better-auth/pitfalls.md §3
//
// The `$sessionSignal` and `$activeOrgSignal` fields exist at runtime but are
// not exposed in better-auth's public types — same TS2883 situation as above.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __authClientInternals = authClient as any
let __authClient9710Initialized = false
__authClientInternals.$sessionSignal.subscribe(() => {
  if (__authClient9710Initialized) {
    __authClientInternals.$activeOrgSignal.value = null
  }
  __authClient9710Initialized = true
})

