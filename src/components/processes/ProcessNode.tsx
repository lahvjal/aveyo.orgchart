import { memo, useState, useRef, useCallback, useEffect, useMemo, Fragment } from 'react'
import { Handle, Position, useStore } from 'reactflow'
import type { NodeProps } from 'reactflow'
import {
  PlayCircle,
  StopCircle,
  CheckSquare,
  GitFork,
  FileText,
  ExternalLink,
  Link2,
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
  documentLinks: string[]
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

type DescriptionBlock =
  | { type: 'text'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }

const BULLET_CHAR = '\u2022'
const BULLET_PREFIX = `${BULLET_CHAR} `
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi
const TRAILING_PUNCTUATION_PATTERN = /[),.;!?]+$/

function toSafeHttpUrl(rawUrl: string): string | null {
  try {
    const candidate = new URL(rawUrl)
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return null
    return candidate.toString()
  } catch {
    return null
  }
}

function renderTextWithLinks(text: string): React.ReactNode[] {
  const pieces: React.ReactNode[] = []
  let lastIndex = 0
  let matchIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const start = match.index ?? 0

    if (start > lastIndex) {
      pieces.push(text.slice(lastIndex, start))
    }

    const trailing = rawUrl.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? ''
    const cleanUrl = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl
    const safeUrl = toSafeHttpUrl(cleanUrl)

    if (safeUrl) {
      pieces.push(
        <a
          key={`link-${start}-${matchIndex}`}
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {cleanUrl}
        </a>
      )
      if (trailing) pieces.push(trailing)
    } else {
      pieces.push(rawUrl)
    }

    lastIndex = start + rawUrl.length
    matchIndex += 1
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex))
  }

  return pieces.length > 0 ? pieces : [text]
}

function getDocumentLinkLabel(rawUrl: string, index: number): string {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
      return `Google Drive document ${index + 1}`
    }
    return `${host}${parsed.pathname}`.slice(0, 48)
  } catch {
    return `Document ${index + 1}`
  }
}

