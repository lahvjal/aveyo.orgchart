import { useStore, getSmoothStepPath, EdgeLabelRenderer, BaseEdge, useReactFlow, Position } from 'reactflow'
import type { EdgeProps } from 'reactflow'
import { X } from 'lucide-react'

// Given a node, return the x/y coordinate of a specific handle position
function getHandleCoords(node: any, position: Position): { x: number; y: number } {
  const { positionAbsolute: pos, width: w, height: h } = node
  switch (position) {
    case Position.Top:    return { x: pos.x + w / 2, y: pos.y }
    case Position.Bottom: return { x: pos.x + w / 2, y: pos.y + h }
    case Position.Left:   return { x: pos.x,         y: pos.y + h / 2 }
    case Position.Right:  return { x: pos.x + w,     y: pos.y + h / 2 }
  }
}

// Choose the best source/target handle pair by comparing node centers.
// Dominant horizontal offset → left/right handles.
// Dominant vertical offset   → top/bottom handles.
function getBestHandles(
  source: any,
  target: any
): { srcPos: Position; tgtPos: Position } {
  const scx = source.positionAbsolute.x + source.width / 2
  const scy = source.positionAbsolute.y + source.height / 2
  const tcx = target.positionAbsolute.x + target.width / 2
  const tcy = target.positionAbsolute.y + target.height / 2

  const dx = tcx - scx
  const dy = tcy - scy

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { srcPos: Position.Right,  tgtPos: Position.Left }
      : { srcPos: Position.Left,   tgtPos: Position.Right }
  }
  return dy >= 0
    ? { srcPos: Position.Bottom, tgtPos: Position.Top }
    : { srcPos: Position.Top,    tgtPos: Position.Bottom }
}

interface ProcessEdgeData {
  canEdit?: boolean
}

export function ProcessEdge({ id, source, target, selected, data }: EdgeProps<ProcessEdgeData>) {
  const sourceNode = useStore((s) => s.nodeInternals.get(source))
  const targetNode = useStore((s) => s.nodeInternals.get(target))
  const { deleteElements } = useReactFlow()

  if (!sourceNode || !targetNode) return null

  const { srcPos, tgtPos } = getBestHandles(sourceNode, targetNode)
  const srcCoords = getHandleCoords(sourceNode, srcPos)
  const tgtCoords = getHandleCoords(targetNode, tgtPos)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: srcCoords.x,
    sourceY: srcCoords.y,
    sourcePosition: srcPos,
    targetX: tgtCoords.x,
    targetY: tgtCoords.y,
    targetPosition: tgtPos,
    borderRadius: 10,
  })

  const canEdit = data?.canEdit

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? '#6366f1' : '#94a3b8',
          strokeWidth: selected ? 2.5 : 2,
        }}
      />

      {canEdit && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan opacity-0 hover:opacity-100 transition-opacity"
          >
            <button
              onClick={() => deleteElements({ edges: [{ id }] })}
              className="bg-white border border-gray-200 rounded-full p-0.5 shadow-sm text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
              title="Delete connection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
