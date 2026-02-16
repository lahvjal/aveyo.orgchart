import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { usePermissions } from '../../hooks/usePermissions'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { getInitials } from '../../lib/utils'
import { LogOut } from 'lucide-react'

export function Header() {
  const { signOut } = useAuth()
  const { data: profile } = useProfile()
  const { isAdmin } = usePermissions()
  const navigate = useNavigate()

  console.log('Header: profile:', profile)
  console.log('Header: isAdmin:', isAdmin, 'profile?.is_admin:', profile?.is_admin)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="font-bold text-xl">
            OrgChart
          </Link>
          <nav className="hidden md:flex gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Org Chart
            </Link>
            <Link
              to="/profile"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              My Profile
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Admin Panel
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </header>
  )
}
