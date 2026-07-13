"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"

// Catches errors thrown inside an org-scoped route (e.g., ${org_slug}/home,
// ${org_slug}/settings/members). This is the most likely place for an
// OrgLayout alignment failure or a per-org DB hiccup.
//
// Recovery: try again (Next.js-provided reset), or navigate to the same
// org's home, or to "/" so the dispatcher can re-evaluate state.
export default function OrgScopedError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	const params = useParams<{ org_slug?: string }>()
	const orgHome = params.org_slug ? `/${params.org_slug}/home` : "/"

	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-6 text-center">
			<h1 className="text-xl font-bold">Something went wrong</h1>
			<p className="text-sm text-muted-foreground">
				We couldn&apos;t load this page. You can try again or head back
				to the org home.
			</p>
			<div className="flex gap-2">
				<Button variant="outline" onClick={reset}>
					Try again
				</Button>
				<Button asChild>
					<Link href={orgHome}>Go to org home</Link>
				</Button>
			</div>
		</div>
	)
}