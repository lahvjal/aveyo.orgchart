export interface Profile {
  id: string
  email: string
  full_name: string
  preferred_name?: string | null
  job_title: string
  job_description: string | null
  bio?: string | null
  start_date: string
  profile_photo_url: string | null
  phone: string | null
  location: string | null
  department_id: string | null
  manager_id: string | null
  social_links: SocialLinks | null
  is_admin: boolean
  onboarding_completed?: boolean
  created_at: string
  updated_at: string
  department?: Department
  manager?: Profile
}

export interface SocialLinks {
  linkedin?: string
  instagram?: string
  facebook?: string
}

export interface Department {
  id: string
  name: string
  color: string
  description: string | null
  created_at: string
}

export interface OrgChartPosition {
  id: string
  profile_id: string
  x_position: number
  y_position: number
  updated_at: string
  updated_by: string
}

export interface ShareLink {
  id: string
  slug: string
  root_profile_id: string
  include_contact_info: boolean
  expires_at: string | null
  created_by: string
  created_at: string
}

export interface AuditLog {
  id: string
  action: string
  profile_id: string
  changed_by: string
  changes: Record<string, any>
  created_at: string
}

export interface EmployeeNode {
  id: string
  profile: Profile
  position: { x: number; y: number }
  reports: EmployeeNode[]
}
