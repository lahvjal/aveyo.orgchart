import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface RemoveEmployeeResult {
  success: boolean
  error?: string
}

/**
 * Hook for removing employees (admin only)
 *
 * This hook:
 * 1. Verifies the current user is an admin (server-side in edge function)
 * 2. Deletes the user account via the admin-user-ops edge function
 * 3. The ON DELETE CASCADE constraint automatically removes the profile
 */
export function useRemoveEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string): Promise<RemoveEmployeeResult> => {
      console.log('useRemoveEmployee: Starting removal process for user', userId)

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return { success: false, error: 'You must be logged in to remove employees' }
      }

      // Prevent self-deletion (client-side guard; edge function also enforces this)
      if (currentUser.id === userId) {
        return { success: false, error: 'You cannot remove your own account' }
      }

      try {
        const { data, error } = await supabase.functions.invoke('admin-user-ops', {
          body: {
            action: 'deleteUser',
            userId: currentUser.id,
            targetUserId: userId,
          },
        })

        if (error || !data?.success) {
          const errMsg = data?.error || error?.message || 'Failed to remove employee'
          console.error('useRemoveEmployee: Error deleting user:', errMsg)
          return { success: false, error: errMsg }
        }

        console.log('useRemoveEmployee: Successfully removed employee')
        return { success: true }
      } catch (error: any) {
        console.error('useRemoveEmployee: Unexpected error:', error)
        return {
          success: false,
          error: error.message || 'An unexpected error occurred',
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
