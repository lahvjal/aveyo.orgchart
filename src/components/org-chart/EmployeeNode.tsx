import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import type { Profile } from '../../types'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Mail } from 'lucide-react'

interface EmployeeNodeData {
  profile: Profile
}

export const EmployeeNode = memo(({ data }: NodeProps<EmployeeNodeData>) => {
  const { profile } = data

  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:border-primary transition-colors overflow-hidden w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-primary" />

      {/* Full-width photo */}
      <div className="w-full h-[150px] bg-gray-100 flex-shrink-0">
        {profile.profile_photo_url ? (
          <img
            src={profile.profile_photo_url}
            alt={profile.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-4xl font-semibold">
            {getInitials(profile.full_name)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{profile.full_name}</h3>
        <p className="text-xs text-muted-foreground truncate mb-2">{profile.job_title}</p>

        {profile.department && (
          <Badge
            className="text-xs mb-2"
            style={{
              backgroundColor: profile.department.color,
              color: 'white',
            }}
          >
            {profile.department.name}
          </Badge>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{profile.email}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
})

EmployeeNode.displayName = 'EmployeeNode'
