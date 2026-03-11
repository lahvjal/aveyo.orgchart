import { supabase } from './supabase'

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

async function invokeWithSession<T = unknown>(
  body: Record<string, unknown>,
  accessToken?: string
): Promise<{ data: T | null; error: AdminInvokeError | null }> {
  const invokeOptions: { body: Record<string, unknown>; headers?: Record<string, string> } = { body }
  if (accessToken) {
    invokeOptions.headers = { Authorization: `Bearer ${accessToken}` }
  }

  const { data, error } = await supabase.functions.invoke('admin-user-ops', invokeOptions)
  if (!error) {
    return { data: (data ?? null) as T | null, error: null }
  }

  let payload: unknown = null
  const responseLike = (error as { context?: Response } | null)?.context
  if (responseLike) {
    try {
      payload = await responseLike.clone().json()
    } catch {
      payload = null
    }
  }

  const errorPayload = asAdminErrorPayload(payload)
  const status = responseLike?.status ?? 0

  return {
    data: (data ?? null) as T | null,
    error: {
      message: mapAdminErrorMessage(
        errorPayload?.code,
        errorPayload?.error || errorPayload?.message || error.message || `Request failed (${status || 'network'})`
      ),
      status,
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
  // For privileged edge calls, proactively refresh once to avoid stale token
  // edge cases seen on first-page-load after app hydration.
  const { data: proactivelyRefreshed } = await supabase.auth.refreshSession()
  if (proactivelyRefreshed.session?.access_token) {
    session = proactivelyRefreshed.session
  }

  if (!session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    session = refreshed.session
  }

  if (!session?.access_token) {
    throw new Error('No active auth session. Please sign out and sign in again.')
  }

  let response = await invokeWithSession<T>(body, session.access_token)
  if (!response.error) return response

  // Edge gateway responses can return generic 401 payloads for expired/invalid tokens.
  // Refresh and retry once on any 401 to recover from stale session state.
  if (response.error.status !== 401) return response

  // Token can be stale in local cookie storage; refresh and retry once.
  const { data: refreshedData } = await supabase.auth.refreshSession()
  const refreshedToken = refreshedData.session?.access_token
  if (!refreshedToken || refreshedToken === session.access_token) {
    return response
  }

  response = await invokeWithSession<T>(body, refreshedToken)
  return response
}
