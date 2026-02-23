import { useState, useRef } from 'react'
import { useStore, EdgeLabelRenderer, BaseEdge, useReactFlow, Position } from 'reactflow'
import type { EdgeProps } from 'reactflow'
import { ArrowLeftRight, X } from 'lucide-react'
import { useProcessCanvasContext } from './ProcessCanvasContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

interface Segment {
  x1: number; y1: number
  x2: number; y2: number
  isHorizontal: boolean
  idx: number  // index in the corners array of the start point
}

interface ProcessEdgeData {
  waypoints?: Pt[]
  srcSide?: string | null
  tgtSide?: string | null
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Connection point on a node side with a fixed 10 px gap between peers.
 * The group is centred on the side, so a single edge still lands in the middle.
 */
function getOffsetHandleCoords(node: any, position: Position, idx: number, count: number): Pt {
  const { positionAbsolute: pos, width: w, height: h } = node
  const SPACING = 10
  // Signed pixel offset from the centre of the side
  const offset = (idx - (count - 1) / 2) * SPACING
  switch (position) {
    case Position.Top:    return { x: pos.x + w / 2 + offset, y: pos.y }
    case Position.Bottom: return { x: pos.x + w / 2 + offset, y: pos.y + h }
    case Position.Left:   return { x: pos.x,                   y: pos.y + h / 2 + offset }
    case Position.Right:  return { x: pos.x + w,               y: pos.y + h / 2 + offset }
  }
}

/** Convert a stored side string to a Position enum value, or null if invalid. */
function posFromString(s: string | null | undefined): Position | null {
  if (s === 'top')    return Position.Top
  if (s === 'right')  return Position.Right
  if (s === 'bottom') return Position.Bottom
  if (s === 'left')   return Position.Left
  return null
}

/**
 * Return which side of nodeId the edge connects to, or null if unrelated.
 * Respects manually stored sides (e.data.srcSide / tgtSide); falls back to
 * the auto-detected side from relative node positions.
 * Used to group edges sharing the same node-side for even distribution.
 */
function getEdgeSideForNode(
  e: { source: string; target: string; data?: ProcessEdgeData },
  nodeId: string,
  nodeInternals: Map<string, any>,
): Position | null {
  const node = nodeInternals.get(nodeId)
  if (!node) return null
  if (e.source === nodeId) {
    const stored = posFromString(e.data?.srcSide)
    if (stored !== null) return stored
    const other = nodeInternals.get(e.target)
    if (!other) return null
    return getBestHandles(node, other).srcPos
  }
  if (e.target === nodeId) {
    const stored = posFromString(e.data?.tgtSide)
    if (stored !== null) return stored
    const other = nodeInternals.get(e.source)
    if (!other) return null
    return getBestHandles(other, node).tgtPos
  }
  return null
}

function getBestHandles(source: any, target: any): { srcPos: Position; tgtPos: Position } {
  const dx = (target.positionAbsolute.x + target.width / 2) - (source.positionAbsolute.x + source.width / 2)
  const dy = (target.positionAbsolute.y + target.height / 2) - (source.positionAbsolute.y + source.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { srcPos: Position.Right, tgtPos: Position.Left } : { srcPos: Position.Left, tgtPos: Position.Right }
  }
  return dy >= 0 ? { srcPos: Position.Bottom, tgtPos: Position.Top } : { srcPos: Position.Top, tgtPos: Position.Bottom }
}

/** Perpendicular distance from point p to segment a→b, clamped to segment bounds. */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x, aby = b.y - a.y
  const apx = p.x - a.x, apy = p.y - a.y
  const lenSq = abx * abx + aby * aby
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/**
 * Auto-route an orthogonal path when no user waypoints exist.
 * Returns a 4-point (or 2-point if aligned) corners array.
 */
function computeInitialCorners(src: Pt, tgt: Pt, srcPos: Position): Pt[] {
  const { x: sx, y: sy } = src
  const { x: tx, y: ty } = tgt
  if (srcPos === Position.Right || srcPos === Position.Left) {
    if (Math.abs(sy - ty) < 1) return [src, tgt]
    const mx = (sx + tx) / 2
    return [src, { x: mx, y: sy }, { x: mx, y: ty }, tgt]
  } else {
    if (Math.abs(sx - tx) < 1) return [src, tgt]
    const my = (sy + ty) / 2
    return [src, { x: sx, y: my }, { x: tx, y: my }, tgt]
  }
}

/**
 * Derive corner array from saved waypoints or fall back to auto-route.
 * Waypoints ARE the interior corners of the orthogonal path.
 */
function computeCorners(src: Pt, waypoints: Pt[], tgt: Pt, srcPos: Position): Pt[] {
  if (waypoints.length === 0) return computeInitialCorners(src, tgt, srcPos)
  return [src, ...waypoints, tgt]
}

/** Compute one straight segment per consecutive corner pair. */
function getSegments(corners: Pt[]): Segment[] {
  return corners.slice(0, -1).map((a, i) => {
    const b = corners[i + 1]
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, isHorizontal: Math.abs(b.y - a.y) < 0.5, idx: i }
  })
}

