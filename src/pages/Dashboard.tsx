import { useState } from 'react'
import { useProfiles, useProfile } from '../hooks/useProfile'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../hooks/useAuth'
import { OrgChartCanvas } from '../components/org-chart/OrgChartCanvas'
import { EmployeeSearch } from '../components/search/EmployeeSearch'
import { ProfileCard } from '../components/profile/ProfileCard'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { X } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const { data: currentProfile, isLoading: profileLoading } = useProfile()
  const { isAdmin, isLoading: permissionsLoading } = usePermissions()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  
  // All users can now view all profiles - the org chart is accessible to everyone
  const { data: allProfiles, isLoading: allProfilesLoading, error: allProfilesError } = useProfiles()

  console.log('Dashboard: user:', user?.id)
  console.log('Dashboard: currentProfile:', currentProfile)
  console.log('Dashboard: isAdmin:', isAdmin, 'permissionsLoading:', permissionsLoading)

  // Check if user needs onboarding
  const needsOnboarding = currentProfile && !currentProfile.onboarding_completed

  console.log('Dashboard: needsOnboarding:', needsOnboarding)

  // Show onboarding wizard if user hasn't completed it
  if (!profileLoading && needsOnboarding && currentProfile) {
    return <OnboardingWizard profile={currentProfile} onComplete={() => window.location.reload()} />
  }

  console.log('Dashboard: allProfiles:', allProfiles, 'loading:', allProfilesLoading, 'error:', allProfilesError)

  const profiles = allProfiles

  const isLoading = permissionsLoading || allProfilesLoading

  console.log('Dashboard: Final - profiles:', profiles, 'isLoading:', isLoading)

  const selectedProfile = profiles?.find((p) => p.id === selectedProfileId)

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">No Employees Found</h2>
          <p className="text-muted-foreground mb-4">
            {isAdmin
              ? "Get started by creating employee profiles in the admin panel."
              : "Your org chart is empty. Please contact an administrator."}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 border-r bg-white p-4 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Organization Chart</h2>
          <p className="text-sm text-muted-foreground">
            Browse and search {profiles.length} employees across all departments
          </p>
        </div>

        <EmployeeSearch
          profiles={profiles}
          onSelectEmployee={setSelectedProfileId}
          currentUserDepartmentId={currentProfile?.department_id || undefined}
        />
      </div>

      {/* Main content - Org Chart */}
      <div className="flex-1 relative">
        <OrgChartCanvas
          profiles={profiles}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          currentUserDepartmentId={currentProfile?.department_id || undefined}
          onNodeClick={setSelectedProfileId}
        />

        {/* Selected profile detail */}
        {selectedProfile && (
          <div className="absolute top-4 right-4 w-96 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={() => setSelectedProfileId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <ProfileCard profile={selectedProfile} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
