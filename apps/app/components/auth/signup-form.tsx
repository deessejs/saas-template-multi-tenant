"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { PasswordInput } from "./password-input"
import { signupSchema } from "@/components/auth/schemas"

type StrengthLevel = 0 | 1 | 2 | 3 | 4

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const
const STRENGTH_COLORS = [
	"bg-muted",
	"bg-destructive",
	"bg-yellow-500",
	"bg-blue-500",
	"bg-green-500",
] as const satisfies Array<string>

function getPasswordStrength(password: string): StrengthLevel {
	if (!password) return 0
	let score = 0
	if (password.length >= 8) score++
	if (password.length >= 12) score++
	if (/[a-z]/.test(password)) score++
	if (/[A-Z]/.test(password)) score++
	if (/[0-9]/.test(password)) score++
	if (/[^a-zA-Z0-9]/.test(password)) score++
	return Math.min(score, 4) as StrengthLevel
}

function PasswordStrength({ password }: { password: string }) {
	const strength = getPasswordStrength(password)
	if (!password) return null

	return (
		<div className="flex flex-col gap-1">
			<div className="flex gap-1">
				{[1, 2, 3, 4].map((level) => (
					<div
						key={level}
						className={`h-1 flex-1 rounded-full transition-colors ${
							strength >= level ? STRENGTH_COLORS[strength] : "bg-muted"
						}`}
					/>
				))}
			</div>
			<p
				className={`text-xs ${
					strength <= 1
						? "text-destructive"
						: strength <= 2
							? "text-yellow-600 dark:text-yellow-400"
							: "text-green-600 dark:text-green-400"
				}`}
			>
				{STRENGTH_LABELS[strength]}
			</p>
		</div>
	)
}

function OAuthButtons() {
	const [loading, setLoading] = useState<string | null>(null)

	async function handleOAuth(provider: "google" | "github") {
		setLoading(provider)
		// OAuth's signInSocial does not run the requireEmailVerification check
		// (sign-in.mjs:230 lives inside signInEmail only). OAuth providers
		// return emailVerified from the provider, so social users land
		// directly in the dispatcher as verified. Route through "/" so the
		// dispatcher picks the right destination.
		await authClient.signIn.social({ provider, callbackURL: "/" })
	}

	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="outline"
				type="button"
				className="w-full"
				onClick={() => handleOAuth("google")}
				disabled={!!loading}
				aria-busy={loading === "google"}
			>
				<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
				</svg>
				{loading === "google" ? "Redirecting…" : "Continue with Google"}
			</Button>
			<Button
				variant="outline"
				type="button"
				className="w-full"
				onClick={() => handleOAuth("github")}
				disabled={!!loading}
				aria-busy={loading === "github"}
			>
				<svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
					<path fill="currentColor" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
				</svg>
				{loading === "github" ? "Redirecting…" : "Continue with GitHub"}
			</Button>
		</div>
	)
}

export function SignupForm() {
	const router = useRouter()

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: signupSchema,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signUp.email({
				email: value.email,
				password: value.password,
				name: value.name,
				// callbackURL="/" ensures that after the user clicks the
				// verification link, better-auth creates the session and
				// redirects to "/". The root dispatcher in app/page.tsx then
				// routes based on session state (no session → /login,
				// unverified → /verify-email, no active org → /onboarding,
				// active org → /home). We still push to /verify-email
				// below so the user sees the "check your email" UI before
				// they leave the tab to check their inbox.
				callbackURL: "/",
			})
			if (error) {
				toast.error(error.message ?? "Could not create account")
				return
			}
			// better-auth skips auto-sign-in when `requireEmailVerification: true`
			// (sign-up.mjs:161-162), so the user has no session here. Send them
			// to /verify-email which shows the "check your email" UI and a resend
			// button. The verification link in the email hits
			// /api/auth/verify-email and — thanks to
			// `autoSignInAfterVerification: true` in packages/auth/src/auth.ts —
			// creates a session and follows callbackURL="/" to the dispatcher.
			router.push(
				`/verify-email?email=${encodeURIComponent(value.email)}`,
			)
		},
	})

	return (
		<div className="flex flex-col gap-6">
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
					children={(field) => (
						<div className="flex flex-col gap-1">
							<label htmlFor={field.name} className="text-sm font-medium">
								Name
							</label>
							<Input
								id={field.name}
								name={field.name}
								type="text"
								autoComplete="name"
								autoFocus
								className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={!!field.state.meta.errors.length}
							/>
							{field.state.meta.errors.map((err) => (
								<p key={err?.message} className="text-sm text-destructive" role="alert">
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<form.Field
					name="email"
					children={(field) => (
						<div className="flex flex-col gap-1">
							<label htmlFor={field.name} className="text-sm font-medium">
								Email
							</label>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								autoComplete="email"
								className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								aria-invalid={!!field.state.meta.errors.length}
							/>
							{field.state.meta.errors.map((err) => (
								<p key={err?.message} className="text-sm text-destructive" role="alert">
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<form.Field
					name="password"
					children={(field) => (
						<div className="flex flex-col gap-1">
							<label htmlFor={field.name} className="text-sm font-medium">
								Password
							</label>
							<PasswordInput
								id={field.name}
								name={field.name}
								autoComplete="new-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={!!field.state.meta.errors.length}
							/>
							<PasswordStrength password={field.state.value} />
							{field.state.meta.errors.map((err) => (
								<p key={err?.message} className="text-sm text-destructive" role="alert">
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<form.Field
					name="confirmPassword"
					children={(field) => (
						<div className="flex flex-col gap-1">
							<label htmlFor={field.name} className="text-sm font-medium">
								Confirm password
							</label>
							<PasswordInput
								id={field.name}
								name={field.name}
								autoComplete="new-password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								error={!!field.state.meta.errors.length}
							/>
							{field.state.meta.errors.map((err) => (
								<p key={err?.message} className="text-sm text-destructive" role="alert">
									{err?.message}
								</p>
							))}
						</div>
					)}
				/>

				<p className="text-xs text-muted-foreground">
					By creating an account, you agree to our{" "}
					<Link href="/terms" className="text-primary underline-offset-4 hover:underline">
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
						Privacy Policy
					</Link>
					.
				</p>

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					children={([canSubmit, isSubmitting]) => (
						<Button type="submit" disabled={!canSubmit} aria-busy={isSubmitting}>
							{isSubmitting ? "Creating account…" : "Create account"}
						</Button>
					)}
				/>
			</form>

			<div className="relative">
				<div className="absolute inset-0 flex items-center">
					<Separator className="w-full" />
				</div>
				<div className="relative flex justify-center text-xs uppercase">
					<span className="bg-background px-2 text-muted-foreground">
						Or continue with
					</span>
				</div>
			</div>

			<OAuthButtons />

			<p className="text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href="/login" className="text-primary underline-offset-4 hover:underline">
					Log in
				</Link>
			</p>
		</div>
	)
}
