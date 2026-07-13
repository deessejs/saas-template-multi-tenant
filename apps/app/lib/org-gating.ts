// Pure helper extracted from apps/app/app/(protected)/[org_slug]/layout.tsx
// so it can be unit-tested without a Next.js runtime.
//
// `resolveOrgAccess` answers one question: "given the user's session, the
// URL slug, the user's org list, and the cookie's active org pointer, what
// should the layout do next?". The 4 outcomes mirror the layout's branches:
//
//   - `redirect-login`        → no session
//   - `redirect-verify-email` → session but email not verified
//   - `redirect-onboarding`   → user is not a member of the URL's org
//   - `allow`                 → user is a member; `needsAlignment` indicates
//                               whether the layout must call
//                               `setActiveOrganization` to bring the cookie
//                               in line with the URL
//
// The alignment side effect (calling setActiveOrganization) is intentionally
// NOT part of this function — the layout handles it after getting the
// decision. This keeps the function pure and trivially testable.

type SessionLike = {
	user?: { email?: string | null; emailVerified?: boolean | null } | null
	session?: { activeOrganizationId?: string | null } | null
} | null

type OrgSummary = { id: string; slug: string }

export type OrgAccess =
	| { kind: "redirect-login" }
	| { kind: "redirect-verify-email" }
	| { kind: "redirect-onboarding" }
	| { kind: "allow"; needsAlignment: boolean }

export function resolveOrgAccess(args: {
	session: SessionLike
	urlSlug: string
	orgs: OrgSummary[]
}): OrgAccess {
	if (!args.session?.user) return { kind: "redirect-login" }
	if (!args.session.user.emailVerified) return { kind: "redirect-verify-email" }

	const target = args.orgs.find((o) => o.slug === args.urlSlug)
	if (!target) return { kind: "redirect-onboarding" }

	const activeOrgId = args.session.session?.activeOrganizationId ?? null
	const needsAlignment = !args.orgs.some(
		(o) => o.id === activeOrgId && o.slug === args.urlSlug,
	)

	return { kind: "allow", needsAlignment }
}