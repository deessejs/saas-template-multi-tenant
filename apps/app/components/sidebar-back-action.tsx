"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

// Path predicates shared with AppSidebar. Importing here would create a
// circular import (app-sidebar.tsx → sidebar-back-action.tsx → app-sidebar.tsx),
// so the helpers are duplicated and kept in sync.

function isAccountSettingsPath(pathname: string): boolean {
	return (
		pathname === "/account/settings" ||
		pathname.startsWith("/account/settings/")
	)
}

function isOrgSettingsPath(pathname: string): boolean {
	return /^\/[^/]+\/settings(\/|$)/.test(pathname)
}

/**
 * Contextual "Back" action rendered inside the sidebar. Shown only on
 * settings routes so users can return to the dashboard.
 *
 * Targets:
 *   - On /${org_slug}/settings/* → back to /${org_slug}/home
 *   - On /account/settings/*      → back to "/" (dispatcher routes)
 *
 * Client component because it reads `useParams()` and the pathname. The
 * surrounding AppSidebar is also client so this composes cleanly.
 *
 * Note: this still uses `window.location.pathname` rather than
 * `usePathname()` from `next/navigation`. Tracked for cleanup in the
 * 2026-07-10 audit #08 (usePathname polish). The current behavior is
 * correct after hydration.
 */
export function SidebarBackAction() {
	const params = useParams<{ org_slug?: string }>()
	const pathname =
		typeof window !== "undefined" ? window.location.pathname : ""

	if (!isAccountSettingsPath(pathname) && !isOrgSettingsPath(pathname)) {
		return null
	}

	const href = params.org_slug ? `/${params.org_slug}/home` : "/"

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton asChild tooltip="Back to home">
					<Link href={href}>
						<ArrowLeftIcon className="size-4" />
						<span>Back to home</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}