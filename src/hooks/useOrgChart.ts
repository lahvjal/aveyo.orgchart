import { useMemo } from 'react'
import type { Node, Edge } from 'reactflow'
import dagre from 'dagre'
import type { Profile } from '../types'

const NODE_WIDTH = 220
const NODE_HEIGHT = 260

function runDagreLayout(
  profileSubset: Profile[],
  allEdges: Edge[],
): Map<string, { x: number; y: number }> {
  if (profileSubset.length === 0) return new Map()

  const subsetIds = new Set(profileSubset.map((p) => p.id))

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 24,   // horizontal gap between sibling cards
    ranksep: 56,   // vertical gap between ranks
  })

  profileSubset.forEach((p) => {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  // Only include edges where both endpoints are in the subset
  allEdges.forEach((edge) => {
    if (subsetIds.has(edge.source) && subsetIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  profileSubset.forEach((p) => {
    const n = g.node(p.id)
    positions.set(p.id, { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 })
  })
  return positions
}

function getBounds(positions: Map<string, { x: number; y: number }>) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  positions.forEach(({ x, y }) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x + NODE_WIDTH)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y + NODE_HEIGHT)
  })
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
}

export function useOrgChart(
  profiles: Profile[],
  isAdmin: boolean,
  _currentUserId?: string,
  focusedProfileIds?: Set<string> | null,
) {
  const { nodes, edges } = useMemo(() => {
    if (!profiles || profiles.length === 0) return { nodes: [], edges: [] }

    const profileIds = new Set(profiles.map((p) => p.id))

    const nodes: Node[] = profiles.map((profile) => ({
      id: profile.id,
      type: 'employee',
      data: { profile },
      position: { x: 0, y: 0 },
    }))

    const edges: Edge[] = profiles
      .filter((p) => p.manager_id && profileIds.has(p.manager_id))
      .map((p) => ({
        id: `${p.manager_id}-${p.id}`,
        source: p.manager_id!,
        target: p.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }))

    return { nodes, edges }
  }, [profiles])

  const layoutedNodes = useMemo(() => {
    if (nodes.length === 0) return nodes

    const hasFocus =
      focusedProfileIds &&
      focusedProfileIds.size > 0 &&
      focusedProfileIds.size < profiles.length

    if (!hasFocus) {
      // Single full layout
      const positions = runDagreLayout(profiles, edges)
      return nodes.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? { x: 0, y: 0 },
      }))
    }

    // ── Dual-pass layout ──────────────────────────────────────────────────────
    // Pass 1: compact layout for just the focused (department-filtered) profiles
    const focusedProfiles = profiles.filter((p) => focusedProfileIds.has(p.id))

    const focusedPositions = runDagreLayout(focusedProfiles, edges)
    const focusedBounds = getBounds(focusedPositions)

    // Pass 2: full layout for background nodes — scaled down and placed below
    const fullPositions = runDagreLayout(profiles, edges)
    const fullBounds = getBounds(fullPositions)

    // Scale background to be a subtle "map" below the focused cluster
    const BG_SCALE = 0.45
    const BG_GAP = 280 // vertical gap between focused cluster and background

    const bgOffsetY = focusedBounds.maxY + BG_GAP
    // Center the scaled background under the focused cluster
    const focusedCenterX = focusedBounds.minX + focusedBounds.width / 2
    const bgOffsetX = focusedCenterX - (fullBounds.width * BG_SCALE) / 2 - fullBounds.minX * BG_SCALE

    return nodes.map((node) => {
      if (focusedProfileIds.has(node.id)) {
        return { ...node, position: focusedPositions.get(node.id) ?? { x: 0, y: 0 } }
      }
      // Background node: scaled full-layout position
      const fullPos = fullPositions.get(node.id) ?? { x: 0, y: 0 }
      return {
        ...node,
        position: {
          x: bgOffsetX + fullPos.x * BG_SCALE,
          y: bgOffsetY + (fullPos.y - fullBounds.minY) * BG_SCALE,
        },
      }
    })
  }, [nodes, edges, profiles, focusedProfileIds])

  // isAdmin is kept in signature for potential future use
  void isAdmin

  return { nodes: layoutedNodes, edges }
}
