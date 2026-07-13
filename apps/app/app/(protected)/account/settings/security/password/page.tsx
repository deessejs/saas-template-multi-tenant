import { SettingsCard } from "@/components/settings"
import { PasswordForm } from "@/components/settings/password-form"

export default function AccountPasswordPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Change password</h1>
				<p className="text-sm text-muted-foreground">
					Update your account password.
				</p>
			</div>

			<SettingsCard>
				<PasswordForm />
			</SettingsCard>
		</div>
	)
}