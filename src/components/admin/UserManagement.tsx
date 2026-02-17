import { useState, useEffect } from 'react'
import { useProfiles, useUpdateProfile } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'
import { useUserAuthStatus, useResendInvite, hasUserLoggedIn } from '../../hooks/useResendInvite'
import type { Profile } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Edit2, Loader2, Shield, UserPlus, Info, Mail, Clock } from 'lucide-react'
import { AddEmployeeDialog } from './AddEmployeeDialog'

export function UserManagement() {
  const { data: profiles, isLoading } = useProfiles()
  const { data: departments } = useDepartments()
  const { data: authStatusMap } = useUserAuthStatus()
  const updateProfile = useUpdateProfile()
  const resendInvite = useResendInvite()

  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [departmentAutoFilled, setDepartmentAutoFilled] = useState(false)
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    job_title: '',
    manager_id: '',
    department_id: '',
    job_description: '',
    is_admin: false,
  })

  const handleEdit = (profile: Profile) => {
    setEditingUser(profile)
    setDepartmentAutoFilled(false)
    setFormData({
      job_title: profile.job_title,
      manager_id: profile.manager_id || '',
      department_id: profile.department_id || '',
      job_description: profile.job_description || '',
      is_admin: profile.is_admin,
    })
  }

  // Auto-update department when manager changes
  useEffect(() => {
    if (editingUser && formData.manager_id && profiles) {
      const selectedManager = profiles.find(p => p.id === formData.manager_id)
      if (selectedManager?.department_id && selectedManager.department_id !== formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: selectedManager.department_id || '' }))
        setDepartmentAutoFilled(true)
      }
    }
  }, [formData.manager_id, profiles, editingUser])

  const handleManagerChange = (value: string) => {
    setFormData(prev => ({ ...prev, manager_id: value }))
    setDepartmentAutoFilled(false)
  }

  const handleDepartmentChange = (value: string) => {
    setFormData(prev => ({ ...prev, department_id: value }))
    setDepartmentAutoFilled(false)
  }

  const handleResendInvite = async (profile: Profile) => {
    setResendingUserId(profile.id)
    const result = await resendInvite.mutateAsync(profile)
    setResendingUserId(null)

    if (result.success) {
      // Show success feedback - you could add a toast notification here
      console.log('Invitation resent successfully to', result.email)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    await updateProfile.mutateAsync({
      id: editingUser.id,
      job_title: formData.job_title,
      manager_id: formData.manager_id || null,
      department_id: formData.department_id || null,
      job_description: formData.job_description || null,
      is_admin: formData.is_admin,
    })

    setEditingUser(null)
  }

  const handleCancel = () => {
    setEditingUser(null)
  }

  if (isLoading) {
    return <div>Loading users...</div>
  }

  // Filter out the current editing user from potential managers
  const potentialManagers = profiles?.filter((p) => p.id !== editingUser?.id) || []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user roles, managers, and departments
              </CardDescription>
            </div>
            {!editingUser && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Employee
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingUser ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
                <Avatar>
                  {editingUser.profile_photo_url && (
                    <AvatarImage src={editingUser.profile_photo_url} alt={editingUser.full_name} />
                  )}
                  <AvatarFallback>{getInitials(editingUser.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{editingUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{editingUser.job_title}</p>
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
                  {potentialManagers.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} - {profile.job_title}
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
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Department automatically updated from new manager. You can change it if needed.</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_description">Job Description</Label>
                <Textarea
                  id="job_description"
                  value={formData.job_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, job_description: e.target.value }))}
                  placeholder="Describe the employee's role and responsibilities..."
                  rows={4}
                  className="resize-none"
                />
              </div>

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

              <div className="flex gap-2">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              {profiles?.map((profile) => {
                const hasLoggedIn = authStatusMap ? hasUserLoggedIn(profile.id, authStatusMap) : true
                const isResending = resendingUserId === profile.id

                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar>
                        {profile.profile_photo_url && (
                          <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
                        )}
                        <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{profile.full_name}</p>
                          {profile.is_admin && (
                            <Badge variant="secondary">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {!hasLoggedIn && (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{profile.job_title}</p>
                        {profile.department && (
                          <Badge
                            className="mt-1"
                            style={{ backgroundColor: profile.department.color, color: 'white' }}
                          >
                            {profile.department.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!hasLoggedIn && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvite(profile)}
                          disabled={isResending}
                          title="Resend invitation email"
                        >
                          {isResending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Resend
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(profile)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddEmployeeDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </div>
  )
}
