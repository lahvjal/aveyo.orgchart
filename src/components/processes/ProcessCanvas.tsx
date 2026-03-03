import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import type { NodeTypes, EdgeTypes, Connection, Edge, Node, ReactFlowInstance } from 'reactflow'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Undo2, Redo2, Save, Loader2 } from 'lucide-react'
import 'reactflow/dist/style.css'
import { ProcessNode } from './ProcessNode'
import type { ProcessNodeData } from './ProcessNode'
import { ProcessEdge } from './ProcessEdge'
import { ProcessNodePalette } from './ProcessNodePalette'
import { ProcessCanvasContext } from './ProcessCanvasContext'
import type { ProcessNodeType, ProcessNode as ProcessNodeRecord, ProcessEdge as ProcessEdgeRecord } from '../../types/processes'
import { useProcessNodes, useProcessEdges } from '../../hooks/useProcesses'
import { useProcessRealtime } from '../../hooks/useProcessRealtime'
import { useProfiles } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'
import type { Database } from '../../types/database'

// Defined outside component so ReactFlow never sees new object references
const nodeTypes: NodeTypes = { process: ProcessNode }
const edgeTypes: EdgeTypes = { process: ProcessEdge }
const AUTO_SAVE_MS = 15000

type ProcessNodeInsert = Database['public']['Tables']['process_nodes']['Insert']
type ProcessEdgeInsert = Database['public']['Tables']['process_edges']['Insert']

function toFlowNodes(dbNodes: ProcessNodeRecord[]): Node<ProcessNodeData>[] {
  return dbNodes.map((n) => ({
    id: n.id,
    type: 'process',
    position: { x: n.x_position, y: n.y_position },
    data: {
      nodeType: n.node_type,
      label: n.label,
      description: n.description ?? '',
      taggedProfileIds: n.tagged_profile_ids ?? [],
      taggedDepartmentIds: n.tagged_department_ids ?? [],
    },
  }))
}

function toFlowEdges(dbEdges: ProcessEdgeRecord[], canEdit: boolean): Edge[] {
  return dbEdges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    label: e.label ?? undefined,
    type: 'process',
    data: {
      canEdit,
      waypoints: e.waypoints ?? [],
      srcSide: e.source_side ?? null,
      tgtSide: e.target_side ?? null,
    },
  }))
}

function graphSignature(
  nodes: Node<ProcessNodeData>[],
  edges: Edge[],
): string {
  const nodeSig = [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      t: n.data.nodeType,
      l: n.data.label,
      d: n.data.description ?? '',
      p: [...n.data.taggedProfileIds].sort(),
      dep: [...n.data.taggedDepartmentIds].sort(),
    }))
  const edgeSig = [...edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({
      id: e.id,
      s: e.source,
      t: e.target,
      l: e.label ?? '',
      w: e.data?.waypoints ?? [],
      ss: e.data?.srcSide ?? null,
      ts: e.data?.tgtSide ?? null,
    }))
  return JSON.stringify({ nodeSig, edgeSig })
}

function normalizeEdgeLabel(label: Edge['label']): string | null {
  if (typeof label === 'string') return label
  if (label == null) return null
  return String(label)
}

function normalizeEdgeWaypoints(edge: Edge): Database['public']['Tables']['process_edges']['Insert']['waypoints'] {
  const candidate = edge.data?.waypoints
  return Array.isArray(candidate) ? (candidate as Database['public']['Tables']['process_edges']['Insert']['waypoints']) : null
}

function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// ── Side-detection helpers (module-level, no closures needed) ────────────────

/**
 * Derive a side string from a handle ID.
 * Handle IDs follow the pattern '<side>-source' / '<side>-target'.
 * Returns null for 'node-body' and any other full-node handles.
 */
function sideFromHandleId(handleId: string | null | undefined): string | null {
  if (!handleId) return null
  if (handleId.startsWith('top'))    return 'top'
  if (handleId.startsWith('bottom')) return 'bottom'
  if (handleId.startsWith('left'))   return 'left'
  if (handleId.startsWith('right'))  return 'right'
  return null
}

/**
 * Compute which side of a node a flow-space point is closest to.
 * Normalises dx/dy by the node's half-dimensions so the result is
 * correct for rectangular (non-square) nodes.
 */
