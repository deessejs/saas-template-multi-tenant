/**
 * Auth test utilities
 *
 * Provides test auth instance with testUtils plugin.
 * Import this in your tests instead of the production auth.
 *
 * The test database is shared via @workspace/database/test-utils (PGlite).
 * No more ad-hoc postgres-js pool construction in this file.
 */
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { testUtils } from "better-auth/plugins"
import { setupTestDb, cleanup, type Drizzle } from "@workspace/database/test-utils"
import * as schema from "@workspace/database/schema"
import { serverEnv } from "@workspace/env/server"
import { sendAuthEmail, templates } from "@workspace/email"
import { afterAll, beforeAll } from "vitest"

let db: Drizzle

beforeAll(async () => {
  db = await setupTestDb()
})

afterAll(async () => {
  await cleanup()
})

// Test auth instance with testUtils
export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      void sendAuthEmail({
        to: user.email,
        subject: "Reset your password",
        react: templates.ResetPassword({ url, userEmail: user.email }),
        tags: [{ name: "flow", value: "reset-password" }],
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your email",
        react: templates.VerifyEmail({ url, userEmail: user.email }),
        tags: [{ name: "flow", value: "verify-email" }],
      })
    },
  },
  plugins: [
    testUtils(),
  ],
})

// Export types
export type TestHelpers = Awaited<ReturnType<typeof auth.$context>>["test"]
