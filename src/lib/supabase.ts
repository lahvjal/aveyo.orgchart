import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { supabaseCookieStorage } from './supabaseCookieStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Uses shared .aveyo.com cookie so session is readable by both
// orgchart.aveyo.com and kpi.aveyo.com simultaneously
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseCookieStorage,
    storageKey: 'sb-aveyo-auth',
    autoRefreshToken: true,
    persistSession: true,
  },
})
