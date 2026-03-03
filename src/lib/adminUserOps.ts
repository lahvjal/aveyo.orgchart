import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

interface AdminInvokeError {
  message: string
  status: number
  code?: string
  requestId?: string
  body?: unknown
}

interface AdminErrorPayload {
  error?: string
  message?: string
  code?: string
  requestId?: string
}

function asAdminErrorPayload(value: unknown): AdminErrorPayload | null {
  if (!value || typeof value !== 'object') return null
  return value as AdminErrorPayload
}

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  AUTHZ_ROLE_DENIED: 'You do not have permission to perform this action.',
  AUTHZ_SCOPE_DENIED: 'You do not have permission to perform this action on this user/resource.',
  AUTHZ_FIELD_DENIED: 'You do not have permission to modify one or more requested fields.',
  REQUESTER_MISMATCH: 'Your session could not be verified. Please sign out and sign in again.',
  INVALID_JWT: 'Your session has expired. Please sign in again.',
  TARGET_NOT_FOUND: 'The requested user/resource could not be found.',
  TARGET_REQUIRED: 'A required target user/resource was missing from the request.',
}

function mapAdminErrorMessage(code: string | undefined, fallback: string) {
  if (!code) return fallback
  return ADMIN_ERROR_MESSAGES[code] || fallback
}

async function invokeWithToken<T = unknown>(
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

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const errorPayload = asAdminErrorPayload(payload)

  if (response.ok) {
    return { data: payload as T, error: null }
  }

  return {
    data: payload as T,
    error: {
      message: mapAdminErrorMessage(
        errorPayload?.code,
        errorPayload?.error || errorPayload?.message || `Request failed (${response.status})`
      ),
      status: response.status,
      code: errorPayload?.code,
      requestId: errorPayload?.requestId,
      body: payload,
    },
  }
}

export function getAdminErrorMessage(
  data: unknown,
  error: AdminInvokeError | null,
  fallback = 'Request failed'
) {
  const payload = asAdminErrorPayload(data) || asAdminErrorPayload(error?.body) || {}
  const code = payload.code || error?.code
  const requestId = payload.requestId || error?.requestId

  const baseMessage = mapAdminErrorMessage(
    code,
    payload.error || error?.message || fallback
  )

  if (!requestId) return baseMessage
  return `${baseMessage} (ref: ${requestId})`
}

export async function invokeAdminUserOps<T = unknown>(body: Record<string, unknown>) {
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
    (((asAdminErrorPayload(response.error.body)?.message ?? response.error.message) || '')
      .toLowerCase()
      .includes('invalid jwt'))
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