function toDescriptionBlocks(value: string): DescriptionBlock[] {
  const lines = value.split('\n')
  const blocks: DescriptionBlock[] = []
  let textLines: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  const flushText = () => {
    if (textLines.length > 0) {
      blocks.push({ type: 'text', lines: textLines })
      textLines = []
    }
  }

  const flushList = () => {
    if (listType && listItems.length > 0) {
      blocks.push({ type: listType, items: listItems })
      listType = null
      listItems = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushText()
      flushList()
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    const bulletItem = bulletMatch?.[1]
      ?? (trimmed.startsWith(BULLET_PREFIX) ? trimmed.slice(BULLET_PREFIX.length).trim() : null)

    if (bulletItem) {
      flushText()
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(bulletItem)
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushText()
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(orderedMatch[1])
      continue
    }

    flushList()
    textLines.push(line)
  }

  flushText()
  flushList()
  return blocks
}

function autoSizeTextarea(el: HTMLTextAreaElement | null, minHeightPx = 96) {
  if (!el) return
  el.style.height = '0px'
  el.style.height = `${Math.max(el.scrollHeight, minHeightPx)}px`
}

function getCurrentLineStart(value: string, cursor: number): number {
  return value.lastIndexOf('\n', Math.max(cursor - 1, 0)) + 1
}

function getCurrentLineEnd(value: string, cursor: number): number {
  const nextNewline = value.indexOf('\n', cursor)
  return nextNewline === -1 ? value.length : nextNewline
}

export const ProcessNode = memo(({ id, data }: NodeProps<ProcessNodeData>) => {
  const { nodeType, label, description, documentLinks, taggedProfileIds, taggedDepartmentIds } = data

  // Shared canvas state/callbacks from context — never stale, never cause setNodes loops
  const {
    isEditing,
    allProfiles,
    allDepartments,
    onLabelChange,
    onDescriptionChange,
    onUpdateDocumentLinks,
    onDelete,
    onUpdateTaggedProfiles,
    onUpdateTaggedDepartments,
  } = useProcessCanvasContext()

  // True while the user is dragging a new connection from any node.
  // Used to make handles fully visible so valid drop targets are obvious.
  const isConnecting = useStore((s) => !!s.connectionNodeId)
  const zoom = useStore((s) => s.transform[2] ?? 1)

  const config = getNodeTypeConfig(nodeType)
  const Icon = NODE_ICONS[nodeType]

  const [editingLabel, setEditingLabel] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [localLabel, setLocalLabel] = useState(label)
  const [localDesc, setLocalDesc] = useState(description ?? '')
  const [localLinkInput, setLocalLinkInput] = useState('')
  const [linkInputError, setLinkInputError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [deptPickerOpen, setDeptPickerOpen] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
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

  const descriptionBlocks = useMemo(() => toDescriptionBlocks(localDesc), [localDesc])
  const normalizedDocumentLinks = useMemo(() => {
    const seen = new Set<string>()
    const links: string[] = []

    for (const rawLink of documentLinks ?? []) {
      const safeLink = toSafeHttpUrl(rawLink)
      if (!safeLink || seen.has(safeLink)) continue
      seen.add(safeLink)
      links.push(safeLink)
    }

    return links
  }, [documentLinks])

  useEffect(() => {
    if (!editingDesc) return
    autoSizeTextarea(descRef.current)
  }, [editingDesc, localDesc])

  useEffect(() => {
    if (!localLinkInput.trim()) {
      setLinkInputError('')
    }
  }, [localLinkInput])

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') commitLabel()
  }
  const handleDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
      e.preventDefault()
      commitDesc()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const caretStart = e.currentTarget.selectionStart ?? 0
      const caretEnd = e.currentTarget.selectionEnd ?? caretStart
      if (caretStart !== caretEnd) return

      const lineStart = getCurrentLineStart(localDesc, caretStart)
      const lineEnd = getCurrentLineEnd(localDesc, caretStart)
      const lineValue = localDesc.slice(lineStart, lineEnd)

      const bulletLineMatch = lineValue.match(/^(\s*)(?:•|-|\*)\s(.*)$/)
      const orderedLineMatch = lineValue.match(/^(\s*)(\d+)\.\s(.*)$/)
      if (!bulletLineMatch && !orderedLineMatch) return

      e.preventDefault()

      let nextValue = localDesc
      let nextCaret = caretStart

      if (bulletLineMatch) {
        const indent = bulletLineMatch[1]
        const lineContent = bulletLineMatch[2]

        if (!lineContent.trim()) {
          nextValue = `${localDesc.slice(0, lineStart)}${indent}${localDesc.slice(lineEnd)}`
          nextCaret = lineStart + indent.length
        } else {
          const insertion = `\n${indent}${BULLET_PREFIX}`
          nextValue = `${localDesc.slice(0, caretStart)}${insertion}${localDesc.slice(caretStart)}`
          nextCaret = caretStart + insertion.length
        }
      } else if (orderedLineMatch) {
        const indent = orderedLineMatch[1]
        const currentIndex = Number.parseInt(orderedLineMatch[2], 10)
        const lineContent = orderedLineMatch[3]

        if (!lineContent.trim()) {
          nextValue = `${localDesc.slice(0, lineStart)}${indent}${localDesc.slice(lineEnd)}`
          nextCaret = lineStart + indent.length
        } else {
          const nextIndex = Number.isFinite(currentIndex) ? currentIndex + 1 : 1
          const insertion = `\n${indent}${nextIndex}. `
          nextValue = `${localDesc.slice(0, caretStart)}${insertion}${localDesc.slice(caretStart)}`
          nextCaret = caretStart + insertion.length
        }
      }

      setLocalDesc(nextValue)

      requestAnimationFrame(() => {
        if (!descRef.current) return
        descRef.current.setSelectionRange(nextCaret, nextCaret)
        autoSizeTextarea(descRef.current)
      })
      return
    }

    if (e.key === ' ') {
      const caretStart = e.currentTarget.selectionStart ?? 0
      const caretEnd = e.currentTarget.selectionEnd ?? caretStart
      if (caretStart !== caretEnd) return

      const lineStart = getCurrentLineStart(localDesc, caretStart)
      const linePrefix = localDesc.slice(lineStart, caretStart)
      const bulletPrefixMatch = linePrefix.match(/^(\s*)[-*]$/)
      if (!bulletPrefixMatch) return

      e.preventDefault()
      const replacement = `${bulletPrefixMatch[1]}${BULLET_PREFIX}`
      const nextValue = `${localDesc.slice(0, lineStart)}${replacement}${localDesc.slice(caretStart)}`
      setLocalDesc(nextValue)

      requestAnimationFrame(() => {
        if (!descRef.current) return
        const nextCaret = lineStart + replacement.length
        descRef.current.setSelectionRange(nextCaret, nextCaret)
        autoSizeTextarea(descRef.current)
      })
    }
  }

  const handleAddDocumentLink = useCallback(() => {
    const safeUrl = toSafeHttpUrl(localLinkInput.trim())
    if (!safeUrl) {
      setLinkInputError('Enter a valid URL (https://...)')
      return
    }

    if (normalizedDocumentLinks.includes(safeUrl)) {
      setLinkInputError('That link is already attached.')
      return
    }

    onUpdateDocumentLinks(id, [...normalizedDocumentLinks, safeUrl])
    setLocalLinkInput('')
    setLinkInputError('')

    requestAnimationFrame(() => {
      linkInputRef.current?.focus()
    })
  }, [id, localLinkInput, normalizedDocumentLinks, onUpdateDocumentLinks])

  const handleRemoveDocumentLink = useCallback((url: string) => {
    onUpdateDocumentLinks(
      id,
      normalizedDocumentLinks.filter((entry) => entry !== url)
    )
    setLinkInputError('')
  }, [id, normalizedDocumentLinks, onUpdateDocumentLinks])

  const handleLinkInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleAddDocumentLink()
  }, [handleAddDocumentLink])

  const isActiveProfile = (profile: { employment_status?: string | null }) =>
    (profile.employment_status ?? 'active') === 'active'

  // Derive objects from ID arrays using context data
  const activeProfiles = allProfiles.filter(isActiveProfile)
  const taggedProfiles = allProfiles.filter((p) => taggedProfileIds.includes(p.id))
  const taggedDepartments = allDepartments.filter((d) => taggedDepartmentIds.includes(d.id))
  const untaggedDepartments = allDepartments.filter((d) => !taggedDepartmentIds.includes(d.id))

  const filteredProfiles = activeProfiles.filter((p) => {
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

  // Handles: visible only in edit mode.
  //
  // Source/target handles overlap on each side. While dragging a new connection,
  // only target handles should accept pointer events; otherwise drops can land on
  // overlapping source handles and silently fail to connect.
  const targetHandleCls = cn(
    '!bg-primary !border-2 !border-white !rounded-full !shadow-sm transition-all duration-150',
    isEditing
      ? isConnecting
        // Actively drawing a connection → valid drop targets are interactive
        ? '!opacity-100 !pointer-events-auto'
        // Idle → ghost on node-hover (interactive), full on direct hover
        : '!opacity-0 !pointer-events-none group-hover:!opacity-45 group-hover:!pointer-events-auto hover:!opacity-100 hover:!shadow-md'
      : '!opacity-0 !pointer-events-none',
  )
  const sourceHandleCls = cn(
    '!bg-primary !border-2 !border-white !rounded-full !shadow-sm transition-all duration-150',
    isEditing
      ? isConnecting
        // During connect-drag, disable source handles to avoid overlap conflicts.
        ? '!opacity-45 !pointer-events-none'
        : '!opacity-0 !pointer-events-none group-hover:!opacity-45 group-hover:!pointer-events-auto hover:!opacity-100 hover:!shadow-md'
      : '!opacity-0 !pointer-events-none',
  )
  const handleSize = 18 / Math.max(zoom, 0.1)
  const handleStyle: React.CSSProperties = { width: handleSize, height: handleSize }
  const nodeBodyTargetStyle: React.CSSProperties = {
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
    pointerEvents: isEditing && isConnecting ? 'auto' : 'none',
    // During connection drag, lift above node content so dropping anywhere
    // on the node reliably lands on this target handle.
    zIndex: isEditing && isConnecting ? 20 : 0,
  }

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
        It only accepts pointer events while a connection is being dragged, so it
        never blocks normal node interactions.
      */}
      <Handle
        type="target"
        position={Position.Top}
        id="node-body"
        style={nodeBodyTargetStyle}
      />

      <Handle type="target" position={Position.Top}    id="top-target"    className={cn(targetHandleCls, 'top-handle-target')} style={handleStyle} />
      <Handle type="source" position={Position.Top}    id="top-source"    className={cn(sourceHandleCls, 'top-handle-source')} style={handleStyle} />
      <Handle type="target" position={Position.Left}   id="left-target"   className={cn(targetHandleCls, 'left-handle-target')} style={handleStyle} />
      <Handle type="source" position={Position.Left}   id="left-source"   className={cn(sourceHandleCls, 'left-handle-source')} style={handleStyle} />
      <Handle type="target" position={Position.Right}  id="right-target"  className={cn(targetHandleCls, 'right-handle-target')} style={handleStyle} />
      <Handle type="source" position={Position.Right}  id="right-source"  className={cn(sourceHandleCls, 'right-handle-source')} style={handleStyle} />

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
          <div className="mt-1">
            <textarea
              ref={descRef}
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onInput={(e) => autoSizeTextarea(e.currentTarget)}
              onFocus={(e) => autoSizeTextarea(e.currentTarget)}
              onBlur={commitDesc}
              onKeyDown={handleDescKeyDown}
              onMouseDown={stopPropagation}
              onPointerDown={stopPropagation}
              autoFocus
              rows={1}
              placeholder={'Add details...\n- Bullet points\n1. Numbered steps\nhttps://drive.google.com/...'}
              className="nodrag nowheel w-full text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-primary min-h-[96px] resize-none overflow-hidden"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Enter for new lines. Ctrl/Cmd+Enter to save.
            </p>
          </div>
        ) : (
          <div
            className={`mt-1 text-xs text-muted-foreground leading-tight min-h-[1rem] ${isEditing ? 'cursor-text hover:bg-gray-50 rounded px-1 -mx-1 py-0.5' : ''}`}
            onClick={() => { if (isEditing) { setEditingDesc(true); setTimeout(() => descRef.current?.focus(), 0) } }}
            title={isEditing ? 'Click to add description' : undefined}
          >
            {localDesc ? (
              <div className="space-y-1.5">
                {descriptionBlocks.map((block, blockIndex) => {
                  if (block.type === 'ul') {
                    return (
                      <ul key={`desc-ul-${blockIndex}`} className="list-disc pl-4 space-y-0.5">
                        {block.items.map((item, itemIndex) => (
                          <li key={`desc-ul-item-${blockIndex}-${itemIndex}`}>
                            {renderTextWithLinks(item)}
                          </li>
                        ))}
                      </ul>
                    )
                  }

                  if (block.type === 'ol') {
                    return (
                      <ol key={`desc-ol-${blockIndex}`} className="list-decimal pl-4 space-y-0.5">
                        {block.items.map((item, itemIndex) => (
                          <li key={`desc-ol-item-${blockIndex}-${itemIndex}`}>
                            {renderTextWithLinks(item)}
                          </li>
                        ))}
                      </ol>
                    )
                  }

                  return (
                    <p key={`desc-text-${blockIndex}`} className="leading-relaxed">
                      {block.lines.map((line, lineIndex) => (
                        <Fragment key={`desc-text-line-${blockIndex}-${lineIndex}`}>
                          {renderTextWithLinks(line)}
                          {lineIndex < block.lines.length - 1 && <br />}
                        </Fragment>
                      ))}
                    </p>
                  )
                })}
              </div>
            ) : (
              isEditing ? <span className="italic text-gray-300">description...</span> : null
            )}
          </div>
        )}

        {/* Attached document links */}
        {(normalizedDocumentLinks.length > 0 || isEditing) && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 mb-1">
              <Link2 className="h-3 w-3" />
              <span>Documents</span>
            </div>

            {normalizedDocumentLinks.length > 0 ? (
              <div className="space-y-1">
                {normalizedDocumentLinks.map((url, index) => (
                  <div key={url} className="flex items-center gap-1.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-2 break-all"
                      onMouseDown={stopPropagation}
                      onPointerDown={stopPropagation}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <span>{getDocumentLinkLabel(url, index)}</span>
                    </a>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveDocumentLink(url)}
                        onMouseDown={stopPropagation}
                        onPointerDown={stopPropagation}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove link"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              isEditing && <p className="text-[11px] text-gray-300 italic">No links attached yet.</p>
            )}

            {isEditing && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={linkInputRef}
                    value={localLinkInput}
                    onChange={(e) => setLocalLinkInput(e.target.value)}
                    onKeyDown={handleLinkInputKeyDown}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    placeholder="Paste Google Drive URL..."
                    className="nodrag w-full text-[11px] bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddDocumentLink}
                    onMouseDown={stopPropagation}
                    onPointerDown={stopPropagation}
                    className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                    title="Attach link"
                  >
                    Add
                  </button>
                </div>
                {linkInputError && (
                  <p className="text-[10px] text-red-500 mt-1">{linkInputError}</p>
                )}
              </div>
            )}
          </div>
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
                const isArchived = !isActiveProfile(profile)
                return (
                  <div
                    key={profile.id}
                    className={cn('relative group/tag', isArchived && 'opacity-75')}
                    title={`${displayName} — ${profile.job_title}${isArchived ? ' (Archived)' : ''}`}
                  >
                    <Avatar className={cn('h-6 w-6 ring-2 ring-white', isArchived && 'ring-amber-300')}>
                      {profile.profile_photo_url && (
                        <AvatarImage src={profile.profile_photo_url} alt={displayName} />
                      )}
                      <AvatarFallback className="text-[9px]">{getInitials(profile.full_name)}</AvatarFallback>
                    </Avatar>
                    {isArchived && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded border border-amber-300 bg-amber-100 px-1 text-[8px] font-medium text-amber-700">
                        Archived
                      </span>
                    )}
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
                            {search
                              ? 'No matches found'
                              : activeProfiles.length === 0
                                ? 'No active employees available'
                                : 'All active employees tagged'}
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

      <Handle type="target" position={Position.Bottom} id="bottom-target" className={cn(targetHandleCls, 'bottom-handle-target')} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={cn(sourceHandleCls, 'bottom-handle-source')} style={handleStyle} />
    </div>
  )
})

ProcessNode.displayName = 'ProcessNode'
