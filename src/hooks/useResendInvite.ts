import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
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

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return { success: false, error: 'You must be logged in to resend invitations' }
      }

      // Get current user's profile for the "invited by" name
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single()

      const invitedByName = (currentProfile as any)?.full_name || 'Administrator'

      try {
        // Generate a new magic link via edge function
        console.log('useResendInvite: Generating new magic link')
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

        const { data: linkData, error: linkError } = await supabase.functions.invoke(
          'admin-user-ops',
          {
            body: {
              action: 'generateLink',
              userId: currentUser.id,
              email: profile.email,
              linkType: 'magiclink',
              redirectTo: `${appUrl}/onboarding`,
            },
          }
        )

        if (linkError || !linkData?.success || !linkData?.actionLink) {
          console.error('useResendInvite: Error generating magic link:', linkData?.error || linkError)
          return { success: false, error: 'Failed to generate invitation link' }
        }

        const magicLink = linkData.actionLink
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
          return { success: false, error: 'Failed to send invitation email' }
        }

        console.log('useResendInvite: Invitation resent successfully')
        return { success: true, email: profile.email }
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
 * Hook to get auth status for all users.
 * Returns a map of userId -> last_sign_in_at
 */
export function useUserAuthStatus() {
  return useQuery({
    queryKey: ['user-auth-status'],
    queryFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        console.warn('useUserAuthStatus: Not authenticated')
        return {}
      }

      try {
        const { data, error } = await supabase.functions.invoke('admin-user-ops', {
          body: { action: 'listUsers', userId: currentUser.id },
        })

        if (error || !data?.success) {
          console.error('useUserAuthStatus: Error fetching users:', data?.error || error)
          return {}
        }

        const authStatusMap: Record<string, string | null> = {}
        for (const user of data.users) {
          authStatusMap[user.id] = user.last_sign_in_at ?? null
        }

        console.log('useUserAuthStatus: Fetched auth status for', data.users.length, 'users')
        return authStatusMap
      } catch (error) {
        console.error('useUserAuthStatus: Unexpected error:', error)
        return {}
      }
    },
    staleTime: 60000,
  })
}

/**
 * Helper to check if a user has ever logged in
 */
export function hasUserLoggedIn(userId: string, authStatusMap: Record<string, string | null>): boolean {
  return !!authStatusMap[userId]
}
