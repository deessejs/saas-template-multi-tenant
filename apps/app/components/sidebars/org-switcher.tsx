"use client"

import { useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
import { authClient } from "@/lib/auth-client"
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"

// TS2883: the inferred type of authClient references internal better-auth types that are
// are not portable. The organization plugin hooks are present at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orgClient = authClient as any

function getOrgInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function OrgSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const { data: organizations } = orgClient.useListOrganizations()
  const { data: activeOrganization } = orgClient.useActiveOrganization()

  const orgs = (organizations ?? []) as Array<{
    id: string
    name: string
    slug: string
    logo?: string | null
  }>

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              {activeOrganization?.logo ? (
                <Image
                  src={activeOrganization.logo}
                  alt={activeOrganization.name}
                  width={32}
                  height={32}
                  className="shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">
                  {getOrgInitials(activeOrganization?.name ?? "Org")}
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">
                  {activeOrganization?.name ?? "Select organization"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeOrganization?.slug ?? ""}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {orgs.map((org, index) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  startTransition(async () => {
                    await orgClient.organization.setActive({
                      organizationId: org.id,
                    })
                    // State → URL alignment (per the source-of-truth rule
                    // in temp/reports/auth/2026-07-10-dashboard-not-org-scoped.md §5).
                    // The cookie is now updated, navigate to the new
                    // org's home so the URL reflects the active org.
                    router.push(`/${org.slug}/home`)
                  })
                }}
                className="gap-2 p-2"
              >
                {org.logo ? (
                  <Image
                    src={org.logo}
                    alt={org.name}
                    width={24}
                    height={24}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                    {getOrgInitials(org.name)}
                  </div>
                )}
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === activeOrganization?.id && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    ⌘{index + 1}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href="/onboarding">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-transparent">
                  <PlusIcon className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  Create new organization
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
