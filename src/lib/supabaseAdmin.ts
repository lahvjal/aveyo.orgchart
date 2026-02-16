import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Missing Supabase admin environment variables - admin features will be unavailable')
}

/**
 * Supabase Admin Client with service role access
 * 
 * WARNING: This client bypasses Row Level Security (RLS) policies.
 * Only use this client for admin operations that require elevated privileges.
 * 
 * Current uses:
 * - Creating user accounts (auth.admin.createUser)
 * - Generating magic links (auth.admin.generateLink)
 * 
 * SECURITY: Only call from admin-protected contexts where isAdmin is verified
 */
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null
