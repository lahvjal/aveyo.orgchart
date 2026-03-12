import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import type {
  Process,
  ProcessNode,
  ProcessEdge,
  ProcessNodeType,
  ProcessEditLock,
  ProcessLockAcquireResult,
  ProcessLockReleaseResult,
} from '../types/processes'

type ProcessRow = Database['public']['Tables']['processes']['Row']
type ProcessInsert = Database['public']['Tables']['processes']['Insert']
type ProcessNodeRow = Database['public']['Tables']['process_nodes']['Row']
type ProcessNodeInsert = Database['public']['Tables']['process_nodes']['Insert']
type ProcessNodeUpdate = Database['public']['Tables']['process_nodes']['Update']
type ProcessEdgeRow = Database['public']['Tables']['process_edges']['Row']
type ProcessEdgeInsert = Database['public']['Tables']['process_edges']['Insert']
type ProcessEdgeUpdate = Database['public']['Tables']['process_edges']['Update']
type ProcessEditLockRow = Database['public']['Tables']['process_edit_locks']['Row']

function mapProcessRow(row: ProcessRow): Process {
  return row
}

function mapNodeRow(row: ProcessNodeRow): ProcessNode {
  return {
    ...row,
    node_type: row.node_type as ProcessNodeType,
    document_links: row.document_links ?? [],
  }
}

function mapEdgeRow(row: ProcessEdgeRow): ProcessEdge {
  return {
    ...row,
    waypoints: (row.waypoints as { x: number; y: number }[] | null) ?? null,
  }
}

function mapLockRow(row: ProcessEditLockRow): ProcessEditLock {
  return row
}

// ── Processes ────────────────────────────────────────────────────────────────

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []).map(mapProcessRow)
    },
  })
}

