"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field } from "@/components/auth/field"
import { profileSchema } from "@/components/settings/schemas"

/**
 * Profile edit form. Wires `authClient.updateUser({ name })`.
 *
 * Email is intentionally not editable here — better-auth requires a separate
 * verification flow (`changeEmail`) routed via `/settings/account/email`.
 *
 * Uses the project-local `Field` wrapper for label + error rendering (F1.6).
 */
export function ProfileForm() {
	const { data: session } = authClient.useSession()
	const user = session?.user
	const [saving, setSaving] = useState(false)
	const [saved, setSaved] = useState(false)

	const form = useForm({
		defaultValues: {
			name: user?.name ?? "",
		},
		validators: {
			onSubmit: profileSchema,
		},
		onSubmit: async ({ value }) => {
			if (!user) return
			setSaving(true)
			const { error } = await authClient.updateUser({
				name: value.name,
			})
			setSaving(false)
			if (error) {
				toast.error(error.message ?? "Could not update profile")
				return
			}
			setSaved(true)
			setTimeout(() => setSaved(false), 3000)
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
				name="name"
				children={(field) => {
					const errors = field.state.meta.errors
						.map((err) => err?.message ?? "")
						.filter(Boolean)
					return (
						<Field
							name={field.name}
							label="Name"
							errors={errors}
						>
							<Input
								id={field.name}
								name={field.name}
								type="text"
								autoComplete="name"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={errors.length > 0}
								disabled={!user}
							/>
						</Field>
					)
				}}
			/>

			<div className="flex flex-col gap-2">
				<label className="text-sm font-medium">Email</label>
				<Input
					value={user?.email ?? ""}
					disabled
					autoComplete="email"
					className="text-muted-foreground"
				/>
				<p className="text-xs text-muted-foreground">
					Email changes require verification.{" "}
					<Link
						href="/settings/account/email"
						className="text-primary hover:underline"
					>
						Change email
					</Link>
				</p>
			</div>

			{saved && (
				<p className="text-sm text-green-600 dark:text-green-400">
					Changes saved.
				</p>
			)}

			<div className="flex justify-end">
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					children={([canSubmit, isSubmitting]) => (
						<Button
							type="submit"
							disabled={!canSubmit || saving || isSubmitting || !user}
							aria-busy={saving || isSubmitting}
						>
							{saving || isSubmitting ? "Saving…" : saved ? "Saved" : "Save changes"}
						</Button>
					)}
				/>
			</div>
		</form>
	)
}
