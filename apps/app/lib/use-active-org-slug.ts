"use client"

import { useActiveOrganization } from "@/lib/auth-client"

/**
 * Client-side active-org-slug hook. The URL is the source of truth
 * (temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5); this hook
 * returns whatever the auth-client atom has, which the [org_slug] layout
 * keeps in sync with the URL on every request.
 *
 * Returns `null` while loading or when no active org is set.
 */
export function useActiveOrgSlug(): string | null {
  const { data } = useActiveOrganization()
  return (data as { slug?: string } | null | undefined)?.slug ?? null
}