/**
 * Slide segment[segIdx] perpendicular to its direction by delta.
 *
 * - Middle segments: both endpoints move, flanking segments stretch.
 * - Stub adjacent to src/tgt (fixed): a new corner is inserted so the fixed
 *   end stays put while the rest of the path adapts.
 * - Single segment: a U-shaped detour is created.
 */
function applySegmentDrag(corners: Pt[], segIdx: number, delta: Pt): Pt[] {
  if (corners.length < 2) return corners
  const n = corners.length
  const a = corners[segIdx], b = corners[segIdx + 1]
  const isH = Math.abs(b.y - a.y) < 0.5
  const d   = isH ? delta.y : delta.x
  if (Math.abs(d) < 0.1) return corners

  const isFirst = segIdx === 0
  const isLast  = segIdx === n - 2
  const r = corners.map(c => ({ ...c }))

  if (isFirst && isLast) {
    // Single segment → U-shape detour
    if (isH) {
      r.splice(1, 0, { x: a.x, y: a.y + d })
      r.splice(2, 0, { x: b.x, y: a.y + d })
    } else {
      r.splice(1, 0, { x: a.x + d, y: a.y })
      r.splice(2, 0, { x: a.x + d, y: b.y })
    }
  } else if (isFirst) {
    // Left end fixed (src): move right endpoint, insert corner at left
    if (isH) {
      const newY = b.y + d
      r[1] = { ...r[1], y: newY }
      r.splice(1, 0, { x: a.x, y: newY })
    } else {
      const newX = b.x + d
      r[1] = { ...r[1], x: newX }
      r.splice(1, 0, { x: newX, y: a.y })
    }
  } else if (isLast) {
    // Right end fixed (tgt): move left endpoint, insert corner at right
    if (isH) {
      r[n - 2] = { ...r[n - 2], y: r[n - 2].y + d }
      r.splice(n - 1, 0, { x: b.x, y: r[n - 2].y })
    } else {
      r[n - 2] = { ...r[n - 2], x: r[n - 2].x + d }
      r.splice(n - 1, 0, { x: r[n - 2].x, y: b.y })
    }
  } else {
    // Pure middle: move both endpoints, flanking segments adapt
    if (isH) { r[segIdx].y += d; r[segIdx + 1].y += d }
    else      { r[segIdx].x += d; r[segIdx + 1].x += d }
  }

  return r
}

/** Remove consecutive collinear corners that add no information. */
function cleanupCorners(corners: Pt[]): Pt[] {
  if (corners.length <= 2) return corners
  const out = [corners[0]]
  for (let i = 1; i < corners.length - 1; i++) {
    const prev = out[out.length - 1], curr = corners[i], next = corners[i + 1]
    const colH = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5
    const colV = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5
    if (!colH && !colV) out.push(curr)
  }
  out.push(corners[corners.length - 1])
  return out
}

/**
 * Build an SVG path string through ordered corners with rounded bends.
 * Corners connect via quadratic Béziers (radius clamped to half-segment length).
 */
function buildPathFromCorners(corners: Pt[], radius = 10): string {
  if (corners.length < 2) return ''
  if (corners.length === 2) return `M ${corners[0].x},${corners[0].y} L ${corners[1].x},${corners[1].y}`
  let d = `M ${corners[0].x},${corners[0].y}`
  for (let i = 1; i < corners.length - 1; i++) {
    const prev = corners[i - 1], curr = corners[i], next = corners[i + 1]
    const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const d2 = Math.hypot(next.x - curr.x, next.y - curr.y)
    const r1 = Math.min(radius, d1 / 2), r2 = Math.min(radius, d2 / 2)
    const bx = curr.x - (curr.x - prev.x) * (r1 / d1)
    const by = curr.y - (curr.y - prev.y) * (r1 / d1)
    const cx = curr.x + (next.x - curr.x) * (r2 / d2)
    const cy = curr.y + (next.y - curr.y) * (r2 / d2)
    d += ` L ${bx},${by} Q ${curr.x},${curr.y} ${cx},${cy}`
  }
  d += ` L ${corners[corners.length - 1].x},${corners[corners.length - 1].y}`
  return d
}

/**
 * Sample the SVG path via the DOM to find the true geometric midpoint and
 * the tangent angle at that point. Results are cached by path string.
 */
