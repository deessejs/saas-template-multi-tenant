"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

// Catches errors thrown by auth pages (login, signup, forgot-password,
// reset-password, verify-email). Recovery: navigate to /login — the auth
// flow itself is the safest landing surface for unauthenticated users.
export default function UnprotectedError({
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
				The auth flow hit an unexpected error. You can try again or
				start over at the login page.
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