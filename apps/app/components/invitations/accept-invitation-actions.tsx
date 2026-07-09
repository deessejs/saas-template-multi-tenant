"use client"

/**
 * Accept / Decline buttons for an open invitation.
 *
 * Wires `authClient.organization.acceptInvitation` / `rejectInvitation`.
 *
 * On accept: the server's `afterAcceptInvitation` hook (per `org.md`) sets the
 * invited org as active. Combined with the bug #9710 workaround in
 * `apps/app/lib/auth-client.ts`, `useActiveOrganization()` refetches correctly.
 * If the workaround regresses upstream, fall back to `window.location.href = "/home"`.
 *
 * The `authClient.organization` namespace is not in better-auth's `ReactAuthClient`
 * type — same TS2883 situation as `org-switcher.tsx`. Cast through `unknown`.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
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
    // Hard reload — the active-org signal workaround should refetch on the
    // session-signal change, but a full reload guarantees a clean state.
    if (typeof window !== "undefined") {
      window.location.href = "/home"
    } else {
      router.push("/home")
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
    router.push("/home")
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
