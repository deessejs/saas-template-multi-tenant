import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog"

export default function AccountDeletePage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Delete account</h1>
				<p className="text-sm text-muted-foreground">
					Permanently remove your account and all associated data.
				</p>
			</div>

			<DeleteAccountDialog />
		</div>
	)
}