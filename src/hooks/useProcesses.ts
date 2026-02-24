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

export function useDuplicateProcess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (process: Process) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create new process
      const { data: newProcess, error: processError } = await (supabase as any)
        .from('processes')
        .insert({
          name: `Copy of ${process.name}`,
          description: process.description,
          created_by: user.id,
        })
        .select()
        .single()

      if (processError) throw processError

      // Fetch original nodes
      const { data: nodes, error: nodesError } = await (supabase as any)
        .from('process_nodes')
        .select('*')
        .eq('process_id', process.id)

      if (nodesError) throw nodesError

      const nodeIdMap = new Map<string, string>()

      if (nodes && nodes.length > 0) {
        // Insert each node and build old->new id mapping
        await Promise.all(
          (nodes as ProcessNode[]).map(async (n) => {
            const { data: newNode, error } = await (supabase as any)
              .from('process_nodes')
              .insert({
                process_id: newProcess.id,
                node_type: n.node_type,
                label: n.label,
                description: n.description,
                x_position: n.x_position,
                y_position: n.y_position,
                tagged_profile_ids: n.tagged_profile_ids,
                tagged_department_ids: n.tagged_department_ids,
              })
              .select()
              .single()

            if (error) throw error
            nodeIdMap.set(n.id, newNode.id)
          })
        )

        // Fetch original edges
        const { data: edges, error: edgesError } = await (supabase as any)
          .from('process_edges')
          .select('*')
          .eq('process_id', process.id)

        if (edgesError) throw edgesError

        if (edges && edges.length > 0) {
          await Promise.all(
            (edges as ProcessEdge[]).map(async (e) => {
              const newSourceId = nodeIdMap.get(e.source_node_id)
              const newTargetId = nodeIdMap.get(e.target_node_id)
              if (!newSourceId || !newTargetId) return

              const { error } = await (supabase as any)
                .from('process_edges')
                .insert({
                  process_id: newProcess.id,
                  source_node_id: newSourceId,
                  target_node_id: newTargetId,
                  label: e.label,
                  source_side: e.source_side,
                  target_side: e.target_side,
                  waypoints: e.waypoints,
                })

              if (error) throw error
            })
          )
        }
      }

      return newProcess as Process
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
      tagged_department_ids?: string[]
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
      source_side?: string | null
      target_side?: string | null
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

export function useUpdateProcessEdge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      process_id: _process_id,
      waypoints,
      source_side,
      target_side,
      source_node_id,
      target_node_id,
    }: {
      id: string
      process_id: string
      waypoints?: { x: number; y: number }[]
      source_side?: string | null
      target_side?: string | null
      source_node_id?: string
      target_node_id?: string
    }) => {
      const patch: Record<string, unknown> = {}
      if (waypoints !== undefined)      patch.waypoints      = waypoints
      if (source_side !== undefined)    patch.source_side    = source_side
      if (target_side !== undefined)    patch.target_side    = target_side
      if (source_node_id !== undefined) patch.source_node_id = source_node_id
      if (target_node_id !== undefined) patch.target_node_id = target_node_id

      const { data, error } = await (supabase as any)
        .from('process_edges')
        .update(patch)
        .eq('id', id)
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

