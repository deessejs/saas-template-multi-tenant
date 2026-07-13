import { SettingsCard } from "@/components/settings"
import { EmailForm } from "@/components/settings/email-form"

export default function AccountEmailPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Change email</h1>
				<p className="text-sm text-muted-foreground">
					Update your account email address. A verification link will be sent to the new address.
				</p>
			</div>

			<SettingsCard>
				<EmailForm />
			</SettingsCard>
		</div>
	)
}