"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { NavMain } from "@/components/sidebars/nav-main"
import { NavUser } from "@/components/sidebars/nav-user"
import { AccountNav } from "@/components/sidebars/account-nav"
import { OrgNav } from "@/components/sidebars/org-nav"
import { SidebarBackAction } from "@/components/sidebar-back-action"
import { OrgSwitcher } from "@/components/sidebars/org-switcher"
import { useActiveOrgSlug } from "@/lib/use-active-org-slug"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@workspace/ui/components/sidebar"

import { Home, Settings } from "lucide-react"

// Items are templated at render time: the org-scoped Home is derived from
// the active org's slug via useActiveOrgSlug().
function useDashboardNav() {
	const orgSlug = useActiveOrgSlug()
	return [
		{
			title: "Home",
			url: orgSlug ? `/${orgSlug}/home` : "/",
			icon: <Home />,
			items: [],
		},
	]
}

// Pinned shortcut at the bottom of the sidebar. Since the 2026-07-13 rename,
// this is the **org-scoped** "Settings" entry-point — it answers "configure
// the org I'm currently working in". Hidden when no active org exists (the
// user is in the onboarding flow — the dispatcher routes them to /onboarding,
// and clicking Settings would be confusing).
function OrgSettingsShortcut() {
	const orgSlug = useActiveOrgSlug()
	if (!orgSlug) return null

	return (
		<SidebarGroup className="mt-auto">
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="Settings">
							<Link href={`/${orgSlug}/settings/members`}>
								<Settings className="size-4" />
								<span>Settings</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}

/**
 * Returns true when the current path lives under /account/settings.
 * Used to decide whether to render AccountNav.
 */
export function isAccountSettingsPath(pathname: string): boolean {
	return (
		pathname === "/account/settings" ||
		pathname.startsWith("/account/settings/")
	)
}

/**
 * Returns true when the current path lives under /:org_slug/settings/*.
 * Used to decide whether to render OrgNav.
 */
export function isOrgSettingsPath(pathname: string): boolean {
	return /^\/[^/]+\/settings(\/|$)/.test(pathname)
}

export function AppSidebar({
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname()
	const inAccountSettings = isAccountSettingsPath(pathname)
	const inOrgSettings = isOrgSettingsPath(pathname)
	const inSettings = inAccountSettings || inOrgSettings
	const dashboardNav = useDashboardNav()

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="flex h-14 flex-row items-center border-b p-0">
				<div className="flex w-full items-center">
					<OrgSwitcher />
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarBackAction />
					</SidebarGroupContent>
				</SidebarGroup>
				{inAccountSettings ? (
					<AccountNav />
				) : inOrgSettings ? (
					<OrgNav />
				) : (
					<NavMain items={dashboardNav} />
				)}
				{!inSettings && <OrgSettingsShortcut />}
			</SidebarContent>
			<SidebarFooter className="border-t">
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	)
}