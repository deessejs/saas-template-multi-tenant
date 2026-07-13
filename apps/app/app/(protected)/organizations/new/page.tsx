import { redirect } from "next/navigation"
import { BuildingIcon } from "lucide-react"
import { getSession } from "@/lib/session"
import { CreateWorkspaceForm } from "@/components/onboarding"

// /organizations/new — the canonical route for creating a workspace.
//
// Serves BOTH the first-org case (post-signup, dispatched from
// apps/app/app/page.tsx for verified users with no active organization)
// AND the additional-org case (OrgSwitcher's "Create new organization"
// entry point for users who already belong to one or more orgs).
//
// Auth + email-verification gates below. No redirect-if-active-org gate:
// that previously sent users with existing orgs back to their current
// home, silently breaking the OrgSwitcher's "Create new organization"
// affordance. See temp/audit/2026-07-13-apps-app-organizations-new/.
//
// The form invokes `authClient.organization.create` on submit, which
// correctly invalidates both `$activeOrgSignal` and `$sessionSignal`
// (per apps/app/lib/auth-client.ts:6-15), avoiding better-auth #9710's
// stale-atom bug.
export default async function NewOrganizationPage() {
	const session = await getSession()
	if (!session?.user) {
		redirect("/login?redirect=/organizations/new")
	}

	// Email verification gate. Verified users are allowed through.
	if (!session.user.emailVerified) {
		redirect("/verify-email")
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border p-6">
			<div className="flex justify-center">
				<div className="flex size-12 items-center justify-center rounded-full border bg-muted">
					<BuildingIcon className="size-5 text-muted-foreground" />
				</div>
			</div>

			<div className="flex flex-col gap-1 text-center">
				<h1 className="text-2xl font-bold">Create a new organization</h1>
				<p className="text-sm text-muted-foreground">
					Set up a name for your team. You can invite people and change
					details later.
				</p>
			</div>

			<CreateWorkspaceForm />
		</div>
	)
}