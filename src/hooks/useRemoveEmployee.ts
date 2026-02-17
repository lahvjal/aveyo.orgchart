import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { supabase } from '../lib/supabase'

interface RemoveEmployeeResult {
  success: boolean
  error?: string
}

/**
 * Hook for removing employees (admin only)
 * 
 * This hook:
 * 1. Verifies the current user is an admin
 * 2. Deletes the user account using supabaseAdmin
 * 3. The ON DELETE CASCADE constraint automatically removes the profile
 */
export function useRemoveEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string): Promise<RemoveEmployeeResult> => {
      console.log('useRemoveEmployee: Starting removal process for user', userId)

      // Check if admin client is available
      if (!supabaseAdmin) {
        console.error('useRemoveEmployee: Admin client not configured')
        return {
          success: false,
          error: 'Admin features are not configured. Please contact your system administrator.',
        }
      }

      // Get current user to verify admin status
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return {
          success: false,
          error: 'You must be logged in to remove employees',
        }
      }

      // Verify current user is an admin
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single()

      if (!currentProfile?.is_admin) {
        return {
          success: false,
          error: 'Only administrators can remove employees',
        }
      }

      // Prevent self-deletion
      if (currentUser.id === userId) {
        return {
          success: false,
          error: 'You cannot remove your own account',
        }
      }

      try {
        // Delete the user account using admin client
        // This will cascade delete the profile due to ON DELETE CASCADE
        console.log('useRemoveEmployee: Deleting user account')
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
          console.error('useRemoveEmployee: Error deleting user:', deleteError)
          return {
            success: false,
            error: deleteError.message || 'Failed to remove employee',
          }
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
      // Invalidate profiles query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
