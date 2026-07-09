"use client"

/**
 * List of OAuth accounts linked to the user's profile (Google, GitHub).
 *
 * Status (2026-07-09): not yet wired to `authClient.listAccounts()`. The previous
 * iteration hardcoded a fake Google account — see audit §F1.3. This is now a
 * placeholder that surfaces the intent and the planned wiring.
 *
 * Reactivation checklist (Sprint 2+):
 * - Replace placeholder with `authClient.listAccounts()`
 * - Wire `linkSocial` + `unlinkAccount` (with proper error for "only auth method")
 * - Show `account.email` or `account.name` from the API, not a fabricated string
 */
import { Button } from "@workspace/ui/components/button"
import { LinkIcon } from "lucide-react"

const PROVIDERS = {
	google: { name: "Google" },
	github: { name: "GitHub" },
} as const

export function ConnectedAccountsList() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center">
				<div className="flex size-10 items-center justify-center rounded-lg border bg-background">
					<LinkIcon className="size-5 text-muted-foreground" />
				</div>
				<div>
					<p className="text-sm font-medium">Linked accounts coming soon</p>
					<p className="text-xs text-muted-foreground">
						Connecting and disconnecting Google / GitHub will land in the next sprint.
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Link a new account</p>
				<div className="flex gap-2">
					{(["google", "github"] as const).map((provider) => (
						<Button key={provider} variant="outline" size="sm" disabled>
							Link {PROVIDERS[provider].name}
						</Button>
					))}
				</div>
			</div>
		</div>
	)
}
