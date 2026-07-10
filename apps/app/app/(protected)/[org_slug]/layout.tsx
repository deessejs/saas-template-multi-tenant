import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getSession } from "@/lib/session"

/**
 * Layout for all org-scoped routes. Resolves the URL slug to the org, gates
 * membership, and reconciles URL → state per the source-of-truth rule
 * (see temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5).
 *
 * Behavior:
 *   - User not authed                       → /login
 *   - Email not verified                    → /verify-email
 *   - User is not a member of {org_slug}    → /onboarding (per §9.5 option a)
 *   - Session's active org ≠ URL's org     → call setActiveOrganization,
 *                                              then continue (URL→state alignment)
 *   - Otherwise                             → render children
 *
 * This layout centralizes the active-org gate. Pages under [org_slug]/
 * no longer need their own getSession() checks for the org membership.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org_slug: string }>
}) {
  const { org_slug } = await params

  const session = await getSession()
  if (!session?.user) {
    redirect("/login")
  }
  if (!session.user.emailVerified) {
    redirect("/verify-email")
  }

  // TS2883: same cast as in lib/active-org.ts. The `listOrganizations` endpoint
  // returns the orgs the user is a member of.
  type OrganizationSummary = { id: string; slug: string; name: string }
  type AuthApiWithOrg = {
    listOrganizations: (opts: { headers: Headers }) => Promise<OrganizationSummary[]>
    setActiveOrganization: (opts: {
      organizationSlug: string
      headers: Headers
    }) => Promise<unknown>
  }
  const authApi = auth.api as unknown as AuthApiWithOrg
  const hdrs = await headers()

  const orgs = await authApi.listOrganizations({ headers: hdrs })
  const target = orgs.find((o) => o.slug === org_slug)

  // User is not a member of the URL's org. Per §9.5 option a: redirect to
  // /onboarding (consistent with the rest of the flow). No toast — the layout
  // is a server component and the user can re-discover the correct route via
  // the org-switcher.
  if (!target) {
    redirect("/onboarding")
  }

  // URL → state alignment: if the session's active org doesn't match the URL's
  // org, set it. This is a soft alignment (no redirect); the URL was correct
  // (user navigated to it explicitly), we're just bringing the cookie in line.
  const activeOrgId = (
    session.session as unknown as { activeOrganizationId?: string | null }
  ).activeOrganizationId
  const activeMatchesUrl = orgs.some(
    (o) => o.id === activeOrgId && o.slug === org_slug,
  )
  if (!activeMatchesUrl) {
    await authApi.setActiveOrganization({
      organizationSlug: org_slug,
      headers: hdrs,
    })
  }

  return <>{children}</>
}