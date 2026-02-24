import { useMemo } from 'react'
import type { Node, Edge } from 'reactflow'
import dagre from 'dagre'
import type { Profile, OrgChartPosition } from '../types'

export function useOrgChart(
  profiles: Profile[], 
  isAdmin: boolean, 
  currentUserId?: string,
  savedPositions?: OrgChartPosition[]
) {
  const { nodes, edges } = useMemo(() => {
    if (!profiles || profiles.length === 0) {
      return { nodes: [], edges: [] }
    }

    // Filter profiles based on permissions
    let visibleProfiles = profiles
    if (!isAdmin && currentUserId) {
      // For non-admin users, show only their branch
      // This is already filtered by the backend, but we keep this for clarity
      visibleProfiles = profiles
    }

    // Create a set of visible profile IDs for quick lookup
    const visibleProfileIds = new Set(visibleProfiles.map((p) => p.id))

    // Create nodes
    const nodes: Node[] = visibleProfiles.map((profile) => ({
      id: profile.id,
      type: 'employee',
      data: { profile },
      position: { x: 0, y: 0 }, // Will be calculated by dagre
    }))

    // Create edges (connections between manager and reports)
    // Only create edges where both the manager and employee are in the visible set
    const edges: Edge[] = visibleProfiles
      .filter((profile) => profile.manager_id && visibleProfileIds.has(profile.manager_id))
      .map((profile) => ({
        id: `${profile.manager_id}-${profile.id}`,
        source: profile.manager_id!,
        target: profile.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }))

    return { nodes, edges }
  }, [profiles, isAdmin, currentUserId])

  // Apply hierarchical layout using dagre
  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return nodes

    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    // Node dimensions must match the rendered EmployeeNode size
    const NODE_WIDTH = 220
    const NODE_HEIGHT = 240 // 150px photo + ~90px content

    dagreGraph.setGraph({ 
      rankdir: 'TB',
      nodesep: 60,  // horizontal gap between sibling cards
      ranksep: 80,  // vertical gap between ranks
    })

    // Add nodes to dagre
    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    })

    // Add edges to dagre
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    // Calculate layout
    dagre.layout(dagreGraph)

    // Create a map of saved positions for quick lookup
    const savedPosMap = new Map(
      savedPositions?.map((pos) => [pos.profile_id, { x: pos.x_position, y: pos.y_position }]) || []
    )

    // Apply calculated positions to nodes (dagre returns center coords, ReactFlow uses top-left)
    // If a saved position exists, use its X coordinate but keep dagre's Y (to preserve hierarchy)
    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      const dagrePos = {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      }
      
      const savedPos = savedPosMap.get(node.id)
      
      return {
        ...node,
        position: savedPos
          ? { x: savedPos.x, y: dagrePos.y } // Use saved X, dagre Y
          : dagrePos, // Use dagre for both if no saved position
      }
    })
  }, [nodes, edges, savedPositions])

  return { nodes: layoutedNodes, edges }
}
