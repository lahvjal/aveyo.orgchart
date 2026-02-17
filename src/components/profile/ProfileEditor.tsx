import { useState, useEffect } from 'react'
import type { Profile } from '../../types'
import { useUpdateProfile } from '../../hooks/useProfile'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { PhotoUpload } from './PhotoUpload'
import { Linkedin, Instagram, Facebook, Loader2 } from 'lucide-react'

interface ProfileEditorProps {
  profile: Profile
  onSaved?: () => void
}

export function ProfileEditor({ profile, onSaved }: ProfileEditorProps) {
  // Split full_name into first and last name for editing
  const nameParts = profile.full_name.split(' ')
  const defaultFirstName = nameParts[0] || ''
  const defaultLastName = nameParts.slice(1).join(' ') || ''

  // Helper function to format date for HTML date input (YYYY-MM-DD).
  // Uses only the date part to avoid timezone shifting (off-by-one day).
  const formatDateForInput = (date: string | null | undefined): string => {
    if (!date) return ''
    const str = String(date).trim()
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
    // Supabase/ISO often returns YYYY-MM-DDTHH:mm:ss or with Z — use date part only
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [formData, setFormData] = useState({
    firstName: defaultFirstName,
    lastName: defaultLastName,
    preferred_name: profile.preferred_name || '',
    job_title: profile.job_title,
    job_description: profile.job_description || '',
    phone: profile.phone || '',
    location: profile.location || '',
    start_date: formatDateForInput(profile.start_date),
    birthday: formatDateForInput(profile.birthday),
    profile_photo_url: profile.profile_photo_url || '',
    social_links: {
      linkedin: profile.social_links?.linkedin || '',
      instagram: profile.social_links?.instagram || '',
      facebook: profile.social_links?.facebook || '',
    },
  })

  // Update formData when profile prop changes (e.g., after refetch)
  // This ensures the form reflects the latest data from the database
  useEffect(() => {
    const nameParts = profile.full_name.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    setFormData(prev => {
      // Only update if the profile data actually changed
      // This prevents unnecessary re-renders while still syncing after save
      const newStartDate = formatDateForInput(profile.start_date)
      const newBirthday = formatDateForInput(profile.birthday)
      if (prev.start_date === newStartDate &&
          prev.birthday === newBirthday &&
          prev.firstName === firstName &&
          prev.lastName === lastName &&
          prev.job_title === profile.job_title) {
        return prev // No changes, return previous state
      }

      return {
        firstName,
        lastName,
        preferred_name: profile.preferred_name || '',
        job_title: profile.job_title,
        job_description: profile.job_description || '',
        phone: profile.phone || '',
        location: profile.location || '',
        start_date: newStartDate,
        birthday: formatDateForInput(profile.birthday),
        profile_photo_url: profile.profile_photo_url || '',
        social_links: {
          linkedin: profile.social_links?.linkedin || '',
          instagram: profile.social_links?.instagram || '',
          facebook: profile.social_links?.facebook || '',
        },
      }
    })
  }, [profile.id, profile.start_date, profile.birthday, profile.full_name, profile.preferred_name, profile.job_title, profile.job_description, profile.phone, profile.location, profile.profile_photo_url, profile.social_links])

  const updateProfile = useUpdateProfile()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Combine first and last name
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()

    // Format dates consistently - extract YYYY-MM-DD to avoid timezone issues
    // start_date is required, so use form value or fall back to existing profile value
    const formattedStartDate = formData.start_date ? formatDateForInput(formData.start_date) : formatDateForInput(profile.start_date)
    const formattedBirthday = formData.birthday ? formatDateForInput(formData.birthday) : null

    await updateProfile.mutateAsync({
      id: profile.id,
      full_name: fullName,
      preferred_name: formData.preferred_name || null,
      job_title: formData.job_title,
      job_description: formData.job_description || null,
      phone: formData.phone || null,
      location: formData.location || null,
      start_date: formattedStartDate,
      birthday: formattedBirthday,
      profile_photo_url: formData.profile_photo_url || null,
      social_links: formData.social_links,
    } as any)

    onSaved?.()
  }

  const handlePhotoUploaded = (url: string) => {
    setFormData(prev => ({ ...prev, profile_photo_url: url }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Update your profile information and social links
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <PhotoUpload
            currentPhotoUrl={formData.profile_photo_url}
            userName={`${formData.firstName} ${formData.lastName}`}
            userId={profile.id}
            onPhotoUploaded={handlePhotoUploaded}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_name">Nickname / Preferred Name</Label>
              <Input
                id="preferred_name"
                value={formData.preferred_name}
                onChange={(e) => setFormData(prev => ({ ...prev, preferred_name: e.target.value }))}
                placeholder="Optional - how you'd like to be called"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job_title">Job Title *</Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="San Francisco, CA"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_description">Job Description</Label>
            <Textarea
              id="job_description"
              value={formData.job_description}
              onChange={(e) => setFormData(prev => ({ ...prev, job_description: e.target.value }))}
              placeholder="Describe your role and responsibilities..."
              rows={4}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Social Links</h3>
            
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Label>
              <Input
                id="linkedin"
                type="url"
                value={formData.social_links.linkedin}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, linkedin: e.target.value }
                }))}
                placeholder="https://linkedin.com/in/username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                id="instagram"
                type="url"
                value={formData.social_links.instagram}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, instagram: e.target.value }
                }))}
                placeholder="https://instagram.com/username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook" className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Facebook
              </Label>
              <Input
                id="facebook"
                type="url"
                value={formData.social_links.facebook}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, facebook: e.target.value }
                }))}
                placeholder="https://facebook.com/username"
              />
            </div>
          </div>

          {updateProfile.isError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              Failed to update profile. Please try again.
            </div>
          )}

          {updateProfile.isSuccess && (
            <div className="bg-green-50 text-green-900 text-sm p-3 rounded-md">
              Profile updated successfully!
            </div>
          )}

          <Button type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
