export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          job_title: string
          job_description: string | null
          start_date: string
          profile_photo_url: string | null
          phone: string | null
          location: string | null
          department_id: string | null
          manager_id: string | null
          social_links: Json | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          job_title: string
          job_description?: string | null
          start_date: string
          profile_photo_url?: string | null
          phone?: string | null
          location?: string | null
          department_id?: string | null
          manager_id?: string | null
          social_links?: Json | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          job_title?: string
          job_description?: string | null
          start_date?: string
          profile_photo_url?: string | null
          phone?: string | null
          location?: string | null
          department_id?: string | null
          manager_id?: string | null
          social_links?: Json | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      departments: {
        Row: {
          id: string
          name: string
          color: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          description?: string | null
          created_at?: string
        }
      }
      org_chart_positions: {
        Row: {
          id: string
          profile_id: string
          x_position: number
          y_position: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          profile_id: string
          x_position: number
          y_position: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          profile_id?: string
          x_position?: number
          y_position?: number
          updated_at?: string
          updated_by?: string
        }
      }
      share_links: {
        Row: {
          id: string
          slug: string
          root_profile_id: string
          include_contact_info: boolean
          expires_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          root_profile_id: string
          include_contact_info?: boolean
          expires_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          root_profile_id?: string
          include_contact_info?: boolean
          expires_at?: string | null
          created_by?: string
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          action: string
          profile_id: string
          changed_by: string
          changes: Json
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          profile_id: string
          changed_by: string
          changes: Json
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          profile_id?: string
          changed_by?: string
          changes?: Json
          created_at?: string
        }
      }
    }
    Functions: {
      get_profile_branch: {
        Args: { profile_id: string }
        Returns: {
          id: string
          email: string
          full_name: string
          job_title: string
          job_description: string | null
          start_date: string
          profile_photo_url: string | null
          phone: string | null
          location: string | null
          department_id: string | null
          manager_id: string | null
          social_links: Json | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }[]
      }
    }
  }
}
