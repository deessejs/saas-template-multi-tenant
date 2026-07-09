"use client"

/**
 * Active sessions table.
 *
 * Status (2026-07-09): not yet wired to `authClient.listSessions()`. The previous
 * iteration hardcoded two fake sessions which was misleading and dangerous —
 * see audit §F1.2. This is now a placeholder that surfaces the intent and
 * the planned wiring so the page isn't empty.
 *
 * Reactivation checklist (Sprint 2+):
 * - Replace placeholder with `authClient.listSessions()` + parse UA + revoke flow
 * - Detect "current" session by token comparison
 * - Use `authClient.revokeOtherSessions()` for the bulk action
 */
import { Button } from "@workspace/ui/components/button"
import { SmartphoneIcon } from "lucide-react"

export function SessionsTable() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
			<div className="flex size-10 items-center justify-center rounded-lg border bg-background">
				<SmartphoneIcon className="size-5 text-muted-foreground" />
			</div>
			<div>
				<p className="text-sm font-medium">Session management coming soon</p>
				<p className="text-xs text-muted-foreground">
					Listing and revoking active devices will land in the next sprint.
				</p>
			</div>
			<Button variant="outline" size="sm" disabled>
				Sign out everywhere else
			</Button>
		</div>
	)
}
