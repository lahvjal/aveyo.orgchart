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

  return {
    isAdmin: profile?.is_admin || false,
    isManager: profile?.is_manager || false,
    canEditProfile: (profileId: string) => {
      return profile?.is_admin || profile?.id === profileId
    },
    canEditTeamMember: (profileId: string) => {
      if (profile?.is_admin) return true
      if (!profile?.is_manager) return false
      return getTeamMembers.some(member => member.id === profileId)
    },
    canManageTeam: profile?.is_admin || profile?.is_manager || false,
    canEditOrgChart: profile?.is_admin || false,
    canManageDepartments: profile?.is_admin || false,
    canCreateShareLinks: profile?.is_admin || false,
    canViewAuditLogs: profile?.is_admin || false,
    getTeamMembers: () => getTeamMembers || [],
    isLoading,
  }
}
