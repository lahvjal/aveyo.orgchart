import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import type { NodeTypes, EdgeTypes, Connection, Edge, Node, ReactFlowInstance } from 'reactflow'
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

  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView, screenToFlowPosition, getNode } = useReactFlow()
  const hasInitialized = useRef(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  // Track last pointer position so onConnect / onReconnect can compute the
  // target side when the edge is dropped on the full-node 'node-body' handle.
  const lastPointerRef = useRef({ x: 0, y: 0 })

  // Stable callbacks via mutation refs — safe in useCallback dep arrays
  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, label })
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)))
    },
    [processId, setNodes]
  )

  const handleDescriptionChange = useCallback(
    (id: string, description: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, description })
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, description } } : n)))
    },
    [processId, setNodes]
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      deleteNodeRef.current.mutate({ id, process_id: processId })
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    },
    [processId, setNodes, setEdges]
  )

  const handleUpdateTaggedProfiles = useCallback(
    (nodeId: string, profileIds: string[]) => {
      updateNodeRef.current.mutate({ id: nodeId, process_id: processId, tagged_profile_ids: profileIds })
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, taggedProfileIds: profileIds } } : n))
      )
    },
    [processId, setNodes]
  )

  const handleUpdateTaggedDepartments = useCallback(
    (nodeId: string, departmentIds: string[]) => {
      updateNodeRef.current.mutate({ id: nodeId, process_id: processId, tagged_department_ids: departmentIds })
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, taggedDepartmentIds: departmentIds } } : n))
      )
    },
    [processId, setNodes]
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
            setEdges((eds) =>
              addEdge(
                {
                  ...connection,
                  id: savedEdge.id,
                  type: 'process',
                  data: { canEdit, waypoints: [], srcSide, tgtSide },
                },
                eds.filter((e) => !(e.source === connection.source && e.target === connection.target))
              )
            )
          },
        }
      )
    },
    [canEdit, processId, setEdges, screenToFlowPosition, getNode]
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
      setEdges((eds) =>
        eds.map((e) =>
          e.id !== oldEdge.id ? e : {
            ...e,
            source: newConnection.source!,
            target: newConnection.target!,
            sourceHandle: newConnection.sourceHandle,
            targetHandle: newConnection.targetHandle,
            data: { ...e.data, srcSide, tgtSide, waypoints: [] },
          }
        )
      )

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
    [canEdit, processId, setEdges, screenToFlowPosition, getNode]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => deleteEdgeRef.current.mutate({ id: e.id, process_id: processId }))
    },
    [processId]
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
      }
    },
    [canEdit, processId]
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
            setNodes((nds) => [...nds, newNode])
          },
        }
      )
    },
    [canEdit, processId, rfInstance, screenToFlowPosition, setNodes]
  )

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: ProcessNodeType) => {
    event.dataTransfer.setData('application/process-node-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleUpdateEdgeWaypoints = useCallback(
    (edgeId: string, waypoints: { x: number; y: number }[]) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, waypoints } } : e))
      )
      updateEdgeRef.current.mutate({ id: edgeId, process_id: processId, waypoints })
    },
    [processId, setEdges]
  )

  const handleReverseEdge = useCallback(
    (edgeId: string, edgeSource: string, edgeTarget: string) => {
      deleteEdgeRef.current.mutate({ id: edgeId, process_id: processId })
      createEdgeRef.current.mutate(
        { process_id: processId, source_node_id: edgeTarget, target_node_id: edgeSource },
        {
          onSuccess: (savedEdge) => {
            setEdges((eds) => [
              ...eds.filter((e) => e.id !== edgeId),
              { id: savedEdge.id, source: edgeTarget, target: edgeSource, type: 'process', data: { canEdit, waypoints: [] } },
            ])
          },
        }
      )
    },
    [processId, canEdit, setEdges]
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
