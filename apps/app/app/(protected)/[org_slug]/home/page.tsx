import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"

/**
 * Home page. Defense-in-depth active-org gate: a user with no active org who
 * deep-links to /home (or whose `authClient.organization.create` fails) is
 * routed to /onboarding instead of seeing a stranded "Welcome back." screen.
 *
 * The same logic is also enforced by the root dispatcher in app/page.tsx, so
 * a user who lands on /home should normally already have an active org. This
 * gate covers the stale-bookmark / mid-flow case.
 *
 * Under org-scoping (see temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md),
 * this gate moves to app/(protected)/[org_slug]/layout.tsx.
 */
export default async function HomePage() {
  const session = await getSession()

  if (!session?.user) {
    redirect("/login")
  }

  const activeOrgId = (
    session.session as unknown as { activeOrganizationId?: string | null }
  ).activeOrganizationId

  if (!activeOrgId) {
    redirect("/onboarding")
  }

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="text-muted-foreground">Welcome back.</p>
    </div>
  )
}