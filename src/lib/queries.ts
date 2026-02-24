import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Department, OrgChartPosition, ShareLink } from '../types'

// Departments
export function useDepartments({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['departments'],
    enabled,
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

/** Builds a nested tree from a flat department list. Returns only root nodes (parent_id === null). */
export function buildDepartmentTree(flat: Department[]): Department[] {
  const map = new Map<string, Department>()
  flat.forEach((d) => map.set(d.id, { ...d, children: [] }))
  const roots: Department[] = []
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

/** Returns all descendant IDs (inclusive of the given id) from a flat list. */
export function getDepartmentDescendantIds(id: string, flat: Department[]): string[] {
  const result: string[] = [id]
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()!
    flat.forEach((d) => {
      if (d.parent_id === current) {
        result.push(d.id)
        queue.push(d.id)
      }
    })
  }
  return result
}

/** Returns the ancestor path from root down to (and including) the given department id. */
export function getDepartmentAncestorPath(id: string, flat: Department[]): Department[] {
  const map = new Map(flat.map((d) => [d.id, d]))
  const path: Department[] = []
  let current = map.get(id)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? map.get(current.parent_id) : undefined
  }
  return path
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (department: Omit<Department, 'id' | 'created_at' | 'children'>) => {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: department.name,
          color: department.color,
          description: department.description,
          parent_id: department.parent_id ?? null,
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
    mutationFn: async (updates: Partial<Omit<Department, 'children'>> & { id: string }) => {
      const { id, created_at, children, ...departmentUpdates } = updates as any
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

// Process Share Links

export interface ProcessShareLink {
  id: string
  slug: string
  process_id: string
  created_by: string
  expires_at: string | null
  is_active: boolean
  created_at: string
}

/** Authenticated: list all share links for a specific process */
export function useProcessShareLinks(processId: string | null) {
  return useQuery({
    queryKey: ['process-share-links', processId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('process_share_links')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ProcessShareLink[]
    },
    enabled: !!processId,
  })
}

/**
 * Anon-safe: validate a slug and return the share link record.
 * Used by the public page — runs with the anon key, no session required.
 * Returns null (not throws) if the link is expired, revoked, or not found
 * so the UI shows a uniform "not available" message regardless of reason.
 */
export function usePublicProcessShareLink(slug: string) {
  return useQuery({
    queryKey: ['public-process-share-link', slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('process_share_links')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        console.error('[share-link] lookup failed:', error)
        throw error
      }

      if (!data) return null

      const link = data as ProcessShareLink

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return null
      }

      return link
    },
    enabled: !!slug,
    retry: false,
  })
}

/** Authenticated: create a share link for a process */
export function useCreateProcessShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      process_id,
      expires_at,
    }: {
      process_id: string
      expires_at?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // crypto.randomUUID() — 128-bit cryptographically secure random slug
      const slug = crypto.randomUUID().replace(/-/g, '')

      const { data, error } = await (supabase as any)
        .from('process_share_links')
        .insert({
          slug,
          process_id,
          created_by: user.id,
          expires_at: expires_at || null,
        })
        .select()
        .single()

      if (error) throw error
      return data as ProcessShareLink
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-share-links', variables.process_id] })
    },
  })
}

/** Authenticated: toggle a share link active/inactive (instant revocation without deletion) */
export function useToggleProcessShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, process_id: _process_id, is_active }: { id: string; process_id: string; is_active: boolean }) => {
      const { data, error } = await (supabase as any)
        .from('process_share_links')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ProcessShareLink
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-share-links', variables.process_id] })
    },
  })
}

/** Authenticated: permanently delete a share link */
export function useDeleteProcessShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, process_id }: { id: string; process_id: string }) => {
      const { error } = await (supabase as any)
        .from('process_share_links')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { id, process_id }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-share-links', variables.process_id] })
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

// Organization Logo Upload
export async function uploadOrganizationLogo(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop()
  const fileName = `logo.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('organization-logos')
    .upload(fileName, file, {
      upsert: true,
    })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('organization-logos')
    .getPublicUrl(fileName)

  return publicUrl
}

// Organization Settings
export function useOrganizationSettings() {
  return useQuery({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      return data as { id: string; logo_url: string | null; updated_by: string; updated_at: string; created_at: string } | null
    },
  })
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { logo_url: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      type SettingsRow = { id: string }
      const { data: existing } = await supabase
        .from('organization_settings')
        .select('id')
        .limit(1)
        .maybeSingle()

      const existingRow = existing as SettingsRow | null
      const payload = { logo_url: updates.logo_url, updated_by: user.id }

      if (existingRow) {
        const { data, error } = await (supabase as any)
          .from('organization_settings')
          .update(payload)
          .eq('id', existingRow.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        const { data, error } = await (supabase as any)
          .from('organization_settings')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] })
    },
  })
}
