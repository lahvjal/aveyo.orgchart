import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Process, ProcessNode, ProcessEdge, ProcessNodeType } from '../types/processes'

// ── Processes ────────────────────────────────────────────────────────────────

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('processes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Process[]
    },
  })
}

export function useProcess(processId: string | null) {
  return useQuery({
    queryKey: ['process', processId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('processes')
        .select('*')
        .eq('id', processId)
        .single()

      if (error) throw error
      return data as Process
    },
    enabled: !!processId,
  })
}

export function useCreateProcess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (process: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await (supabase as any)
        .from('processes')
        .insert({ ...process, created_by: user.id })
        .select()
        .single()

      if (error) throw error
      return data as Process
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] })
    },
  })
}

export function useUpdateProcess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: { id: string; name?: string; description?: string }) => {
      const { id, ...rest } = updates
      const { data, error } = await (supabase as any)
        .from('processes')
        .update(rest)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Process
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['processes'] })
      queryClient.invalidateQueries({ queryKey: ['process', variables.id] })
    },
  })
}

export function useDeleteProcess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('processes')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] })
    },
  })
}

// ── Process Nodes ─────────────────────────────────────────────────────────────

export function useProcessNodes(processId: string | null) {
  return useQuery({
    queryKey: ['process-nodes', processId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('process_nodes')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as ProcessNode[]
    },
    enabled: !!processId,
  })
}

export function useCreateProcessNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (node: {
      process_id: string
      node_type: ProcessNodeType
      label: string
      description?: string
      x_position: number
      y_position: number
    }) => {
      const { data, error } = await (supabase as any)
        .from('process_nodes')
        .insert(node)
        .select()
        .single()

      if (error) throw error
      return data as ProcessNode
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-nodes', variables.process_id] })
    },
  })
}

export function useUpdateProcessNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: {
      id: string
      process_id: string
      label?: string
      description?: string
      x_position?: number
      y_position?: number
      tagged_profile_ids?: string[]
    }) => {
      const { id, process_id, ...rest } = updates
      const { data, error } = await (supabase as any)
        .from('process_nodes')
        .update(rest)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as ProcessNode
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-nodes', variables.process_id] })
    },
  })
}

export function useDeleteProcessNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, process_id }: { id: string; process_id: string }) => {
      const { error } = await (supabase as any)
        .from('process_nodes')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { id, process_id }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-nodes', variables.process_id] })
      queryClient.invalidateQueries({ queryKey: ['process-edges', variables.process_id] })
    },
  })
}

// ── Process Edges ─────────────────────────────────────────────────────────────

export function useProcessEdges(processId: string | null) {
  return useQuery({
    queryKey: ['process-edges', processId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('process_edges')
        .select('*')
        .eq('process_id', processId)

      if (error) throw error
      return data as ProcessEdge[]
    },
    enabled: !!processId,
  })
}

export function useCreateProcessEdge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (edge: {
      process_id: string
      source_node_id: string
      target_node_id: string
      label?: string
    }) => {
      const { data, error } = await (supabase as any)
        .from('process_edges')
        .insert(edge)
        .select()
        .single()

      if (error) throw error
      return data as ProcessEdge
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edges', variables.process_id] })
    },
  })
}

export function useDeleteProcessEdge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, process_id }: { id: string; process_id: string }) => {
      const { error } = await (supabase as any)
        .from('process_edges')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { id, process_id }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edges', variables.process_id] })
    },
  })
}

