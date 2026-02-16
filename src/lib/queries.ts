import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Department, OrgChartPosition, ShareLink } from '../types'

// Departments
export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name')

      if (error) throw error
      return data as Department[]
    },
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (department: Omit<Department, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: department.name,
          color: department.color,
          description: department.description,
        } as any)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<Department> & { id: string }) => {
      const { id, created_at, ...departmentUpdates } = updates as any
      const { data, error } = await (supabase as any)
        .from('departments')
        .update(departmentUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

// Org Chart Positions
export function useOrgChartPositions() {
  return useQuery({
    queryKey: ['org-chart-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_chart_positions')
        .select('*')

      if (error) throw error
      return data as OrgChartPosition[]
    },
  })
}

export function useUpdatePosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { profile_id: string; x_position: number; y_position: number }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('org_chart_positions')
        .upsert({
          profile_id: updates.profile_id,
          x_position: updates.x_position,
          y_position: updates.y_position,
          updated_by: user.id,
        } as any)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart-positions'] })
    },
  })
}

// Share Links
export function useShareLinks() {
  return useQuery({
    queryKey: ['share-links'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('share_links')
        .select('*, root_profile:profiles!share_links_root_profile_id_fkey(full_name, job_title)')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useShareLink(slug: string) {
  return useQuery({
    queryKey: ['share-link', slug],
    queryFn: async () => {
      console.log('useShareLink: Fetching share link for slug:', slug)
      
      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('slug', slug)
        .single()

      console.log('useShareLink: Response:', { data, error })

      if (error) {
        console.error('useShareLink: Error fetching share link:', error)
        throw error
      }
      
      const link = data as any
      
      // Check expiration
      if (link?.expires_at && new Date(link.expires_at) < new Date()) {
        console.error('useShareLink: Share link has expired')
        throw new Error('Share link has expired')
      }

      console.log('useShareLink: Share link found:', link)
      return link as ShareLink
    },
    enabled: !!slug,
  })
}

export function useCreateShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (shareLink: {
      root_profile_id: string
      include_contact_info: boolean
      expires_at?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate random slug
      const slug = Math.random().toString(36).substring(2, 15)

      const { data, error } = await supabase
        .from('share_links')
        .insert({
          slug,
          root_profile_id: shareLink.root_profile_id,
          include_contact_info: shareLink.include_contact_info,
          expires_at: shareLink.expires_at || null,
          created_by: user.id,
        } as any)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

export function useDeleteShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('share_links')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

// Photo Upload
export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('profile-photos')
    .upload(fileName, file, {
      upsert: true,
    })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('profile-photos')
    .getPublicUrl(fileName)

  return publicUrl
}
