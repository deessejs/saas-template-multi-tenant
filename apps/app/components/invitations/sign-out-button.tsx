"use client"

import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"

// Sign-out button used in the /accept-invitation "Wrong account" panel.
//
// Renders inside a server-rendered StatusPanel (which can't directly call
// authClient.signOut because it's a client-only API). On click, signs out
// the current session and hard-navigates to /login with the invitation id
// preserved as the redirect target, so after re-auth the user lands back
// on the same invitation.
export function SignOutButton({ redirectTo }: { redirectTo: string }) {
	return (
		<Button
			variant="outline"
			type="button"
			onClick={async () => {
				await authClient.signOut()
				window.location.href = redirectTo
			}}
		>
			Sign out
		</Button>
	)
}