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
import { Undo2, Redo2 } from 'lucide-react'
import 'reactflow/dist/style.css'
import { ProcessNode } from './ProcessNode'
import type { ProcessNodeData } from './ProcessNode'
import { ProcessEdge } from './ProcessEdge'
import { ProcessNodePalette } from './ProcessNodePalette'
import { ProcessCanvasContext } from './ProcessCanvasContext'
import type { ProcessNodeType } from '../../types/processes'
import {
  useProcessNodes,
  useProcessEdges,
  useCreateProcessNode,
  useUpdateProcessNode,
  useDeleteProcessNode,
  useCreateProcessEdge,
  useUpdateProcessEdge,
  useDeleteProcessEdge,
} from '../../hooks/useProcesses'
import { useProfiles } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'

// Defined outside component so ReactFlow never sees new object references
const nodeTypes: NodeTypes = { process: ProcessNode }
const edgeTypes: EdgeTypes = { process: ProcessEdge }

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
  const { data: allProfiles = [] } = useProfiles({ enabled: !isPublic })
  const { data: allDepartments = [] } = useDepartments({ enabled: !isPublic })
  const isLoading = nodesLoading || edgesLoading

  const createNode = useCreateProcessNode()
  const updateNode = useUpdateProcessNode()
  const deleteNode = useDeleteProcessNode()
  const createEdge = useCreateProcessEdge()
  const updateEdge = useUpdateProcessEdge()
  const deleteEdge = useDeleteProcessEdge()

  // Mutation objects in refs — their unstable identity never enters useCallback deps
  const updateNodeRef = useRef(updateNode)
  const deleteNodeRef = useRef(deleteNode)
  const createEdgeRef = useRef(createEdge)
  const updateEdgeRef = useRef(updateEdge)
  const deleteEdgeRef = useRef(deleteEdge)
  const createNodeRef = useRef(createNode)
  updateNodeRef.current = updateNode
  deleteNodeRef.current = deleteNode
  createEdgeRef.current = createEdge
  updateEdgeRef.current = updateEdge
  deleteEdgeRef.current = deleteEdge
  createNodeRef.current = createNode

  const queryClient = useQueryClient()

  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView, screenToFlowPosition, getNode } = useReactFlow()
  const hasInitialized = useRef(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
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

  /**
   * Reconcile the canvas state with the DB after an undo/redo step.
   * Order matters due to FK constraints:
   *   delete edges → delete nodes → upsert nodes → upsert edges
   */
  const reconcileToDb = useCallback(async (
    target: HistoryEntry,
    from: HistoryEntry,
  ) => {
    const targetNodeIds = new Set(target.nodes.map(n => n.id))
    const targetEdgeIds = new Set(target.edges.map(e => e.id))

    // 1. Delete edges not in target (FK: edges reference nodes)
    const edgesToDel = from.edges.filter(e => !targetEdgeIds.has(e.id))
    if (edgesToDel.length) {
      await Promise.all(edgesToDel.map(e =>
        (supabase as any).from('process_edges').delete().eq('id', e.id)
      ))
    }
    // 2. Delete nodes not in target
    const nodesToDel = from.nodes.filter(n => !targetNodeIds.has(n.id))
    if (nodesToDel.length) {
      await Promise.all(nodesToDel.map(n =>
        (supabase as any).from('process_nodes').delete().eq('id', n.id)
      ))
    }
    // 3. Upsert target nodes first (edges need them to exist)
    if (target.nodes.length) {
      await Promise.all(target.nodes.map(n =>
        (supabase as any).from('process_nodes').upsert({
          id: n.id, process_id: processId,
          node_type: n.data.nodeType, label: n.data.label,
          description: n.data.description || null,
          x_position: n.position.x, y_position: n.position.y,
          tagged_profile_ids: n.data.taggedProfileIds,
          tagged_department_ids: n.data.taggedDepartmentIds,
        })
      ))
    }
    // 4. Upsert target edges
    if (target.edges.length) {
      await Promise.all(target.edges.map(e =>
        (supabase as any).from('process_edges').upsert({
          id: e.id, process_id: processId,
          source_node_id: e.source, target_node_id: e.target,
          label: e.label || null,
          waypoints: e.data?.waypoints || null,
          source_side: e.data?.srcSide || null,
          target_side: e.data?.tgtSide || null,
        })
      ))
    }
    queryClient.invalidateQueries({ queryKey: ['process-nodes', processId] })
    queryClient.invalidateQueries({ queryKey: ['process-edges', processId] })
  }, [processId, queryClient])

  const undo = useCallback(async () => {
    if (!canEdit || historyIndexRef.current <= 0) return
    const from = historyRef.current[historyIndexRef.current]
    historyIndexRef.current--
    const target = historyRef.current[historyIndexRef.current]
    setNodes(target.nodes)
    setEdges(target.edges)
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
    reconcileToDb(target, from)
  }, [canEdit, setNodes, setEdges, reconcileToDb])

  const redo = useCallback(async () => {
    if (!canEdit || historyIndexRef.current >= historyRef.current.length - 1) return
    const from = historyRef.current[historyIndexRef.current]
    historyIndexRef.current++
    const target = historyRef.current[historyIndexRef.current]
    setNodes(target.nodes)
    setEdges(target.edges)
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    reconcileToDb(target, from)
  }, [canEdit, setNodes, setEdges, reconcileToDb])

  // Keyboard shortcuts: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo
  useEffect(() => {
    if (!canEdit) return
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canEdit, undo, redo])

  // Stable callbacks via mutation refs — safe in useCallback dep arrays
  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, label })
      const next = nodesRef.current.map((n) => n.id === id ? { ...n, data: { ...n.data, label } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
    },
    [processId, setNodes, pushToHistory]
  )

  const handleDescriptionChange = useCallback(
    (id: string, description: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, description })
      const next = nodesRef.current.map((n) => n.id === id ? { ...n, data: { ...n.data, description } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
    },
    [processId, setNodes, pushToHistory]
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      deleteNodeRef.current.mutate({ id, process_id: processId })
      const nextNodes = nodesRef.current.filter((n) => n.id !== id)
      const nextEdges = edgesRef.current.filter((e) => e.source !== id && e.target !== id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      pushToHistory(nextNodes, nextEdges)
    },
    [processId, setNodes, setEdges, pushToHistory]
  )

  const handleUpdateTaggedProfiles = useCallback(
    (nodeId: string, profileIds: string[]) => {
      updateNodeRef.current.mutate({ id: nodeId, process_id: processId, tagged_profile_ids: profileIds })
      const next = nodesRef.current.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, taggedProfileIds: profileIds } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
    },
    [processId, setNodes, pushToHistory]
  )

  const handleUpdateTaggedDepartments = useCallback(
    (nodeId: string, departmentIds: string[]) => {
      updateNodeRef.current.mutate({ id: nodeId, process_id: processId, tagged_department_ids: departmentIds })
      const next = nodesRef.current.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, taggedDepartmentIds: departmentIds } } : n)
      setNodes(next)
      pushToHistory(next, edgesRef.current)
    },
    [processId, setNodes, pushToHistory]
  )

  // One-time initialization from the database — ref guard prevents re-runs
  // on subsequent ReactFlow-triggered re-renders.
  useEffect(() => {
    if (isLoading || hasInitialized.current) return
    hasInitialized.current = true

    const rfNodes: Node<ProcessNodeData>[] = dbNodes.map((n) => ({
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

    const rfEdges: Edge[] = dbEdges.map((e) => ({
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

    setNodes(rfNodes)
    setEdges(rfEdges)

    // Seed history with the initial loaded state
    historyRef.current = [{ nodes: rfNodes, edges: rfEdges }]
    historyIndexRef.current = 0
    setCanUndo(false)
    setCanRedo(false)

    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 150)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

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
      const srcSide = sideFromHandleId(connection.sourceHandle)
        ?? (srcNode ? sideFromPoint(srcNode, flowPt) : null)
      const tgtSide = sideFromHandleId(connection.targetHandle)
        ?? (tgtNode ? sideFromPoint(tgtNode, flowPt) : null)

      createEdgeRef.current.mutate(
        {
          process_id: processId,
          source_node_id: connection.source,
          target_node_id: connection.target,
          source_side: srcSide,
          target_side: tgtSide,
        },
        {
          onSuccess: (savedEdge) => {
            const nextEdges = addEdge(
              { ...connection, id: savedEdge.id, type: 'process', data: { canEdit, waypoints: [], srcSide, tgtSide } },
              edgesRef.current.filter((e) => !(e.source === connection.source && e.target === connection.target))
            )
            setEdges(nextEdges)
            pushToHistory(nodesRef.current, nextEdges)
          },
        }
      )
    },
    [canEdit, processId, setEdges, screenToFlowPosition, getNode, pushToHistory]
  )

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!canEdit || !newConnection.source || !newConnection.target) return

      const flowPt  = screenToFlowPosition(lastPointerRef.current)
      const srcNode = getNode(newConnection.source)
      const tgtNode = getNode(newConnection.target)
      const srcSide = sideFromHandleId(newConnection.sourceHandle)
        ?? (srcNode ? sideFromPoint(srcNode, flowPt) : null)
      const tgtSide = sideFromHandleId(newConnection.targetHandle)
        ?? (tgtNode ? sideFromPoint(tgtNode, flowPt) : null)

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

      // Persist all changed fields (source/target nodes + sides + cleared waypoints)
      updateEdgeRef.current.mutate({
        id: oldEdge.id,
        process_id: processId,
        source_node_id: newConnection.source!,
        target_node_id: newConnection.target!,
        source_side: srcSide,
        target_side: tgtSide,
        waypoints: [],
      })
    },
    [canEdit, processId, setEdges, screenToFlowPosition, getNode, pushToHistory]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => deleteEdgeRef.current.mutate({ id: e.id, process_id: processId }))
      const deletedIds = new Set(deletedEdges.map(e => e.id))
      const nextEdges = edgesRef.current.filter(e => !deletedIds.has(e.id))
      pushToHistory(nodesRef.current, nextEdges)
    },
    [processId, pushToHistory]
  )

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (canEdit) {
        updateNodeRef.current.mutate({
          id: node.id,
          process_id: processId,
          x_position: node.position.x,
          y_position: node.position.y,
        })
        // nodesRef.current already reflects the final drag position
        pushToHistory(nodesRef.current, edgesRef.current)
      }
    },
    [canEdit, processId, pushToHistory]
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

      createNodeRef.current.mutate(
        {
          process_id: processId,
          node_type: nodeType,
          label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
          x_position: position.x,
          y_position: position.y,
        },
        {
          onSuccess: (savedNode) => {
            const newNode: Node<ProcessNodeData> = {
              id: savedNode.id,
              type: 'process',
              position: { x: savedNode.x_position, y: savedNode.y_position },
              data: {
                nodeType: savedNode.node_type,
                label: savedNode.label,
                description: savedNode.description ?? '',
                taggedProfileIds: [],
                taggedDepartmentIds: [],
              },
            }
            const nextNodes = [...nodesRef.current, newNode]
            setNodes(nextNodes)
            pushToHistory(nextNodes, edgesRef.current)
          },
        }
      )
    },
    [canEdit, processId, rfInstance, screenToFlowPosition, setNodes, pushToHistory]
  )

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: ProcessNodeType) => {
    event.dataTransfer.setData('application/process-node-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleUpdateEdgeWaypoints = useCallback(
    (edgeId: string, waypoints: { x: number; y: number }[]) => {
      const nextEdges = edgesRef.current.map((e) => e.id === edgeId ? { ...e, data: { ...e.data, waypoints } } : e)
      setEdges(nextEdges)
      updateEdgeRef.current.mutate({ id: edgeId, process_id: processId, waypoints })
      pushToHistory(nodesRef.current, nextEdges)
    },
    [processId, setEdges, pushToHistory]
  )

  const handleReverseEdge = useCallback(
    (edgeId: string, edgeSource: string, edgeTarget: string) => {
      deleteEdgeRef.current.mutate({ id: edgeId, process_id: processId })
      createEdgeRef.current.mutate(
        { process_id: processId, source_node_id: edgeTarget, target_node_id: edgeSource },
        {
          onSuccess: (savedEdge) => {
            const nextEdges = [
              ...edgesRef.current.filter((e) => e.id !== edgeId),
              { id: savedEdge.id, source: edgeTarget, target: edgeSource, type: 'process', data: { canEdit, waypoints: [] } },
            ]
            setEdges(nextEdges)
            pushToHistory(nodesRef.current, nextEdges)
          },
        }
      )
    },
    [processId, canEdit, setEdges, pushToHistory]
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
            {canEdit && (
              <Panel position="top-right">
                <div className="flex items-center gap-0.5 bg-white rounded-lg border border-gray-200 shadow-sm p-1">
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
