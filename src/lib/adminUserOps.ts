import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface AdminInvokeError {
  message: string
  status: number
  body?: any
}

async function invokeWithToken<T = any>(
  token: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: AdminInvokeError | null }> {
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-user-ops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let payload: any = null
  try {
    payload = await response.json()
  } catch (_) {
    payload = null
  }

  if (response.ok) {
    return { data: payload as T, error: null }
  }

  return {
    data: payload as T,
    error: {
      message: payload?.error || payload?.message || `Request failed (${response.status})`,
      status: response.status,
      body: payload,
    },
  }
}

export async function invokeAdminUserOps<T = any>(body: Record<string, unknown>) {
  // Ensure auth state is hydrated/refreshed before calling protected edge functions.
  await supabase.auth.getUser()

  let { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    throw new Error('No active auth session. Please sign out and sign in again.')
  }

  let response = await invokeWithToken<T>(session.access_token, body)
  if (!response.error) return response

  const invalidJwt =
    response.error.status === 401 &&
    ((response.error.body?.message ?? response.error.message).toLowerCase().includes('invalid jwt'))
  if (!invalidJwt) return response

  // Token can be stale in local cookie storage; refresh and retry once.
  const { data: refreshedData } = await supabase.auth.refreshSession()
  const refreshedToken = refreshedData.session?.access_token
  if (!refreshedToken || refreshedToken === session.access_token) {
    return response
  }

  response = await invokeWithToken<T>(refreshedToken, body)
  return response
}
