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
import {
	BadgeCheckIcon,
	KeyIcon,
	LinkIcon,
	SmartphoneIcon,
	UserIcon,
} from "lucide-react"

// Personal (user-account) settings nav. Rendered when on
// /account/settings/*. The /settings/* legacy URLs are 307-redirected to
// /account/settings/* by server-side redirects (see temp/audit/2026-07-13
// .../03-rename-personal-settings-to-account.md).

type AccountNavChild = {
	title: string
	href: string
}

type AccountNavItem = {
	title: string
	href: string
	icon: typeof UserIcon
	children?: AccountNavChild[]
}

const ITEMS: AccountNavItem[] = [
	{
		title: "Profile",
		href: "/account/settings/profile",
		icon: UserIcon,
	},
	{
		title: "Security",
		href: "/account/settings/security",
		icon: KeyIcon,
		children: [
			{ title: "Password", href: "/account/settings/security/password" },
		],
	},
	{
		title: "Sessions",
		href: "/account/settings/sessions",
		icon: SmartphoneIcon,
	},
	{
		title: "Connections",
		href: "/account/settings/connections",
		icon: LinkIcon,
	},
	{
		title: "Account",
		href: "/account/settings/account",
		icon: BadgeCheckIcon,
		children: [
			{ title: "Email", href: "/account/settings/account/email" },
			{ title: "Delete account", href: "/account/settings/account/delete" },
		],
	},
]

export function AccountNav() {
	const pathname = usePathname()

	return (
		<SidebarGroup>
			<SidebarGroupContent>
				<SidebarMenu>
					{ITEMS.map((item) => {
						const Icon = item.icon
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`)

						return (
							<SidebarMenuItem key={item.href}>
								<SidebarMenuButton
									asChild
									isActive={isActive}
									tooltip={item.title}
								>
									<Link href={item.href}>
										<Icon className="size-4" />
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
								{item.children && isActive && (
									<div className="ml-6 flex flex-col gap-1 border-l pl-4">
										{item.children.map((child) => (
											<Link
												key={child.href}
												href={child.href}
												className="text-sm text-muted-foreground hover:text-foreground"
											>
												{child.title}
											</Link>
										))}
									</div>
								)}
							</SidebarMenuItem>
						)
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	)
}