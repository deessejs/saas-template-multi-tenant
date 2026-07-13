"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

// Absolute fallback. Catches errors not caught by route-group boundaries
// (e.g., the root layout itself, or routes that don't sit under any error
// boundary). Recovery: navigate to /login — if the user's session is
// valid, the dispatcher routes them to the right place from there.
export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		// Optional: ship to error tracking (Sentry, etc.).
		console.error(error)
	}, [error])

	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-6 text-center">
			<h1 className="text-xl font-bold">Something went wrong</h1>
			<p className="text-sm text-muted-foreground">
				We couldn&apos;t load this page. You can try again or head to the
				login screen.
			</p>
			<div className="flex gap-2">
				<Button variant="outline" onClick={reset}>
					Try again
				</Button>
				<Button asChild>
					<Link href="/login">Go to login</Link>
				</Button>
			</div>
		</div>
	)
}