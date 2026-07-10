import { redirect } from "next/navigation"
import { BuildingIcon } from "lucide-react"
import { getSession } from "@/lib/session"
import { getActiveOrgSlug } from "@/lib/active-org"
import { CreateWorkspaceForm } from "@/components/onboarding"

// State checks for /onboarding, on the page that needs them.
//
// `getSession()` (lib/session.ts) already returns the user with emailVerified,
// so we read it from the user object. The active org's slug is resolved
// server-side via `getActiveOrgSlug()` (lib/active-org.ts) so we can
// redirect to the org-scoped /${activeOrgSlug}/home route.
export default async function OnboardingPage() {
  const session = await getSession()
	if (!session?.user) {
		redirect("/login?redirect=/onboarding")
	}

	// Email verification gate.
	if (!session.user.emailVerified) {
		redirect("/verify-email")
	}

	const activeOrgSlug = await getActiveOrgSlug()

	// Pre-existing org → send the user to their org-scoped home; the form
	// below is irrelevant.
	if (activeOrgSlug) {
		redirect(`/${activeOrgSlug}/home`)
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
					Set up a name for your team. You can invite people and change
					details later.
				</p>
			</div>

			<CreateWorkspaceForm />
		</div>
	)
}
