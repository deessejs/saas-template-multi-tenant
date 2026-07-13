import { SettingsCard } from "@/components/settings"
import { ConnectedAccountsList } from "@/components/settings/connected-accounts-list"

export default function AccountConnectionsPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Connections</h1>
				<p className="text-sm text-muted-foreground">
					Manage your linked social accounts.
				</p>
			</div>

			<SettingsCard
				title="Linked accounts"
				description="Connect your social accounts for easier sign-in."
			>
				<ConnectedAccountsList />
			</SettingsCard>
		</div>
	)
}