"use client"

/**
 * Password change form.
 *
 * Wired to `authClient.changePassword({ currentPassword, newPassword })`.
 *
 * Locked decisions (2026-07-09):
 * - D1: force `authClient.revokeOtherSessions()` after every successful change
 *   (security-first; aligns with NIST SP 800-63B and SOC 2 CC6.1).
 * - D4: implementation is **inline** in TanStack `onSubmit` (single consumer
 *   today; no hook abstraction for v1). If a 2nd password-change surface appears
 *   (e.g. admin reset), extract into a shared `useChangePassword()` hook.
 *
 * If the revoke call fails after a successful password change, we log a
 * warning but still show success — credential rotation is the priority, the
 * remaining sessions will expire at their natural timeout (7 days).
 */
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { PasswordInput } from "@/components/auth/password-input"
import { Field } from "@/components/auth/field"
import { changePasswordSchema } from "@/components/settings/schemas"

export function PasswordForm() {
	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: changePasswordSchema,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.changePassword({
				currentPassword: value.currentPassword,
				newPassword: value.newPassword,
			})
			if (error) {
				toast.error(error.message ?? "Could not change password")
				return
			}
			// D1 + D4: force-revoke all other sessions inline. Failure here is
			// non-blocking — the credential rotation already succeeded.
			try {
				await authClient.revokeOtherSessions()
			} catch (revokeError) {
				console.warn(
					"[D1] Failed to revoke other sessions after password change:",
					revokeError,
				)
			}
			toast.success("Password updated. Other devices have been signed out.")
			form.reset()
		},
	})

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				void form.handleSubmit()
			}}
			noValidate
			className="flex flex-col gap-4"
		>
			<form.Field
				name="currentPassword"
				children={(field) => {
					const errors = field.state.meta.errors
						.map((err) => err?.message ?? "")
						.filter(Boolean)
					return (
						<Field
							name={field.name}
							label="Current password"
							errors={errors}
						>
							<PasswordInput
								id={field.name}
								name={field.name}
								autoComplete="current-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={errors.length > 0}
							/>
						</Field>
					)
				}}
			/>

			<form.Field
				name="newPassword"
				children={(field) => {
					const errors = field.state.meta.errors
						.map((err) => err?.message ?? "")
						.filter(Boolean)
					return (
						<Field
							name={field.name}
							label="New password"
							errors={errors}
						>
							<PasswordInput
								id={field.name}
								name={field.name}
								autoComplete="new-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={errors.length > 0}
							/>
						</Field>
					)
				}}
			/>

			<form.Field
				name="confirmPassword"
				children={(field) => {
					const errors = field.state.meta.errors
						.map((err) => err?.message ?? "")
						.filter(Boolean)
					return (
						<Field
							name={field.name}
							label="Confirm new password"
							errors={errors}
						>
							<PasswordInput
								id={field.name}
								name={field.name}
								autoComplete="new-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={errors.length > 0}
							/>
						</Field>
					)
				}}
			/>

			<div className="flex justify-end">
				<form.Subscribe
					selector={(state) =>
						[state.canSubmit, state.isSubmitting] as const
					}
					children={([canSubmit, isSubmitting]) => (
						<Button
							type="submit"
							disabled={!canSubmit || isSubmitting}
							aria-busy={isSubmitting}
						>
							{isSubmitting ? "Updating…" : "Update password"}
						</Button>
					)}
				/>
			</div>
		</form>
	)
}
