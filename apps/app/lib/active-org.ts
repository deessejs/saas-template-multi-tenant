import "server-only"

import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getSession } from "@/lib/session"

/**
 * Server-only active-org helpers.
 *
 * Source-of-truth rule (see temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5):
 * the URL is the authoritative org selector.
 *
 * `getActiveOrgSlug()` reads the session's `activeOrganizationId`, resolves
 * to the org's slug via `auth.api.listOrganizations`, returns null if the
 * user has no active org.
 *
 * The client-side counterpart is `useActiveOrgSlug()` in
 * `apps/app/lib/use-active-org-slug.ts` (kept in a separate file because
 * this file imports `next/headers`, which is server-only).
 */

// TS2883: the `auth.api.organization` namespace is not in the public
// BetterAuth type surface. Cast through unknown to a structurally-typed
// callable. The `listOrganizations` return shape is taken from crud-org.d.mts:
// an array of organizations the user is a member of.
type OrganizationSummary = { id: string; slug: string; name: string }
type AuthApiWithOrg = {
  listOrganizations: (opts: { headers: Headers }) => Promise<OrganizationSummary[]>
}
const authApi = auth.api as unknown as AuthApiWithOrg

/**
 * List the organizations the current user is a member of.
 *
 * Returns an empty array if the user is not signed in. Used by:
 *   - The dispatcher in `apps/app/app/page.tsx` to route between
 *     `/onboarding` (no orgs), `/${slug}/home` (has orgs), etc.
 *   - The `/onboarding` wizard to detect returning users.
 *
 * Prefer this over calling `auth.api.listOrganizations` directly so the
 * TS surface cast and shape contract live in one place.
 */
export async function listUserOrganizations(): Promise<OrganizationSummary[]> {
  const session = await getSession()
  if (!session?.user) return []
  return authApi.listOrganizations({ headers: await headers() })
}

export async function getActiveOrgSlug(): Promise<string | null> {
  const session = await getSession()
  if (!session?.user) return null

  const activeOrgId = (
    session.session as unknown as { activeOrganizationId?: string | null }
  ).activeOrganizationId

  if (!activeOrgId) return null

  const orgs = await authApi.listOrganizations({ headers: await headers() })
  const active = orgs.find((o) => o.id === activeOrgId)
  return active?.slug ?? null
}