function sideFromPoint(
  node: { position: { x: number; y: number }; positionAbsolute?: { x: number; y: number }; width?: number | null; height?: number | null },
  flowPt: { x: number; y: number },
): string {
  const pos = node.positionAbsolute ?? node.position
  const hw = (node.width  ?? 200) / 2
  const hh = (node.height ?? 100) / 2
  const dx = flowPt.x - (pos.x + hw)
  const dy = flowPt.y - (pos.y + hh)
  if (Math.abs(dx / hw) >= Math.abs(dy / hh)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function getNodeCenter(
  node: { position: { x: number; y: number }; positionAbsolute?: { x: number; y: number }; width?: number | null; height?: number | null },
): { x: number; y: number } {
  const pos = node.positionAbsolute ?? node.position
  return {
    x: pos.x + (node.width ?? 200) / 2,
    y: pos.y + (node.height ?? 100) / 2,
  }
}

function getDirectionalSides(
  sourceNode: { position: { x: number; y: number }; positionAbsolute?: { x: number; y: number }; width?: number | null; height?: number | null },
  targetNode: { position: { x: number; y: number }; positionAbsolute?: { x: number; y: number }; width?: number | null; height?: number | null },
): { srcSide: string; tgtSide: string; dx: number; dy: number } {
  const src = getNodeCenter(sourceNode)
  const tgt = getNodeCenter(targetNode)
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y

  // Bias toward left/right so branches to lower-left/lower-right avoid piling
  // through the same bottom connector and visually crossing near the node.
  const horizontalWins = Math.abs(dx) >= Math.max(Math.abs(dy) * 0.55, 24)
  if (horizontalWins) {
    return dx >= 0
      ? { srcSide: 'right', tgtSide: 'left', dx, dy }
      : { srcSide: 'left', tgtSide: 'right', dx, dy }
  }

  return dy >= 0
    ? { srcSide: 'bottom', tgtSide: 'top', dx, dy }
    : { srcSide: 'top', tgtSide: 'bottom', dx, dy }
}

function chooseSmartSide(
  explicit: string | null,
  directional: string,
): string {
  // Keep user-selected/source-handle side stable; directional side is only for
  // cases where no explicit side exists (e.g. full-node body target).
  return explicit ?? directional
}

interface ProcessCanvasProps {
  processId: string
  canEdit: boolean
  isPublic?: boolean
}

function ProcessCanvasInner({ processId, canEdit, isPublic = false }: ProcessCanvasProps) {
  const { data: dbNodes = [], isLoading: nodesLoading } = useProcessNodes(processId)
  const { data: dbEdges = [], isLoading: edgesLoading } = useProcessEdges(processId)
  // Disabled on public pages — prevents org-wide employee/dept data from being
  // fetched and exposed to unauthenticated viewers
  const { data: allProfiles = [] } = useProfiles({ enabled: !isPublic, status: 'all' })
  const { data: allDepartments = [] } = useDepartments({ enabled: !isPublic })
  const isLoading = nodesLoading || edgesLoading

  const queryClient = useQueryClient()

  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView, screenToFlowPosition, getNode } = useReactFlow()
  const hasHydratedRef = useRef(false)
  const lastRemoteSignatureRef = useRef<string | null>(null)
  const pendingRemoteSnapshotRef = useRef<{ nodes: Node<ProcessNodeData>[]; edges: Edge[] } | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasPendingRemoteChanges, setHasPendingRemoteChanges] = useState(false)
  const isSavingRef = useRef(false)
  const isDirtyRef = useRef(false)
  const editVersionRef = useRef(0)
  const deletingNodeIdsRef = useRef<Set<string>>(new Set())
  // Track last pointer position so onConnect / onReconnect can compute the
  // target side when the edge is dropped on the full-node 'node-body' handle.
  const lastPointerRef = useRef({ x: 0, y: 0 })

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  // Always-current mirrors used in callbacks to avoid stale closures
  const nodesRef = useRef<Node<ProcessNodeData>[]>([])
  const edgesRef = useRef<Edge[]>([])
  nodesRef.current = nodes
  edgesRef.current = edges

  interface HistoryEntry { nodes: Node<ProcessNodeData>[]; edges: Edge[] }
  const historyRef      = useRef<HistoryEntry[]>([])
  const historyIndexRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const applySnapshotToCanvas = useCallback((
    snapshot: HistoryEntry,
    {
      resetHistory = false,
      clearDirty = false,
      setAsLastRemote = false,
    }: { resetHistory?: boolean; clearDirty?: boolean; setAsLastRemote?: boolean } = {},
  ) => {
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)

    if (resetHistory) {
      historyRef.current = [snapshot]
      historyIndexRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
    }

    if (clearDirty) {
      editVersionRef.current = 0
      isDirtyRef.current = false
      setHasUnsavedChanges(false)
      setSaveError(null)
    }

    if (setAsLastRemote) {
      lastRemoteSignatureRef.current = graphSignature(snapshot.nodes, snapshot.edges)
    }
  }, [setNodes, setEdges])

  /** Push a snapshot onto the history stack (max 20 undoable steps). */
  const pushToHistory = useCallback((newNodes: Node<ProcessNodeData>[], newEdges: Edge[]) => {
    if (!canEdit) return
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1)
    truncated.push({
      nodes: newNodes.map(n => ({ ...n, data: { ...n.data } })),
      edges: newEdges.map(e => ({ ...e, data: { ...e.data } })),
    })
    if (truncated.length > 21) truncated.shift() // keep at most 20 past + current
    else historyIndexRef.current++
    historyRef.current = truncated
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
  }, [canEdit])

  const markDirty = useCallback(() => {
    if (!canEdit) return
    editVersionRef.current += 1
    isDirtyRef.current = true
    setHasUnsavedChanges(true)
    setSaveError(null)
  }, [canEdit])

  const onRealtimeGraphMutation = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['process-nodes', processId] })
    queryClient.invalidateQueries({ queryKey: ['process-edges', processId] })
  }, [processId, queryClient])

  useProcessRealtime({
    processId,
    onGraphMutation: onRealtimeGraphMutation,
  })

  const persistGraphSnapshot = useCallback(async (
    snapshotNodes: Node<ProcessNodeData>[],
    snapshotEdges: Edge[],
  ) => {
    const [{ data: dbNodeRows, error: dbNodeErr }, { data: dbEdgeRows, error: dbEdgeErr }] = await Promise.all([
      supabase
        .from('process_nodes')
        .select('id')
        .eq('process_id', processId),
      supabase
        .from('process_edges')
        .select('id')
        .eq('process_id', processId),
    ])
    if (dbNodeErr) throw dbNodeErr
    if (dbEdgeErr) throw dbEdgeErr

    const localNodeIds = new Set(snapshotNodes.map((n) => n.id))
    const localEdgeIds = new Set(snapshotEdges.map((e) => e.id))
    const nodeIdsToDelete = ((dbNodeRows ?? []) as { id: string }[])
      .map((n) => n.id)
      .filter((id) => !localNodeIds.has(id))
    const edgeIdsToDelete = ((dbEdgeRows ?? []) as { id: string }[])
      .map((e) => e.id)
      .filter((id) => !localEdgeIds.has(id))

    if (edgeIdsToDelete.length > 0) {
      const { error } = await supabase.from('process_edges').delete().in('id', edgeIdsToDelete)
      if (error) throw error
    }
    if (nodeIdsToDelete.length > 0) {
      const { error } = await supabase.from('process_nodes').delete().in('id', nodeIdsToDelete)
      if (error) throw error
    }

    if (snapshotNodes.length > 0) {
      const nodeRows: ProcessNodeInsert[] = snapshotNodes.map((n) => ({
        id: n.id,
        process_id: processId,
        node_type: n.data.nodeType,
        label: n.data.label,
        description: n.data.description || null,
        x_position: n.position.x,
        y_position: n.position.y,
        tagged_profile_ids: n.data.taggedProfileIds,
        tagged_department_ids: n.data.taggedDepartmentIds,
      }))
      const { error } = await supabase
        .from('process_nodes')
        .upsert(nodeRows, { onConflict: 'id' })
      if (error) throw error
    }

    if (snapshotEdges.length > 0) {
      const edgeRowsWithSides: ProcessEdgeInsert[] = snapshotEdges.map((e) => ({
        id: e.id,
        process_id: processId,
        source_node_id: e.source,
        target_node_id: e.target,
        label: normalizeEdgeLabel(e.label),
        waypoints: normalizeEdgeWaypoints(e),
        source_side: e.data?.srcSide || null,
        target_side: e.data?.tgtSide || null,
      }))
      let { error: edgeErr } = await supabase
        .from('process_edges')
        .upsert(edgeRowsWithSides, { onConflict: 'id' })

      if (edgeErr) {
        const edgeRowsBase: ProcessEdgeInsert[] = snapshotEdges.map((e) => ({
          id: e.id,
          process_id: processId,
          source_node_id: e.source,
          target_node_id: e.target,
          label: normalizeEdgeLabel(e.label),
          waypoints: normalizeEdgeWaypoints(e),
        }))
        const retry = await supabase
          .from('process_edges')
          .upsert(edgeRowsBase, { onConflict: 'id' })
        edgeErr = retry.error
      }

      if (edgeErr) throw edgeErr
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['process-nodes', processId] }),
      queryClient.invalidateQueries({ queryKey: ['process-edges', processId] }),
    ])
  }, [processId, queryClient])

  const saveChanges = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!canEdit && !force) return
    if (isSavingRef.current) return
    if (!force && !isDirtyRef.current) return

    const versionAtStart = editVersionRef.current
    isSavingRef.current = true
    setIsSaving(true)
    setSaveError(null)

    try {
      const snapshotNodes = nodesRef.current.map((n) => ({ ...n, data: { ...n.data } }))
      const snapshotEdges = edgesRef.current.map((e) => ({ ...e, data: { ...e.data } }))
      await persistGraphSnapshot(snapshotNodes, snapshotEdges)
      const hasConcurrentEdits = editVersionRef.current !== versionAtStart
      isDirtyRef.current = hasConcurrentEdits
      setHasUnsavedChanges(hasConcurrentEdits)
      setLastSavedAt(new Date())
    } catch (err) {
      const saveMsg =
        err instanceof Error
          ? err.message
          : 'Unable to save process updates right now.'
      setSaveError(saveMsg)
      console.error('Process save failed', { err, processId })
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [canEdit, persistGraphSnapshot, processId])

  const undo = useCallback(() => {
    if (!canEdit || historyIndexRef.current <= 0) return
    historyIndexRef.current--
    const target = historyRef.current[historyIndexRef.current]
    setNodes(target.nodes)
    setEdges(target.edges)
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
    markDirty()
  }, [canEdit, setNodes, setEdges, markDirty])

  const redo = useCallback(() => {
    if (!canEdit || historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    const target = historyRef.current[historyIndexRef.current]
    setNodes(target.nodes)
    setEdges(target.edges)
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    markDirty()
  }, [canEdit, setNodes, setEdges, markDirty])

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
      else if (e.key === 's') { e.preventDefault(); void saveChanges({ force: true }) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canEdit, undo, redo, saveChanges])

  // Auto-save in the background so edits are not sent on every tiny interaction.
  useEffect(() => {
    if (!canEdit) return
    const timer = window.setInterval(() => {
      if (!isSavingRef.current && isDirtyRef.current) {
        void saveChanges()
      }
    }, AUTO_SAVE_MS)
    return () => window.clearInterval(timer)
  }, [canEdit, saveChanges])

  // Prompt before tab close if there are unsaved changes.
  useEffect(() => {
    if (!canEdit) return
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [canEdit])

  // Best-effort flush when leaving edit mode.
  const wasEditingRef = useRef(canEdit)
  useEffect(() => {
    if (wasEditingRef.current && !canEdit && isDirtyRef.current && !isSavingRef.current) {
      void saveChanges({ force: true })
    }
    wasEditingRef.current = canEdit
  }, [canEdit, saveChanges])

  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      const next = nodesRef.current.map((n) => n.id === id ? { ...n, data: { ...n.data, label } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
      markDirty()
    },
    [setNodes, pushToHistory, markDirty]
  )

  const handleDescriptionChange = useCallback(
    (id: string, description: string) => {
      const next = nodesRef.current.map((n) => n.id === id ? { ...n, data: { ...n.data, description } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
      markDirty()
    },
    [setNodes, pushToHistory, markDirty]
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      const nextNodes = nodesRef.current.filter((n) => n.id !== id)
      const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      pushToHistory(nextNodes, nextEdges)
      markDirty()
    },
    [setNodes, setEdges, pushToHistory, markDirty]
  )

  const handleUpdateTaggedProfiles = useCallback(
    (nodeId: string, profileIds: string[]) => {
      const next = nodesRef.current.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, taggedProfileIds: profileIds } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
      markDirty()
    },
    [setNodes, pushToHistory, markDirty]
  )

  const handleUpdateTaggedDepartments = useCallback(
    (nodeId: string, departmentIds: string[]) => {
      const next = nodesRef.current.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, taggedDepartmentIds: departmentIds } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
      markDirty()
    },
    [setNodes, pushToHistory, markDirty]
  )

  // Reconcile query snapshots into the canvas:
  // - first load hydrates canvas + history
  // - clean local state applies remote updates immediately
  // - dirty local state defers remote updates behind an explicit banner action
  useEffect(() => {
    if (isLoading) return

    const incomingNodes = toFlowNodes(dbNodes)
    const incomingEdges = toFlowEdges(dbEdges, canEdit)
    const incomingSnapshot = { nodes: incomingNodes, edges: incomingEdges }
    const incomingSignature = graphSignature(incomingNodes, incomingEdges)
    const localSignature = graphSignature(nodesRef.current, edgesRef.current)

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      applySnapshotToCanvas(incomingSnapshot, { resetHistory: true, clearDirty: true, setAsLastRemote: true })
      pendingRemoteSnapshotRef.current = null
      setHasPendingRemoteChanges(false)
      setLastSavedAt(new Date())

      if (incomingNodes.length > 0) {
        setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 150)
      }
      return
    }

    if (incomingSignature === localSignature) {
      lastRemoteSignatureRef.current = incomingSignature
      pendingRemoteSnapshotRef.current = null
      setHasPendingRemoteChanges(false)
      return
    }

    if (isDirtyRef.current || isSavingRef.current) {
      pendingRemoteSnapshotRef.current = incomingSnapshot
      setHasPendingRemoteChanges(true)
      return
    }

    applySnapshotToCanvas(incomingSnapshot, { resetHistory: true, clearDirty: true, setAsLastRemote: true })
    pendingRemoteSnapshotRef.current = null
    setHasPendingRemoteChanges(false)
  }, [isLoading, dbNodes, dbEdges, canEdit, applySnapshotToCanvas, fitView])

  const applyPendingRemoteSnapshot = useCallback(() => {
    if (!pendingRemoteSnapshotRef.current) return
    applySnapshotToCanvas(pendingRemoteSnapshotRef.current, {
      resetHistory: true,
      clearDirty: true,
      setAsLastRemote: true,
    })
    pendingRemoteSnapshotRef.current = null
    setHasPendingRemoteChanges(false)
  }, [applySnapshotToCanvas])

  // Keep edge canEdit flag in sync when edit mode toggles.
  // Nodes no longer need updating here — they read canEdit from context.
  useEffect(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, data: { ...e.data, canEdit } })))
  }, [canEdit, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return

      // Resolve which side of each node the edge exits/enters.
      // Named handles (e.g. 'right-source') give us the side directly.
      // The full-node 'node-body' handle falls back to cursor-position heuristic.
      const flowPt = screenToFlowPosition(lastPointerRef.current)
      const srcNode = getNode(connection.source)
      const tgtNode = getNode(connection.target)
      const directional = srcNode && tgtNode ? getDirectionalSides(srcNode, tgtNode) : null
      const explicitSrcSide = sideFromHandleId(connection.sourceHandle)
      const explicitTgtSide = sideFromHandleId(connection.targetHandle)
      const srcSide = directional
        ? chooseSmartSide(explicitSrcSide, directional.srcSide)
        : (explicitSrcSide ?? (srcNode ? sideFromPoint(srcNode, flowPt) : null))
      const tgtSide = directional
        ? chooseSmartSide(explicitTgtSide, directional.tgtSide)
        : (explicitTgtSide ?? (tgtNode ? sideFromPoint(tgtNode, flowPt) : null))

      const nextEdges = addEdge(
        {
          ...connection,
          id: createLocalId(),
          type: 'process',
          data: { canEdit, waypoints: [], srcSide, tgtSide },
        },
        edgesRef.current.filter((e) => !(e.source === connection.source && e.target === connection.target))
      )
      setEdges(nextEdges)
      pushToHistory(nodesRef.current, nextEdges)
      markDirty()
    },
    [canEdit, setEdges, screenToFlowPosition, getNode, pushToHistory, markDirty]
  )

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!canEdit || !newConnection.source || !newConnection.target) return

      const flowPt  = screenToFlowPosition(lastPointerRef.current)
      const srcNode = getNode(newConnection.source)
      const tgtNode = getNode(newConnection.target)
      const directional = srcNode && tgtNode ? getDirectionalSides(srcNode, tgtNode) : null
      const explicitSrcSide = sideFromHandleId(newConnection.sourceHandle)
      const explicitTgtSide = sideFromHandleId(newConnection.targetHandle)
      const srcSide = directional
        ? chooseSmartSide(explicitSrcSide, directional.srcSide)
        : (explicitSrcSide ?? (srcNode ? sideFromPoint(srcNode, flowPt) : null))
      const tgtSide = directional
        ? chooseSmartSide(explicitTgtSide, directional.tgtSide)
        : (explicitTgtSide ?? (tgtNode ? sideFromPoint(tgtNode, flowPt) : null))

      // Update React Flow edge state (source/target may have changed)
      const nextEdges = edgesRef.current.map((e) =>
        e.id !== oldEdge.id ? e : {
          ...e,
          source: newConnection.source!,
          target: newConnection.target!,
          sourceHandle: newConnection.sourceHandle,
          targetHandle: newConnection.targetHandle,
          data: { ...e.data, srcSide, tgtSide, waypoints: [] },
        }
      )
      setEdges(nextEdges)
      pushToHistory(nodesRef.current, nextEdges)
      markDirty()
    },
    [canEdit, setEdges, screenToFlowPosition, getNode, pushToHistory, markDirty]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const isCascadeFromNodeDelete =
        deletedEdges.length > 0 &&
        deletedEdges.every((e) => deletingNodeIdsRef.current.has(e.source) || deletingNodeIdsRef.current.has(e.target))
      if (isCascadeFromNodeDelete) return

      const deletedIds = new Set(deletedEdges.map(e => e.id))
      const nextEdges = edgesRef.current.filter(e => !deletedIds.has(e.id))
      pushToHistory(nodesRef.current, nextEdges)
      markDirty()
    },
    [pushToHistory, markDirty]
  )

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      const deletedNodeIds = new Set(deletedNodes.map((n) => n.id))
      deletingNodeIdsRef.current = deletedNodeIds
      setTimeout(() => {
        deletingNodeIdsRef.current = new Set()
      }, 0)

      const nextNodes = nodesRef.current.filter((n) => !deletedNodeIds.has(n.id))
      const nextEdges = edgesRef.current.filter(
        (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
      )
      setNodes(nextNodes)
      setEdges(nextEdges)
      pushToHistory(nextNodes, nextEdges)
      markDirty()
    },
    [setNodes, setEdges, pushToHistory, markDirty]
  )

  const handleNodeDragStop = useCallback(
    () => {
      if (canEdit) {
        // nodesRef.current already reflects the final drag position
        pushToHistory(nodesRef.current, edgesRef.current)
        markDirty()
      }
    },
    [canEdit, pushToHistory, markDirty]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (!canEdit || !rfInstance) return

      const nodeType = event.dataTransfer.getData('application/process-node-type') as ProcessNodeType
      if (!nodeType) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode: Node<ProcessNodeData> = {
        id: createLocalId(),
        type: 'process',
        position: { x: position.x, y: position.y },
        data: {
          nodeType,
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          description: '',
          taggedProfileIds: [],
          taggedDepartmentIds: [],
        },
      }
      const nextNodes = [...nodesRef.current, newNode]
      setNodes(nextNodes)
      pushToHistory(nextNodes, edgesRef.current)
      markDirty()
    },
    [canEdit, rfInstance, screenToFlowPosition, setNodes, pushToHistory, markDirty]
  )

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: ProcessNodeType) => {
    event.dataTransfer.setData('application/process-node-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleUpdateEdgeWaypoints = useCallback(
    (edgeId: string, waypoints: { x: number; y: number }[]) => {
      const nextEdges = edgesRef.current.map((e) => e.id === edgeId ? { ...e, data: { ...e.data, waypoints } } : e)
      setEdges(nextEdges)
      pushToHistory(nodesRef.current, nextEdges)
      markDirty()
    },
    [setEdges, pushToHistory, markDirty]
  )

  const handleReverseEdge = useCallback(
    (edgeId: string, edgeSource: string, edgeTarget: string) => {
      const nextEdges = edgesRef.current.map((e) =>
        e.id !== edgeId
          ? e
          : {
              ...e,
              source: edgeTarget,
              target: edgeSource,
              data: { ...e.data, waypoints: [], srcSide: null, tgtSide: null },
            }
      )
      setEdges(nextEdges)
      pushToHistory(nodesRef.current, nextEdges)
      markDirty()
    },
    [setEdges, pushToHistory, markDirty]
  )

  // Memoized context value — only recreates when actual values change
  const contextValue = useMemo(
    () => ({
      isEditing: canEdit,
      allProfiles,
      allDepartments,
      onLabelChange: handleLabelChange,
      onDescriptionChange: handleDescriptionChange,
      onDelete: handleDeleteNode,
      onUpdateTaggedProfiles: handleUpdateTaggedProfiles,
      onUpdateTaggedDepartments: handleUpdateTaggedDepartments,
      onReverseEdge: handleReverseEdge,
      onUpdateEdgeWaypoints: handleUpdateEdgeWaypoints,
      processId,
    }),
    [
      canEdit,
      allProfiles,
      allDepartments,
      handleLabelChange,
      handleDescriptionChange,
      handleDeleteNode,
      handleUpdateTaggedProfiles,
      handleUpdateTaggedDepartments,
      handleReverseEdge,
      handleUpdateEdgeWaypoints,
      processId,
    ]
  )

  const saveStatusLabel = saveError
    ? 'Save failed'
    : isSaving
      ? 'Saving...'
      : hasUnsavedChanges
        ? 'Unsaved changes'
        : lastSavedAt
          ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Saved'

  return (
    <ProcessCanvasContext.Provider value={contextValue}>
      <div className="flex w-full h-full">
        {canEdit && <ProcessNodePalette onDragStart={handleDragStart} />}

        <div
          ref={reactFlowWrapper}
          className="flex-1 h-full"
          onPointerMove={(e) => { lastPointerRef.current = { x: e.clientX, y: e.clientY } }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={canEdit ? onReconnect : undefined}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onNodeDragStop={handleNodeDragStop}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={true}
            deleteKeyCode={canEdit ? 'Backspace' : null}
            connectionRadius={60}
            reconnectRadius={20}
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap nodeColor={() => '#94a3b8'} maskColor="rgba(0,0,0,0.06)" />
            {canEdit && hasPendingRemoteChanges && (
              <Panel position="top-left">
                <div className="flex items-center gap-2 bg-white rounded-lg border border-amber-300 shadow-sm p-2">
                  <p className="text-xs text-amber-700">
                    Remote updates are available.
                  </p>
                  <button
                    onClick={applyPendingRemoteSnapshot}
                    className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    Apply remote
                  </button>
                </div>
              </Panel>
            )}
            {canEdit && (
              <Panel position="top-right">
                <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 shadow-sm p-1.5">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                  <div className="w-px h-5 bg-gray-200 mx-0.5" />
                  <button
                    onClick={() => { void saveChanges({ force: true }) }}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Save now"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="text-xs font-medium">Save</span>
                  </button>
                  <span
                    className={`text-[11px] ml-1 ${
                      saveError
                        ? 'text-red-500'
                        : hasUnsavedChanges
                          ? 'text-amber-600'
                          : 'text-gray-500'
                    }`}
                    title={saveError ?? undefined}
                  >
                    {saveStatusLabel}
                  </span>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </ProcessCanvasContext.Provider>
  )
}

export function ProcessCanvas({ isPublic = false, ...props }: ProcessCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProcessCanvasInner isPublic={isPublic} {...props} />
    </ReactFlowProvider>
  )
}
