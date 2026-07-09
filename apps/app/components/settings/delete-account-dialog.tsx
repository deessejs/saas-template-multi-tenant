"use client"

/**
 * Account deletion dialog.
 *
 * Wired to `authClient.deleteUser({ password })` (better-auth).
 *
 * Flow:
 * 1. User types the literal `DELETE` to confirm intent
 * 2. User enters their password (required by better-auth to prevent CSRF / hijack)
 * 3. On submit: better-auth deletes the account server-side
 * 4. On success: client-side `signOut()` clears the session cookie, then redirect
 *    to `/` (which itself redirects to `/login`)
 *
 * Locked decision (2026-07-09, D2): wire now. The previous iteration simulated
 * success with `setTimeout` and is unsafe to ship — see audit §F1.1.
 *
 * Org-ownership caveat: better-auth refuses to delete a user who is the sole
 * `owner` of an organization. The server returns 403 with a code that mentions
 * ownership. We surface that message verbatim in a toast.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { PasswordInput } from "@/components/auth/password-input"
import { DangerZone } from "@/components/settings"
import { deleteAccountSchema } from "@/components/settings/schemas"

export function DeleteAccountDialog() {
	const router = useRouter()
	const [submitting, setSubmitting] = useState(false)

	const form = useForm({
		defaultValues: {
			confirm: "",
			password: "",
		},
		validators: {
			onSubmit: deleteAccountSchema,
		},
		onSubmit: async ({ value }) => {
			if (submitting) return
			setSubmitting(true)
			const { error } = await authClient.deleteUser({
				password: value.password,
			})
			if (error) {
				setSubmitting(false)
				const message =
					error.message?.toLowerCase().includes("owner")
						? "Cannot delete your account while you are the sole owner of an organization. Transfer ownership or delete the organization first."
						: (error.message ?? "Could not delete account")
				toast.error(message)
				return
			}
			// Account deleted server-side. Clear the client-side session cookie and
			// bounce to the home route (which itself redirects to /login).
			await authClient.signOut()
			router.push("/")
		},
	})

	return (
		<DangerZone
			title="Delete account"
			description="Permanently delete your account and all associated data. This action cannot be undone."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					void form.handleSubmit()
				}}
				noValidate
				className="flex flex-col gap-4"
			>
				<p className="text-sm text-muted-foreground">
					To confirm, type <strong>DELETE</strong> below and enter your
					password.
				</p>

				<form.Field
					name="confirm"
					children={(field) => (
						<div className="flex flex-col gap-2">
							<label htmlFor="delete-confirm" className="text-sm font-medium">
								Type &quot;DELETE&quot;
							</label>
							<Input
								id="delete-confirm"
								name={field.name}
								type="text"
								autoComplete="off"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={!!field.state.meta.errors.length}
								placeholder="DELETE"
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<form.Field
					name="password"
					children={(field) => (
						<div className="flex flex-col gap-2">
							<label htmlFor="delete-password" className="text-sm font-medium">
								Your password
							</label>
							<PasswordInput
								id="delete-password"
								name={field.name}
								autoComplete="current-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={!!field.state.meta.errors.length}
							/>
							{field.state.meta.errors.map((err) => (
								<p
									key={err?.message}
									className="text-sm text-destructive"
									role="alert"
								>
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<div className="flex justify-end">
					<form.Subscribe
						selector={(state) =>
							[state.canSubmit, state.isSubmitting] as const
						}
						children={([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								variant="destructive"
								disabled={!canSubmit || submitting || isSubmitting}
								aria-busy={submitting || isSubmitting}
							>
								{submitting || isSubmitting
									? "Deleting…"
									: "Delete account"}
							</Button>
						)}
					/>
				</div>
			</form>
		</DangerZone>
	)
}
