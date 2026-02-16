import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import type { Profile } from '../../types'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials } from '../../lib/utils'
import { Mail } from 'lucide-react'

interface EmployeeNodeData {
  profile: Profile
}

export const EmployeeNode = memo(({ data }: NodeProps<EmployeeNodeData>) => {
  const { profile } = data

  return (
    <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 hover:border-primary transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-12 w-12">
            {profile.profile_photo_url && (
              <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
            )}
            <AvatarFallback className="text-sm">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{profile.full_name}</h3>
            <p className="text-xs text-muted-foreground truncate">{profile.job_title}</p>
          </div>
        </div>

        {profile.department && (
          <Badge
            className="text-xs"
            style={{ 
              backgroundColor: profile.department.color,
              color: 'white',
            }}
          >
            {profile.department.name}
          </Badge>
        )}

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span className="truncate">{profile.email}</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
})

EmployeeNode.displayName = 'EmployeeNode'
