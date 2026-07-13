import { describe, expect, it } from "vitest"
import { resolveOrgAccess } from "./org-gating"

// Pure helper extracted from apps/app/app/(protected)/[org_slug]/layout.tsx.
// Tests cover the 4 decision kinds and the `needsAlignment` flag for the
// `allow` kind.

const ORGS = [
	{ id: "org_1", slug: "acme" },
	{ id: "org_2", slug: "beta" },
]

describe("resolveOrgAccess", () => {
	it("returns redirect-login when there is no session", () => {
		const result = resolveOrgAccess({
			session: null,
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-login" })
	})

	it("returns redirect-login when session has no user", () => {
		const result = resolveOrgAccess({
			session: { user: null },
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-login" })
	})

	it("returns redirect-verify-email when emailVerified is false", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: false },
				session: { activeOrganizationId: null },
			},
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-verify-email" })
	})

	it("returns redirect-verify-email when emailVerified is null", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: null },
				session: { activeOrganizationId: null },
			},
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-verify-email" })
	})

	it("returns redirect-onboarding when user is not a member of the URL slug", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: true },
				session: { activeOrganizationId: "org_1" },
			},
			urlSlug: "gamma",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-onboarding" })
	})

	it("returns allow + needsAlignment: false when active org matches URL slug", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: true },
				session: { activeOrganizationId: "org_1" },
			},
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "allow", needsAlignment: false })
	})

	it("returns allow + needsAlignment: true when active org differs from URL slug", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: true },
				session: { activeOrganizationId: "org_1" },
			},
			urlSlug: "beta",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "allow", needsAlignment: true })
	})

	it("returns allow + needsAlignment: true when activeOrganizationId is null", () => {
		const result = resolveOrgAccess({
			session: {
				user: { email: "a@b.com", emailVerified: true },
				session: { activeOrganizationId: null },
			},
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "allow", needsAlignment: true })
	})

	it("returns redirect-login takes precedence over email verification", () => {
		const result = resolveOrgAccess({
			session: { user: null, session: null },
			urlSlug: "acme",
			orgs: ORGS,
		})
		expect(result).toEqual({ kind: "redirect-login" })
	})
})