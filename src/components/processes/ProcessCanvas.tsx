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
  const { fitView, screenToFlowPosition } = useReactFlow()
  const hasInitialized = useRef(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

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
      data: { canEdit, waypoints: e.waypoints ?? [] },
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
      createEdgeRef.current.mutate(
        { process_id: processId, source_node_id: connection.source, target_node_id: connection.target },
        {
          onSuccess: (savedEdge) => {
            setEdges((eds) =>
              addEdge(
                { ...connection, id: savedEdge.id, type: 'process', data: { canEdit } },
                eds.filter((e) => !(e.source === connection.source && e.target === connection.target))
              )
            )
          },
        }
      )
    },
    [canEdit, processId, setEdges]
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

        <div ref={reactFlowWrapper} className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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
