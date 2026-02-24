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
  Panel,
} from 'reactflow'
import type { NodeTypes, Connection } from 'reactflow'
import 'reactflow/dist/style.css'
import { EmployeeNode } from './EmployeeNode'
import type { Profile, Department, OrgChartPosition } from '../../types'
import { useOrgChart } from '../../hooks/useOrgChart'
import { useUpdatePosition, getDepartmentDescendantIds, useClearAllPositions, useBatchSavePositions } from '../../lib/queries'
import { Button } from '../ui/button'
import { Save, Loader2 } from 'lucide-react'

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
  savedPositions?: OrgChartPosition[]
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
  savedPositions,
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
    currentUserId,
    savedPositions
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const updatePosition = useUpdatePosition()
  const clearAllPositions = useClearAllPositions()
  const batchSavePositions = useBatchSavePositions()
  const { fitView } = useReactFlow()

  // Keep a ref to current nodes so fitView effects don't need nodes in their dep arrays
  const nodesRef = useRef(nodes)
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Store fixed Y positions for each node to enforce horizontal-only dragging
  const nodeYPositions = useRef<Record<string, number>>({})
  
  // Track node positions before drag starts (for swapping)
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({})

  // Constants for grid snapping
  const SLOT_WIDTH = 320 // 220px node width + 100px gap (matches dagre nodesep)

  // Update nodes when profiles change
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    
    // Update Y position map when nodes change
    const yPositions: Record<string, number> = {}
    initialNodes.forEach((node) => {
      yPositions[node.id] = node.position.y
    })
    nodeYPositions.current = yPositions
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

  // Handler for when drag starts - store initial positions
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (isAdmin) {
        dragStartPositions.current[node.id] = { x: node.position.x, y: node.position.y }
      }
    },
    [isAdmin]
  )

  // Handler during drag - lock Y coordinate to enforce horizontal-only movement
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (isAdmin) {
        const fixedY = nodeYPositions.current[node.id]
        if (fixedY !== undefined) {
          node.position.y = fixedY
        }
      }
    },
    [isAdmin]
  )

  // Handler when drag stops - snap to grid and handle swapping
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: any) => {
      if (!isAdmin) return

      const fixedY = nodeYPositions.current[node.id]
      if (fixedY === undefined) return

      // Snap X to nearest slot
      const snappedX = Math.round(node.position.x / SLOT_WIDTH) * SLOT_WIDTH

      // Find if there's a sibling at the target position (within tolerance)
      const siblings = nodesRef.current.filter(
        (n) => n.id !== node.id && Math.abs(n.position.y - fixedY) < 5
      )

      const collision = siblings.find(
        (sibling) => Math.abs(sibling.position.x - snappedX) < 5
      )

      if (collision && dragStartPositions.current[node.id]) {
        // Swap positions
        const oldPosition = dragStartPositions.current[node.id]

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return { ...n, position: { x: snappedX, y: fixedY } }
            }
            if (n.id === collision.id) {
              return { ...n, position: { x: oldPosition.x, y: fixedY } }
            }
            return n
          })
        )

        // Save both positions to database
        try {
          await Promise.all([
            updatePosition.mutateAsync({
              profile_id: node.id,
              x_position: snappedX,
              y_position: fixedY,
            }),
            updatePosition.mutateAsync({
              profile_id: collision.id,
              x_position: oldPosition.x,
              y_position: fixedY,
            }),
          ])
        } catch (error) {
          console.error('Failed to save swapped positions:', error)
        }
      } else {
        // No collision, just snap to grid
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return { ...n, position: { x: snappedX, y: fixedY } }
            }
            return n
          })
        )

        updatePosition.mutate({
          profile_id: node.id,
          x_position: snappedX,
          y_position: fixedY,
        })
      }
    },
    [isAdmin, updatePosition, setNodes]
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  const handleSaveCleanLayout = useCallback(async () => {
    if (window.confirm('Save current clean layout? This will clear old positions and save the current dagre layout as the new baseline.')) {
      try {
        // First clear all existing positions
        await clearAllPositions.mutateAsync()
        
        // Then save all current node positions, snapped to grid
        const positions = nodesRef.current.map((node) => {
          const snappedX = Math.round(node.position.x / SLOT_WIDTH) * SLOT_WIDTH
          return {
            profile_id: node.id,
            x_position: snappedX,
            y_position: node.position.y,
          }
        })
        
        await batchSavePositions.mutateAsync(positions)
      } catch (error) {
        console.error('Failed to save clean layout:', error)
      }
    }
  }, [clearAllPositions, batchSavePositions])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
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
        {isAdmin && (
          <Panel position="top-left" className="bg-white rounded-lg shadow-md p-2 m-2">
            <Button
              onClick={handleSaveCleanLayout}
              variant="outline"
              size="sm"
              disabled={clearAllPositions.isPending || batchSavePositions.isPending}
              className="flex items-center gap-2"
            >
              {(clearAllPositions.isPending || batchSavePositions.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Clean Layout
            </Button>
          </Panel>
        )}
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
