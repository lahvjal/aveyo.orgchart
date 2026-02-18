import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Handles Supabase auth callbacks that land on / when the redirectTo URL
 * falls back to the site root (e.g. when the full path isn't in the allowed-
 * redirect-URLs list in Supabase).
 *
 * - type=recovery   → /reset-password  (password-reset email)
 * - type=magiclink  → /onboarding      (invite email for new employees)
 * - anything else   → /dashboard
 */
export function RecoveryRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash

    if (hash && hash.includes('type=recovery')) {
      window.location.replace(`${window.location.origin}/reset-password${hash}`)
      return
    }

    if (hash && hash.includes('type=magiclink')) {
      window.location.replace(`${window.location.origin}/onboarding${hash}`)
      return
    }

    navigate('/dashboard', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  )
}
