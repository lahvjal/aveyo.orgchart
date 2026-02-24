import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment, buildDepartmentTree, getDepartmentDescendantIds } from '../../lib/queries'
import type { Department } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Plus, Edit2, Trash2, Loader2, ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatNode {
  dept: Department
  depth: number
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function buildFlatNodes(dept: Department, depth: number, collapsed: Set<string>, result: FlatNode[]) {
  result.push({ dept, depth })
  if (!collapsed.has(dept.id) && dept.children && dept.children.length > 0) {
    for (const child of dept.children) {
      buildFlatNodes(child, depth + 1, collapsed, result)
    }
  }
}

function getDeptLabel(depth: number): string {
  if (depth === 0) return 'Department'
  return 'Sub-department'
}

// ─── Draggable row ────────────────────────────────────────────────────────────

interface DeptRowProps {
  node: FlatNode
  isOver: boolean
  isActive: boolean
  onEdit: (dept: Department) => void
  onDelete: (dept: Department) => void
  onToggleCollapse: (id: string) => void
  isCollapsed: boolean
  hasChildren: boolean
}

function DeptRow({ node, isOver, isActive: _isActive, onEdit, onDelete, onToggleCollapse, isCollapsed, hasChildren }: DeptRowProps) {
  const { dept, depth } = node

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: dept.id })
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({ id: dept.id })

  const isDropTarget = isOver || isDropOver

  // Combine refs
  const ref = (el: HTMLDivElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={ref}
      style={{ paddingLeft: `${depth * 24 + 4}px` }}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border transition-colors',
        isDragging && 'opacity-30',
        isDropTarget && !isDragging && 'bg-primary/5 border-primary/40 ring-1 ring-primary/30',
        !isDropTarget && !isDragging && 'hover:bg-accent',
      )}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => hasChildren && onToggleCollapse(dept.id)}
        className={cn('p-0.5 rounded text-muted-foreground', hasChildren ? 'hover:text-foreground' : 'invisible')}
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Department info */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge style={{ backgroundColor: dept.color, color: 'white' }} className="shrink-0">
          {dept.name}
        </Badge>
        <span className="text-xs text-muted-foreground shrink-0">{getDeptLabel(depth)}</span>
        {dept.description && (
          <span className="text-sm text-muted-foreground truncate">{dept.description}</span>
        )}
      </div>

      {/* Edit button */}
      <Button variant="ghost" size="icon" onClick={() => onEdit(dept)} className="shrink-0">
        <Edit2 className="h-4 w-4" />
      </Button>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(dept)}
        className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─── Root droppable zone ──────────────────────────────────────────────────────

function RootDropZone({ isActive }: { isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: '__root__' })
  if (!isActive) return null
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center h-10 rounded-lg border-2 border-dashed text-sm transition-colors mb-2',
        isOver ? 'border-primary bg-primary/5 text-primary' : 'border-muted-foreground/30 text-muted-foreground',
      )}
    >
      Drop here to make a root department
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DepartmentManager() {
  const { data: departments, isLoading } = useDepartments()
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()
  const deleteDepartment = useDeleteDepartment()

  const [isEditing, setIsEditing] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deletingDept, setDeletingDept] = useState<Department | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    color: '#6366f1',
    description: '',
    parent_id: null as string | null,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const tree = useMemo(() => buildDepartmentTree(departments || []), [departments])

  const flatNodes = useMemo(() => {
    const result: FlatNode[] = []
    tree.forEach((root) => buildFlatNodes(root, 0, collapsed, result))
    return result
  }, [tree, collapsed])

  const activeDept = useMemo(
    () => departments?.find((d) => d.id === activeId) ?? null,
    [departments, activeId],
  )

  const handleToggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEdit = (dept: Department) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      color: dept.color,
      description: dept.description || '',
      parent_id: dept.parent_id ?? null,
    })
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingDept(null)
    setFormData({ name: '', color: '#6366f1', description: '', parent_id: null })
  }

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return
    await deleteDepartment.mutateAsync(deletingDept.id)
    setDeletingDept(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingDept) {
      await updateDepartment.mutateAsync({ id: editingDept.id, ...formData })
    } else {
      await createDepartment.mutateAsync(formData)
    }
    handleCancel()
  }

  // Departments that can be chosen as parent in form (exclude self + own descendants when editing)
  const parentOptions = useMemo(() => {
    if (!departments) return []
    if (!editingDept) return departments
    const forbidden = new Set(getDepartmentDescendantIds(editingDept.id, departments))
    return departments.filter((d) => !forbidden.has(d.id))
  }, [departments, editingDept])

  // ── DnD handlers ──
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? (over.id as string) : null)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const targetId = over.id as string

    // Prevent nesting under own descendants (cycle prevention)
    if (targetId !== '__root__') {
      const descendants = getDepartmentDescendantIds(draggedId, departments || [])
      if (descendants.includes(targetId)) return
    }

    const newParentId = targetId === '__root__' ? null : targetId
    const dragged = departments?.find((d) => d.id === draggedId)
    if (!dragged || dragged.parent_id === newParentId) return

    await updateDepartment.mutateAsync({ id: draggedId, parent_id: newParentId })
  }

  if (isLoading) {
    return <div>Loading departments...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditing ? (editingDept ? 'Edit Department' : 'Add Department') : 'Departments'}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? 'Configure department details and color coding'
              : 'Manage departments — drag a department onto another to nest it as a sub-department'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Department Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="e.g., Engineering"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color *</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-20 h-10"
                    required
                  />
                  <Badge style={{ backgroundColor: formData.color, color: 'white' }}>Preview</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent">Parent Department</Label>
                <select
                  id="parent"
                  value={formData.parent_id ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, parent_id: e.target.value || null }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">None (root department)</option>
                  {parentOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {(createDepartment.isPending || updateDepartment.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingDept ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setIsEditing(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>

              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <RootDropZone isActive={!!activeId} />

                <div className="space-y-1">
                  {flatNodes.map(({ dept, depth }) => {
                    const hasChildren = (dept.children?.length ?? 0) > 0
                    return (
                      <DeptRow
                        key={dept.id}
                        node={{ dept, depth }}
                        isOver={overId === dept.id}
                        isActive={activeId === dept.id}
                        onEdit={handleEdit}
                        onDelete={setDeletingDept}
                        onToggleCollapse={handleToggleCollapse}
                        isCollapsed={collapsed.has(dept.id)}
                        hasChildren={hasChildren}
                      />
                    )
                  })}
                  {flatNodes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No departments yet. Add one above.
                    </p>
                  )}
                </div>

                <DragOverlay>
                  {activeDept && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border bg-background shadow-lg opacity-90">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge style={{ backgroundColor: activeDept.color, color: 'white' }}>
                        {activeDept.name}
                      </Badge>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      {deletingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-sm space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">Delete department?</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{deletingDept.name}</span> will be
                permanently deleted. Any child departments will be moved to the root level.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeletingDept(null)} disabled={deleteDepartment.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteDepartment.isPending}>
                {deleteDepartment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
