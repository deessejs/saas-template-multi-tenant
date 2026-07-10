import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getActiveOrgSlug } from "@/lib/active-org"

/**
 * Root entry point. Acts as a session-aware dispatcher.
 *
 * State machine:
 *   - No session                          → /login
 *   - Session + email not verified        → /verify-email
 *   - Session + verified + no active org  → /onboarding
 *   - Session + verified + active org     → /${activeOrgSlug}/home
 *
 * See temp/reports/auth/2026-07-10-signup-verify-onboarding-redirect-chain.md
 * for the routing chain, and
 * temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md for the org-scoping
 * target structure (the 4th case here is what §5 of that report enables).
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
  if (!activeOrgSlug) {
    redirect("/onboarding")
  }

  redirect(`/${activeOrgSlug}/home`)
}