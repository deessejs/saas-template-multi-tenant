"use client"

/**
 * Org members manager (D7 — members-only scope).
 *
 * Sections:
 *  1. Members list — name, email, role select, remove action
 *  2. Pending invitations — email, role, inviter, cancel action
 *  3. Invite form — email + role select + send (admin/owner only)
 *  4. Leave organization — non-owners only
 *
 * Permission gating (via `useActiveOrganization().userRole`):
 *  - View members: any role
 *  - Invite / change role / remove: admin or owner
 *  - Remove owner: forbidden (owner must transfer first)
 *  - Leave: any non-owner
 *
 * The `authClient.organization` namespace and the `useActiveOrganization` hook
 * are not in better-auth's public TS surface — same TS2883 caveat as
 * `org-switcher.tsx`. Structural casts are scoped locally.
 */
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2Icon, UserMinusIcon } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field } from "@/components/auth/field"

type Member = {
  id: string
  userId: string
  role: string
  createdAt: Date | string
  user?: { name?: string; email?: string }
}

type Invitation = {
  id: string
  email: string
  role: string | null
  status: string
  expiresAt: Date | string
  inviterId: string
}

type OrganizationApi = {
  organization: {
    listMembers: (opts?: { query?: { organizationId?: string } }) => Promise<{ data: Member[] } | { error?: unknown }>
    listInvitations: (opts?: { query?: { organizationId?: string } }) => Promise<{ data: Invitation[] } | { error?: unknown }>
    inviteMember: (opts: { email: string; role: string; organizationId?: string }) => Promise<{ error: { message?: string } | null }>
    updateMemberRole: (opts: { memberId: string; role: string; organizationId?: string }) => Promise<{ error: { message?: string } | null }>
    removeMember: (opts: { memberId: string; organizationId?: string }) => Promise<{ error: { message?: string } | null }>
    cancelInvitation: (opts: { invitationId: string }) => Promise<{ error: { message?: string } | null }>
    leaveOrganization: (opts: { organizationId: string }) => Promise<{ error: { message?: string } | null }>
  }
}

type ActiveOrgView = {
  data?: { id?: string; userRole?: string | null } | null
}

type AuthClientExtras = {
  organization: OrganizationApi["organization"]
  useActiveOrganization?: () => ActiveOrgView
}

const authExtras = authClient as unknown as AuthClientExtras

const ROLES = ["owner", "admin", "member"] as const
type Role = (typeof ROLES)[number]

function hasAdminPermissions(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin"
}

