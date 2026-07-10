"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/")
}

/**
 * Contextual "Back" action rendered inside the sidebar. Shown only on
 * /settings/* routes so users can return to the dashboard.
 *
 * The "Back to home" target is the active org's home (under [org_slug]/home),
 * derived from the current URL params. If the user is on a personal
 * /settings/* path (no org_slug in the URL), the back link goes to "/".
 *
 * Client component because it reads `useParams()`. The surrounding
 * AppSidebar is also client so this composes cleanly.
 */
export function SidebarBackAction() {
  const params = useParams<{ org_slug?: string }>()
  const pathname = typeof window !== "undefined" ? window.location.pathname : ""

  if (!isSettingsPath(pathname)) {
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