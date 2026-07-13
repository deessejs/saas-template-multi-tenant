// Shared app configuration — used by all apps in the workspace.
// Values come from `@workspace/env/client` so the contract is single-sourced
// and the bundler can inline NEXT_PUBLIC_* at build time.

import { clientEnv } from "@workspace/env/client"

export const APP_CONFIG = {
  name: clientEnv.NEXT_PUBLIC_APP_NAME,
  description: clientEnv.NEXT_PUBLIC_APP_DESCRIPTION,
  url: clientEnv.NEXT_PUBLIC_APP_URL,
  links: {
    home: "/",
    login: "/login",
    signup: "/signup",
    // Personal account settings. Renamed from `/settings` to `/account/settings`
    // on 2026-07-13 to make the personal-vs-org-scoped distinction explicit in
    // the URL. See temp/audit/2026-07-13-apps-app-organizations-new/problems/03.
    settings: "/account/settings",
  },
} as const

// Convenience exports
export const APP_NAME = APP_CONFIG.name
export const APP_URL = APP_CONFIG.url

export type AppConfig = typeof APP_CONFIG
