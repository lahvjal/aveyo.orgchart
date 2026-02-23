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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { cn, getInitials } from '../../lib/utils'
import { useProcessCanvasContext } from './ProcessCanvasContext'

// Only node-specific fields live in data — shared state comes from context.
export interface ProcessNodeData {
  nodeType: ProcessNodeType
  label: string
  description?: string
  taggedProfileIds: string[]
  taggedDepartmentIds: string[]
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
  const { nodeType, label, description, taggedProfileIds, taggedDepartmentIds } = data

  // Shared canvas state/callbacks from context — never stale, never cause setNodes loops
  const {
    isEditing,
    allProfiles,
    allDepartments,
    onLabelChange,
    onDescriptionChange,
    onDelete,
    onUpdateTaggedProfiles,
    onUpdateTaggedDepartments,
  } = useProcessCanvasContext()

  const config = getNodeTypeConfig(nodeType)
  const Icon = NODE_ICONS[nodeType]

  const [editingLabel, setEditingLabel] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [localLabel, setLocalLabel] = useState(label)
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [deptPickerOpen, setDeptPickerOpen] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const deptPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setLocalLabel(label) }, [label])
  useEffect(() => { setLocalDesc(description ?? '') }, [description])

  // Close employee picker on outside click
  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [pickerOpen])

  // Close department picker on outside click
  useEffect(() => {
    if (!deptPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (deptPickerRef.current && !deptPickerRef.current.contains(e.target as Node)) {
        setDeptPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [deptPickerOpen])

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

  // Derive objects from ID arrays using context data
  const taggedProfiles = allProfiles.filter((p) => taggedProfileIds.includes(p.id))
  const taggedDepartments = allDepartments.filter((d) => taggedDepartmentIds.includes(d.id))
  const untaggedDepartments = allDepartments.filter((d) => !taggedDepartmentIds.includes(d.id))

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
  const handleTagDept = (deptId: string) => {
    onUpdateTaggedDepartments(id, [...taggedDepartmentIds, deptId])
    setDeptPickerOpen(false)
  }
  const handleUntagDept = (deptId: string) => {
    onUpdateTaggedDepartments(id, taggedDepartmentIds.filter((did) => did !== deptId))
  }

  const stopPropagation = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation()

  // Handles: visible only in edit mode, emerge on node hover, grow on direct hover
  const handleCls = cn(
    '!bg-primary !border-2 !border-white !rounded-full !shadow-sm transition-all duration-150',
    isEditing
      ? '!w-3 !h-3 !opacity-0 group-hover:!opacity-100 hover:!w-4 hover:!h-4 hover:!shadow-md'
      : '!opacity-0 !pointer-events-none !w-2 !h-2',
  )

  return (
    <div
      className="bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:border-gray-400 transition-colors min-w-[200px] max-w-[240px] group"
      style={{ borderTopColor: config.color, borderTopWidth: 4 }}
    >
      {/*
        Full-node invisible target handle.
        Covers the entire node face so users can drop a connection anywhere on the
        node — not just on the small side handles. React Flow detects it via its
        bounding box; our ProcessEdge getBestHandles() still picks the correct
        visual routing independently of which handle was used.
        pointer-events:none ensures it never blocks clicks on node content.
      */}
      <Handle
        type="target"
        position={Position.Top}
        id="node-body"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          transform: 'none',
          opacity: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Handle type="target" position={Position.Top}    id="top-target"    className={cn(handleCls, 'top-handle-target')} />
      <Handle type="source" position={Position.Top}    id="top-source"    className={cn(handleCls, 'top-handle-source')} />
      <Handle type="target" position={Position.Left}   id="left-target"   className={cn(handleCls, 'left-handle-target')} />
      <Handle type="source" position={Position.Left}   id="left-source"   className={cn(handleCls, 'left-handle-source')} />
      <Handle type="target" position={Position.Right}  id="right-target"  className={cn(handleCls, 'right-handle-target')} />
      <Handle type="source" position={Position.Right}  id="right-source"  className={cn(handleCls, 'right-handle-source')} />

      <div className="p-3">
        {/* Header */}
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
            className={`mt-1 text-xs text-muted-foreground leading-tight min-h-[1rem] ${isEditing ? 'cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5' : ''}`}
            onClick={() => { if (isEditing) { setEditingDesc(true); setTimeout(() => descRef.current?.focus(), 0) } }}
            title={isEditing ? 'Click to add description' : undefined}
          >
            {localDesc || (isEditing ? <span className="italic text-gray-300">description...</span> : null)}
          </p>
        )}

        {/* Department badges
            Always rendered when the org has departments so node height stays
            consistent between edit and view mode. In view mode with no tagged
            departments the section is invisible but still occupies space. */}
        {(taggedDepartments.length > 0 || allDepartments.length > 0) && (
          <div className={cn(
            'flex flex-wrap gap-1 mt-2 min-h-[24px]',
            !isEditing && taggedDepartments.length === 0 && 'invisible',
          )}>
            {taggedDepartments.map((dept) => (
              <Badge
                key={dept.id}
                className="text-xs pr-2.5 cursor-default"
                style={{ backgroundColor: dept.color, color: 'white' }}
              >
                {dept.name}
                {isEditing && (
                  <button
                    onClick={() => handleUntagDept(dept.id)}
                    onMouseDown={stopPropagation}
                    className="ml-1 hover:opacity-70 transition-opacity"
                    title={`Remove ${dept.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </Badge>
            ))}

            {isEditing && untaggedDepartments.length > 0 && (
              <div className="relative" ref={deptPickerRef}>
                <button
                  onClick={() => setDeptPickerOpen((o) => !o)}
                  onMouseDown={stopPropagation}
                  className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-primary border border-dashed border-gray-300 hover:border-primary rounded-full px-2 py-0.5 transition-colors"
                  title="Tag a department"
                >
                  <X className="h-2.5 w-2.5 rotate-45" />
                  dept
                </button>

                {deptPickerOpen && (
                  <div
                    className="absolute bottom-7 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-44 overflow-hidden"
                    onMouseDown={stopPropagation}
                  >
                    <div className="overflow-y-auto py-1">
                      {untaggedDepartments.map((dept) => (
                        <button
                          key={dept.id}
                          onClick={() => handleTagDept(dept.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color }} />
                          <span className="text-xs text-gray-700 truncate">{dept.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tagged employees
            Same rationale as the department section above: always rendered
            when the org has profiles so the node stays the same height in
            both edit and view mode. */}
        {(taggedProfiles.length > 0 || allProfiles.length > 0) && (
          <div className={cn(
            'mt-3 pt-2.5 border-t border-gray-100',
            !isEditing && taggedProfiles.length === 0 && 'invisible',
          )}>
            <div className="flex items-center flex-wrap gap-1 min-h-[24px]">
              {taggedProfiles.map((profile) => {
                const displayName = profile.preferred_name || profile.full_name
                return (
                  <div key={profile.id} className="relative group/tag" title={`${displayName} — ${profile.job_title}`}>
                    <Avatar className="h-6 w-6 ring-2 ring-white">
                      {profile.profile_photo_url && (
                        <AvatarImage src={profile.profile_photo_url} alt={displayName} />
                      )}
                      <AvatarFallback className="text-[9px]">{getInitials(profile.full_name)}</AvatarFallback>
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
                      <div className="max-h-44 overflow-y-auto nowheel">
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
                                <AvatarFallback className="text-[9px]">{getInitials(profile.full_name)}</AvatarFallback>
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

      <Handle type="target" position={Position.Bottom} id="bottom-target" className={cn(handleCls, 'bottom-handle-target')} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={cn(handleCls, 'bottom-handle-source')} />
    </div>
  )
})

ProcessNode.displayName = 'ProcessNode'
