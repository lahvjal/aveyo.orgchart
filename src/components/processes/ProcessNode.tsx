import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import {
  PlayCircle,
  StopCircle,
  CheckSquare,
  GitFork,
  FileText,
  UserCheck,
  Bell,
  Trash2,
} from 'lucide-react'
import type { ProcessNodeType } from '../../types/processes'
import { getNodeTypeConfig } from '../../types/processes'

export interface ProcessNodeData {
  nodeType: ProcessNodeType
  label: string
  description?: string
  isEditing: boolean
  onLabelChange: (id: string, label: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onDelete: (id: string) => void
}

const NODE_ICONS: Record<ProcessNodeType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  start:        PlayCircle,
  end:          StopCircle,
  task:         CheckSquare,
  decision:     GitFork,
  document:     FileText,
  approval:     UserCheck,
  notification: Bell,
}

export const ProcessNode = memo(({ id, data }: NodeProps<ProcessNodeData>) => {
  const { nodeType, label, description, isEditing, onLabelChange, onDescriptionChange, onDelete } = data
  const config = getNodeTypeConfig(nodeType)
  const Icon = NODE_ICONS[nodeType]

  const [editingLabel, setEditingLabel] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [localLabel, setLocalLabel] = useState(label)
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const labelRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)

  // Sync from external changes (e.g. initial load)
  useEffect(() => { setLocalLabel(label) }, [label])
  useEffect(() => { setLocalDesc(description ?? '') }, [description])

  const commitLabel = useCallback(() => {
    setEditingLabel(false)
    if (localLabel.trim()) {
      onLabelChange(id, localLabel.trim())
    } else {
      setLocalLabel(label)
    }
  }, [id, localLabel, label, onLabelChange])

  const commitDesc = useCallback(() => {
    setEditingDesc(false)
    onDescriptionChange(id, localDesc)
  }, [id, localDesc, onDescriptionChange])

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitLabel()
    }
  }

  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitDesc()
    }
  }

  return (
    <div
      className="bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:border-gray-400 transition-colors min-w-[180px] max-w-[220px] group"
      style={{ borderTopColor: config.color, borderTopWidth: 4 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />

      <div className="p-3">
        {/* Header: icon + type label + delete */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Icon className="h-4 w-4 flex-shrink-0" style={{ color: config.color }} />
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: config.color }}>
              {config.label}
            </span>
          </div>
          {isEditing && (
            <button
              onClick={() => onDelete(id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-0.5 rounded"
              title="Delete node"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Label */}
        {isEditing && editingLabel ? (
          <input
            ref={labelRef}
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={handleLabelKeyDown}
            autoFocus
            className="w-full text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-primary"
          />
        ) : (
          <p
            className={`text-sm font-semibold text-gray-800 leading-tight ${isEditing ? 'cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5' : ''}`}
            onClick={() => { if (isEditing) { setEditingLabel(true); setTimeout(() => labelRef.current?.focus(), 0) } }}
            title={isEditing ? 'Click to edit' : undefined}
          >
            {localLabel}
          </p>
        )}

        {/* Description */}
        {isEditing && editingDesc ? (
          <input
            ref={descRef}
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
            onBlur={commitDesc}
            onKeyDown={handleDescKeyDown}
            autoFocus
            placeholder="Add description..."
            className="w-full mt-1 text-xs text-gray-500 bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 outline-none focus:border-primary"
          />
        ) : (
          <p
            className={`mt-1 text-xs text-muted-foreground leading-tight ${isEditing ? 'cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 min-h-[16px]' : ''}`}
            onClick={() => { if (isEditing) { setEditingDesc(true); setTimeout(() => descRef.current?.focus(), 0) } }}
            title={isEditing ? 'Click to add description' : undefined}
          >
            {localDesc || (isEditing ? <span className="italic text-gray-300">description...</span> : null)}
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
})

ProcessNode.displayName = 'ProcessNode'
