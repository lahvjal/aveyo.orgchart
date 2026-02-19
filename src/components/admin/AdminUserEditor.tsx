import { useState, useEffect } from 'react'
import { useProfiles, useUpdateProfile } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'
import type { Profile } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { JobDescriptionEditor } from '../ui/JobDescriptionEditor'
import { Loader2, Shield, Users, Info, BarChart2 } from 'lucide-react'
import { PhotoUpload } from '../profile/PhotoUpload'

interface AdminUserEditorProps {
  profile: Profile
  onSaved?: () => void
  onCancel?: () => void
}

export function AdminUserEditor({ profile, onSaved, onCancel }: AdminUserEditorProps) {
  const { data: profiles } = useProfiles()
  const { data: departments } = useDepartments()
  const updateProfile = useUpdateProfile()

  const [departmentAutoFilled, setDepartmentAutoFilled] = useState(false)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(profile.profile_photo_url)
  const [formData, setFormData] = useState({
    job_title: profile.job_title,
    manager_id: profile.manager_id || '',
    department_id: profile.department_id || '',
    job_description: profile.job_description || '',
    is_admin: profile.is_admin,
    is_manager: profile.is_manager || false,
    is_executive: profile.is_executive || false,
  })

  // Reset form when profile changes
  useEffect(() => {
    setFormData({
      job_title: profile.job_title,
      manager_id: profile.manager_id || '',
      department_id: profile.department_id || '',
      job_description: profile.job_description || '',
      is_admin: profile.is_admin,
      is_manager: profile.is_manager || false,
      is_executive: profile.is_executive || false,
    })
    setCurrentPhotoUrl(profile.profile_photo_url)
    setDepartmentAutoFilled(false)
  }, [profile.id])

  // Auto-update department when manager changes
  useEffect(() => {
    if (formData.manager_id && profiles) {
      const selectedManager = profiles.find(p => p.id === formData.manager_id)
      if (selectedManager?.department_id && selectedManager.department_id !== formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: selectedManager.department_id || '' }))
        setDepartmentAutoFilled(true)
      }
    }
  }, [formData.manager_id, profiles])

  const handleManagerChange = (value: string) => {
    setFormData(prev => ({ ...prev, manager_id: value }))
    setDepartmentAutoFilled(false)
  }

  const handleDepartmentChange = (value: string) => {
    setFormData(prev => ({ ...prev, department_id: value }))
    setDepartmentAutoFilled(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    await updateProfile.mutateAsync({
      id: profile.id,
      job_title: formData.job_title,
      manager_id: formData.manager_id || null,
      department_id: formData.department_id || null,
      job_description: formData.job_description || null,
      is_admin: formData.is_admin,
      is_manager: formData.is_manager,
      is_executive: formData.is_executive,
    } as any)

    onSaved?.()
  }

  const potentialManagers = profiles?.filter(p => p.is_manager && p.id !== profile.id) || []

  const handlePhotoUploaded = async (url: string) => {
    setCurrentPhotoUrl(url)
    await updateProfile.mutateAsync({
      id: profile.id,
      profile_photo_url: url,
    } as any)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
        <PhotoUpload
          currentPhotoUrl={currentPhotoUrl}
          userName={profile.full_name}
          userId={profile.id}
          onPhotoUploaded={handlePhotoUploaded}
          size="sm"
        />
        <div>
          <p className="font-medium">{profile.full_name}</p>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="job_title">Job Title</Label>
        <Input
          id="job_title"
          type="text"
          value={formData.job_title}
          onChange={(e) => setFormData(prev => ({ ...prev, job_title: e.target.value }))}
          placeholder="e.g. Software Engineer"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="manager">Manager</Label>
        <select
          id="manager"
          value={formData.manager_id}
          onChange={(e) => handleManagerChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No Manager</option>
          {potentialManagers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} — {p.job_title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">
          Department
          {departmentAutoFilled && (
            <span className="ml-2 text-xs text-muted-foreground">(auto-updated from manager)</span>
          )}
        </Label>
        <select
          id="department"
          value={formData.department_id}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">No Department</option>
          {departments?.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        {departmentAutoFilled && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Department automatically updated from manager. You can change it if needed.</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Job Description</Label>
        <JobDescriptionEditor
          value={formData.job_description}
          onChange={(html) => setFormData(prev => ({ ...prev, job_description: html }))}
          placeholder="Describe the employee's role and responsibilities..."
          minRows={4}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_admin"
            checked={formData.is_admin}
            onChange={(e) => setFormData(prev => ({ ...prev, is_admin: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="is_admin" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Administrator
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_manager"
            checked={formData.is_manager}
            onChange={(e) => setFormData(prev => ({ ...prev, is_manager: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="is_manager" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Manager
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_executive"
            checked={formData.is_executive}
            onChange={(e) => setFormData(prev => ({ ...prev, is_executive: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="is_executive" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Executive (KPI Dashboard access)
          </Label>
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

      <div className="flex gap-2">
        <Button type="submit" disabled={updateProfile.isPending}>
          {updateProfile.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Changes
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
