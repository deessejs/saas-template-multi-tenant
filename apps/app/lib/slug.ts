import slugify from "@sindresorhus/slugify"
import { authClient } from "@/lib/auth-client"

/**
 * Slug derivation, collision detection, and retry helpers for org creation.
 *
 * better-auth's POST /organization/create requires BOTH `name` and `slug`
 * (crud-org.mjs:14 — `slug: z.string().min(1)`). The server does NOT derive
 * the slug from the name; the client must provide one. We do that here,
 * then verify availability via /organization/check-slug before create.
 *
 * Reference: temp/reports/auth/2026-07-10-organization-create-requires-slug-400.md
 */

// TS2883: `authClient.organization` is not in better-auth's public
// ReactAuthClient type. Cast through unknown to a structurally-typed callable
// here so consumers don't repeat the workaround.
// Note: the client method is `checkSlug`, not `checkOrganizationSlug` —
// the "Organization" is already in the `authClient.organization` namespace.
// The endpoint is at /organization/check-slug (crud-org.mjs:152) and the
// dynamic-path proxy builds the URL from the camelCase method name.
type OrganizationApi = {
  organization: {
    checkSlug: (data: { slug: string }) => Promise<{
      data: { status: true } | null
      error: { code?: string; message?: string } | null
    }>
  }
}
const orgApi = authClient as unknown as OrganizationApi

const SLUG_MAX_LENGTH = 48
const SLUG_MIN_LENGTH = 2
const RETRY_CAP = 5

export class SlugDerivationError extends Error {
  readonly code = "SLUG_DERIVATION_FAILED" as const
}

/**
 * Derive a URL-safe slug from an organization name.
 *
 * Rules: lowercase, ASCII-only (transliterates diacritics), ASCII letters /
 * digits / hyphens only, no leading/trailing hyphen, capped at SLUG_MAX_LENGTH
 * chars. Throws SlugDerivationError if the result is shorter than SLUG_MIN_LENGTH
 * (e.g. all-emoji names, whitespace-only names).
 */
export function deriveSlug(name: string): string {
  const slug = slugify(name, { decamelize: false })
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-$/, "") // strip trailing dash from truncate

  if (slug.length < SLUG_MIN_LENGTH) {
    throw new SlugDerivationError(
      `Cannot derive a usable slug from "${name}". Use at least ${SLUG_MIN_LENGTH} letters or digits.`,
    )
  }
  return slug
}

/**
 * Check whether a slug is available for use.
 *
 * Calls `authClient.organization.checkSlug({ slug })` (the client method
 * is `checkSlug`, not `checkOrganizationSlug` — the "Organization" is
 * already in the `authClient.organization` namespace).
 *
 * better-fetch returns { data, error } by default — it does NOT throw.
 * The server-side throw at crud-org.mjs:158 is translated into a returned
 * error.code by better-fetch.
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const { data, error } = await orgApi.organization.checkSlug({ slug })
  if (data?.status === true) return true
  if (error?.code === "ORGANIZATION_SLUG_ALREADY_TAKEN") return false
  if (error) throw new Error(error.message ?? "Could not check slug availability")
  return false // unexpected: no data, no error
}

/**
 * Find an available slug, retrying with `-N` suffix on collision.
 *
 * Returns the first available slug (e.g. `acme`, `acme-2`, `acme-3`, ...).
 * Throws SlugDerivationError if RETRY_CAP attempts all collide.
 */
export async function findAvailableSlug(
  base: string,
  isAvailable: (slug: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < RETRY_CAP; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    if (await isAvailable(candidate)) return candidate
  }
  throw new SlugDerivationError(
    `Could not find an available slug for "${base}" after ${RETRY_CAP} attempts.`,
  )
}