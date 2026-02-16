import type { Profile } from '../../types'
import { Card, CardContent, CardHeader } from '../ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { getInitials, formatDate } from '../../lib/utils'
import { Mail, Phone, MapPin, Calendar, Linkedin, Twitter, Github } from 'lucide-react'

interface ProfileCardProps {
  profile: Profile
  showContactInfo?: boolean
}

export function ProfileCard({ profile, showContactInfo = true }: ProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {profile.profile_photo_url && (
              <AvatarImage src={profile.profile_photo_url} alt={profile.full_name} />
            )}
            <AvatarFallback className="text-xl">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{profile.full_name}</h2>
            <p className="text-muted-foreground">{profile.job_title}</p>
            {profile.department && (
              <Badge 
                className="mt-2"
                style={{ backgroundColor: profile.department.color }}
              >
                {profile.department.name}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {profile.job_description && (
          <div>
            <h3 className="font-semibold mb-2">About</h3>
            <p className="text-sm text-muted-foreground">{profile.job_description}</p>
          </div>
        )}

        {showContactInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${profile.email}`} className="hover:underline">
                {profile.email}
              </a>
            </div>

            {profile.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${profile.phone}`} className="hover:underline">
                  {profile.phone}
                </a>
              </div>
            )}

            {profile.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{profile.location}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Started {formatDate(profile.start_date)}</span>
            </div>
          </div>
        )}

        {profile.social_links && (
          <div className="flex gap-3 pt-2">
            {profile.social_links.linkedin && (
              <a
                href={profile.social_links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            )}
            {profile.social_links.twitter && (
              <a
                href={profile.social_links.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Twitter className="h-5 w-5" />
              </a>
            )}
            {profile.social_links.github && (
              <a
                href={profile.social_links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
            )}
          </div>
        )}

        {profile.manager && (
          <div>
            <h3 className="font-semibold mb-2">Reports to</h3>
            <p className="text-sm">
              {profile.manager.full_name} - {profile.manager.job_title}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
