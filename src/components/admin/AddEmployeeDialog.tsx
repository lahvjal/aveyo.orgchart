import { useState, useEffect } from 'react'
import { useInviteEmployee } from '../../hooks/useInviteEmployee'
import { useProfiles } from '../../hooks/useProfile'
import { useDepartments } from '../../lib/queries'
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
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { CascadingDepartmentSelect } from './CascadingDepartmentSelect'

interface AddEmployeeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddEmployeeDialog({ open, onOpenChange }: AddEmployeeDialogProps) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [managerId, setManagerId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [departmentAutoFilled, setDepartmentAutoFilled] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  const inviteEmployee = useInviteEmployee()
  const { data: profiles } = useProfiles()
  const { data: departments } = useDepartments()

  // Auto-fill department when manager is selected
  useEffect(() => {
    if (managerId && profiles) {
      const selectedManager = profiles.find(p => p.id === managerId)
      if (selectedManager?.department_id) {
        setDepartmentId(selectedManager.department_id)
        setDepartmentAutoFilled(true)
      }
    }
  }, [managerId, profiles])

  // Handle manual department change
  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value)
    setDepartmentAutoFilled(false)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // First name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters'
    }

    // Last name validation
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    } else if (lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters'
    }

    // Job title validation
    if (!jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required'
    } else if (jobTitle.trim().length < 2) {
      newErrors.jobTitle = 'Job title must be at least 2 characters'
    }

    // Start date validation
    if (!startDate) {
      newErrors.startDate = 'Start date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setSuccessMessage('')
    setErrors({})

    if (!validateForm()) {
      return
    }

    const result = await inviteEmployee.mutateAsync({
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      jobTitle: jobTitle.trim(),
      managerId: managerId || undefined,
      departmentId: departmentId || undefined,
      startDate,
    })

    if (result.success) {
      setSuccessMessage(`Invitation sent successfully to ${result.email}!`)
      
      // Reset form after 2 seconds and close dialog
      setTimeout(() => {
        setEmail('')
        setFirstName('')
        setLastName('')
        setJobTitle('')
        setManagerId('')
        setDepartmentId('')
        setDepartmentAutoFilled(false)
        setStartDate(new Date().toISOString().split('T')[0])
        setSuccessMessage('')
        setErrors({})
        onOpenChange(false)
      }, 2000)
    } else {
      setErrors({ submit: result.error || 'Failed to send invitation' })
    }
  }

  const handleCancel = () => {
    setEmail('')
    setFirstName('')
    setLastName('')
    setJobTitle('')
    setManagerId('')
    setDepartmentId('')
    setDepartmentAutoFilled(false)
    setStartDate(new Date().toISOString().split('T')[0])
    setSuccessMessage('')
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Invite New Employee</DialogTitle>
          <DialogDescription>
            Send an invitation email with a magic link to create their account and set up their password.
          </DialogDescription>
        </DialogHeader>

        {successMessage ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-center text-lg font-medium text-green-700">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteEmployee.isPending}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={inviteEmployee.isPending}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={inviteEmployee.isPending}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTitle">
                Job Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jobTitle"
                type="text"
                placeholder="Software Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                disabled={inviteEmployee.isPending}
              />
              {errors.jobTitle && (
                <p className="text-sm text-destructive">{errors.jobTitle}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager">Manager</Label>
              <select
                id="manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={inviteEmployee.isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">No Manager</option>
                {profiles?.filter((p) => p.is_manager).map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} - {profile.job_title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <CascadingDepartmentSelect
                departments={departments || []}
                value={departmentId}
                onChange={handleDepartmentChange}
                disabled={inviteEmployee.isPending}
                autoFilledNote={departmentAutoFilled ? '(auto-filled from manager)' : undefined}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={inviteEmployee.isPending}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate}</p>
              )}
            </div>

            {errors.submit && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{errors.submit}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={inviteEmployee.isPending}
                className="flex-1"
              >
                {inviteEmployee.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Invitation
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={inviteEmployee.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
