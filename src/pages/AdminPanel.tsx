import { useState } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { Navigate } from 'react-router-dom'
import { DepartmentManager } from '../components/admin/DepartmentManager'
import { UserManagement } from '../components/admin/UserManagement'
import { ShareLinkManager } from '../components/admin/ShareLinkManager'
import { LogoUpload } from '../components/admin/LogoUpload'
import { Button } from '../components/ui/button'
import { Building2, Users, Share2, Palette } from 'lucide-react'

type Tab = 'departments' | 'users' | 'sharing' | 'branding'

export default function AdminPanel() {
  const { isAdmin, isLoading } = usePermissions()
  const [activeTab, setActiveTab] = useState<Tab>('users')

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <div className="flex gap-2 mb-6 border-b">
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="rounded-b-none"
        >
          <Users className="mr-2 h-4 w-4" />
          Users
        </Button>
        <Button
          variant={activeTab === 'departments' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('departments')}
          className="rounded-b-none"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Departments
        </Button>
        <Button
          variant={activeTab === 'sharing' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('sharing')}
          className="rounded-b-none"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Sharing
        </Button>
        <Button
          variant={activeTab === 'branding' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('branding')}
          className="rounded-b-none"
        >
          <Palette className="mr-2 h-4 w-4" />
          Branding
        </Button>
      </div>

      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'departments' && <DepartmentManager />}
      {activeTab === 'sharing' && <ShareLinkManager />}
      {activeTab === 'branding' && <LogoUpload />}
    </div>
  )
}
