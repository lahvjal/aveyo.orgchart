import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
} from 'reactflow'
import type { EdgeTypes, NodeTypes, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import type { ProcessEdge as ProcessEdgeRow, ProcessNode as ProcessNodeRow } from '../../types/processes'
import { ProcessNode } from './ProcessNode'
import { ProcessEdge } from './ProcessEdge'
import { ProcessCanvasContext, type ProcessCanvasContextType } from './ProcessCanvasContext'
import type { ProcessNodeData } from './ProcessNode'

const nodeTypes: NodeTypes = {
  process: ProcessNode,
}

const edgeTypes: EdgeTypes = {
  process: ProcessEdge,
}

interface PublicProcessCanvasProps {
  processId: string
  nodes: ProcessNodeRow[]
  edges: ProcessEdgeRow[]
}

const noop = () => undefined

function PublicProcessCanvasInner({ processId, nodes, edges }: PublicProcessCanvasProps) {
  const flowNodes = useMemo<Array<Node<ProcessNodeData>>>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: 'process',
        position: { x: node.x_position, y: node.y_position },
        data: {
          nodeType: node.node_type,
          label: node.label,
          description: node.description ?? undefined,
          documentLinks: node.document_links ?? [],
          taggedProfileIds: node.tagged_profile_ids ?? [],
          taggedDepartmentIds: node.tagged_department_ids ?? [],
        },
        draggable: false,
      })),
    [nodes]
  )

  const flowEdges = useMemo<Array<Edge>>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        type: 'process',
        source: edge.source_node_id,
        target: edge.target_node_id,
        data: {
          waypoints: edge.waypoints ?? [],
          srcSide: edge.source_side,
          tgtSide: edge.target_side,
        },
      })),
    [edges]
  )

  const contextValue = useMemo<ProcessCanvasContextType>(
    () => ({
      isEditing: false,
      allProfiles: [],
      allDepartments: [],
      onLabelChange: noop,
      onDescriptionChange: noop,
      onUpdateDocumentLinks: noop,
      onDelete: noop,
      onUpdateTaggedProfiles: noop,
      onUpdateTaggedDepartments: noop,
      onReverseEdge: noop,
      onUpdateEdgeWaypoints: noop,
      processId,
    }),
    [processId]
  )

  return (
    <ProcessCanvasContext.Provider value={contextValue}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </ProcessCanvasContext.Provider>
  )
}

export function PublicProcessCanvas(props: PublicProcessCanvasProps) {
  return (
    <ReactFlowProvider>
      <PublicProcessCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
