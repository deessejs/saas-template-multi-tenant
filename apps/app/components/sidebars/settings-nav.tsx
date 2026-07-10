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
  BuildingIcon,
  KeyIcon,
  LinkIcon,
  SmartphoneIcon,
  UserIcon,
} from "lucide-react"
import { useActiveOrgSlug } from "@/lib/use-active-org-slug"

type SettingsNavChild = {
  title: string
  href: string
}

type SettingsNavItem = {
  title: string
  href: string
  icon: typeof UserIcon
  children?: SettingsNavChild[]
  // If true, href is a template and the active org slug is prepended at render.
  orgScoped?: boolean
}

const PERSONAL_ITEMS: SettingsNavItem[] = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: UserIcon,
  },
  {
    title: "Security",
    href: "/settings/security",
    icon: KeyIcon,
    children: [{ title: "Password", href: "/settings/security/password" }],
  },
  {
    title: "Sessions",
    href: "/settings/sessions",
    icon: SmartphoneIcon,
  },
  {
    title: "Connections",
    href: "/settings/connections",
    icon: LinkIcon,
  },
  {
    title: "Account",
    href: "/settings/account",
    icon: BadgeCheckIcon,
    children: [
      { title: "Email", href: "/settings/account/email" },
      { title: "Delete account", href: "/settings/account/delete" },
    ],
  },
]

const ORG_ITEM: SettingsNavItem = {
  title: "Organization",
  // Rendered with the active org slug prepended (see useActiveOrgSlug below).
  href: "/settings/members",
  icon: BuildingIcon,
  orgScoped: true,
}

export function SettingsNav() {
  const pathname = usePathname()
  const orgSlug = useActiveOrgSlug()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Personal settings (user-scoped). */}
          {PERSONAL_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`)

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

          {/* Org settings (org-scoped, only when an active org exists). */}
          {orgSlug && (() => {
            const Icon = ORG_ITEM.icon
            const orgHref = `/${orgSlug}${ORG_ITEM.href}`
            const isActive =
              pathname === orgHref || pathname.startsWith(`${orgHref}/`)
            return (
              <SidebarMenuItem key={orgHref}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={ORG_ITEM.title}
                >
                  <Link href={orgHref}>
                    <Icon className="size-4" />
                    <span>{ORG_ITEM.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })()}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
