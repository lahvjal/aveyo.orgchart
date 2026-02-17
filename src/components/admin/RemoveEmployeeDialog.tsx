import { useState } from 'react'
import { useRemoveEmployee } from '../../hooks/useRemoveEmployee'
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
import { Loader2, AlertTriangle } from 'lucide-react'

interface RemoveEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Profile | null
}

export function RemoveEmployeeDialog({ open, onOpenChange, employee }: RemoveEmployeeDialogProps) {
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [error, setError] = useState('')
  const removeEmployee = useRemoveEmployee()

  const employeeEmail = employee?.email || ''
  const isEmailMatch = emailConfirmation.toLowerCase().trim() === employeeEmail.toLowerCase().trim()
  const canConfirm = isEmailMatch && !removeEmployee.isPending

  const handleRemove = async () => {
    if (!employee || !canConfirm) return

    setError('')
    const result = await removeEmployee.mutateAsync(employee.id)

    if (result.success) {
      // Reset form and close dialog
      setEmailConfirmation('')
      setError('')
      onOpenChange(false)
    } else {
      setError(result.error || 'Failed to remove employee')
    }
  }

  const handleClose = () => {
    if (!removeEmployee.isPending) {
      setEmailConfirmation('')
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
            Remove Employee
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the employee's account and all associated data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm font-medium text-destructive mb-2">
              Warning: This action is permanent
            </p>
            <p className="text-sm text-muted-foreground">
              Removing this employee will:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
              <li>Delete their user account</li>
              <li>Remove their profile and all associated data</li>
              <li>Remove them from the organization chart</li>
              <li>This cannot be undone</li>
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
                disabled={removeEmployee.isPending}
                className={error ? 'border-destructive' : ''}
              />
              {!isEmailMatch && emailConfirmation && (
                <p className="text-xs text-muted-foreground">
                  Email does not match
                </p>
              )}
            </div>
          )}

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
              disabled={removeEmployee.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={!canConfirm}
            >
              {removeEmployee.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Employee'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
