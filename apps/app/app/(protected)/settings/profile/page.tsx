import { SettingsCard } from "@/components/settings"
import { ProfileForm } from "@/components/settings/profile-form"

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your public profile information.
        </p>
      </div>

      <SettingsCard
        title="Public profile"
        description="This information will be visible to others."
      >
        <ProfileForm />
      </SettingsCard>
    </div>
  )
}

