"use client"

/**
 * Accept / Decline buttons for an open invitation.
 *
 * Wires `authClient.organization.acceptInvitation` / `rejectInvitation`.
 *
 * On accept: the server's `afterAcceptInvitation` hook (per `org.md`) sets
 * the invited org as active. The `acceptInvitation` path matches the
 * organization plugin's atomListeners, so `useActiveOrganization()`
 * refetches correctly without a hard reload.
 *
 * The `authClient.organization` namespace is not in better-auth's
 * `ReactAuthClient` type — same TS2883 situation as `org-switcher.tsx`.
 * Cast through `unknown`.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient, useActiveOrganization } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"

interface AcceptInvitationActionsProps {
  invitationId: string
}

type OrganizationApi = {
  organization: {
    acceptInvitation: (opts: { invitationId: string }) => Promise<{ error: { message?: string } | null }>
    rejectInvitation: (opts: { invitationId: string }) => Promise<{ error: { message?: string } | null }>
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const orgApi = authClient as any as OrganizationApi

export function AcceptInvitationActions({
  invitationId,
}: AcceptInvitationActionsProps) {
  const router = useRouter()
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  // Hooks must be called at the top of the component. Read the active
  // org's slug once and use it in the event handlers below.
  const { data: activeOrg } = useActiveOrganization()
  const activeOrgSlug = (activeOrg as { slug?: string } | null | undefined)?.slug ?? null

  async function handleAccept() {
    if (accepting) return
    setAccepting(true)
    const { error } = await orgApi.organization.acceptInvitation({
      invitationId,
    })
    if (error) {
      setAccepting(false)
      toast.error(error.message ?? "Could not accept invitation")
      return
    }
    toast.success("Invitation accepted")
    // `afterAcceptInvitation` in packages/auth/src/auth.ts sets the accepted
    // org as active. Navigate to /:slug/home, or fall back to the
    // dispatcher at "/" if the slug isn't loaded yet.
    router.refresh()
    if (activeOrgSlug) {
      router.push(`/${activeOrgSlug}/home`)
    } else {
      router.push("/")
    }
  }

  async function handleDecline() {
    if (declining) return
    setDeclining(true)
    const { error } = await orgApi.organization.rejectInvitation({
      invitationId,
    })
    if (error) {
      setDeclining(false)
      toast.error(error.message ?? "Could not decline invitation")
      return
    }
    toast.success("Invitation declined")
    // User still has their existing active org (decline doesn't touch it).
    if (activeOrgSlug) {
      router.push(`/${activeOrgSlug}/home`)
    } else {
      router.push("/")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleAccept}
        disabled={accepting || declining}
        aria-busy={accepting}
      >
        {accepting ? "Joining…" : "Accept invitation"}
      </Button>
      <Button
        variant="outline"
        onClick={handleDecline}
        disabled={accepting || declining}
        aria-busy={declining}
      >
        {declining ? "Declining…" : "Decline"}
      </Button>
    </div>
  )
}