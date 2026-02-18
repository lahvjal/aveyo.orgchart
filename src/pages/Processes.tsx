import { useState } from 'react'
import { ArrowLeft, Pencil, Eye } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../hooks/useAuth'
import { ProcessList } from '../components/processes/ProcessList'
import { ProcessCanvas } from '../components/processes/ProcessCanvas'
import { Button } from '../components/ui/button'
import type { Process } from '../types/processes'
import { Loader2 } from 'lucide-react'

export default function Processes() {
  const { user } = useAuth()
  const { isAdmin, isManager, isLoading } = usePermissions()
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null)
  const [editMode, setEditMode] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const canCreate = isAdmin || isManager
  const canEdit = (process: Process) =>
    isAdmin || (isManager && process.created_by === user?.id)

  // Canvas view
  if (selectedProcess) {
    const userCanEdit = canEdit(selectedProcess)

    return (
      <div className="flex flex-col h-full">
        {/* Canvas toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedProcess(null); setEditMode(false) }}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              All Processes
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-sm">{selectedProcess.name}</span>
          </div>

          {userCanEdit && (
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode((m) => !m)}
              className="gap-1.5"
            >
              {editMode ? (
                <>
                  <Eye className="h-4 w-4" />
                  View Mode
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Edit Mode
                </>
              )}
            </Button>
          )}
        </div>

        {/* Canvas area (fills remaining height) */}
        <div className="flex-1 min-h-0">
          <ProcessCanvas
            processId={selectedProcess.id}
            canEdit={userCanEdit && editMode}
          />
        </div>
      </div>
    )
  }

  // List view
  return (
    <ProcessList
      canCreate={canCreate}
      currentUserId={user?.id ?? ''}
      isAdmin={isAdmin}
      onSelect={(process) => {
        setSelectedProcess(process)
        setEditMode(false)
      }}
    />
  )
}
