import { useState, useMemo } from 'react'
import type { Profile } from '../../types'
import { Input } from '../ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Search, X } from 'lucide-react'
import { Button } from '../ui/button'

interface EmployeeSearchProps {
  profiles: Profile[]
  onSelectEmployee: (profileId: string) => void
}

export function EmployeeSearch({ profiles, onSelectEmployee }: EmployeeSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)

  const departments = useMemo(() => {
    const depts = new Map<string, { id: string; name: string; color: string }>()
    profiles.forEach((profile) => {
      if (profile.department) {
        depts.set(profile.department.id, profile.department)
      }
    })
    return Array.from(depts.values())
  }, [profiles])

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const matchesSearch =
        searchQuery === '' ||
        profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.email.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesDepartment =
        !selectedDepartment || profile.department_id === selectedDepartment

      return matchesSearch && matchesDepartment
    })
  }, [profiles, searchQuery, selectedDepartment])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={() => setSearchQuery('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {departments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedDepartment === null ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedDepartment(null)}
          >
            All
          </Badge>
          {departments.map((dept) => (
            <Badge
              key={dept.id}
              variant={selectedDepartment === dept.id ? 'default' : 'outline'}
              className="cursor-pointer"
              style={
                selectedDepartment === dept.id
                  ? { backgroundColor: dept.color, color: 'white' }
                  : undefined
              }
              onClick={() => setSelectedDepartment(dept.id)}
            >
              {dept.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredProfiles.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No employees found</p>
        ) : (
          filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => onSelectEmployee(profile.id)}
            >
              <Avatar>
                {profile.profile_photo_url && (
                  <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
                )}
                <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">{profile.job_title}</p>
              </div>

              {profile.department && (
                <Badge style={{ backgroundColor: profile.department.color, color: 'white' }}>
                  {profile.department.name}
                </Badge>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
