import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { sendProfileUpdateEmail, sendManagerChangeEmail, sendDepartmentChangeEmail } from '../lib/notifications'

export type EmploymentStatusFilter = 'active' | 'terminated' | 'all'

function filterProfilesByStatus(profiles: Profile[], status: EmploymentStatusFilter): Profile[] {
  if (status === 'all') return profiles
  return profiles.filter((profile) => (profile.employment_status ?? 'active') === status)
}

export function useProfile(
  userId?: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled,
    queryFn: async () => {
      console.log('useProfile: Fetching profile for userId:', userId)
      const { data: { user } } = await supabase.auth.getUser()
      const id = userId || user?.id
      
      console.log('useProfile: Resolved ID:', id)
      
      if (!id) {
        console.error('useProfile: No user ID available')
        throw new Error('No user ID provided')
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          department:departments(*),
          manager:manager_id(id, full_name, job_title, email)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('useProfile: Error fetching profile:', error)
        throw error
      }
      
      console.log('useProfile: Successfully fetched profile:', data)
      return data as unknown as Profile
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<Profile> & { id: string }) => {
      const { id, department, manager, created_at, updated_at, email, ...profileUpdates } = updates as any
      
      // Get old profile data for comparison
      const { data: oldProfile } = await supabase
        .from('profiles')
        .select('*, department:departments(*), manager:manager_id(id, full_name, job_title, email)')
        .eq('id', id)
        .single()

      const { data, error } = await (supabase as any)
        .from('profiles')
        .update(profileUpdates)
        .eq('id', id)
        .select('*, department:departments(*), manager:manager_id(id, full_name, job_title, email)')
        .single()

      if (error) throw error
      
      // Get current user for notification
      const { data: { user } } = await supabase.auth.getUser()
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user?.id || '')
        .single()

      // Send notifications
      const isOwnUpdate = user?.id === id
      
      // Profile update notification
      if (currentUserProfile && data) {
        sendProfileUpdateEmail(
          data as any,
          currentUserProfile as any,
          isOwnUpdate
        ).catch(err => console.error('Failed to send profile update email:', err))
      }

      // Manager change notification
      if (oldProfile && data && (oldProfile as any).manager_id !== (data as any).manager_id) {
        sendManagerChangeEmail(
          data as any,
          (data as any).manager,
          (oldProfile as any).manager
        ).catch(err => console.error('Failed to send manager change email:', err))
      }

      // Department change notification
      if (oldProfile && data && (oldProfile as any).department_id !== (data as any).department_id) {
        sendDepartmentChangeEmail(
          data as any,
          (oldProfile as any).department?.name || null,
          (data as any).department?.name || 'None'
        ).catch(err => console.error('Failed to send department change email:', err))
      }

      return data as any as Profile
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', data.id] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useProfiles({
  enabled = true,
  status = 'active',
}: { enabled?: boolean; status?: EmploymentStatusFilter } = {}) {
  return useQuery({
    queryKey: ['profiles', status],
    enabled,
    queryFn: async () => {
      console.log('useProfiles: Fetching all profiles...')
      
      let query = supabase
        .from('profiles')
        .select(`
          *,
          department:departments(*),
          manager:manager_id(id, full_name, job_title)
        `)
        .order('full_name')

      if (status !== 'all') {
        query = query.eq('employment_status', status)
      }

      const { data, error } = await query

      if (error) {
        console.error('useProfiles: Error:', error)
        throw error
      }
      
      const profiles = (data as unknown as Profile[]) || []
      console.log('useProfiles: Fetched profiles:', profiles)
      return profiles
    },
  })
}

export function useProfileBranch(
  userId?: string,
  { status = 'active' }: { status?: EmploymentStatusFilter } = {}
) {
  return useQuery({
    queryKey: ['profile-branch', userId, status],
    queryFn: async () => {
      console.log('useProfileBranch: Fetching branch for userId:', userId)
      
      const { data: { user } } = await supabase.auth.getUser()
      const id = userId || user?.id
      
      console.log('useProfileBranch: Resolved ID:', id)
      
      if (!id) {
        console.error('useProfileBranch: No user ID')
        throw new Error('No user ID provided')
      }

      const { data, error } = await supabase.rpc('get_profile_branch', {
        user_id: id,
      })

      if (error) {
        console.error('useProfileBranch: Error:', error)
        throw error
      }
      
      const branchProfiles = (data as any as Profile[]) || []
      const filteredBranch = filterProfilesByStatus(branchProfiles, status)
      console.log('useProfileBranch: Fetched branch profiles:', filteredBranch)
      return filteredBranch
    },
  })
}
