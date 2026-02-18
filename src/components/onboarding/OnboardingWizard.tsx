import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { CheckCircle2, User, Lock, FileText, AlertCircle } from 'lucide-react'
import type { Profile } from '../../types'

interface OnboardingWizardProps {
  profile: Profile
  onComplete: () => void
}

type Step = 'welcome' | 'password' | 'profile' | 'complete'

export function OnboardingWizard({ profile, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  // Form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [preferredName, setPreferredName] = useState(profile.preferred_name || '')
  const [jobDescription, setJobDescription] = useState(profile.job_description || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [location, setLocation] = useState(profile.location || '')
  const [birthday, setBirthday] = useState(
    profile.birthday ? (typeof profile.birthday === 'string' && profile.birthday.length >= 10 ? profile.birthday.slice(0, 10) : '') : ''
  )
  const [socialLinks, setSocialLinks] = useState({
    linkedin: profile.social_links?.linkedin || '',
    instagram: profile.social_links?.instagram || '',
    facebook: profile.social_links?.facebook || '',
  })

  const handleSetPassword = async () => {
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      setCurrentStep('profile')
    } catch (err) {
      console.error('Error setting password:', err)
      setError(err instanceof Error ? err.message : 'Failed to set password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        // @ts-expect-error - Supabase type inference issue with newly added columns
        .update({
          preferred_name: preferredName || null,
          job_description: jobDescription || null,
          phone: phone || null,
          location: location || null,
          birthday: birthday || null,
          social_links: socialLinks,
          onboarding_completed: true,
        })
        .eq('id', profile.id)

      if (updateError) throw updateError

      // Bust the cached profile so Dashboard reads onboarding_completed: true
      await queryClient.invalidateQueries({ queryKey: ['profile'] })

      setCurrentStep('complete')
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome, {profile.full_name}! 👋
              </h2>
              <p className="text-muted-foreground">
                Let's get you set up with your account
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Lock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Set Your Password</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a secure password for future logins
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Complete Your Profile</p>
                  <p className="text-sm text-muted-foreground">
                    Add additional information to help your team connect
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => setCurrentStep('password')} className="w-full">
              Get Started
            </Button>
          </div>
        )

      case 'password':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Set Your Password</h2>
              <p className="text-muted-foreground">
                Choose a secure password for future logins
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('welcome')}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleSetPassword}
                disabled={loading || !password || !confirmPassword}
                className="flex-1"
              >
                {loading ? 'Setting Password...' : 'Continue'}
              </Button>
            </div>
          </div>
        )

      case 'profile':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Complete Your Profile</h2>
              <p className="text-muted-foreground">
                Help your team get to know you better (optional)
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferredName">Nickname / Preferred Name (Optional)</Label>
                <Input
                  id="preferredName"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="What would you like to be called?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobDescription">Job Description (Optional)</Label>
                <Textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Describe your role and responsibilities..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, State or Remote"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthday">Birthday (Optional)</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Social Links (Optional)</Label>
                <div className="space-y-2">
                  <Input
                    id="linkedin"
                    value={socialLinks.linkedin}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))}
                    placeholder="LinkedIn URL"
                  />
                  <Input
                    id="instagram"
                    value={socialLinks.instagram}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
                    placeholder="Instagram URL"
                  />
                  <Input
                    id="facebook"
                    value={socialLinks.facebook}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, facebook: e.target.value }))}
                    placeholder="Facebook URL"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('password')}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Saving...' : 'Complete Setup'}
              </Button>
            </div>
          </div>
        )

      case 'complete':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">All Set! 🎉</h2>
              <p className="text-muted-foreground">
                Your profile is complete. Welcome to the team!
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium">What's Next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>View the organization chart</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Upload a profile photo</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Connect with your team members</span>
                </li>
              </ul>
            </div>

            <Button onClick={handleComplete} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {currentStep !== 'welcome' && currentStep !== 'complete' && (
            <div className="flex gap-2 mb-4">
              <div className={`h-2 flex-1 rounded-full ${currentStep === 'password' || currentStep === 'profile' ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`h-2 flex-1 rounded-full ${currentStep === 'profile' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  )
}
