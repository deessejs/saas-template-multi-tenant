"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { OAuthButtons } from "./oauth-buttons"
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
      const { error } = await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => router.push("/verify-email"),
        }
      )
      if (error) {
        toast.error(error.message ?? "Could not create account")
      }
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
        <form.Field name="name">
          {(field) => (
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
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors.length}
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
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label htmlFor={field.name} className="text-sm font-medium">
                Email
              </label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={!!field.state.meta.errors.length}
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
        </form.Field>

        <form.Field name="password">
          {(field) => (
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
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
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
        </form.Field>

        <p className="text-xs text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link
            href="/terms"
            className="text-primary underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          )}
        </form.Subscribe>
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
        <Link
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  )
}
