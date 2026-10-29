"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { forgotPasswordSchema } from "@/components/auth/schemas"

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)

  const form = useForm({
    defaultValues: { email: "" },
    validators: {
      onSubmit: forgotPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
      })
      // Always succeed to avoid email enumeration
      setSent(true)
      if (error) {
        toast.error(error.message ?? "Something went wrong")
      }
    },
  })

  if (sent) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
        <p className="font-medium">Email sent</p>
        <p>Check your email for a reset link.</p>
        <Link
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      </div>
    )
  }

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

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
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
