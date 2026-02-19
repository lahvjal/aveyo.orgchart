import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { usePermissions } from '../../hooks/usePermissions'
import { useOrganizationSettings } from '../../lib/queries'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { getInitials } from '../../lib/utils'
import { LogOut, Menu, X } from 'lucide-react'

export function Header() {
  const { signOut } = useAuth()
  const { data: profile } = useProfile()
  const { isAdmin, isManager, isExecutive, isSuperAdmin } = usePermissions()
  const { data: orgSettings } = useOrganizationSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSignOut = async () => {
    setMobileMenuOpen(false)
    await signOut()
    navigate('/login')
  }

  const navLinkClass = (path: string) =>
    `text-sm transition-colors ${
      location.pathname === path
        ? 'text-foreground font-medium'
        : 'text-muted-foreground hover:text-foreground'
    }`

  const mobileNavLinkClass = (path: string) =>
    `block px-4 py-3 text-base transition-colors border-b border-border last:border-0 ${
      location.pathname === path
        ? 'text-foreground font-medium bg-accent'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
    }`

  const navLinks = (
    <>
      <Link to="/dashboard" className={navLinkClass('/dashboard')}>Org Chart</Link>
      <Link to="/profile" className={navLinkClass('/profile')}>My Profile</Link>
      <Link to="/processes" className={navLinkClass('/processes')}>Processes</Link>
      {isManager && (
        <Link to="/manager" className={navLinkClass('/manager')}>Manager Panel</Link>
      )}
      {isAdmin && (
        <Link to="/admin" className={navLinkClass('/admin')}>Admin Panel</Link>
      )}
      {(isExecutive || isSuperAdmin) && (
        <a
          href="https://kpi.aveyo.com"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          KPI Dashboard
        </a>
      )}
    </>
  )

  const mobileNavLinks = (
    <>
      <Link to="/dashboard" className={mobileNavLinkClass('/dashboard')} onClick={() => setMobileMenuOpen(false)}>Org Chart</Link>
      <Link to="/profile" className={mobileNavLinkClass('/profile')} onClick={() => setMobileMenuOpen(false)}>My Profile</Link>
      <Link to="/processes" className={mobileNavLinkClass('/processes')} onClick={() => setMobileMenuOpen(false)}>Processes</Link>
      {isManager && (
        <Link to="/manager" className={mobileNavLinkClass('/manager')} onClick={() => setMobileMenuOpen(false)}>Manager Panel</Link>
      )}
      {isAdmin && (
        <Link to="/admin" className={mobileNavLinkClass('/admin')} onClick={() => setMobileMenuOpen(false)}>Admin Panel</Link>
      )}
      {(isExecutive || isSuperAdmin) && (
        <a
          href="https://kpi.aveyo.com"
          className="block px-4 py-3 text-base text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={() => setMobileMenuOpen(false)}
        >
          KPI Dashboard
        </a>
      )}
    </>
  )

  return (
    <>
      <header className="border-b bg-white relative z-40">
        <div className="mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center">
              {orgSettings?.logo_url ? (
                <img
                  src={orgSettings.logo_url}
                  alt="Organization logo"
                  className="h-8 object-contain"
                />
              ) : (
                <span className="font-bold text-xl">OrgChart</span>
              )}
            </Link>
            <nav className="hidden md:flex gap-4">
              {navLinks}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {profile && (
              <div className="flex items-center gap-3">
                <Link to="/profile">
                  <Avatar className="cursor-pointer">
                    {profile.profile_photo_url && (
                      <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
                    )}
                    <AvatarFallback>
                      {getInitials(profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground">{profile.job_title}</p>
                </div>
              </div>
            )}

            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Hamburger — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile slide-down drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed top-16 left-0 right-0 z-40 bg-white border-b shadow-lg md:hidden">
            <nav className="flex flex-col">
              {mobileNavLinks}
            </nav>
            {profile && (
              <div className="px-4 py-3 border-t border-border bg-muted/30">
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.job_title}</p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
