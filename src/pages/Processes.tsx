import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Eye, Share2 } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { ProcessList } from '../components/processes/ProcessList'
import { ProcessCanvas } from '../components/processes/ProcessCanvas'
import { ProcessShareLinkManager } from '../components/processes/ProcessShareLinkManager'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog'
import type { Process } from '../types/processes'
import { Loader2 } from 'lucide-react'
import type { ProcessLockAcquireResult } from '../types/processes'
import {
  useAcquireProcessEditLock,
  useForceTakeoverProcessEditLock,
  useProcessEditLock,
  useReleaseProcessEditLock,
} from '../hooks/useProcesses'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

export default function Processes() {
  usePageTitle('Processes')
  const { user } = useAuth()
  const { isAdmin, isManager, isProcessEditor, isLoading } = usePermissions()
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [lockConflict, setLockConflict] = useState<ProcessLockAcquireResult | null>(null)
  const queryClient = useQueryClient()
  const acquireEditLock = useAcquireProcessEditLock()
  const forceTakeoverLock = useForceTakeoverProcessEditLock()
  const releaseEditLock = useReleaseProcessEditLock()
  const { data: activeEditLock } = useProcessEditLock(selectedProcess?.id ?? null)

  const releaseCurrentLock = useCallback(async (processId: string) => {
    try {
      await releaseEditLock.mutateAsync({ process_id: processId })
    } catch (err) {
      console.warn('Failed to release process edit lock', { processId, err })
    }
  }, [releaseEditLock])

  const enterEditMode = useCallback(async () => {
    if (!selectedProcess) return
    try {
      const result = await acquireEditLock.mutateAsync({ process_id: selectedProcess.id })
      if (result.acquired) {
        setLockConflict(null)
        setEditMode(true)
      } else {
        setLockConflict(result)
      }
    } catch (err) {
      console.error('Failed to acquire process edit lock', err)
      alert(err instanceof Error ? err.message : 'Unable to enter edit mode right now.')
    }
  }, [acquireEditLock, selectedProcess])

  const exitEditMode = useCallback(() => {
    if (selectedProcess) {
      void releaseCurrentLock(selectedProcess.id)
    }
    setEditMode(false)
  }, [releaseCurrentLock, selectedProcess])

  const takeOverEditMode = useCallback(async () => {
    if (!selectedProcess) return
    try {
      const result = await forceTakeoverLock.mutateAsync({ process_id: selectedProcess.id })
      if (result.acquired) {
        setLockConflict(null)
        setEditMode(true)
      }
    } catch (err) {
      console.error('Failed to take over process edit lock', err)
      alert(err instanceof Error ? err.message : 'Unable to take over edit mode right now.')
    }
  }, [forceTakeoverLock, selectedProcess])

  // If lock ownership changes remotely while editing, drop this user back to view mode.
  useEffect(() => {
    if (!selectedProcess) return
    const channel = supabase
      .channel(`process-lock-${selectedProcess.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'process_edit_locks', filter: `process_id=eq.${selectedProcess.id}` },
        (payload) => {
          const lockOwner =
            payload.eventType === 'DELETE'
              ? null
              : (payload.new as { locked_by?: string } | null)?.locked_by ?? null

          if (editMode && lockOwner && lockOwner !== user?.id) {
            setEditMode(false)
          }
          queryClient.invalidateQueries({ queryKey: ['process-edit-lock', selectedProcess.id] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedProcess, editMode, user?.id, queryClient])

  // Best-effort release if the tab/window is being closed while editing.
  useEffect(() => {
    if (!editMode || !selectedProcess) return
    const onPageHide = () => {
      void supabase.rpc('release_process_edit_lock', { p_process_id: selectedProcess.id })
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [editMode, selectedProcess])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const canCreate = isAdmin || isManager || isProcessEditor
  const canEdit = (process: Process) =>
    isAdmin || isProcessEditor || (isManager && process.created_by === user?.id)

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
              onClick={() => {
                if (editMode) exitEditMode()
                setSelectedProcess(null)
                setEditMode(false)
              }}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              All Processes
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-sm">{selectedProcess.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {userCanEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareOpen(true)}
                className="gap-1.5"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}

            {userCanEdit && (
              <Button
                variant={editMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (editMode) {
                    exitEditMode()
                  } else {
                    void enterEditMode()
                  }
                }}
                disabled={acquireEditLock.isPending || forceTakeoverLock.isPending}
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
            {userCanEdit && !editMode && activeEditLock && activeEditLock.locked_by !== user?.id && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Editing: {activeEditLock.locked_by_name}
              </span>
            )}
          </div>
        </div>

        {/* Canvas area (fills remaining height) */}
        <div className="flex-1 min-h-0">
          <ProcessCanvas
            processId={selectedProcess.id}
            canEdit={userCanEdit && editMode}
          />
        </div>

        {/* Share link manager dialog */}
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Process Diagram</DialogTitle>
            </DialogHeader>
            <ProcessShareLinkManager
              processId={selectedProcess.id}
              processName={selectedProcess.name}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={!!lockConflict} onOpenChange={(open) => { if (!open) setLockConflict(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Mode In Use</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {lockConflict
                ? `${lockConflict.locked_by_name} is currently editing this process. You can stay in view mode or take over edit mode.`
                : 'Another editor currently holds the edit lock for this process.'}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setLockConflict(null)}
              >
                Stay in view mode
              </Button>
              <Button
                onClick={() => { void takeOverEditMode() }}
                disabled={forceTakeoverLock.isPending}
              >
                {forceTakeoverLock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Take over edit mode
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // List view
  return (
    <ProcessList
      canCreate={canCreate}
      currentUserId={user?.id ?? ''}
      isAdmin={isAdmin}
      isProcessEditor={isProcessEditor}
      onSelect={(process) => {
        setSelectedProcess(process)
        setEditMode(false)
      }}
    />
  )
}
