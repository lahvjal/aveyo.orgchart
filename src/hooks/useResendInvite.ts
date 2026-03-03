import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendEmployeeInvitationEmail } from '../lib/notifications'
import { invokeAdminUserOps } from '../lib/adminUserOps'
import type { Profile } from '../types'

interface ResendInviteResult {
  success: boolean
  email?: string
  error?: string
}

interface ListUsersResponse {
  success?: boolean
  error?: string
  users?: Array<{ id: string; last_sign_in_at: string | null }>
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

      try {
        // Edge function handles server-side link generation and email dispatch.
        const appUrl = import.meta.env.VITE_APP_URL || window.location.origin

        // Send invitation email
        console.log('useResendInvite: Sending invitation email')
        const emailResult = await sendEmployeeInvitationEmail(
          profile.id,
          `${appUrl}/onboarding`
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
        const { data, error } = await invokeAdminUserOps<ListUsersResponse>({
          action: 'listUsers',
          userId: currentUser.id,
        })

        if (error || !data?.success) {
          console.error('useUserAuthStatus: Error fetching users:', data?.error || error)
          return {}
        }

        if (!data.users) {
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
 * Helper to check if a user has ever logged in.
 * Returns true when the user has a recorded sign-in date.
 * Returns false only when the user is explicitly in the map with a null date.
 * Returns true (benefit of the doubt) when the userId is absent from the map,
 * which can happen if the auth-status fetch failed or returned partial data —
 * better to hide a pending badge than to falsely show one.
 */
export function hasUserLoggedIn(userId: string, authStatusMap: Record<string, string | null>): boolean {
  if (!(userId in authStatusMap)) return true
  return !!authStatusMap[userId]
}
