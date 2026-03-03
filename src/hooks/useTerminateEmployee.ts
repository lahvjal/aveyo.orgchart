import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface TerminateEmployeeInput {
  targetUserId: string
  successorManagerId: string | null
  terminationReason?: string | null
  terminationEffectiveAt?: string | null
}

interface TerminateEmployeeResult {
  success: boolean
  error?: string
  reassignedCount?: number
  terminatedAt?: string
}

export function useTerminateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TerminateEmployeeInput): Promise<TerminateEmployeeResult> => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        return { success: false, error: 'You must be logged in to terminate employees' }
      }

      if (input.targetUserId === currentUser.id) {
        return { success: false, error: 'You cannot terminate your own account' }
      }

      try {
        const { data, error } = await supabase.functions.invoke('admin-user-ops', {
          body: {
            action: 'terminateEmployee',
            userId: currentUser.id,
            targetUserId: input.targetUserId,
            successorManagerId: input.successorManagerId,
            terminationReason: input.terminationReason ?? null,
            terminationEffectiveAt: input.terminationEffectiveAt ?? null,
          },
        })

        if (error || !data?.success) {
          const errMsg = data?.error || error?.message || 'Failed to terminate employee'
          return { success: false, error: errMsg }
        }

        return {
          success: true,
          reassignedCount: data.reassignedCount ?? 0,
          terminatedAt: data.terminatedAt,
        }
      } catch (error: any) {
        return {
          success: false,
          error: error?.message || 'An unexpected error occurred',
        }
      }
    },
    onSuccess: (result) => {
      if (!result.success) return
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile-branch'] })
    },
  })
}
