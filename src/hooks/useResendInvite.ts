import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { supabase } from '../lib/supabase'
import { sendEmployeeInvitationEmail } from '../lib/notifications'
import type { Profile } from '../types'

interface ResendInviteResult {
  success: boolean
  email?: string
  error?: string
}

/**
 * Hook for resending invitations to employees who haven't logged in yet
 */
export function useResendInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profile: Profile): Promise<ResendInviteResult> => {
      console.log('useResendInvite: Resending invitation for', profile.email)

      if (!supabaseAdmin) {
        console.error('useResendInvite: Admin client not configured')
        return {
          success: false,
          error: 'Admin features are not configured',
        }
      }

      // Get current user to include in invitation email
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return {
          success: false,
          error: 'You must be logged in to resend invitations',
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
        // Generate a new magic link
        console.log('useResendInvite: Generating new magic link')
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: profile.email,
          options: {
            redirectTo: `${import.meta.env.VITE_APP_URL}/dashboard`,
          },
        })

        if (linkError || !linkData.properties?.action_link) {
          console.error('useResendInvite: Error generating magic link:', linkError)
          return {
            success: false,
            error: 'Failed to generate invitation link',
          }
        }

        const magicLink = linkData.properties.action_link
        console.log('useResendInvite: Magic link generated successfully')

        // Send invitation email
        console.log('useResendInvite: Sending invitation email')
        const emailResult = await sendEmployeeInvitationEmail(
          profile.email,
          profile.full_name,
          profile.job_title,
          invitedByName,
          magicLink
        )

        if (!emailResult.success) {
          console.error('useResendInvite: Error sending email:', emailResult.error)
          return {
            success: false,
            error: 'Failed to send invitation email',
          }
        }

        console.log('useResendInvite: Invitation resent successfully')
        return {
          success: true,
          email: profile.email,
        }
      } catch (error) {
        console.error('useResendInvite: Unexpected error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
        }
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        console.log('useResendInvite: Success, invalidating user auth status')
        queryClient.invalidateQueries({ queryKey: ['user-auth-status'] })
      }
    },
  })
}

/**
 * Hook to get auth status for all users
 * Returns a map of userId -> last_sign_in_at
 */
export function useUserAuthStatus() {
  return useQuery({
    queryKey: ['user-auth-status'],
    queryFn: async () => {
      if (!supabaseAdmin) {
        console.warn('useUserAuthStatus: Admin client not configured')
        return {}
      }

      try {
        // Get all users from auth.users
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

        if (error) {
          console.error('useUserAuthStatus: Error fetching users:', error)
          return {}
        }

        // Create a map of userId -> last_sign_in_at
        const authStatusMap: Record<string, string | null> = {}
        users.forEach(user => {
          authStatusMap[user.id] = user.last_sign_in_at || null
        })

        console.log('useUserAuthStatus: Fetched auth status for', users.length, 'users')
        return authStatusMap
      } catch (error) {
        console.error('useUserAuthStatus: Unexpected error:', error)
        return {}
      }
    },
    staleTime: 60000, // Cache for 1 minute
  })
}

/**
 * Helper to check if a user has ever logged in
 */
export function hasUserLoggedIn(userId: string, authStatusMap: Record<string, string | null>): boolean {
  return !!authStatusMap[userId]
}
