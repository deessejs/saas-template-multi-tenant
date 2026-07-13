"use client"

import { BadgeCheckIcon, LogOutIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Typed items for `NavUser`'s dropdown.
 *
 * Three kinds are supported:
 * - `link`: navigates to an internal route (uses `next/link`)
 * - `action`: triggers a client-side callback (e.g. sign-out)
 * - `disabled`: rendered as a non-interactive item with an optional tooltip
 *   (used for "Coming soon" affordances)
 *
 * Why extracted from `nav-user.tsx`:
 * - Reusable for a future mobile top-bar or `Cmd+K` palette
 * - Pure function → trivially unit-testable
 * - Adding/removing items (Billing, Notifications, etc.) becomes a one-line change
 *   here rather than a JSX edit
 *
 * Decision 2026-07-09 (D3 in audit report r2): only `Account` and `Log out`
 * ship today. `Billing`, `Notifications`, and `Upgrade to Pro` were removed from
 * the menu because their target pages don't exist (see audit §F5.1).
 */
export type UserMenuItem =
  | { kind: "link"; icon: LucideIcon; label: string; href: string }
  | { kind: "action"; icon: LucideIcon; label: string; onClick: () => void }
  | {
      kind: "disabled"
      icon: LucideIcon
      label: string
      tooltip?: string
    }

export interface UserMenuItemsOptions {
  /** Called when the user picks "Log out". The menu disables itself while this is in-flight. */
  handleLogout: () => void
  /** Target for the Account link. Since the 2026-07-13 rename, the canonical personal-account destination is `/account/settings/account`. */
  accountHref: string
}

export function buildUserMenuItems(
  opts: UserMenuItemsOptions,
): UserMenuItem[] {
  return [
    {
      kind: "link",
      icon: BadgeCheckIcon,
      label: "Account",
      href: opts.accountHref,
    },
    {
      kind: "action",
      icon: LogOutIcon,
      label: "Log out",
      onClick: opts.handleLogout,
    },
  ]
}
