import { SettingsCard } from "@/components/settings"
import { SessionsTable } from "@/components/settings/sessions-table"

export default function AccountSessionsPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Sessions</h1>
				<p className="text-sm text-muted-foreground">
					Manage your active sessions and signed-in devices.
				</p>
			</div>

			<SettingsCard
				title="Active sessions"
				description="These devices are currently signed in to your account."
			>
				<SessionsTable />
			</SettingsCard>
		</div>
	)
}