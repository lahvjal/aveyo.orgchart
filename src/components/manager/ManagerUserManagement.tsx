import { useState, useEffect, useMemo } from 'react'
import { useProfiles, useUpdateProfile, useProfileBranch } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'
import { useUserAuthStatus, useResendInvite, hasUserLoggedIn } from '../../hooks/useResendInvite'
import { usePermissions } from '../../hooks/usePermissions'
import { useProfile } from '../../hooks/useProfile'
import type { Profile } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { JobDescriptionEditor } from '../ui/JobDescriptionEditor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Edit2, Loader2, UserPlus, Info, Mail, Clock } from 'lucide-react'
import { ManagerAddEmployeeDialog } from './ManagerAddEmployeeDialog'

export function ManagerUserManagement() {
  const { data: allProfiles, isLoading } = useProfiles()
  const { data: departments } = useDepartments()
  const { data: authStatusMap } = useUserAuthStatus()
  const updateProfile = useUpdateProfile()
  const resendInvite = useResendInvite()
  const { getTeamMembers } = usePermissions()
  const { data: currentManager } = useProfile()
  const { data: branchProfiles } = useProfileBranch(currentManager?.id)

  // Managers the current user can assign: themselves + any managers in their reporting chain
  const assignableManagers = useMemo(() => [
    ...(currentManager ? [currentManager] : []),
    ...((branchProfiles ?? []).filter((p) => p.is_manager && p.id !== currentManager?.id)),
  ], [currentManager, branchProfiles])

  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [departmentAutoFilled, setDepartmentAutoFilled] = useState(false)
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    job_title: '',
    manager_id: '',
    department_id: '',
    job_description: '',
  })

  // Filter to show only team members
  const teamMembers = useMemo(() => {
    if (!allProfiles || !currentManager) return []
    return getTeamMembers() || []
  }, [allProfiles, currentManager, getTeamMembers])

  const handleEdit = (profile: Profile) => {
    setEditingUser(profile)
    setDepartmentAutoFilled(false)
    setFormData({
      job_title: profile.job_title,
      manager_id: profile.manager_id || '',
      department_id: profile.department_id || '',
      job_description: profile.job_description || '',
    })
  }

  // Auto-update department when manager changes (though manager shouldn't change for managers)
  useEffect(() => {
    if (editingUser && formData.manager_id && allProfiles) {
      const selectedManager = allProfiles.find(p => p.id === formData.manager_id)
      if (selectedManager?.department_id && selectedManager.department_id !== formData.department_id) {
        setFormData(prev => ({ ...prev, department_id: selectedManager.department_id || '' }))
        setDepartmentAutoFilled(true)
      }
    }
  }, [formData.manager_id, allProfiles, editingUser])

  const handleDepartmentChange = (value: string) => {
    setFormData(prev => ({ ...prev, department_id: value }))
    setDepartmentAutoFilled(false)
  }

  const handleResendInvite = async (profile: Profile) => {
    setResendingUserId(profile.id)
    const result = await resendInvite.mutateAsync(profile)
    setResendingUserId(null)

    if (result.success) {
      console.log('Invitation resent successfully to', result.email)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser || !currentManager) return

    await updateProfile.mutateAsync({
      id: editingUser.id,
      job_title: formData.job_title,
      manager_id: formData.manager_id || currentManager.id,
      department_id: formData.department_id || null,
      job_description: formData.job_description || null,
    })

    setEditingUser(null)
  }

  const handleCancel = () => {
    setEditingUser(null)
  }

  if (isLoading) {
    return <div>Loading team members...</div>
  }

  if (!currentManager) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Manage your team members ({teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'})
              </CardDescription>
            </div>
            {!editingUser && (
              <Button onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Team Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>You don't have any team members yet.</p>
              <p className="text-sm mt-2">Click "Invite Team Member" to add someone to your team.</p>
            </div>
          ) : editingUser ? (
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
                {assignableManagers.length > 1 ? (
                  <select
                    id="manager"
                    value={formData.manager_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                    disabled={updateProfile.isPending}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {assignableManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}{m.id === currentManager?.id ? ' (you)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="manager"
                    type="text"
                    value={currentManager.full_name}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {assignableManagers.length > 1
                    ? 'Select the manager this person reports to. Only managers in your team are shown.'
                    : 'This team member reports directly to you.'}
                </p>
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
                    <span>Department automatically updated from manager. You can change it if needed.</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Job Description</Label>
                <JobDescriptionEditor
                  value={formData.job_description || ''}
                  onChange={(html) => setFormData(prev => ({ ...prev, job_description: html }))}
                  placeholder="Describe the employee's role and responsibilities..."
                  minRows={4}
                />
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
              {teamMembers.map((profile) => {
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

      <ManagerAddEmployeeDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </div>
  )
}
