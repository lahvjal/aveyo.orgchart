import { useProfile } from './useProfile'
import { useProfiles } from './useProfile'
import { useMemo } from 'react'
import type { Profile } from '../types'

export function usePermissions() {
  const { data: profile, isLoading } = useProfile()
  const { data: allProfiles } = useProfiles()

  console.log('usePermissions: profile data:', profile)
  console.log('usePermissions: is_admin value:', profile?.is_admin)
  console.log('usePermissions: is_manager value:', profile?.is_manager)
  console.log('usePermissions: returning isAdmin:', profile?.is_admin || false)
  console.log('usePermissions: returning isManager:', profile?.is_manager || false)

  // Helper function to get team members (direct and indirect reports)
  const getTeamMembers = useMemo(() => {
    if (!profile?.is_manager || !allProfiles) {
      return []
    }

    // Recursively find all team members
    const findTeamMembers = (managerId: string, visited = new Set<string>()): Profile[] => {
      if (visited.has(managerId)) {
        return [] // Prevent infinite loops
      }
      visited.add(managerId)

      const directReports = allProfiles.filter(p => p.manager_id === managerId)
      const allReports: Profile[] = [...directReports]

      // Recursively get indirect reports
      directReports.forEach(report => {
        allReports.push(...findTeamMembers(report.id, visited))
      })

      return allReports
    }

    return findTeamMembers(profile.id)
  }, [profile?.id, profile?.is_manager, allProfiles])

  const isSuperAdmin = profile?.is_super_admin || false
  const isAdmin = profile?.is_admin || isSuperAdmin

  return {
    isAdmin,
    isManager: profile?.is_manager || false,
    isExecutive: profile?.is_executive || false,
    isSuperAdmin,
    canEditProfile: (profileId: string) => {
      return isAdmin || profile?.id === profileId
    },
    canEditTeamMember: (profileId: string) => {
      if (isAdmin) return true
      if (!profile?.is_manager) return false
      return getTeamMembers.some(member => member.id === profileId)
    },
    canManageTeam: isAdmin || profile?.is_manager || false,
    canEditOrgChart: isAdmin,
    canManageDepartments: isAdmin,
    canCreateShareLinks: isAdmin,
    canViewAuditLogs: isAdmin,
    getTeamMembers: () => getTeamMembers || [],
    isLoading,
  }
}
