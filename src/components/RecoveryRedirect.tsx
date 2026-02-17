import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * When user lands on / with recovery tokens in the hash (from password reset email),
 * redirect to /reset-password and preserve the hash so Supabase can establish the session.
 */
export function RecoveryRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash
    const hasRecovery = hash && (
      hash.includes('type=recovery') ||
      (hash.includes('access_token=') && hash.includes('type='))
    )
    if (hasRecovery) {
      window.location.replace(`${window.location.origin}/reset-password${hash}`)
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
