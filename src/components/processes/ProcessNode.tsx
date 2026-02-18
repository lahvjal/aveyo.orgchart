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
  UserPlus,
  X,
} from 'lucide-react'
import type { ProcessNodeType } from '../../types/processes'
import { getNodeTypeConfig } from '../../types/processes'
import type { Profile } from '../../types'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { getInitials } from '../../lib/utils'

export interface ProcessNodeData {
  nodeType: ProcessNodeType
  label: string
  description?: string
  isEditing: boolean
  taggedProfileIds: string[]
  allProfiles: Profile[]
  onLabelChange: (id: string, label: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onDelete: (id: string) => void
  onUpdateTaggedProfiles: (nodeId: string, profileIds: string[]) => void
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
  const {
    nodeType, label, description, isEditing,
    taggedProfileIds, allProfiles,
    onLabelChange, onDescriptionChange, onDelete,
    onUpdateTaggedProfiles,
  } = data
  const config = getNodeTypeConfig(nodeType)
  const Icon = NODE_ICONS[nodeType]

  const [editingLabel, setEditingLabel] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [localLabel, setLocalLabel] = useState(label)
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const labelRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setLocalLabel(label) }, [label])
  useEffect(() => { setLocalDesc(description ?? '') }, [description])

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

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
    if (e.key === 'Enter' || e.key === 'Escape') commitLabel()
  }
  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') commitDesc()
  }

  // Derive tagged profile objects from the ID list
  const taggedProfiles = allProfiles.filter((p) => taggedProfileIds.includes(p.id))

  const filteredProfiles = allProfiles.filter((p) => {
    if (taggedProfileIds.includes(p.id)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.preferred_name?.toLowerCase().includes(q) ||
      p.job_title?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  })

  const handleTag = (profileId: string) => {
    onUpdateTaggedProfiles(id, [...taggedProfileIds, profileId])
    setSearch('')
    setPickerOpen(false)
  }

  const handleUntag = (profileId: string) => {
    onUpdateTaggedProfiles(id, taggedProfileIds.filter((pid) => pid !== profileId))
  }

  // Prevent ReactFlow from dragging when interacting with inputs/picker
  const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation()

  return (
    <div
      className="bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:border-gray-400 transition-colors min-w-[200px] max-w-[240px] group"
      style={{ borderTopColor: config.color, borderTopWidth: 4 }}
    >
      <Handle type="target" position={Position.Top} id="top-target" className="!bg-primary" />
      <Handle type="source" position={Position.Top} id="top-source" className="!bg-primary" />
      <Handle type="target" position={Position.Left} id="left-target" className="!bg-primary" />
      <Handle type="source" position={Position.Left} id="left-source" className="!bg-primary" />
      <Handle type="target" position={Position.Right} id="right-target" className="!bg-primary" />
      <Handle type="source" position={Position.Right} id="right-source" className="!bg-primary" />

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
              onMouseDown={stopPropagation}
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
            onMouseDown={stopPropagation}
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
            onMouseDown={stopPropagation}
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

        {/* Tagged employees */}
        {(taggedProfiles.length > 0 || isEditing) && (
          <div className="mt-3 pt-2.5 border-t border-gray-100">
            <div className="flex items-center flex-wrap gap-1">
              {taggedProfiles.map((profile) => {
                const displayName = profile.preferred_name || profile.full_name
                return (
                  <div
                    key={profile.id}
                    className="relative group/tag"
                    title={`${displayName} — ${profile.job_title}`}
                  >
                    <Avatar className="h-6 w-6 ring-2 ring-white">
                      {profile.profile_photo_url && (
                        <AvatarImage src={profile.profile_photo_url} alt={displayName} />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <button
                        onClick={() => handleUntag(profile.id)}
                        onMouseDown={stopPropagation}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-px opacity-0 group-hover/tag:opacity-100 transition-opacity"
                        title={`Remove ${displayName}`}
                      >
                        <X className="h-2 w-2" />
                      </button>
                    )}
                  </div>
                )
              })}

              {/* Add employee button + picker */}
              {isEditing && (
                <div className="relative" ref={pickerRef}>
                  <button
                    onClick={() => { setPickerOpen((o) => !o); setTimeout(() => searchRef.current?.focus(), 50) }}
                    onMouseDown={stopPropagation}
                    className="h-6 w-6 rounded-full border-2 border-dashed border-gray-300 hover:border-primary flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    title="Tag an employee"
                  >
                    <UserPlus className="h-3 w-3" />
                  </button>

                  {pickerOpen && (
                    <div
                      className="absolute bottom-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 overflow-hidden"
                      onMouseDown={stopPropagation}
                    >
                      <div className="p-2 border-b border-gray-100">
                        <input
                          ref={searchRef}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search employees..."
                          className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary"
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {filteredProfiles.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4 px-2">
                            {search ? 'No matches found' : 'All employees tagged'}
                          </p>
                        ) : (
                          filteredProfiles.map((profile) => (
                            <button
                              key={profile.id}
                              onClick={() => handleTag(profile.id)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 transition-colors text-left"
                            >
                              <Avatar className="h-6 w-6 flex-shrink-0">
                                {profile.profile_photo_url && (
                                  <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
                                )}
                                <AvatarFallback className="text-[9px]">
                                  {getInitials(profile.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">
                                  {profile.preferred_name || profile.full_name}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">{profile.job_title}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-primary" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-primary" />
    </div>
  )
})

ProcessNode.displayName = 'ProcessNode'
