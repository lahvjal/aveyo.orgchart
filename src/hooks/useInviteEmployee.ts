import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { supabase } from '../lib/supabase'
import { sendEmployeeInvitationEmail } from '../lib/notifications'

interface InviteEmployeeData {
  email: string
  firstName: string
  lastName: string
  jobTitle: string
  managerId?: string
  departmentId?: string
  startDate?: string
}

interface InviteEmployeeResult {
  success: boolean
  userId?: string
  email?: string
  error?: string
}

/**
 * Hook for inviting new employees
 * 
 * This hook:
 * 1. Creates a new user account in Supabase Auth
 * 2. Generates a magic link for password setup
 * 3. Sends an invitation email with the magic link
 * 4. The handle_new_user trigger automatically creates the profile
 */
export function useInviteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: InviteEmployeeData): Promise<InviteEmployeeResult> => {
      console.log('useInviteEmployee: Starting invitation process for', data.email)

      // Check if admin client is available
      if (!supabaseAdmin) {
        console.error('useInviteEmployee: Admin client not configured')
        return {
          success: false,
          error: 'Admin features are not configured. Please contact your system administrator.',
        }
      }

      // Get current user to include in invitation email
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return {
          success: false,
          error: 'You must be logged in to invite employees',
        }
      }

      // Get current user's profile for the "invited by" name
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single()

      const invitedByName = (currentProfile as any)?.full_name || 'Administrator'

      try {
        // Construct full name from first and last name
        const fullName = `${data.firstName} ${data.lastName}`.trim()

        // Step 1: Create user account with admin client
        console.log('useInviteEmployee: Creating user account')
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          email_confirm: true, // Auto-confirm email since we're sending magic link
          user_metadata: {
            full_name: fullName,
            job_title: data.jobTitle,
            start_date: data.startDate || new Date().toISOString().split('T')[0],
          },
        })

        if (createError) {
          console.error('useInviteEmployee: Error creating user:', createError)
          
          // Handle specific error cases
          if (createError.message.includes('already registered')) {
            return {
              success: false,
              error: 'This email address is already registered',
            }
          }
          
          return {
            success: false,
            error: createError.message || 'Failed to create user account',
          }
        }

        if (!newUser.user) {
          console.error('useInviteEmployee: No user returned from createUser')
          return {
            success: false,
            error: 'Failed to create user account',
          }
        }

        console.log('useInviteEmployee: User created successfully:', newUser.user.id)

        // Step 1.5: Update profile with additional fields (manager, department)
        if (data.managerId || data.departmentId) {
          console.log('useInviteEmployee: Updating profile with manager/department')
          const { error: updateError } = await (supabaseAdmin as any)
            .from('profiles')
            .update({
              manager_id: data.managerId || null,
              department_id: data.departmentId || null,
            })
            .eq('id', newUser.user.id)

          if (updateError) {
            console.warn('useInviteEmployee: Failed to update manager/department:', updateError)
            // Don't fail the entire invitation for this
          }
        }

        // Step 2: Generate magic link for password setup
        console.log('useInviteEmployee: Generating magic link')
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: data.email,
          options: {
            redirectTo: `${import.meta.env.VITE_APP_URL}/dashboard`,
          },
        })

        if (linkError || !linkData.properties?.action_link) {
          console.error('useInviteEmployee: Error generating magic link:', linkError)
          return {
            success: false,
            userId: newUser.user.id,
            error: 'User created but failed to generate invitation link',
          }
        }

        const magicLink = linkData.properties.action_link
        console.log('useInviteEmployee: Magic link generated successfully')

        // Step 3: Send invitation email
        console.log('useInviteEmployee: Sending invitation email')
        const emailResult = await sendEmployeeInvitationEmail(
          data.email,
          fullName,
          data.jobTitle,
          invitedByName,
          magicLink
        )

        if (!emailResult.success) {
          console.error('useInviteEmployee: Error sending email:', emailResult.error)
          return {
            success: false,
            userId: newUser.user.id,
            email: data.email,
            error: 'User created but failed to send invitation email. Please manually send the invitation.',
          }
        }

        console.log('useInviteEmployee: Invitation process completed successfully')
        return {
          success: true,
          userId: newUser.user.id,
          email: data.email,
        }
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
        // Invalidate profiles query to refresh the user list
        queryClient.invalidateQueries({ queryKey: ['profiles'] })
        console.log('useInviteEmployee: Success, profiles query invalidated')
      }
    },
  })
}