function getPathMidInfo(pathD: string): { angle: number; midX: number; midY: number } {
  try {
    const svg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path') as SVGPathElement
    path.setAttribute('d', pathD)
    svg.style.cssText = 'position:absolute;top:-9999px;visibility:hidden;pointer-events:none'
    svg.appendChild(path)
    document.body.appendChild(svg)
    const len   = path.getTotalLength()
    const mid   = len / 2
    const midPt = path.getPointAtLength(mid)
    const p1    = path.getPointAtLength(Math.max(0,   mid - 0.5))
    const p2    = path.getPointAtLength(Math.min(len, mid + 0.5))
    document.body.removeChild(svg)
    return { angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI), midX: midPt.x, midY: midPt.y }
  } catch {
    return { angle: 0, midX: 0, midY: 0 }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProcessEdge({ id, source, target, selected, data }: EdgeProps<ProcessEdgeData>) {
  const sourceNode    = useStore((s) => s.nodeInternals.get(source))
  const targetNode    = useStore((s) => s.nodeInternals.get(target))
  const allEdges      = useStore((s) => s.edges)
  const nodeInternals = useStore((s) => s.nodeInternals)
  const { deleteElements, screenToFlowPosition } = useReactFlow()
  const { isEditing, onReverseEdge, onUpdateEdgeWaypoints } = useProcessCanvasContext()

  const [controlsHovered, setControlsHovered] = useState(false)
  const [hoveredSegIdx, setHoveredSegIdx] = useState<number | null>(null)

  // During drag: local corners for instant feedback; null = not dragging
  const [dragCorners, setDragCorners] = useState<Pt[] | null>(null)
  const draggingSegRef    = useRef<number>(-1)
  const dragStartPosRef   = useRef<Pt | null>(null)
  const initialCornersRef = useRef<Pt[] | null>(null)
  const latestCornersRef  = useRef<Pt[] | null>(null)

  // Mid-info cache keyed by path string — avoids repeated DOM ops each render
  const midInfoCache = useRef<{ path: string; angle: number; midX: number; midY: number }>({
    path: '', angle: 0, midX: 0, midY: 0,
  })

  if (!sourceNode || !targetNode) return null

  // Use manually stored sides if present; otherwise auto-detect from positions
  const { srcPos: autoSrcPos, tgtPos: autoTgtPos } = getBestHandles(sourceNode, targetNode)
  const srcPos = posFromString(data?.srcSide) ?? autoSrcPos
  const tgtPos = posFromString(data?.tgtSide) ?? autoTgtPos

  // Rank this edge among peers sharing the same node-side, for even spacing
  const edgesOnSrcSide = allEdges
    .filter((e) => getEdgeSideForNode(e, source, nodeInternals) === srcPos)
    .sort((a, b) => a.id.localeCompare(b.id))
  const edgesOnTgtSide = allEdges
    .filter((e) => getEdgeSideForNode(e, target, nodeInternals) === tgtPos)
    .sort((a, b) => a.id.localeCompare(b.id))

  const srcIdx   = edgesOnSrcSide.findIndex((e) => e.id === id)
  const srcCount = edgesOnSrcSide.length
  const tgtIdx   = edgesOnTgtSide.findIndex((e) => e.id === id)
  const tgtCount = edgesOnTgtSide.length

  const srcCoords = getOffsetHandleCoords(sourceNode, srcPos, Math.max(0, srcIdx), Math.max(1, srcCount))
  const tgtCoords = getOffsetHandleCoords(targetNode, tgtPos, Math.max(0, tgtIdx), Math.max(1, tgtCount))

  const savedWaypoints: Pt[] = data?.waypoints ?? []

  // During drag: use the live drag corners; otherwise derive from saved data
  const corners  = dragCorners ?? computeCorners(srcCoords, savedWaypoints, tgtCoords, srcPos)
  const segments = getSegments(corners)
  const edgePath = buildPathFromCorners(corners)

  // Cache the path mid-info (only recomputed when path string changes)
  if (edgePath !== midInfoCache.current.path) {
    midInfoCache.current = { path: edgePath, ...getPathMidInfo(edgePath) }
  }
  const { angle: arrowAngle, midX: labelX, midY: labelY } = midInfoCache.current

  const edgeColor = selected ? '#6366f1' : '#94a3b8'
  const isDragging = dragCorners !== null

  // ── Segment drag ────────────────────────────────────────────────────────────

  const startSegmentDrag = (e: React.MouseEvent, segIdx: number) => {
    if (!isEditing) return
    e.stopPropagation()
    e.preventDefault()

    const startPos     = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const snapCorners  = [...corners]  // snapshot at drag start
    draggingSegRef.current    = segIdx
    dragStartPosRef.current   = startPos
    initialCornersRef.current = snapCorners
    latestCornersRef.current  = snapCorners
    setDragCorners(snapCorners)

    // Match cursor globally so it doesn't flicker when mouse leaves the path
    const seg = segments[segIdx]
    document.body.style.cursor = seg.isHorizontal ? 'ns-resize' : 'ew-resize'

    const onMouseMove = (me: MouseEvent) => {
      const pos   = screenToFlowPosition({ x: me.clientX, y: me.clientY })
      const delta = { x: pos.x - startPos.x, y: pos.y - startPos.y }
      const next  = applySegmentDrag(snapCorners, segIdx, delta)
      latestCornersRef.current = next
      setDragCorners(next)
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      if (latestCornersRef.current) {
        const finalWaypoints = cleanupCorners(latestCornersRef.current).slice(1, -1)
        onUpdateEdgeWaypoints(id, finalWaypoints)
      }
      draggingSegRef.current    = -1
      dragStartPosRef.current   = null
      initialCornersRef.current = null
      latestCornersRef.current  = null
      setDragCorners(null)
      setHoveredSegIdx(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
  }

  // ── Hover detection on the wide overlay path ───────────────────────────────

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isEditing || isDragging) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    let nearest: number | null = null
    let minDist = 14  // px threshold in flow coords
    segments.forEach((seg, i) => {
      const d = distToSegment(pos, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 })
      if (d < minDist) { minDist = d; nearest = i }
    })
    setHoveredSegIdx(nearest)
  }

  const handleOverlayMouseLeave = () => { if (!isDragging) setHoveredSegIdx(null) }

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (hoveredSegIdx !== null) startSegmentDrag(e, hoveredSegIdx)
  }

  // ── Cursor for the overlay ─────────────────────────────────────────────────
  const overlayCursor =
    hoveredSegIdx !== null
      ? segments[hoveredSegIdx]?.isHorizontal ? 'ns-resize' : 'ew-resize'
      : 'default'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Visible edge */}
      <BaseEdge
        path={edgePath}
        style={{ stroke: edgeColor, strokeWidth: selected ? 2.5 : 2 }}
      />

      {/* Connection dots — visual markers at each endpoint, always non-interactive */}
      <circle cx={srcCoords.x} cy={srcCoords.y} r={4} fill={edgeColor} stroke="white" strokeWidth={2} style={{ pointerEvents: 'none' }} />
      <circle cx={tgtCoords.x} cy={tgtCoords.y} r={4} fill={edgeColor} stroke="white" strokeWidth={2} style={{ pointerEvents: 'none' }} />

      {/* Highlight the hovered segment */}
      {isEditing && hoveredSegIdx !== null && !isDragging && (() => {
        const seg = segments[hoveredSegIdx]
        return (
          <line
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke={edgeColor}
            strokeWidth={6}
            strokeOpacity={0.35}
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        )
      })()}

      {/* Wide transparent overlay for mouse interaction */}
      {isEditing && (
        <path
          d={edgePath}
          stroke="transparent"
          strokeWidth={24}
          fill="none"
          style={{ cursor: overlayCursor }}
          onMouseMove={handleOverlayMouseMove}
          onMouseLeave={handleOverlayMouseLeave}
          onMouseDown={handleOverlayMouseDown}
        />
      )}

      {/* Arrow + edge controls + side pickers (HTML layer) */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: isEditing && !isDragging ? 'all' : 'none',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setControlsHovered(true)}
          onMouseLeave={() => setControlsHovered(false)}
        >
          <div className="relative flex items-center justify-center" style={{ minWidth: 52, minHeight: 28 }}>

            {/* Arrow — hidden while controls are open */}
            {(!controlsHovered || !isEditing) && (
              <svg
                width="26" height="26" viewBox="-5 -5 10 10"
                style={{ transform: `rotate(${arrowAngle}deg)`, display: 'block' }}
              >
                <polygon
                  points="-3,-4 4,0 -3,4"
                  fill={edgeColor}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {/* Edit controls — appear on hover */}
            {controlsHovered && isEditing && (
              <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-md">
                <button
                  onClick={() => onReverseEdge(id, source, target)}
                  className="text-gray-400 hover:text-primary p-0.5 rounded-full transition-colors"
                  title="Reverse direction"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                </button>
                {savedWaypoints.length > 0 && (
                  <>
                    <div className="w-px h-3 bg-gray-200" />
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdateEdgeWaypoints(id, []) }}
                      className="text-gray-400 hover:text-amber-500 p-0.5 rounded-full transition-colors text-[10px] font-medium px-1"
                      title="Reset route"
                    >
                      reset
                    </button>
                  </>
                )}
                <div className="w-px h-3 bg-gray-200" />
                <button
                  onClick={() => deleteElements({ edges: [{ id }] })}
                  className="text-gray-400 hover:text-red-500 p-0.5 rounded-full transition-colors"
                  title="Delete connection"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

      </EdgeLabelRenderer>
    </>
  )
}
