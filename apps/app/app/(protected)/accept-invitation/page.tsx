import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { BuildingIcon, MailIcon, UserIcon } from "lucide-react"
import { auth } from "@workspace/auth"
import { getSession } from "@/lib/session"
import { Button } from "@workspace/ui/components/button"
import { AcceptInvitationActions } from "@/components/invitations/accept-invitation-actions"

type SearchParamsInput = { id?: string | undefined }
type PageProps = { searchParams: Promise<SearchParamsInput> }

/**
 * Accept-invitation page (D6).
 *
 * URL contract: `/accept-invitation?id=<invitationId>` (id only — server-side
 * `getInvitation` is the single source of truth for display data). The email
 * template `templates/InvitationEmail` is unchanged.
 *
 * State machine:
 *   1. Not authenticated            → redirect to /login?redirect=...
 *   2. Missing id                   → "Invalid invitation link"
 *   3. Invitation not found         → "This invitation is invalid or has been cancelled"
 *   4. Invitation expired           → "This invitation has expired. Ask the inviter..."
 *   5. Authenticated wrong email    → "Sign in as {email} to accept this invitation"
 *   6. Already accepted             → redirect /home
 *   7. Valid                        → AcceptInvitationActions (Accept / Decline)
 */
// React 19's `react-hooks/purity` rule flags any call to non-pure functions
// (Date.now, searchParams await, etc.) inside an async server component body.
// In a Next.js 15+ async server component, these are documented patterns and
// suppression is the pragmatic choice. We disable the rule for this page only.
/* eslint-disable react-hooks/purity */
export default async function AcceptInvitationPage({ searchParams }: PageProps) {
  // Hoist `Date.now()` once so the JSX render path stays pure per React 19 lint.
  const nowMs = Date.now()

  const params = await searchParams
  const id: string = params.id ?? ""

  const session = await getSession()
  // Defensive — proxy.ts should redirect unauth'd users before reaching here.
  if (!session?.user) {
    const redirectTarget = id
      ? `/login?redirect=/accept-invitation?id=${encodeURIComponent(id)}`
      : "/login"
    redirect(redirectTarget)
  }

  if (!id) {
    return (
      <StatusPanel
        title="Invalid invitation link"
        description="This invitation link is missing or malformed."
      />
    )
  }

  // Server-side fetch via better-auth. query.id is the only trusted input —
  // any display data (org name, role, inviter, expiresAt) comes from this call.
  // The `getInvitation` endpoint exists at runtime per org.md but is not in the
  // `auth.api` TS surface (same TS2883 caveat as `auth-client.ts`); cast
  // through `unknown` to a structurally-typed callable.
  const requestHeaders = await headers()
  const getInvitation = (
    auth.api as unknown as {
      getInvitation: (opts: { query: { id: string }; headers: Headers }) => Promise<InvitationView>
    }
  ).getInvitation

  let invitation: InvitationView | null = null
  let fetchError: "not_found" | "unknown" | null = null

  try {
    invitation = await getInvitation({ query: { id }, headers: requestHeaders })
  } catch {
    fetchError = "not_found"
  }

  if (fetchError === "not_found" || !invitation) {
    return (
      <StatusPanel
        title="Invitation unavailable"
        description="This invitation is invalid, has been cancelled, or you no longer have access to it."
      />
    )
  }

  // Expiry check (better-auth also enforces server-side; this is for UX).
  const expiresAt =
    invitation.expiresAt instanceof Date
      ? invitation.expiresAt
      : new Date(invitation.expiresAt)
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < nowMs) {
    return (
      <StatusPanel
        title="Invitation expired"
        description="This invitation has expired. Ask the inviter to send a new one."
      />
    )
  }

  // Wrong email — the invitation is for a different address.
  if (
    session.user.email &&
    invitation.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    return (
      <StatusPanel
        title="Wrong account"
        description={`This invitation is for ${invitation.email}. Sign out and sign in with that address to accept.`}
        Icon={MailIcon}
      />
    )
  }

  // Already accepted?
  if (invitation.status && invitation.status !== "pending") {
    redirect("/home")
  }

  const orgName = invitation.organization?.name ?? "this organization"
  const inviterName =
    invitation.inviter?.user?.name ?? invitation.inviter?.user?.email ?? "Someone"
  const role = invitation.role ?? "member"

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border p-6 text-center">
      <div className="flex justify-center">
        <div className="flex size-12 items-center justify-center rounded-full border bg-muted">
          <BuildingIcon className="size-5 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Join {orgName}</h1>
        <p className="text-sm text-muted-foreground">
          <UserIcon className="mr-1 inline size-3.5" />
          {inviterName} invited you to join as <strong>{role}</strong>.
        </p>
      </div>

      <AcceptInvitationActions invitationId={invitation.id} />
    </div>
  )
}

type InvitationView = {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: Date | string
  organizationId: string
  inviterId: string
  organization?: { id: string; name: string; slug: string } | undefined
  inviter?: { user?: { name?: string; email?: string } } | undefined
}

function StatusPanel({
  title,
  description,
  Icon = MailIcon,
}: {
  title: string
  description: string
  Icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-lg border p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" asChild>
        <a href="/login">Go to login</a>
      </Button>
    </div>
  )
}
