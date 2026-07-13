import Link from "next/link"
import { SettingsCard } from "@/components/settings"
import {
	BadgeCheckIcon,
	KeyIcon,
	LinkIcon,
	SmartphoneIcon,
	UserIcon,
} from "lucide-react"

const SECTIONS = [
	{
		title: "Profile",
		description: "Manage your public profile information.",
		href: "/account/settings/profile",
		icon: UserIcon,
	},
	{
		title: "Security",
		description: "Manage your password and active sessions.",
		href: "/account/settings/security",
		icon: KeyIcon,
	},
	{
		title: "Sessions",
		description: "View and manage your active devices.",
		href: "/account/settings/sessions",
		icon: SmartphoneIcon,
	},
	{
		title: "Connections",
		description: "Manage your linked social accounts.",
		href: "/account/settings/connections",
		icon: LinkIcon,
	},
	{
		title: "Account",
		description: "Manage your email and delete your account.",
		href: "/account/settings/account",
		icon: BadgeCheckIcon,
	},
]

export default function AccountSettingsPage() {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold">Account settings</h1>
				<p className="text-sm text-muted-foreground">
					Manage your personal account settings. Org-scoped settings live
					under each organization.
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{SECTIONS.map((section) => {
					const Icon = section.icon
					return (
						<Link key={section.href} href={section.href}>
							<SettingsCard title="" description="">
								<div className="flex items-center gap-4">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
										<Icon className="size-5 text-muted-foreground" />
									</div>
									<div className="flex-1">
										<h2 className="font-medium">{section.title}</h2>
										<p className="text-sm text-muted-foreground">{section.description}</p>
									</div>
								</div>
							</SettingsCard>
						</Link>
					)
				})}
			</div>
		</div>
	)
}