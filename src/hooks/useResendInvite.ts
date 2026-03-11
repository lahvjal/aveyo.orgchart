import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { sendEmployeeInvitationEmail } from '../lib/notifications'
import type { Profile } from '../types'

interface ResendInviteResult {
  success: boolean
  email?: string
  error?: string
}

interface ProfileAuthStatusRow {
  id: string
  has_logged_in: boolean | null
  last_sign_in_at: string | null
}

export type UserAuthStatusMap = Record<string, boolean>

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
 * Hook to get auth status from profiles mirror columns.
 * Returns a map of userId -> hasLoggedIn boolean.
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
        const { data, error } = await supabase
          .from('profiles')
          .select('id, has_logged_in, last_sign_in_at')

        if (error) {
          const errorMessage = (error.message || '').toLowerCase()
          const mirrorColumnsMissing =
            error.code === '42703' ||
            errorMessage.includes('has_logged_in') ||
            errorMessage.includes('last_sign_in_at')

          if (mirrorColumnsMissing) {
            console.warn('useUserAuthStatus: login-status mirror columns not available yet')
            return {}
          }

          console.error('useUserAuthStatus: Error fetching profile auth status:', error)
          return {}
        }

        if (!data) {
          return {}
        }

        const authStatusMap: UserAuthStatusMap = {}
        const rows = data as ProfileAuthStatusRow[]
        for (const row of rows) {
          authStatusMap[row.id] = Boolean(row.has_logged_in || row.last_sign_in_at)
        }

        console.log('useUserAuthStatus: Fetched auth status for', rows.length, 'users')
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
 * Returns false only when the user is explicitly in the map as not logged in.
 * Returns true (benefit of the doubt) when the userId is absent from the map,
 * which can happen if the auth-status query failed or returned partial data —
 * better to hide a pending badge than to falsely show one.
 */
export function hasUserLoggedIn(userId: string, authStatusMap: UserAuthStatusMap): boolean {
  if (!(userId in authStatusMap)) return true
  return authStatusMap[userId]
}