export function MembersManager() {
  const { data: session } = authClient.useSession()
  const { data: activeOrg } = authExtras.useActiveOrganization?.() ?? {}
  const organizationId = activeOrg?.id ?? null
  const currentRole: string | null | undefined = activeOrg?.userRole
  const canAdmin = hasAdminPermissions(currentRole)

  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("member")
  const [inviting, setInviting] = useState(false)

  async function refresh() {
    if (!organizationId) return
    setLoading(true)
    try {
      const [m, i] = await Promise.all([
        authExtras.organization.listMembers({ query: { organizationId } }),
        authExtras.organization.listInvitations({ query: { organizationId } }),
      ])
      if ("data" in m) setMembers(m.data as Member[])
      if ("data" in i) setInvitations(i.data as Invitation[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial mount: refresh member/invitation lists once the active org is
    // known. Same external-sync rationale as `use-mobile.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!organizationId || !inviteEmail.trim()) return
    setInviting(true)
    const { error } = await authExtras.organization.inviteMember({
      email: inviteEmail.trim(),
      role: inviteRole,
      organizationId,
    })
    setInviting(false)
    if (error) {
      toast.error(error.message ?? "Could not send invitation")
      return
    }
    toast.success(`Invitation sent to ${inviteEmail}`)
    setInviteEmail("")
    refresh()
  }

  async function handleRoleChange(memberId: string, role: Role) {
    if (!organizationId) return
    const { error } = await authExtras.organization.updateMemberRole({
      memberId,
      role,
      organizationId,
    })
    if (error) {
      toast.error(error.message ?? "Could not change role")
      return
    }
    toast.success("Role updated")
    refresh()
  }

  async function handleRemove(memberId: string, name: string) {
    if (!organizationId) return
    if (!confirm(`Remove ${name} from the organization?`)) return
    const { error } = await authExtras.organization.removeMember({
      memberId,
      organizationId,
    })
    if (error) {
      toast.error(error.message ?? "Could not remove member")
      return
    }
    toast.success(`${name} has been removed`)
    refresh()
  }

  async function handleCancelInvite(invitationId: string, email: string) {
    if (!confirm(`Cancel the invitation sent to ${email}?`)) return
    const { error } = await authExtras.organization.cancelInvitation({
      invitationId,
    })
    if (error) {
      toast.error(error.message ?? "Could not cancel invitation")
      return
    }
    toast.success("Invitation cancelled")
    refresh()
  }

  async function handleLeave() {
    if (!organizationId) return
    if (currentRole === "owner") {
      toast.error("You must transfer ownership before leaving.")
      return
    }
    if (!confirm("Leave this organization? You'll lose access to its resources.")) return
    const { error } = await authExtras.organization.leaveOrganization({
      organizationId,
    })
    if (error) {
      toast.error(error.message ?? "Could not leave organization")
      return
    }
    toast.success("You left the organization")
    // Force a reload so proxy.ts can re-evaluate and redirect to /onboarding
    if (typeof window !== "undefined") window.location.href = "/home"
  }

  if (!session?.user) return null

  // The two `<select>` controls below use the native element intentionally.
  // shadcn's `<Select>` is a portal-based component that's awkward inline with
  // adjacent buttons/labels and not worth the markup bloat for a simple 2-3
  // option choice. The `use-shadcn` rule `react/forbid-elements` is suppressed
  // for these two specific elements.
  return (
    <div className="flex flex-col gap-8">
      {/* Members */}
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-base font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"}
          </p>
        </header>
        {loading && members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {m.user?.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.user?.email ?? m.userId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canAdmin && m.role !== "owner" ? (
                    <>
                      {/* eslint-disable-next-line react/forbid-elements */}
                      <select
                        aria-label={`Role for ${m.user?.email ?? m.userId}`}
                        className="rounded-md border bg-transparent px-2 py-1 text-sm"
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m.id, e.target.value as Role)
                        }
                      >
                        {ROLES.filter((r) => r !== "owner").map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemove(
                            m.id,
                            m.user?.name ?? m.user?.email ?? "this member",
                          )
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {m.role}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending invitations */}
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-base font-medium">Pending invitations</h2>
          <p className="text-sm text-muted-foreground">
            {invitations.filter((i) => i.status === "pending").length} pending
          </p>
        </header>
        {invitations.filter((i) => i.status === "pending").length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invitations
              .filter((i) => i.status === "pending")
              .map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-dashed p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{inv.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Invited as {inv.role ?? "member"} · expires{" "}
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  {canAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(inv.id, inv.email)}
                    >
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Invite */}
      {canAdmin && (
        <section className="flex flex-col gap-3">
          <header>
            <h2 className="text-base font-medium">Invite a member</h2>
            <p className="text-sm text-muted-foreground">
              An email with an invitation link will be sent.
            </p>
          </header>
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field name="invite-email" label="Email" className="flex-1">
              <Input
                id="invite-email"
                name="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                required
              />
            </Field>
            <Field name="invite-role" label="Role">
              {/* eslint-disable-next-line react/forbid-elements */}
              <select
                aria-label="Role for invitee"
                className="rounded-md border bg-transparent px-2 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </Field>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </form>
        </section>
      )}

      {/* Leave */}
      {currentRole && currentRole !== "owner" && (
        <section className="flex flex-col gap-3 border-t pt-6">
          <header>
            <h2 className="text-base font-medium">Leave organization</h2>
            <p className="text-sm text-muted-foreground">
              You&apos;ll lose access to this organization&apos;s resources.
            </p>
          </header>
          <div>
            <Button variant="outline" onClick={handleLeave}>
              <UserMinusIcon className="mr-2 size-4" />
              Leave
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
