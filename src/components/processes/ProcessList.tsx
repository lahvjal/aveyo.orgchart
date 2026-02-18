import { useState } from 'react'
import { Plus, GitFork, Trash2, Pencil, Loader2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Label } from '../ui/label'
import { CreateProcessDialog } from './CreateProcessDialog'
import type { Process } from '../../types/processes'
import {
  useProcesses,
  useCreateProcess,
  useUpdateProcess,
  useDeleteProcess,
} from '../../hooks/useProcesses'

interface ProcessListProps {
  canCreate: boolean
  currentUserId: string
  isAdmin: boolean
  onSelect: (process: Process) => void
}

export function ProcessList({ canCreate, currentUserId, isAdmin, onSelect }: ProcessListProps) {
  const { data: processes = [], isLoading } = useProcesses()
  const createProcess = useCreateProcess()
  const updateProcess = useUpdateProcess()
  const deleteProcess = useDeleteProcess()

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Process | null>(null)
  const [renameValue, setRenameName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Process | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canManage = (process: Process) => isAdmin || process.created_by === currentUserId

  const handleCreate = async (name: string, description: string) => {
    await createProcess.mutateAsync({ name, description: description || undefined })
  }

  const openRename = (process: Process) => {
    setRenameTarget(process)
    setRenameName(process.name)
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget || !renameValue.trim()) return
    await updateProcess.mutateAsync({ id: renameTarget.id, name: renameValue.trim() })
    setRenameTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProcess.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Processes</h1>
          <p className="text-muted-foreground mt-1">
            Build and view flowcharts for your team's processes.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Process
          </Button>
        )}
      </div>

      {processes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-4">
          <GitFork className="h-12 w-12 opacity-30" />
          <div>
            <p className="font-medium text-lg">No processes yet</p>
            {canCreate ? (
              <p className="text-sm">Create your first process to get started.</p>
            ) : (
              <p className="text-sm">No processes have been created yet.</p>
            )}
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Process
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {processes.map((process) => (
            <div
              key={process.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
              onClick={() => onSelect(process)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitFork className="h-5 w-5 flex-shrink-0 text-primary" />
                    <h3 className="font-semibold text-sm truncate">{process.name}</h3>
                  </div>
                  {canManage(process) && (
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openRename(process)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(process)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {process.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {process.description}
                  </p>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3 pt-3 border-t border-gray-100">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(process.updated_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateProcessDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Process</DialogTitle>
            <DialogDescription>Enter a new name for this process.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rename-input">Name</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove all nodes and connections in this process.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