export function useProcess(processId: string | null) {
  return useQuery({
    queryKey: ['process', processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .eq('id', processId as string)
        .single()

      if (error) throw error
      return mapProcessRow(data)
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

      const payload: ProcessInsert = {
        name: process.name,
        description: process.description ?? null,
        created_by: user.id,
      }

      const { data, error } = await supabase
        .from('processes')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return mapProcessRow(data)
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
      const processPatch: Database['public']['Tables']['processes']['Update'] = {
        name: rest.name,
        description: rest.description,
      }
      const { data, error } = await supabase
        .from('processes')
        .update(processPatch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return mapProcessRow(data)
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
      const { error } = await supabase
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
      const { data: newProcess, error: processError } = await supabase
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
      const { data: nodes, error: nodesError } = await supabase
        .from('process_nodes')
        .select('*')
        .eq('process_id', process.id)

      if (nodesError) throw nodesError

      const nodeIdMap = new Map<string, string>()

      if (nodes && nodes.length > 0) {
        // Insert each node and build old->new id mapping
        await Promise.all(
          nodes.map(async (n) => {
            const { data: newNode, error } = await supabase
              .from('process_nodes')
              .insert({
                process_id: newProcess.id,
                node_type: n.node_type,
                label: n.label,
                description: n.description,
                document_links: n.document_links ?? [],
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
        const { data: edges, error: edgesError } = await supabase
          .from('process_edges')
          .select('*')
          .eq('process_id', process.id)

        if (edgesError) throw edgesError

        if (edges && edges.length > 0) {
          await Promise.all(
            edges.map(async (e) => {
              const newSourceId = nodeIdMap.get(e.source_node_id)
              const newTargetId = nodeIdMap.get(e.target_node_id)
              if (!newSourceId || !newTargetId) return

              const insertPayload: ProcessEdgeInsert = {
                process_id: newProcess.id,
                source_node_id: newSourceId,
                target_node_id: newTargetId,
                label: e.label,
                source_side: e.source_side,
                target_side: e.target_side,
                waypoints: e.waypoints,
              }

              const { error } = await supabase
                .from('process_edges')
                .insert(insertPayload)

              if (error) throw error
            })
          )
        }
      }

      return mapProcessRow(newProcess)
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
      const { data, error } = await supabase
        .from('process_nodes')
        .select('*')
        .eq('process_id', processId as string)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map(mapNodeRow)
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
      document_links?: string[]
      x_position: number
      y_position: number
    }) => {
      const payload: ProcessNodeInsert = {
        process_id: node.process_id,
        node_type: node.node_type,
        label: node.label,
        description: node.description ?? null,
        document_links: node.document_links ?? [],
        x_position: node.x_position,
        y_position: node.y_position,
      }

      const { data, error } = await supabase
        .from('process_nodes')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return mapNodeRow(data)
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
      document_links?: string[]
      x_position?: number
      y_position?: number
      tagged_profile_ids?: string[]
      tagged_department_ids?: string[]
    }) => {
      const id = updates.id
      const patch: ProcessNodeUpdate = {}
      if (updates.label !== undefined) patch.label = updates.label
      if (updates.description !== undefined) patch.description = updates.description
      if (updates.document_links !== undefined) patch.document_links = updates.document_links
      if (updates.x_position !== undefined) patch.x_position = updates.x_position
      if (updates.y_position !== undefined) patch.y_position = updates.y_position
      if (updates.tagged_profile_ids !== undefined) patch.tagged_profile_ids = updates.tagged_profile_ids
      if (updates.tagged_department_ids !== undefined) patch.tagged_department_ids = updates.tagged_department_ids

      const { data, error } = await supabase
        .from('process_nodes')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return mapNodeRow(data)
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
      const { error } = await supabase
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
      const { data, error } = await supabase
        .from('process_edges')
        .select('*')
        .eq('process_id', processId as string)

      if (error) throw error
      return (data ?? []).map(mapEdgeRow)
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
      const basePayload: ProcessEdgeInsert = {
        process_id: edge.process_id,
        source_node_id: edge.source_node_id,
        target_node_id: edge.target_node_id,
      }
      if (edge.label !== undefined) basePayload.label = edge.label

      // Always create with the core payload first. This guarantees edge creation
      // even in environments where side columns are missing or constrained.
      const { data, error } = await supabase
        .from('process_edges')
        .insert(basePayload)
        .select()
        .single()
      if (error) throw error

      return mapEdgeRow(data)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edges', variables.process_id] })
    },
  })
}

export function useUpdateProcessEdge() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: {
      id: string
      process_id: string
      waypoints?: { x: number; y: number }[]
      source_side?: string | null
      target_side?: string | null
      source_node_id?: string
      target_node_id?: string
    }) => {
      const { id, waypoints, source_side, target_side, source_node_id, target_node_id } = updates
      const patch: ProcessEdgeUpdate = {}
      if (waypoints !== undefined)      patch.waypoints      = waypoints
      if (source_side !== undefined)    patch.source_side    = source_side
      if (target_side !== undefined)    patch.target_side    = target_side
      if (source_node_id !== undefined) patch.source_node_id = source_node_id
      if (target_node_id !== undefined) patch.target_node_id = target_node_id

      let { data, error } = await supabase
        .from('process_edges')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      // If endpoint-side columns are unsupported, retry without them so reconnect
      // and other updates still succeed.
      const includesSidePatch = patch.source_side !== undefined || patch.target_side !== undefined
      const errText = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase()
      const shouldRetryWithoutSides =
        !!error &&
        includesSidePatch &&
        (
          errText.includes('source_side')
          || errText.includes('target_side')
          || errText.includes('column')
        )

      if (shouldRetryWithoutSides) {
        const retryPatch: ProcessEdgeUpdate = { ...patch }
        delete retryPatch.source_side
        delete retryPatch.target_side

        if (Object.keys(retryPatch).length > 0) {
          const retry = await supabase
            .from('process_edges')
            .update(retryPatch)
            .eq('id', id)
            .select()
            .single()
          data = retry.data
          error = retry.error
        }
      }

      if (error) throw error
      if (!data) throw new Error('Edge update returned no row')
      return mapEdgeRow(data)
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
      const { error } = await supabase
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

// ── Process Edit Locks ────────────────────────────────────────────────────────

export function useProcessEditLock(processId: string | null) {
  return useQuery({
    queryKey: ['process-edit-lock', processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_edit_locks')
        .select('*')
        .eq('process_id', processId as string)
        .maybeSingle()

      if (error) throw error
      return data ? mapLockRow(data) : null
    },
    enabled: !!processId,
  })
}

export function useAcquireProcessEditLock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ process_id }: { process_id: string }) => {
      const { data, error } = await supabase.rpc('acquire_process_edit_lock', {
        p_process_id: process_id,
      })
      if (error) throw error

      const result = (data ?? [])[0]
      if (!result) throw new Error('Lock acquire returned no result')
      return result as ProcessLockAcquireResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edit-lock', variables.process_id] })
    },
  })
}

export function useForceTakeoverProcessEditLock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ process_id }: { process_id: string }) => {
      const { data, error } = await supabase.rpc('force_takeover_process_edit_lock', {
        p_process_id: process_id,
      })
      if (error) throw error

      const result = (data ?? [])[0]
      if (!result) throw new Error('Lock takeover returned no result')
      return result as ProcessLockAcquireResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edit-lock', variables.process_id] })
    },
  })
}

export function useReleaseProcessEditLock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ process_id }: { process_id: string }) => {
      const { data, error } = await supabase.rpc('release_process_edit_lock', {
        p_process_id: process_id,
      })
      if (error) throw error

      const result = (data ?? [])[0]
      if (!result) throw new Error('Lock release returned no result')
      return result as ProcessLockReleaseResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['process-edit-lock', variables.process_id] })
    },
  })
}

