import Link from "next/link"
import { SettingsCard, DangerZone } from "@/components/settings"

export default function AccountAccountPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Account</h1>
				<p className="text-sm text-muted-foreground">
					Manage your email and account data.
				</p>
			</div>

			<SettingsCard
				title="Email"
				description="Change your account email address."
			>
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Update the email associated with your account.
					</p>
					<Link
						href="/account/settings/account/email"
						className="text-sm font-medium text-primary hover:underline"
					>
						Change
					</Link>
				</div>
			</SettingsCard>

			<DangerZone
				title="Delete account"
				description="Permanently delete your account and all associated data. This action cannot be undone."
			>
				<div className="flex justify-end">
					<Link
						href="/account/settings/account/delete"
						className="text-sm font-medium text-destructive hover:underline"
					>
						Delete account
					</Link>
				</div>
			</DangerZone>
		</div>
	)
}