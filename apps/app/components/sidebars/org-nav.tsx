"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { BuildingIcon } from "lucide-react"
import { useActiveOrgSlug } from "@/lib/use-active-org-slug"

// Org-scoped settings nav. Rendered when on /${org_slug}/settings/*.
// Only renders when an active org exists (useActiveOrgSlug returns null
// otherwise) — without an active org there's nothing to manage here, and
// the dispatcher routes such users to /onboarding instead.

type OrgNavItem = {
	title: string
	href: string // relative to /${orgSlug}, no leading slash
	icon: typeof BuildingIcon
}

const ITEMS: OrgNavItem[] = [
	{
		title: "Members",
		href: "/settings/members",
		icon: BuildingIcon,
	},
]

export function OrgNav() {
	const pathname = usePathname()
	const orgSlug = useActiveOrgSlug()
	if (!orgSlug) return null

	return (
		<SidebarGroup>
			<SidebarGroupContent>
				<SidebarMenu>
					{ITEMS.map((item) => {
						const fullHref = `/${orgSlug}${item.href}`
						const isActive =
							pathname === fullHref || pathname.startsWith(`${fullHref}/`)
						const Icon = item.icon
						return (
							<SidebarMenuItem key={fullHref}>
								<SidebarMenuButton
									asChild
									isActive={isActive}
									tooltip={item.title}
								>
									<Link href={fullHref}>
										<Icon className="size-4" />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}