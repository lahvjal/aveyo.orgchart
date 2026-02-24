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
import type { NodeTypes, Connection } from 'reactflow'
import 'reactflow/dist/style.css'
import { EmployeeNode } from './EmployeeNode'
import type { Profile, Department } from '../../types'
import { useOrgChart } from '../../hooks/useOrgChart'
import { useUpdatePosition, getDepartmentDescendantIds } from '../../lib/queries'

interface OrgChartCanvasProps {
  profiles: Profile[]
  isAdmin: boolean
  currentUserId?: string
  currentUserDepartmentId?: string
  onNodeClick?: (profileId: string) => void
  selectedProfileId?: string | null
  searchQuery?: string
  selectedDepartment?: string | null
  allDepartments?: Department[]
}

const nodeTypes: NodeTypes = {
  employee: EmployeeNode,
}

function OrgChartCanvasInner({ 
  profiles, 
  isAdmin, 
  currentUserId,
  currentUserDepartmentId: _currentUserDepartmentId,
  onNodeClick,
  selectedProfileId,
  searchQuery = '',
  selectedDepartment,
  allDepartments,
}: OrgChartCanvasProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const { nodes: initialNodes, edges: initialEdges } = useOrgChart(
    profiles,
    isAdmin,
    currentUserId
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const updatePosition = useUpdatePosition()
  const { fitView } = useReactFlow()

  // Keep a ref to current nodes so fitView effects don't need nodes in their dep arrays
  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Update nodes when profiles change
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Pan to selected profile when it changes (e.g. clicked in sidebar search)
  useEffect(() => {
    if (selectedProfileId) {
      fitView({
        nodes: [{ id: selectedProfileId }],
        padding: 0.4,
        duration: 600,
        maxZoom: 1,
      })
    }
  }, [selectedProfileId, fitView])

  // Dim nodes that don't match the active department filter and/or search query
  useEffect(() => {
    const deptMatchIds = selectedDepartment && allDepartments
      ? new Set(getDepartmentDescendantIds(selectedDepartment, allDepartments))
      : null

    setNodes((nds) =>
      nds.map((n) => {
        const profile = n.data?.profile as Profile

        const matchesDept = deptMatchIds
          ? !!(profile.department_id && deptMatchIds.has(profile.department_id))
          : true

        const matchesSearch = searchQuery
          ? (() => {
              const q = searchQuery.toLowerCase()
              return (
                profile.full_name.toLowerCase().includes(q) ||
                profile.job_title.toLowerCase().includes(q) ||
                profile.email.toLowerCase().includes(q)
              )
            })()
          : true

        return { ...n, style: { ...n.style, opacity: matchesDept && matchesSearch ? 1 : 0.15 } }
      })
    )
  }, [searchQuery, selectedDepartment, allDepartments, setNodes])

  // Pan/zoom to the selected department's nodes whenever the filter changes
  useEffect(() => {
    const deptMatchIds = selectedDepartment && allDepartments
      ? new Set(getDepartmentDescendantIds(selectedDepartment, allDepartments))
      : null

    const targetNodes = deptMatchIds
      ? nodesRef.current.filter((n) => {
          const profile = n.data?.profile as Profile
          return profile?.department_id && deptMatchIds.has(profile.department_id)
        })
      : nodesRef.current

    if (targetNodes.length === 0) return

    setTimeout(() => {
      fitView({
        nodes: targetNodes.map((n) => ({ id: n.id })),
        padding: 0.3,
        duration: 700,
      })
    }, 80)
  }, [selectedDepartment, allDepartments, fitView])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isAdmin) {
        setEdges((eds) => addEdge(connection, eds))
      }
    },
    [isAdmin, setEdges]
  )

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (isAdmin) {
        updatePosition.mutate({
          profile_id: node.id,
          x_position: node.position.x,
          y_position: node.position.y,
        })
      }
    },
    [isAdmin, updatePosition]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={isAdmin}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        {!isMobile && (
          <MiniMap 
            nodeColor={(node: any) => {
              const profile = node.data?.profile as Profile
              return profile?.department?.color || '#94a3b8'
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        )}
      </ReactFlow>
    </div>
  )
}

export function OrgChartCanvas(props: OrgChartCanvasProps) {
  return (
    <ReactFlowProvider>
      <OrgChartCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
