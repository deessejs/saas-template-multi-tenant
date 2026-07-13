import { redirect } from "next/navigation"

// Legacy alias. The canonical route is `/account/settings` (renamed
// 2026-07-13); this redirect preserves bookmarks and external links.
// See temp/audit/2026-07-13-apps-app-organizations-new/problems/03-rename-personal-settings-to-account.md.
export default function SettingsLegacyRedirect() {
	redirect("/account/settings")
}