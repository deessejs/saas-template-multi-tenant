import { redirect } from "next/navigation"

// Legacy alias. See temp/audit/2026-07-13-apps-app-organizations-new/problems/03-rename-personal-settings-to-account.md.
export default function SettingsSessionsLegacyRedirect() {
	redirect("/account/settings/sessions")
}