import { useMemo, useState } from 'react'
import { useTerminateEmployee } from '../../hooks/useTerminateEmployee'
import type { Profile } from '../../types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Loader2, AlertTriangle } from 'lucide-react'

interface RemoveEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Profile | null
  allProfiles: Profile[]
}

export function RemoveEmployeeDialog({
  open,
  onOpenChange,
  employee,
  allProfiles,
}: RemoveEmployeeDialogProps) {
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [successorManagerId, setSuccessorManagerId] = useState('')
  const [terminationReason, setTerminationReason] = useState('')
  const [terminationEffectiveAt, setTerminationEffectiveAt] = useState('')
  const [error, setError] = useState('')
  const terminateEmployee = useTerminateEmployee()

  const employeeEmail = employee?.email || ''
  const isEmailMatch = emailConfirmation.toLowerCase().trim() === employeeEmail.toLowerCase().trim()

  const directReports = useMemo(() => {
    if (!employee) return []
    return allProfiles.filter((profile) => {
      const status = (profile as any).employment_status
      return profile.manager_id === employee.id && status !== 'terminated'
    })
  }, [allProfiles, employee])

  const successorManagers = useMemo(() => {
    if (!employee) return []
    const employeeId = employee.id
    return allProfiles.filter((profile) => {
      const status = (profile as any).employment_status
      return profile.id !== employeeId && profile.is_manager && status !== 'terminated'
    })
  }, [allProfiles, employee])

  const successorRequired = directReports.length > 0
  const hasValidSuccessor = !successorRequired || !!successorManagerId
  const canConfirm = isEmailMatch && hasValidSuccessor && !terminateEmployee.isPending

  const handleTerminate = async () => {
    if (!employee || !canConfirm) return

    setError('')
    const effectiveAtUtc = terminationEffectiveAt
      ? new Date(terminationEffectiveAt).toISOString()
      : null

    const result = await terminateEmployee.mutateAsync({
      targetUserId: employee.id,
      successorManagerId: successorManagerId || null,
      terminationReason: terminationReason.trim() || null,
      terminationEffectiveAt: effectiveAtUtc,
    })

    if (result.success) {
      setEmailConfirmation('')
      setSuccessorManagerId('')
      setTerminationReason('')
      setTerminationEffectiveAt('')
      setError('')
      onOpenChange(false)
    } else {
      setError(result.error || 'Failed to terminate employee')
    }
  }

  const handleClose = () => {
    if (!terminateEmployee.isPending) {
      setEmailConfirmation('')
      setSuccessorManagerId('')
      setTerminationReason('')
      setTerminationEffectiveAt('')
      setError('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Terminate Employee
          </DialogTitle>
          <DialogDescription>
            This action archives the employee profile and disables active access. It does not hard-delete historical data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive mb-2">
              Warning: Termination will immediately remove the employee from active views
            </p>
            <p className="text-sm text-muted-foreground">
              Terminating this employee will:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>Archive their profile and mark employment as terminated</li>
              <li>Hide them from active org chart and assignment pickers</li>
              <li>Reassign direct reports to a successor manager (if applicable)</li>
              <li>Preserve historical records instead of hard deletion</li>
            </ul>
          </div>

          {employee && (
            <div className="space-y-2">
              <Label htmlFor="employee-email">
                To confirm, type the employee's email address:
              </Label>
              <div className="p-2 bg-muted rounded-md">
                <p className="text-sm font-medium">{employee.full_name}</p>
                <p className="text-xs text-muted-foreground">{employeeEmail}</p>
              </div>
              <Input
                id="employee-email"
                type="email"
                placeholder={employeeEmail}
                value={emailConfirmation}
                onChange={(e) => {
                  setEmailConfirmation(e.target.value)
                  setError('')
                }}
                disabled={terminateEmployee.isPending}
                className={error ? 'border-destructive' : ''}
              />
              {!isEmailMatch && emailConfirmation && (
                <p className="text-xs text-muted-foreground">
                  Email does not match
                </p>
              )}
            </div>
          )}

          {successorRequired && (
            <div className="space-y-2">
              <Label htmlFor="successor-manager">
                Successor manager <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                This employee has {directReports.length} direct report{directReports.length === 1 ? '' : 's'} that must be reassigned.
              </p>
              <select
                id="successor-manager"
                value={successorManagerId}
                onChange={(event) => {
                  setSuccessorManagerId(event.target.value)
                  setError('')
                }}
                disabled={terminateEmployee.isPending || successorManagers.length === 0}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select successor manager</option>
                {successorManagers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name} - {manager.job_title}
                  </option>
                ))}
              </select>
              {successorManagers.length === 0 && (
                <p className="text-xs text-destructive">
                  No eligible active managers are available. Create or update a manager before terminating this employee.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="termination-effective-at">Termination effective at (optional)</Label>
            <Input
              id="termination-effective-at"
              type="datetime-local"
              value={terminationEffectiveAt}
              onChange={(event) => setTerminationEffectiveAt(event.target.value)}
              disabled={terminateEmployee.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="termination-reason">Termination reason (optional)</Label>
            <Textarea
              id="termination-reason"
              value={terminationReason}
              onChange={(event) => setTerminationReason(event.target.value)}
              placeholder="Add an internal HR/admin reason for this termination..."
              disabled={terminateEmployee.isPending}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={terminateEmployee.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleTerminate}
              disabled={!canConfirm}
            >
              {terminateEmployee.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Terminating...
                </>
              ) : (
                'Terminate Employee'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
