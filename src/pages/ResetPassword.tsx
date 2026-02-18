import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../hooks/useProfile'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [ready, setReady] = useState(false)
  const { user, loading: authLoading, updatePassword } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile()
  const navigate = useNavigate()

  // After recovery link, session is established from URL hash
  useEffect(() => {
    if (authLoading) return
    setReady(true)
  }, [authLoading])

  // If the authenticated user hasn't finished onboarding, send them there
  useEffect(() => {
    if (!ready || !user || profileLoading) return
    if (profile && !profile.onboarding_completed) {
      navigate('/onboarding', { replace: true })
    }
  }, [ready, user, profile, profileLoading, navigate])

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await updatePassword(password)
      if (updateError) throw updateError
      setComplete(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm">This link is invalid or has expired. Request a new reset link.</p>
            </div>
            <Link to="/forgot-password">
              <Button className="w-full">Request new reset link</Button>
            </Link>
            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Password updated</h2>
              <p className="text-muted-foreground">Redirecting you to the dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex gap-2 mb-4">
            <div className="h-2 flex-1 rounded-full bg-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Set new password</h2>
              <p className="text-muted-foreground">
                Choose a secure password for future logins
              </p>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? 'Updating...' : 'Update password'}
              </Button>
            </form>

            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                Back to login
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
