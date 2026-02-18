import { useState } from 'react'
import { useProfiles } from '../../hooks/useProfile'
import { useUserAuthStatus, useResendInvite, hasUserLoggedIn } from '../../hooks/useResendInvite'
import type { Profile } from '../../types'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Edit2, UserPlus, Mail, Clock, Trash2, Shield, Users, Loader2 } from 'lucide-react'
import { AddEmployeeDialog } from './AddEmployeeDialog'
import { RemoveEmployeeDialog } from './RemoveEmployeeDialog'
import { AdminUserEditorDialog } from './AdminUserEditorDialog'

export function UserManagement() {
  const { data: profiles, isLoading } = useProfiles()
  const { data: authStatusMap } = useUserAuthStatus()
  const resendInvite = useResendInvite()

  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [employeeToRemove, setEmployeeToRemove] = useState<Profile | null>(null)
  const [resendingUserId, setResendingUserId] = useState<string | null>(null)

  const handleResendInvite = async (profile: Profile) => {
    setResendingUserId(profile.id)
    const result = await resendInvite.mutateAsync(profile)
    setResendingUserId(null)

    if (result.success) {
      console.log('Invitation resent successfully to', result.email)
    }
  }

  if (isLoading) {
    return <div>Loading users...</div>
  }

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
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                          {profile.is_manager && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                              <Users className="h-3 w-3 mr-1" />
                              Manager
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
                        onClick={() => setEditingUser(profile)}
                        title="Edit employee"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEmployeeToRemove(profile)}
                        title="Remove employee"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
        </CardContent>
      </Card>

      <AdminUserEditorDialog
        profile={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />

      <AddEmployeeDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />

      <RemoveEmployeeDialog
        open={!!employeeToRemove}
        onOpenChange={(open) => !open && setEmployeeToRemove(null)}
        employee={employeeToRemove}
      />
    </div>
  )
}
