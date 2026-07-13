import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@workspace/auth"
import { getSession } from "@/lib/session"
import { resolveOrgAccess } from "@/lib/org-gating"

/**
 * Layout for all org-scoped routes. Resolves the URL slug to the org, gates
 * membership, and reconciles URL → state per the source-of-truth rule
 * (see temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5).
 *
 * The decision logic is extracted to `resolveOrgAccess` (lib/org-gating.ts)
 * for unit testing. This layout handles the side effects: redirect calls
 * and `setActiveOrganization` for URL → state alignment.
 *
 * Behavior:
 *   - User not authed                       → /login
 *   - Email not verified                    → /verify-email
 *   - User is not a member of {org_slug}    → /onboarding
 *   - Session's active org ≠ URL's org     → call setActiveOrganization,
 *                                              then continue (URL→state alignment)
 *   - Otherwise                             → render children
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

	// TS2883: same cast as in lib/active-org.ts. The `listOrganizations`
	// endpoint returns the orgs the user is a member of.
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

	const decision = resolveOrgAccess({
		session: session as Parameters<typeof resolveOrgAccess>[0]["session"],
		urlSlug: org_slug,
		orgs,
	})

	if (decision.kind === "redirect-login") redirect("/login")
	if (decision.kind === "redirect-verify-email") redirect("/verify-email")
	if (decision.kind === "redirect-onboarding") redirect("/onboarding")

	// decision.kind === "allow"
	if (decision.needsAlignment) {
		await authApi.setActiveOrganization({
			organizationSlug: org_slug,
			headers: hdrs,
		})
	}

	return <>{children}</>
}