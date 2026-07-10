import { SettingsCard } from "@/components/settings"
import { MembersManager } from "@/components/settings/organization/members-manager"

export default function OrganizationMembersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Organization members</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates and manage their roles.
        </p>
      </div>

      <SettingsCard
        title="Members"
        description="Everyone with access to this organization."
      >
        <MembersManager />
      </SettingsCard>
    </div>
  )
}