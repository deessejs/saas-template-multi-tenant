import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getActiveOrgSlug, listUserOrganizations } from "@/lib/active-org"

/**
 * Root entry point. Acts as a session-aware dispatcher.
 *
 * State machine:
 *   - No session                                  → /login
 *   - Session + email not verified                → /verify-email
 *   - Session + verified + active org in cookie   → /${activeOrgSlug}/home
 *   - Session + verified + has orgs + no active   → /${firstOrg.slug}/home
 *     (OrgLayout aligns the active-org cookie via setActiveOrganization)
 *   - Session + verified + no orgs at all         → /onboarding (first-org wizard)
 *
 * `/organizations/new` is NOT a dispatcher destination — it's reachable
 * only via the OrgSwitcher's "Create new organization" entry point
 * (additional-org flow for users who already have at least one org).
 *
 * See temp/audit/2026-07-13-apps-app-organizations-new/ for the rationale.
 */
export default async function RootPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect("/login")
  }

  if (!session.user.emailVerified) {
    redirect("/verify-email")
  }

  const activeOrgSlug = await getActiveOrgSlug()
  if (activeOrgSlug) {
    redirect(`/${activeOrgSlug}/home`)
  }

  // No active org in the session. Distinguish "no orgs at all" (need
  // /onboarding wizard) from "has orgs but no active pointer" (which
  // happens after login because better-auth does not auto-restore
  // activeOrganizationId on sign-in — see
  // temp/audit/2026-07-13-apps-app-organizations-new/problems/02-login-active-org-not-restored.md).
  // For the latter, route to the first org's home and let the OrgLayout
  // align the cookie via setActiveOrganization.
  const orgs = await listUserOrganizations()
  const firstOrg = orgs[0]
  if (!firstOrg) {
    redirect("/onboarding")
  }

  redirect(`/${firstOrg.slug}/home`)
}