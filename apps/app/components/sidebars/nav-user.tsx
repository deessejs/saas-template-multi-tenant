"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@workspace/ui/components/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@workspace/ui/components/sidebar"
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { buildUserMenuItems } from "@/lib/user-menu-items"

const VERCEL_AVATAR_BASE = "https://vercel.com/api/www/avatar"

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) return "?"
	if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
	return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function getAvatarUrl(email: string, image?: string | null): string {
	if (image) return image
	return `${VERCEL_AVATAR_BASE}?s=40&u=${encodeURIComponent(email)}&dpl=dpl_AS99V7XmtTzE4xdb72tYFtNTVV48`
}

/**
 * Renders one entry from the `buildUserMenuItems()` config. Kept inline rather
 * than extracted so the icon-to-component mapping stays obvious at the call site.
 */
function renderMenuItem(
	item: ReturnType<typeof buildUserMenuItems>[number],
	loggingOut: boolean,
) {
	if (item.kind === "link") {
		const Icon = item.icon
		return (
			<DropdownMenuItem asChild>
				<Link href={item.href}>
					<Icon />
					<span>{item.label}</span>
				</Link>
			</DropdownMenuItem>
		)
	}
	if (item.kind === "action") {
		// Log-out gets the in-flight disabled state and dynamic label.
		// This is the only action today; if more in-flight actions are added,
		// lift this state into the config (e.g. add `inFlight?: boolean` to
		// the action variant).
		const isLogOut = item.label === "Log out"
		return (
			<DropdownMenuItem
				onClick={item.onClick}
				disabled={isLogOut ? loggingOut : false}
				aria-busy={isLogOut ? loggingOut : false}
			>
				<LogOutIcon />
				<span>{isLogOut && loggingOut ? "Signing out…" : item.label}</span>
			</DropdownMenuItem>
		)
	}
	// disabled
	const Icon = item.icon
	return (
		<DropdownMenuItem disabled title={item.tooltip}>
			<Icon />
			<span>{item.label}</span>
		</DropdownMenuItem>
	)
}

export function NavUser() {
	const router = useRouter()
	const { isMobile } = useSidebar()
	const { data: session } = authClient.useSession()
	const [loggingOut, setLoggingOut] = useState(false)

	const user = session?.user

	async function handleLogout() {
		setLoggingOut(true)
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => router.push("/login"),
			},
		})
	}

	const menuItems = buildUserMenuItems({
		accountHref: "/settings/account",
		handleLogout,
	})

	// No session — render an anonymous "Guest" placeholder
	if (!user) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" disabled>
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarFallback className="rounded-lg">?</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">Guest</span>
							<span className="truncate text-xs">Not signed in</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		)
	}

	const avatarUrl = getAvatarUrl(user.email, user.image)
	const initials = getInitials(user.name)

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								<AvatarImage src={avatarUrl} alt={user.name} />
								<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">{user.name}</span>
								<span className="truncate text-xs">{user.email}</span>
							</div>
							<ChevronsUpDownIcon className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-fit"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={avatarUrl} alt={user.name} />
									<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user.name}</span>
									<span className="truncate text-xs">{user.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{menuItems.map((item, idx) => (
							<div key={`${item.kind}-${item.label}`}>
								{idx > 0 && <DropdownMenuSeparator />}
								{renderMenuItem(item, loggingOut)}
							</div>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
