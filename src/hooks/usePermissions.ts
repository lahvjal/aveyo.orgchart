import { useProfile } from './useProfile'

export function usePermissions() {
  const { data: profile, isLoading } = useProfile()

  console.log('usePermissions: profile data:', profile)
  console.log('usePermissions: is_admin value:', profile?.is_admin)
  console.log('usePermissions: returning isAdmin:', profile?.is_admin || false)

  return {
    isAdmin: profile?.is_admin || false,
    canEditProfile: (profileId: string) => {
      return profile?.is_admin || profile?.id === profileId
    },
    canEditOrgChart: profile?.is_admin || false,
    canManageDepartments: profile?.is_admin || false,
    canCreateShareLinks: profile?.is_admin || false,
    canViewAuditLogs: profile?.is_admin || false,
    isLoading,
  }
}
