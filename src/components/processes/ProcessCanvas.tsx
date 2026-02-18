import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { NodeTypes, Connection, Edge, Node, ReactFlowInstance } from 'reactflow'
import 'reactflow/dist/style.css'
import { ProcessNode } from './ProcessNode'
import type { ProcessNodeData } from './ProcessNode'
import { ProcessNodePalette } from './ProcessNodePalette'
import type { ProcessNodeType } from '../../types/processes'
import {
  useProcessNodes,
  useProcessEdges,
  useCreateProcessNode,
  useUpdateProcessNode,
  useDeleteProcessNode,
  useCreateProcessEdge,
  useDeleteProcessEdge,
} from '../../hooks/useProcesses'

const nodeTypes: NodeTypes = {
  process: ProcessNode,
}

interface ProcessCanvasProps {
  processId: string
  canEdit: boolean
}

function ProcessCanvasInner({ processId, canEdit }: ProcessCanvasProps) {
  const { data: dbNodes = [], isLoading: nodesLoading } = useProcessNodes(processId)
  const { data: dbEdges = [], isLoading: edgesLoading } = useProcessEdges(processId)
  const isLoading = nodesLoading || edgesLoading

  const createNode = useCreateProcessNode()
  const updateNode = useUpdateProcessNode()
  const deleteNode = useDeleteProcessNode()
  const createEdge = useCreateProcessEdge()
  const deleteEdge = useDeleteProcessEdge()

  // Keep mutation objects in refs so their unstable references never appear in
  // useCallback/useEffect dependency arrays, preventing infinite re-render loops.
  const updateNodeRef = useRef(updateNode)
  const deleteNodeRef = useRef(deleteNode)
  const createEdgeRef = useRef(createEdge)
  const deleteEdgeRef = useRef(deleteEdge)
  const createNodeRef = useRef(createNode)
  updateNodeRef.current = updateNode
  deleteNodeRef.current = deleteNode
  createEdgeRef.current = createEdge
  deleteEdgeRef.current = deleteEdge
  createNodeRef.current = createNode

  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView, screenToFlowPosition } = useReactFlow()
  // Track whether we've done the one-time init from the database
  const hasInitialized = useRef(false)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

  // Stable callbacks — mutations accessed via refs, not as direct deps
  const handleLabelChange = useCallback(
    (id: string, label: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, label })
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
      )
    },
    [processId, setNodes]
  )

  const handleDescriptionChange = useCallback(
    (id: string, description: string) => {
      updateNodeRef.current.mutate({ id, process_id: processId, description })
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, description } } : n))
      )
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

  // Initialize canvas ONCE from the database after the first successful load.
  // Using a ref guard prevents re-running when ReactFlow's internal state
  // triggers re-renders, which would otherwise cause an infinite setNodes loop.
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
        isEditing: canEdit,
        onLabelChange: handleLabelChange,
        onDescriptionChange: handleDescriptionChange,
        onDelete: handleDeleteNode,
      },
    }))

    const rfEdges: Edge[] = dbEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.label ?? undefined,
      type: 'smoothstep',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }))

    setNodes(rfNodes)
    setEdges(rfEdges)

    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 150)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  // When the user toggles edit mode, update isEditing on all nodes without
  // touching positions or labels (so we don't re-trigger the init guard).
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, isEditing: canEdit } }))
    )
  }, [canEdit, setNodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit || !connection.source || !connection.target) return

      createEdgeRef.current.mutate(
        {
          process_id: processId,
          source_node_id: connection.source,
          target_node_id: connection.target,
        },
        {
          onSuccess: (savedEdge) => {
            setEdges((eds) =>
              addEdge(
                {
                  ...connection,
                  id: savedEdge.id,
                  type: 'smoothstep',
                  style: { stroke: '#94a3b8', strokeWidth: 2 },
                },
                eds.filter(
                  (e) => !(e.source === connection.source && e.target === connection.target)
                )
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
      deletedEdges.forEach((e) => {
        deleteEdgeRef.current.mutate({ id: e.id, process_id: processId })
      })
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

  // Drag-from-palette: drop handler
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

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

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
                isEditing: canEdit,
                onLabelChange: handleLabelChange,
                onDescriptionChange: handleDescriptionChange,
                onDelete: handleDeleteNode,
              },
            }
            setNodes((nds) => [...nds, newNode])
          },
        }
      )
    },
    [canEdit, processId, rfInstance, screenToFlowPosition, handleLabelChange, handleDescriptionChange, handleDeleteNode, setNodes]
  )

  const handleDragStart = useCallback((event: React.DragEvent, nodeType: ProcessNodeType) => {
    event.dataTransfer.setData('application/process-node-type', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  return (
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
          nodesDraggable={canEdit}
          nodesConnectable={canEdit}
          elementsSelectable={true}
          deleteKeyCode={canEdit ? 'Backspace' : null}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          <Controls />
          <MiniMap
            nodeColor={() => '#94a3b8'}
            maskColor="rgba(0,0,0,0.06)"
          />
        </ReactFlow>
      </div>
    </div>
  )
}

export function ProcessCanvas(props: ProcessCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProcessCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
