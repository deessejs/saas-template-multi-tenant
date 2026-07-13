"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

// Catches errors thrown by protected pages outside any [org_slug] layout
// (onboarding, accept-invitation, personal settings). Recovery: navigate
// to "/" — the dispatcher routes the user to the right org-scoped home,
// or to /onboarding if they have no orgs yet.
export default function ProtectedError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-6 text-center">
			<h1 className="text-xl font-bold">Something went wrong</h1>
			<p className="text-sm text-muted-foreground">
				We couldn&apos;t load this page. You can try again or head back
				home.
			</p>
			<div className="flex gap-2">
				<Button variant="outline" onClick={reset}>
					Try again
				</Button>
				<Button asChild>
					<Link href="/">Go home</Link>
				</Button>
			</div>
		</div>
	)
}