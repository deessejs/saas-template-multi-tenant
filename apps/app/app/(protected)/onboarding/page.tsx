import { redirect } from "next/navigation"
import { BuildingIcon } from "lucide-react"
import { getSession } from "@/lib/session"
import { listUserOrganizations } from "@/lib/active-org"
import { CreateWorkspaceForm } from "@/components/onboarding"

// /onboarding — first-time setup wizard for users with NO organizations yet.
//
// Distinct from /organizations/new (which serves the additional-org case
// for users who already belong to one or more orgs). See
// temp/audit/2026-07-13-apps-app-organizations-new/.
//
// State checks:
//   - Not signed in     → /login?redirect=/onboarding
//   - Unverified email  → /verify-email
//   - Already has orgs  → /${firstOrg.slug}/home (the wizard is irrelevant
//                         for returning users; they should use
//                         /organizations/new to add more, or hit their
//                         existing home directly)
//
// The form invokes `authClient.organization.create` on submit, which
// correctly invalidates both `$activeOrgSignal` and `$sessionSignal`
// (per apps/app/lib/auth-client.ts:6-15), avoiding better-auth #9710's
// stale-atom bug.
export default async function OnboardingPage() {
	const session = await getSession()
	if (!session?.user) {
		redirect("/login?redirect=/onboarding")
	}

	// Email verification gate.
	if (!session.user.emailVerified) {
		redirect("/verify-email")
	}

	// Returning users belong here — the onboarding wizard is for first-org
	// setup only. Send them to their first org's home so the OrgLayout can
	// align the active-org cookie via setActiveOrganization. They can use
	// the OrgSwitcher's "Create new organization" entry point (linking to
	// /organizations/new) to add more.
	const orgs = await listUserOrganizations()
	const firstOrg = orgs[0]
	if (firstOrg) {
		redirect(`/${firstOrg.slug}/home`)
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border p-6">
			<div className="flex justify-center">
				<div className="flex size-12 items-center justify-center rounded-full border bg-muted">
					<BuildingIcon className="size-5 text-muted-foreground" />
				</div>
			</div>

			<div className="flex flex-col gap-1 text-center">
				<h1 className="text-2xl font-bold">Create your workspace</h1>
				<p className="text-sm text-muted-foreground">
					Welcome — let&apos;s set up your first team. You can invite
					people and change details later.
				</p>
			</div>

			<CreateWorkspaceForm />
		</div>
	)
}