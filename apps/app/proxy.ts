import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@workspace/auth"

const AUTH_PREFIXES = [
	"/login",
	"/signup",
	"/forgot-password",
	"/reset-password",
	"/verify-email",
]

// Match /:org_slug/home and /:org_slug/settings (with optional nested path).
// The :org_slug is a single path segment.
const ORG_SCOPED_PROTECTED_RE = /^\/[^/]+\/(home|settings)(\/|$)/

export const config = {
	matcher: [
		// Personal (user-scoped) routes. Since the 2026-07-13 rename, the
		// personal namespace lives under /account/settings/*.
		"/account/settings/:path*",
		// Legacy personal routes under /settings/* — kept in the matcher so
		// the redirect files can run; they all 307 to /account/settings/*.
		"/settings/:path*",
		// Personal non-settings routes.
		"/home/:path*",
		"/onboarding",
		"/accept-invitation",
		"/organizations/new",
		// Org-scoped routes (restrictive — explicit per §6 decision 1).
		// Matches /:org_slug/home/... and /:org_slug/settings/... where
		// :org_slug is any non-empty path segment.
		"/:org_slug/home/:path*",
		"/:org_slug/settings/:path*",
		// Auth pages.
		"/login",
		"/signup",
		"/forgot-password",
		"/reset-password",
		"/verify-email",
	],
}

/**
 * Auth gate. Two questions and only two:
 *   1. Unauthenticated hitting a protected page → /login?redirect=…
 *   2. Authenticated sitting on an auth page (login/signup/etc.) → /
 *
 * The /verify-email page is the only auth page an authenticated user is
 * allowed to see — they may have just landed there from the email link
 * before the redirect chain settles. The root "/" is then the dispatcher
 * (apps/app/app/page.tsx) that routes to /${activeOrgSlug}/home or
 * /onboarding depending on session state.
 *
 * Anything beyond these two questions (e.g. "is the email verified?",
 * "do they have an org?") is application state, not auth, and lives in the
 * page that needs it.
 */
export async function proxy(request: NextRequest) {
	const pathname = request.nextUrl.pathname
	const isProtected =
		pathname.startsWith("/account/settings") ||
		pathname === "/account/settings" ||
		pathname.startsWith("/settings") ||
		pathname === "/settings" ||
		pathname.startsWith("/home") ||
		pathname === "/onboarding" ||
		pathname === "/accept-invitation" ||
		pathname === "/organizations/new" ||
		ORG_SCOPED_PROTECTED_RE.test(pathname)
	const isAuthPage = AUTH_PREFIXES.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	)

	// Skip the DB roundtrip on routes that don't need a session decision.
	if (!isProtected && !isAuthPage) return NextResponse.next()

	const session = await auth.api.getSession({ headers: request.headers })

	if (isProtected && !session?.session) {
		const loginUrl = new URL("/login", request.url)
		loginUrl.searchParams.set("redirect", pathname)
		return NextResponse.redirect(loginUrl)
	}

	if (isAuthPage && session?.session && pathname !== "/verify-email") {
		// Bounce to "/" — the dispatcher routes to the right org-scoped route.
		// The proxy itself does not know the active org slug (would require a
		// DB call per request) so the dispatcher is the right place.
		return NextResponse.redirect(new URL("/", request.url))
	}

	return NextResponse.next()
}