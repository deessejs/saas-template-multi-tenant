import Link from "next/link"
import { SettingsCard } from "@/components/settings"

export default function AccountSecurityPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Security</h1>
				<p className="text-sm text-muted-foreground">
					Manage your password and active sessions.
				</p>
			</div>

			<SettingsCard
				title="Password"
				description="Change your account password."
			>
				<div className="flex items-center justify-between">
					<p className="text-sm text-muted-foreground">
						Use a strong password you don&apos;t use elsewhere.
					</p>
					<Link
						href="/account/settings/security/password"
						className="text-sm font-medium text-primary hover:underline"
					>
						Change
					</Link>
				</div>
			</SettingsCard>
		</div>
	)
}