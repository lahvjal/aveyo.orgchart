import {
  PlayCircle,
  StopCircle,
  CheckSquare,
  GitFork,
  FileText,
  UserCheck,
  Bell,
} from 'lucide-react'
import type { ProcessNodeType } from '../../types/processes'
import { PROCESS_NODE_TYPE_CONFIGS } from '../../types/processes'

const ICONS: Record<ProcessNodeType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  start:        PlayCircle,
  end:          StopCircle,
  task:         CheckSquare,
  decision:     GitFork,
  document:     FileText,
  approval:     UserCheck,
  notification: Bell,
}

interface ProcessNodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: ProcessNodeType) => void
}

export function ProcessNodePalette({ onDragStart }: ProcessNodePaletteProps) {
  return (
    <aside className="w-44 flex-shrink-0 bg-white border-r border-gray-200 p-3 flex flex-col gap-1 overflow-y-auto">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
        Node Types
      </p>
      {PROCESS_NODE_TYPE_CONFIGS.map((config) => {
        const Icon = ICONS[config.type]
        return (
          <div
            key={config.type}
            draggable
            onDragStart={(e) => onDragStart(e, config.type)}
            className="flex items-center gap-2 px-2 py-2 rounded-md border border-gray-200 bg-white cursor-grab active:cursor-grabbing hover:border-gray-400 hover:shadow-sm transition-all select-none"
            title={`Drag to add a ${config.label} node`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" style={{ color: config.color }} />
            <span className="text-xs font-medium text-gray-700">{config.label}</span>
            <div
              className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: config.color }}
            />
          </div>
        )
      })}
      <p className="mt-3 text-[10px] text-gray-400 leading-relaxed px-1">
        Drag a node type onto the canvas to add it. Connect nodes by dragging from the bottom handle to another node's top handle.
      </p>
    </aside>
  )
}
