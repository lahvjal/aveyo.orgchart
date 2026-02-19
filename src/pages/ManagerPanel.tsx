import { usePermissions } from '../hooks/usePermissions'
import { Navigate } from 'react-router-dom'
import { ManagerUserManagement } from '../components/manager/ManagerUserManagement'
import { usePageTitle } from '../hooks/usePageTitle'

export default function ManagerPanel() {
  usePageTitle('Manager Panel')
  const { isManager, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!isManager) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Manager Panel</h1>
      <p className="text-muted-foreground mb-6">
        Manage your team members. You can edit team member details and invite new employees to your team.
      </p>

      <ManagerUserManagement />
    </div>
  )
}
