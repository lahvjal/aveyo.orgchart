import type { Profile } from '../../types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { AdminUserEditor } from './AdminUserEditor'

interface AdminUserEditorDialogProps {
  profile: Profile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminUserEditorDialog({ profile, open, onOpenChange }: AdminUserEditorDialogProps) {
  return (
    <Dialog open={open && !!profile} onOpenChange={onOpenChange}>
      <DialogContent className="w-[70vw] max-w-[70vw]">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        {profile && (
          <AdminUserEditor
            profile={profile}
            onSaved={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
