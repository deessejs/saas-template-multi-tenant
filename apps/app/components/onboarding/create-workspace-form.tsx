"use client"

import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field } from "@/components/auth/field"
import {
  deriveSlug,
  findAvailableSlug,
  isSlugAvailable,
  SlugDerivationError,
} from "@/lib/slug"
import { createWorkspaceSchema } from "./schemas"

// TS2883: `authClient.organization` is not in better-auth's public
// `ReactAuthClient` type. Cast through `unknown` to a structurally-typed
// callable. Same pattern as `components/settings/organization/members-manager.tsx`.
//
// Cast reflects:
// - the body schema (baseOrganizationSchema in crud-org.mjs:12-19)
// - the client return shape ({ data, error } — better-fetch does NOT throw
//   by default; see @better-fetch/fetch@1.1.21/.../index.cjs:714-727)
type OrganizationApi = {
  organization: {
    create: (data: {
      name: string
      slug: string
      logo?: string | null
      metadata?: Record<string, unknown>
      keepCurrentActiveOrganization?: boolean
    }) => Promise<{
      data: { id: string; slug: string } | null
      error: { code?: string; message?: string } | null
    }>
  }
}

const orgApi = authClient as unknown as OrganizationApi

const COLLISION_RETRY_CAP = 3

export function CreateWorkspaceForm() {
  const router = useRouter()

  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmit: createWorkspaceSchema,
    },
    onSubmit: async ({ value }) => {
      // 1. Derive the base slug from the workspace name.
      let baseSlug: string
      try {
        baseSlug = deriveSlug(value.name)
      } catch (error) {
        if (error instanceof SlugDerivationError) {
          toast.error(error.message)
          return
        }
        throw error
      }

      // 2. Find an available slug with up-front collision probing.
      //    findAvailableSlug retries with `-N` suffix on collision.
      let slug: string
      try {
        slug = await findAvailableSlug(baseSlug, isSlugAvailable)
      } catch (error) {
        if (error instanceof SlugDerivationError) {
          toast.error(error.message)
          return
        }
        throw error
      }

      // 3. Create with retry on race: two users may both pass check-slug,
      //    but only one wins the create. Catch ORGANIZATION_ALREADY_EXISTS
      //    and retry with the next suffix (crud-org.mjs:62 throws this).
      let attempt = 0
      let result: Awaited<ReturnType<typeof orgApi.organization.create>>
      while (attempt <= COLLISION_RETRY_CAP) {
        result = await orgApi.organization.create({ name: value.name, slug })
        if (!result.error) break

        if (
          result.error.code === "ORGANIZATION_ALREADY_EXISTS" &&
          attempt < COLLISION_RETRY_CAP
        ) {
          attempt++
          slug = `${baseSlug}-${attempt + 1}`
          continue
        }
        toast.error(result.error.message ?? "Could not create workspace")
        return
      }

      // 4. Server-side validation may set `error` to a truthy object without
      //    `code`. Defensive guard.
      if (result!.error) {
        toast.error(result!.error.message ?? "Could not create workspace")
        return
      }

      // 5. `create` invalidates both $activeOrgSignal and $sessionSignal
      //    on the client (see org.md:154 — atomListeners on this path),
      //    so a soft navigation suffices. Org-scoping landed, so the
      //    created org's slug is in the URL.
      router.refresh()
      router.push(`/${result!.data!.slug}/home`)
    },
  })

  // Note: live slug preview (the §4.6 snippet from the report) is deferred to
  // a follow-up. PR scope here is the form's submit handler + retry logic only.

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
            <Field name={field.name} label="Workspace name" errors={errors}>
              <Input
                id={field.name}
                name={field.name}
                type="text"
                autoComplete="off"
                autoFocus
                placeholder="Acme Inc."
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={errors.length > 0}
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
              {isSubmitting ? "Creating…" : "Create workspace"}
            </Button>
          )}
        />
      </div>
    </form>
  )
}