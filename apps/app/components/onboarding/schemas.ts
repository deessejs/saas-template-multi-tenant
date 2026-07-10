import { z } from "zod"

/**
 * Zod schema for the /onboarding create-workspace form.
 *
 * Mirrors the pattern in `apps/app/components/auth/schemas.ts` and
 * `apps/app/components/settings/schemas.ts` — validated on submit via
 * `validators: { onSubmit: <schema> }` from TanStack Form.
 *
 * `slug` is NOT a form field. better-auth's POST /organization/create
 * requires it (crud-org.mjs:14 — `slug: z.string().min(1)`), but better-auth
 * does NOT derive it from the name server-side. The form derives the slug
 * client-side at submit time using `deriveSlug()` from
 * `apps/app/lib/slug.ts`, then probes availability via `findAvailableSlug()`,
 * then passes `{ name, slug }` to the create call.
 *
 * See: temp/reports/auth/2026-07-10-organization-create-requires-slug-400.md
 */
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(60, "Workspace name is too long")
    .trim(),
})