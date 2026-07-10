import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { nextCookies } from "better-auth/next-js"
import { db } from "@workspace/database"
import * as schema from "@workspace/database"
import { serverEnv } from "@workspace/env/server"
import { sendAuthEmail, templates } from "@workspace/email"
import { organization } from "better-auth/plugins"

/**
 * Organization plugin options shared between the runtime auth instance and the
 * test auth instance. Kept in sync by living in the same file.
 */
const organizationPluginOptions = {
  requireEmailVerificationOnInvitation: true,

  sendInvitationEmail: async ({
    email,
    organization: org,
    inviter,
    invitation,
  }: {
    email: string
    organization: { name: string }
    inviter: { user?: { name?: string | null; email: string } | null }
    invitation: { id: string; role?: string; expiresAt: Date }
  }) => {
    const inviteLink = `${serverEnv.BETTER_AUTH_URL}/accept-invitation?id=${invitation.id}`
    void sendAuthEmail({
      to: email,
      subject: `Join ${org.name}`,
      react: templates.InvitationEmail({
        inviteLink,
        organizationName: org.name,
        inviterName: inviter.user?.name ?? inviter.user?.email ?? "Someone",
        inviterEmail: inviter.user?.email ?? "",
        role: invitation.role ?? "member",
        expiresAt: new Date(invitation.expiresAt),
      }),
      tags: [{ name: "flow", value: "invitation" }],
      idempotencyKey: invitation.id,
    })
  },
}

export const auth = betterAuth({
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: serverEnv.BETTER_AUTH_SECRET,
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    ...serverEnv.ALLOWED_ORIGINS,
  ],

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
    // Send a verification email on signup. Without this, brand-new users
    // have `emailVerified = false` and cannot sign in (since
    // `requireEmailVerification: true` above enforces verification).
    // In dev, the email is logged to the console via the Resend + console
    // setup in packages/email — the verification link is in the terminal.
    sendOnSignUp: true,
    // `shouldSkipAutoSignIn` is true when `requireEmailVerification: true`
    // (see sign-up.mjs:161-162). So sign-up does NOT create a session.
    // Without `autoSignInAfterVerification: true`, the verification endpoint
    // would mark the email verified but leave the user not-logged-in —
    // they'd have to manually re-type their credentials at /login. With
    // this set, the verification endpoint creates a session + setSessionCookie,
    // redirecting them into the app fully authenticated.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your email",
        react: templates.VerifyEmail({ url, userEmail: user.email }),
        tags: [{ name: "flow", value: "verify-email" }],
      })
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  advanced: {
    // In production, mark cookies Secure (HTTPS-only). In dev (HTTP), drop
    // the Secure flag so cookies stick on http://localhost. Without this
    // guard, browsers silently drop the Set-Cookie header on HTTP origins
    // and sessions never persist client-side.
    // See docs/guides/better-auth/pitfalls.md (former §4) for context.
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  experimental: {
    joins: true,
  },

  // Org creation happens at /onboarding via authClient.organization.create,
  // which correctly invalidates the active-org atom on the client (avoids
  // [better-auth #9710](https://github.com/better-auth/better-auth/issues/9710)).
  plugins: [
    organization({
      ...organizationPluginOptions,
      // After accepting an invitation, set the invited org as the active one.
      organizationHooks: {
        afterAcceptInvitation: async ({ organization: org }) => {
          // `setActiveOrganization` is not in better-auth's public TS surface
          // (TS2883). Cast through `any` to access the runtime method.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (auth.api as any).setActiveOrganization({
            body: { organizationId: org.id },
            headers: new Headers(),
          })
        },
      },
    }),
    nextCookies(),
  ],
}) as unknown as ReturnType<typeof betterAuth>

// Type exports for consumers
export type AuthInstance = typeof auth
export type { Session, User } from "better-auth"
