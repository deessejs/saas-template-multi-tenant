"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { OAuthButtons } from "./oauth-buttons"
import { PasswordInput } from "./password-input"
import { loginSchema } from "@/components/auth/schemas"

export function LoginForm() {
  const router = useRouter()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.email(value, {
        onSuccess: () => router.push("/home"),
      })
      if (error) {
        toast.error(error.message ?? "Invalid credentials")
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
              <div className="flex items-center justify-between">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id={field.name}
                name={field.name}
                autoComplete="current-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                error={!!field.state.meta.errors.length}
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

        <div className="flex items-center gap-2">
          <Checkbox id="remember" name="remember" />
          <label htmlFor="remember" className="text-sm font-normal">
            Remember me
          </label>
        </div>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
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
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-primary underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
