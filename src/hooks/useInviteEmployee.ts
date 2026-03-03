import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendEmployeeInvitationEmail } from '../lib/notifications'
import { getAdminErrorMessage, invokeAdminUserOps } from '../lib/adminUserOps'

interface InviteEmployeeData {
  email: string
  firstName: string
  lastName: string
  jobTitle: string
  managerId?: string
  departmentId?: string
  startDate?: string
  managerMode?: boolean // When true, managerId must be set and user must be a manager
}

interface InviteEmployeeResult {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

interface InviteActorProfile {
  is_admin: boolean | null
  is_super_admin: boolean | null
  is_manager: boolean | null
}

interface CreateUserResponse {
  success?: boolean
  error?: string
  user?: {
    id: string
    email: string
  }
}

interface UpdateProfileResponse {
  success?: boolean
  error?: string
}

/**
 * Hook for inviting new employees
 *
 * This hook:
 * 1. Creates a new user account via the admin-user-ops edge function
 * 2. Updates profile manager/department assignment if provided
 * 3. Sends invitation email via edge function (server-side link generation)
 * 4. The handle_new_user trigger automatically creates the profile
 */
export function useInviteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: InviteEmployeeData): Promise<InviteEmployeeResult> => {
      console.log('useInviteEmployee: Starting invitation process for', data.email)

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return { success: false, error: 'You must be logged in to invite employees' }
      }

      // Get current user's profile for permission check and "invited by" name
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('is_admin, is_super_admin, is_manager')
        .eq('id', currentUser.id)
        .single<InviteActorProfile>()

      const isAdmin = Boolean(currentProfile?.is_admin || currentProfile?.is_super_admin)
      const isManager = Boolean(currentProfile?.is_manager)

      // Validate manager mode permissions
      if (data.managerMode) {
        if (!isManager && !isAdmin) {
          return { success: false, error: 'You do not have permission to invite team members' }
        }
        if (!data.managerId || data.managerId !== currentUser.id) {
          return { success: false, error: 'Manager ID must be set to your user ID in manager mode' }
        }
      }

      try {
        const fullName = `${data.firstName} ${data.lastName}`.trim()

        // Step 1: Create user account via edge function
        console.log('useInviteEmployee: Creating user account via edge function')
        const { data: createData, error: createError } = await invokeAdminUserOps<CreateUserResponse>({
          action: 'createUser',
          userId: currentUser.id,
          email: data.email,
          emailConfirm: true,
          userMetadata: {
            full_name: fullName,
            job_title: data.jobTitle,
            start_date: data.startDate || new Date().toISOString().split('T')[0],
          },
        })

        if (createError || !createData?.success) {
          const errMsg = getAdminErrorMessage(createData, createError, 'Failed to create user account')

          console.error('useInviteEmployee: Error creating user:', errMsg)

          if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already been registered')) {
            return { success: false, error: 'This email address is already registered' }
          }
          return { success: false, error: errMsg }
        }

        if (!createData.user?.id) {
          return { success: false, error: 'User was created but no user ID was returned' }
        }

        const newUserId = createData.user.id
        console.log('useInviteEmployee: User created successfully:', newUserId)

        // Step 1.5: Update profile with additional fields (manager, department)
        if (data.managerId || data.departmentId) {
          console.log('useInviteEmployee: Updating profile with manager/department')
          const { data: updateData, error: updateError } = await invokeAdminUserOps<UpdateProfileResponse>({
            action: 'updateProfile',
            userId: currentUser.id,
            targetUserId: newUserId,
            profileData: {
              manager_id: data.managerId || null,
              department_id: data.departmentId || null,
            },
          })

          if (updateError || !updateData?.success) {
            console.warn(
              'useInviteEmployee: Failed to update manager/department:',
              getAdminErrorMessage(updateData, updateError, 'Failed to update manager/department')
            )
            // Don't fail the entire invitation for this
          }
        }

        // Step 2: Send invitation email (edge function generates magic link server-side)
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
        console.log('useInviteEmployee: Sending invitation email')
        const emailResult = await sendEmployeeInvitationEmail(
          newUserId,
          `${appUrl}/onboarding`
        )

        if (!emailResult.success) {
          console.error('useInviteEmployee: Error sending email:', emailResult.error)
          return {
            success: false,
            userId: newUserId,
            email: data.email,
            error: 'User created but failed to send invitation email. Please manually send the invitation.',
          }
        }

        console.log('useInviteEmployee: Invitation process completed successfully')
        return { success: true, userId: newUserId, email: data.email }
      } catch (error) {
        console.error('useInviteEmployee: Unexpected error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['profiles'] })
        console.log('useInviteEmployee: Success, profiles query invalidated')
      }
    },
  })
}
