"use client"

/**
 * Email change form.
 *
 * Wired to `authClient.changeEmail({ newEmail })`. Better-auth sends a
 * verification link to the *new* address; until the user clicks it, the
 * current email remains active.
 *
 * Locked decision (2026-07-09, D5): client-side `localStorage` cooldown (5 min)
 * to prevent rapid resubmission and email enumeration. This is a v1 mitigation
 * only — a determined user can bypass by clearing `localStorage`. A real
 * server-side rate limit (Upstash / Cloudflare) is a future hardening item.
 */
import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field } from "@/components/auth/field"
import { changeEmailSchema } from "@/components/settings/schemas"

const COOLDOWN_KEY = "email-change-last-request"
const COOLDOWN_MS = 5 * 60 * 1000

function getCooldownRemaining(): number {
	if (typeof window === "undefined") return 0
	const raw = window.localStorage.getItem(COOLDOWN_KEY)
	if (!raw) return 0
	const ts = Number(raw)
	if (!Number.isFinite(ts)) return 0
	const remaining = ts + COOLDOWN_MS - Date.now()
	return remaining > 0 ? remaining : 0
}

function setCooldown() {
	if (typeof window !== "undefined") {
		window.localStorage.setItem(COOLDOWN_KEY, String(Date.now()))
	}
}

export function EmailForm() {
	const [sent, setSent] = useState(false)
	// Hydrate after mount to avoid SSR/CSR mismatch on the time text.
	const [cooldownRemaining, setCooldownRemaining] = useState(0)

	useEffect(() => {
		// Hydrate the cooldown timer from localStorage on mount. This is a
		// one-shot sync with an external system (browser storage), not a
		// cascading render — the canonical use-case for setState in effect.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setCooldownRemaining(getCooldownRemaining())
	}, [])

	const form = useForm({
		defaultValues: {
			newEmail: "",
		},
		validators: {
			onSubmit: changeEmailSchema,
		},
		onSubmit: async ({ value }) => {
			// D5: enforce cooldown before calling better-auth. Recompute at submit
			// time so the gate works even if the user sat on a stale tab.
			const remaining = getCooldownRemaining()
			if (remaining > 0) {
				const minutes = Math.ceil(remaining / 60_000)
				toast.error(
					`We already sent a verification email recently. Try again in ${minutes} min, or check your inbox.`,
				)
				return
			}
			const { error } = await authClient.changeEmail({
				newEmail: value.newEmail,
			})
			if (error) {
				toast.error(error.message ?? "Could not change email")
				return
			}
			setCooldown()
			setCooldownRemaining(COOLDOWN_MS)
			setSent(true)
		},
	})

	if (sent) {
		return (
			<div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
				<p className="font-medium">Verification email sent</p>
				<p className="mt-1">
					Check the inbox of the new address. Until you click the
					verification link, your current email stays active.
				</p>
			</div>
		)
	}

	const cooldownActive = cooldownRemaining > 0
	const cooldownLabel = cooldownActive
		? `Try again in ${Math.ceil(cooldownRemaining / 60_000)} min`
		: undefined

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
				name="newEmail"
				children={(field) => {
					const errors = field.state.meta.errors
						.map((err) => err?.message ?? "")
						.filter(Boolean)
					return (
						<Field
							name={field.name}
							label="New email"
							errors={errors}
						>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								autoComplete="email"
								placeholder="new@example.com"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={errors.length > 0}
								disabled={cooldownActive}
							/>
						</Field>
					)
				}}
			/>

			{cooldownActive && (
				<p className="text-xs text-muted-foreground">
					{cooldownLabel}. Already requested a change recently? Check the
					inbox of the address you entered.
				</p>
			)}

			<div className="flex justify-end">
				<form.Subscribe
					selector={(state) =>
						[state.canSubmit, state.isSubmitting] as const
					}
					children={([canSubmit, isSubmitting]) => (
						<Button
							type="submit"
							disabled={!canSubmit || cooldownActive || isSubmitting}
							aria-busy={isSubmitting}
						>
							{isSubmitting ? "Sending…" : "Send verification"}
						</Button>
					)}
				/>
			</div>
		</form>
	)
}
