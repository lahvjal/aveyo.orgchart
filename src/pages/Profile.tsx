import { useProfile } from '../hooks/useProfile'
import { ProfileEditor } from '../components/profile/ProfileEditor'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Profile() {
  usePageTitle('My Profile')
  const { data: profile, isLoading, error } = useProfile()

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Failed to load profile. Please try again.
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-muted p-4 rounded-md">
          Profile not found.
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>
      <ProfileEditor profile={profile} />
    </div>
  )
}
