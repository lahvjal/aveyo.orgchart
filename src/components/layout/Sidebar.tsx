import { Link, useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { useOrganizationSettings } from '../../lib/queries'
import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  GitBranch,
  ShieldCheck,
  Users,
  BarChart2,
  LogOut,
} from 'lucide-react'

export function Sidebar() {
  const location = useLocation()
  const { isAdmin, isManager, isExecutive } = usePermissions()
  const { data: orgSettings } = useOrganizationSettings()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/dashboard', label: 'Org Chart', icon: LayoutDashboard, always: true },
    { to: '/profile', label: 'My Profile', icon: User, always: true },
    { to: '/processes', label: 'Processes', icon: GitBranch, always: true },
    { to: '/manager', label: 'Manager Panel', icon: Users, always: false, show: isManager },
    { to: '/admin', label: 'Admin Panel', icon: ShieldCheck, always: false, show: isAdmin },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <aside className="w-52 shrink-0 h-screen bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-100">
        {orgSettings?.logo_url ? (
          <img
            src={orgSettings.logo_url}
            alt="Organization logo"
            className="h-7 object-contain"
          />
        ) : (
          <span className="font-bold text-lg text-slate-900">OrgChart</span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, always, show }) => {
          if (!always && !show) return null
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {(isExecutive || isAdmin) && (
          <a
            href="https://kpi.aveyo.com"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <BarChart2 className="h-4 w-4 shrink-0" />
            KPI Dashboard
          </a>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-2 pb-4">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
