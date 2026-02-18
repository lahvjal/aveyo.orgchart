import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'

/**
 * Landing page for new employees arriving via invite magic link.
 * Renders the OnboardingWizard directly. Once complete, the wizard
 * navigates the user to /dashboard.
 */
export default function Onboarding() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  // Not authenticated — send to login
  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  // Already completed onboarding — send to dashboard
  if (profile?.onboarding_completed) {
    navigate('/dashboard', { replace: true })
    return null
  }

  // Profile not yet available (edge case: trigger hasn't run yet)
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Setting up your account…</p>
        </div>
      </div>
    )
  }

  return (
    <OnboardingWizard
      profile={profile}
      onComplete={() => {
        // Hard redirect clears any remaining stale React Query cache
        window.location.replace('/dashboard')
      }}
    />
  )
}
