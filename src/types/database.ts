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
          preferred_name: string | null
          job_title: string
          job_description: string | null
          bio: string | null
          start_date: string
          birthday: string | null
          profile_photo_url: string | null
          phone: string | null
          location: string | null
          department_id: string | null
          manager_id: string | null
          social_links: Json | null
          is_admin: boolean
          is_manager: boolean
          is_executive: boolean
          is_super_admin: boolean
          is_process_editor: boolean
          onboarding_completed: boolean
          has_logged_in: boolean
          last_sign_in_at: string | null
          employment_status: 'active' | 'terminated'
          terminated_at: string | null
          termination_effective_at: string | null
          termination_reason: string | null
          terminated_by: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          preferred_name?: string | null
          job_title: string
          job_description?: string | null
          bio?: string | null
          start_date: string
          birthday?: string | null
          profile_photo_url?: string | null
          phone?: string | null
          location?: string | null
          department_id?: string | null
          manager_id?: string | null
          social_links?: Json | null
          is_admin?: boolean
          is_manager?: boolean
          is_executive?: boolean
          is_super_admin?: boolean
          is_process_editor?: boolean
          onboarding_completed?: boolean
          has_logged_in?: boolean
          last_sign_in_at?: string | null
          employment_status?: 'active' | 'terminated'
          terminated_at?: string | null
          termination_effective_at?: string | null
          termination_reason?: string | null
          terminated_by?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          preferred_name?: string | null
          job_title?: string
          job_description?: string | null
          bio?: string | null
          start_date?: string
          birthday?: string | null
          profile_photo_url?: string | null
          phone?: string | null
          location?: string | null
          department_id?: string | null
          manager_id?: string | null
          social_links?: Json | null
          is_admin?: boolean
          is_manager?: boolean
          is_executive?: boolean
          is_super_admin?: boolean
          is_process_editor?: boolean
          onboarding_completed?: boolean
          has_logged_in?: boolean
          last_sign_in_at?: string | null
          employment_status?: 'active' | 'terminated'
          terminated_at?: string | null
          termination_effective_at?: string | null
          termination_reason?: string | null
          terminated_by?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_department_id_fkey'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_manager_id_fkey'
            columns: ['manager_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          color: string
          description: string | null
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          description?: string | null
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          description?: string | null
          parent_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'departments_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'org_chart_positions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'org_chart_positions_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'share_links_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'share_links_root_profile_id_fkey'
            columns: ['root_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'audit_logs_changed_by_fkey'
            columns: ['changed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      organization_settings: {
        Row: {
          id: string
          logo_url: string | null
          updated_by: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          logo_url?: string | null
          updated_by: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          logo_url?: string | null
          updated_by?: string
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      processes: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'processes_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      process_nodes: {
        Row: {
          id: string
          process_id: string
          node_type: string
          label: string
          description: string | null
          document_links: string[]
          x_position: number
          y_position: number
          tagged_profile_ids: string[]
          tagged_department_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          node_type?: string
          label?: string
          description?: string | null
          document_links?: string[]
          x_position?: number
          y_position?: number
          tagged_profile_ids?: string[]
          tagged_department_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          process_id?: string
          node_type?: string
          label?: string
          description?: string | null
          document_links?: string[]
          x_position?: number
          y_position?: number
          tagged_profile_ids?: string[]
          tagged_department_ids?: string[]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'process_nodes_process_id_fkey'
            columns: ['process_id']
            isOneToOne: false
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
        ]
      }
      process_edges: {
        Row: {
          id: string
          process_id: string
          source_node_id: string
          target_node_id: string
          label: string | null
          waypoints: Json | null
          source_side: string | null
          target_side: string | null
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          source_node_id: string
          target_node_id: string
          label?: string | null
          waypoints?: Json | null
          source_side?: string | null
          target_side?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          process_id?: string
          source_node_id?: string
          target_node_id?: string
          label?: string | null
          waypoints?: Json | null
          source_side?: string | null
          target_side?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'process_edges_process_id_fkey'
            columns: ['process_id']
            isOneToOne: false
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'process_edges_source_node_id_fkey'
            columns: ['source_node_id']
            isOneToOne: false
            referencedRelation: 'process_nodes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'process_edges_target_node_id_fkey'
            columns: ['target_node_id']
            isOneToOne: false
            referencedRelation: 'process_nodes'
            referencedColumns: ['id']
          },
        ]
      }
      process_share_links: {
        Row: {
          id: string
          slug: string
          process_id: string
          created_by: string
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          process_id: string
          created_by: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          slug?: string
          process_id?: string
          created_by?: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'process_share_links_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'process_share_links_process_id_fkey'
            columns: ['process_id']
            isOneToOne: false
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
        ]
      }
      process_edit_locks: {
        Row: {
          process_id: string
          locked_by: string
          locked_by_name: string
          locked_at: string
        }
        Insert: {
          process_id: string
          locked_by: string
          locked_by_name: string
          locked_at?: string
        }
        Update: {
          process_id?: string
          locked_by?: string
          locked_by_name?: string
          locked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'process_edit_locks_locked_by_fkey'
            columns: ['locked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'process_edit_locks_process_id_fkey'
            columns: ['process_id']
            isOneToOne: true
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_profile_branch: {
        Args: { user_id: string }
        Returns: {
          id: string
          email: string
          full_name: string
          preferred_name: string | null
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
          is_manager: boolean
          is_executive: boolean
          is_super_admin: boolean
          is_process_editor: boolean
          onboarding_completed: boolean
          employment_status: 'active' | 'terminated'
          terminated_at: string | null
          termination_effective_at: string | null
          termination_reason: string | null
          terminated_by: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }[]
      }
      get_public_org_share_bundle: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_public_process_bundle: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_manager_team: {
        Args: { p_manager_id: string }
        Returns: {
          id: string
          email: string
          full_name: string
          preferred_name: string | null
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
          is_manager: boolean
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }[]
      }
      can_edit_process_for_lock: {
        Args: {
          p_process_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_admin_like: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      acquire_process_edit_lock: {
        Args: { p_process_id: string }
        Returns: {
          acquired: boolean
          process_id: string
          locked_by: string
          locked_by_name: string
          locked_at: string
          message: string
        }[]
      }
      force_takeover_process_edit_lock: {
        Args: { p_process_id: string }
        Returns: {
          acquired: boolean
          process_id: string
          locked_by: string
          locked_by_name: string
          locked_at: string
          message: string
        }[]
      }
      release_process_edit_lock: {
        Args: { p_process_id: string }
        Returns: {
          released: boolean
          process_id: string
          locked_by: string | null
          locked_by_name: string | null
          locked_at: string | null
          message: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
