/**
 * admin-user-ops – Server-side admin operations using the service role key.
 * Handles: createUser, generateLink, deleteUser, terminateEmployee, listUsers, updateProfile
 *
 * The service role key MUST NOT be in the client bundle.
 * All auth.admin operations are proxied through this edge function.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

type AdminAction =
  | 'createUser'
  | 'generateLink'
  | 'deleteUser'
  | 'terminateEmployee'
  | 'listUsers'
  | 'updateProfile'

interface RequesterProfile {
  id: string
  full_name: string | null
  is_admin: boolean | null
  is_manager: boolean | null
  is_super_admin: boolean | null
}

function logEvent(event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      ...details,
    })
  )
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const token = authHeader.slice('bearer '.length).trim()
  return token || null
}

function normalizedEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email) return null
  return email
}

function sanitizeRedirectTo(raw: unknown, fallbackPath: string): string {
  const appUrl = (Deno.env.get('APP_URL') || 'https://orgchart.aveyo.com').replace(/\/+$/, '')
  const fallback = `${appUrl}${fallbackPath}`

  if (typeof raw !== 'string' || !raw.trim()) {
    return fallback
  }

  try {
    const base = new URL(appUrl)
    const candidate = new URL(raw, appUrl)
    if (candidate.origin !== base.origin) return fallback
    return candidate.toString()
  } catch {
    return fallback
  }
}

async function getRequesterProfile(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  return supabaseAdmin
    .from('profiles')
    .select('id, full_name, is_admin, is_manager, is_super_admin')
    .eq('id', userId)
    .single<RequesterProfile>()
}

async function getManagedUserIds(supabaseAdmin: ReturnType<typeof createClient>, managerId: string) {
  const managed = new Set<string>()
  let frontier: string[] = [managerId]

  while (frontier.length > 0) {
    const batch = frontier.slice(0, 200)
    frontier = frontier.slice(200)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('manager_id', batch)

    if (error) throw error

    for (const row of data ?? []) {
      if (!managed.has(row.id)) {
        managed.add(row.id)
        frontier.push(row.id)
      }
    }
  }

  return managed
}

serve(async (req) => {
  const requestId = crypto.randomUUID()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', requestId }, 405)
  }

  try {
    const body = await req.json()
    const action = body?.action as AdminAction | undefined
    const claimedUserId = body?.userId as string | undefined

    if (!action) {
      return jsonResponse({ error: 'action is required', code: 'ACTION_REQUIRED', requestId }, 400)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const accessToken = getBearerToken(req)
    if (!accessToken) {
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData?.user) {
      logEvent('auth_token_invalid', {
        requestId,
        action,
        authError: authError?.message ?? null,
      })
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const userId = authData.user.id
    if (claimedUserId && claimedUserId !== userId) {
      logEvent('auth_requester_mismatch', {
        requestId,
        action,
        tokenUserId: userId,
        claimedUserId,
      })
      return jsonResponse({ error: 'Requester mismatch', code: 'REQUESTER_MISMATCH', requestId }, 403)
    }

    const { data: requesterProfile, error: profileError } = await getRequesterProfile(supabaseAdmin, userId)
    if (profileError || !requesterProfile) {
      logEvent('auth_requester_profile_missing', {
        requestId,
        action,
        userId,
        profileError: profileError?.message ?? null,
      })
      return jsonResponse(
        { error: 'Could not verify requester identity', code: 'REQUESTER_PROFILE_NOT_FOUND', requestId },
        403
      )
    }

    const isAdmin = Boolean(requesterProfile.is_admin || requesterProfile.is_super_admin)
    const isManager = Boolean(requesterProfile.is_manager)
    const isSuperAdmin = Boolean(requesterProfile.is_super_admin)

    // ── createUser ──────────────────────────────────────────────────────────
    if (action === 'createUser') {
      if (!isAdmin && !isManager) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin_or_manager' })
        return jsonResponse(
          { error: 'Admin or manager access required', code: 'AUTHZ_ROLE_DENIED', requestId },
          403
        )
      }

      const { email, emailConfirm = true, userMetadata = {} } = body
      const normalized = normalizedEmail(email)

      if (!normalized) {
        return jsonResponse({ error: 'email is required', code: 'EMAIL_REQUIRED', requestId }, 400)
      }

      if (!isAdmin && isManager) {
        const managerId = (userMetadata as Record<string, unknown>)?.manager_id
        if (typeof managerId === 'string' && managerId !== userId) {
          return jsonResponse(
            { error: 'Managers can only invite users into their own team', code: 'AUTHZ_SCOPE_DENIED', requestId },
            403
          )
        }
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalized,
        email_confirm: emailConfirm,
        user_metadata: userMetadata,
      })

      if (error) {
        logEvent('admin_create_user_failed', {
          requestId,
          action,
          actorUserId: userId,
          email: normalized,
          error: error.message,
        })
        return jsonResponse({ error: error.message, code: 'CREATE_USER_FAILED', requestId }, 400)
      }

      logEvent('admin_create_user_success', {
        requestId,
        action,
        actorUserId: userId,
        targetUserId: data.user.id,
      })
      return jsonResponse({ success: true, user: { id: data.user.id, email: data.user.email } })
    }

    // ── generateLink ─────────────────────────────────────────────────────────
    if (action === 'generateLink') {
      if (!isAdmin && !isManager) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin_or_manager' })
        return jsonResponse(
          { error: 'Admin or manager access required', code: 'AUTHZ_ROLE_DENIED', requestId },
          403
        )
      }

      const requestedLinkType = body?.linkType ?? 'magiclink'
      const targetUserId = body?.targetUserId as string | undefined
      const normalizedRequestedEmail = normalizedEmail(body?.email)
      const redirectTo = sanitizeRedirectTo(body?.redirectTo, '/onboarding')

      if (requestedLinkType !== 'magiclink') {
        return jsonResponse(
          { error: 'Unsupported link type', code: 'LINK_TYPE_NOT_ALLOWED', requestId },
          400
        )
      }

      let emailForLink = normalizedRequestedEmail

      if (!targetUserId && !emailForLink) {
        return jsonResponse(
          { error: 'targetUserId or email is required', code: 'TARGET_REQUIRED', requestId },
          400
        )
      }

      if (targetUserId) {
        const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('id', targetUserId)
          .single<{ id: string; email: string }>()

        if (targetProfileError || !targetProfile) {
          return jsonResponse(
            { error: 'Target user not found', code: 'TARGET_NOT_FOUND', requestId },
            404
          )
        }

        if (!isAdmin && isManager) {
          const teamIds = await getManagedUserIds(supabaseAdmin, userId)
          if (!teamIds.has(targetUserId)) {
            logEvent('authz_scope_denied', {
              requestId,
              action,
              actorUserId: userId,
              targetUserId,
            })
            return jsonResponse(
              { error: 'Managers can only generate links for team members', code: 'AUTHZ_SCOPE_DENIED', requestId },
              403
            )
          }
        }

        if (emailForLink && emailForLink !== targetProfile.email.toLowerCase()) {
          return jsonResponse(
            { error: 'Email does not match target user', code: 'TARGET_EMAIL_MISMATCH', requestId },
            400
          )
        }

        emailForLink = targetProfile.email.toLowerCase()
      }

      if (!emailForLink) {
        return jsonResponse({ error: 'email is required', code: 'EMAIL_REQUIRED', requestId }, 400)
      }

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: emailForLink,
        options: { redirectTo },
      })

      if (error || !data.properties?.action_link) {
        logEvent('admin_generate_link_failed', {
          requestId,
          action,
          actorUserId: userId,
          targetUserId: targetUserId ?? null,
          error: error?.message ?? 'Unknown error',
        })
        return jsonResponse(
          { error: error?.message ?? 'Failed to generate link', code: 'GENERATE_LINK_FAILED', requestId },
          400
        )
      }

      logEvent('admin_generate_link_success', {
        requestId,
        action,
        actorUserId: userId,
        targetUserId: targetUserId ?? null,
      })
      return jsonResponse({ success: true, actionLink: data.properties.action_link })
    }

    // ── deleteUser ────────────────────────────────────────────────────────────
    if (action === 'deleteUser') {
      if (!isAdmin) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin' })
        return jsonResponse({ error: 'Admin access required', code: 'AUTHZ_ROLE_DENIED', requestId }, 403)
      }

      const { targetUserId } = body
      if (!targetUserId) {
        return jsonResponse({ error: 'targetUserId is required', code: 'TARGET_REQUIRED', requestId }, 400)
      }

      if (targetUserId === userId) {
        return jsonResponse(
          { error: 'You cannot delete your own account', code: 'SELF_DELETE_BLOCKED', requestId },
          400
        )
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

      if (error) {
        logEvent('admin_delete_user_failed', {
          requestId,
          action,
          actorUserId: userId,
          targetUserId,
          error: error.message,
        })
        return jsonResponse({ error: error.message, code: 'DELETE_USER_FAILED', requestId }, 400)
      }

      logEvent('admin_delete_user_success', {
        requestId,
        action,
        actorUserId: userId,
        targetUserId,
      })
      return jsonResponse({ success: true })
    }

    // ── terminateEmployee ───────────────────────────────────────────────────────
    if (action === 'terminateEmployee') {
      if (!isAdmin) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin' })
        return jsonResponse({ error: 'Admin access required', code: 'AUTHZ_ROLE_DENIED', requestId }, 403)
      }

      const {
        targetUserId,
        successorManagerId = null,
        terminationReason = null,
        terminationEffectiveAt = null,
      } = body

      if (!targetUserId) {
        return jsonResponse({ error: 'targetUserId is required', code: 'TARGET_REQUIRED', requestId }, 400)
      }

      if (targetUserId === userId) {
        return jsonResponse(
          { error: 'You cannot terminate your own account', code: 'SELF_TERMINATE_BLOCKED', requestId },
          400
        )
      }

      const { data, error } = await supabaseAdmin.rpc('terminate_employee', {
        p_actor_user_id: userId,
        p_target_user_id: targetUserId,
        p_successor_manager_id: successorManagerId,
        p_termination_reason: terminationReason,
        p_termination_effective_at: terminationEffectiveAt,
      })

      if (error) {
        logEvent('admin_terminate_failed', {
          requestId,
          action,
          actorUserId: userId,
          targetUserId,
          error: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
        })
        return jsonResponse(
          {
            error: error.message,
            code: 'TERMINATE_EMPLOYEE_FAILED',
            details: error.details ?? null,
            hint: error.hint ?? null,
            requestId,
          },
          400
        )
      }

      const result = Array.isArray(data) ? data[0] : null
      if (!result?.success) {
        return jsonResponse(
          { error: 'Failed to terminate employee', code: 'TERMINATE_EMPLOYEE_FAILED', requestId },
          400
        )
      }

      logEvent('admin_terminate_success', {
        requestId,
        action,
        actorUserId: userId,
        targetUserId: result.target_user_id,
      })
      return jsonResponse({
        success: true,
        targetUserId: result.target_user_id,
        successorManagerId: result.successor_manager_id,
        reassignedCount: result.reassigned_count ?? 0,
        terminatedAt: result.terminated_at,
      })
    }

    // ── listUsers ─────────────────────────────────────────────────────────────
    if (action === 'listUsers') {
      if (!isAdmin && !isManager) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin_or_manager' })
        return jsonResponse(
          { error: 'Admin or manager access required', code: 'AUTHZ_ROLE_DENIED', requestId },
          403
        )
      }

      // Paginate through all users — the default page size is 50, so without
      // pagination any user beyond the first page would be missing from the
      // auth-status map and incorrectly shown as "Pending" in the UI.
      const allUsers: Array<{ id: string; last_sign_in_at: string | null }> = []
      let page = 1
      const perPage = 1000

      const managerScopeIds =
        !isAdmin && isManager ? await getManagedUserIds(supabaseAdmin, userId) : null

      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage, page })

        if (error) {
          logEvent('admin_list_users_failed', {
            requestId,
            action,
            actorUserId: userId,
            error: error.message,
          })
          return jsonResponse({ error: error.message, code: 'LIST_USERS_FAILED', requestId }, 500)
        }

        for (const u of data.users) {
          if (managerScopeIds && !managerScopeIds.has(u.id)) {
            continue
          }
          allUsers.push({ id: u.id, last_sign_in_at: u.last_sign_in_at ?? null })
        }

        if (!data.nextPage) break
        page = data.nextPage
      }

      logEvent('admin_list_users_success', {
        requestId,
        action,
        actorUserId: userId,
        count: allUsers.length,
      })
      return jsonResponse({ success: true, users: allUsers })
    }

    // ── updateProfile ─────────────────────────────────────────────────────────
    if (action === 'updateProfile') {
      if (!isAdmin && !isManager) {
        logEvent('authz_denied', { requestId, action, actorUserId: userId, reason: 'not_admin_or_manager' })
        return jsonResponse(
          { error: 'Admin or manager access required', code: 'AUTHZ_ROLE_DENIED', requestId },
          403
        )
      }

      const { targetUserId, profileData } = body
      if (!targetUserId || typeof profileData !== 'object' || Array.isArray(profileData) || profileData === null) {
        return jsonResponse(
          { error: 'targetUserId and profileData are required', code: 'INVALID_UPDATE_REQUEST', requestId },
          400
        )
      }

      if (!isAdmin && isManager) {
        const teamIds = await getManagedUserIds(supabaseAdmin, userId)
        if (!teamIds.has(targetUserId)) {
          logEvent('authz_scope_denied', {
            requestId,
            action,
            actorUserId: userId,
            targetUserId,
          })
          return jsonResponse(
            { error: 'Managers can only update team members', code: 'AUTHZ_SCOPE_DENIED', requestId },
            403
          )
        }
      }

      const adminAllowedFields = new Set([
        'full_name',
        'preferred_name',
        'job_title',
        'job_description',
        'start_date',
        'birthday',
        'phone',
        'location',
        'social_links',
        'manager_id',
        'department_id',
        'profile_photo_url',
        'onboarding_completed',
        'is_admin',
        'is_manager',
        'is_executive',
        'is_process_editor',
      ])

      const managerAllowedFields = new Set([
        'full_name',
        'preferred_name',
        'job_title',
        'job_description',
        'start_date',
        'birthday',
        'phone',
        'location',
        'social_links',
        'manager_id',
        'department_id',
        'profile_photo_url',
        'onboarding_completed',
      ])

      const alwaysBlockedFields = new Set([
        'id',
        'email',
        'created_at',
        'updated_at',
        'employment_status',
        'terminated_at',
        'termination_effective_at',
        'termination_reason',
        'terminated_by',
        'archived_at',
      ])

      const payload = profileData as Record<string, unknown>
      const requestedFields = Object.keys(payload)

      if (requestedFields.length === 0) {
        return jsonResponse({ error: 'No fields to update', code: 'NO_FIELDS_TO_UPDATE', requestId }, 400)
      }

      for (const field of requestedFields) {
        if (alwaysBlockedFields.has(field)) {
          return jsonResponse(
            { error: `Field '${field}' is not editable via this action`, code: 'AUTHZ_FIELD_DENIED', requestId },
            403
          )
        }
      }

      if (!isSuperAdmin && Object.prototype.hasOwnProperty.call(payload, 'is_super_admin')) {
        return jsonResponse(
          { error: 'Only super admins can modify super-admin status', code: 'AUTHZ_FIELD_DENIED', requestId },
          403
        )
      }

      const allowed = isAdmin ? adminAllowedFields : managerAllowedFields
      const disallowed = requestedFields.filter((field) => !allowed.has(field))

      if (disallowed.length > 0) {
        return jsonResponse(
          {
            error: `Unauthorized fields in update request: ${disallowed.join(', ')}`,
            code: 'AUTHZ_FIELD_DENIED',
            requestId,
          },
          403
        )
      }

      const safeUpdate: Record<string, unknown> = {}
      for (const key of requestedFields) {
        safeUpdate[key] = payload[key]
      }

      if (!isAdmin && isManager && Object.prototype.hasOwnProperty.call(safeUpdate, 'manager_id')) {
        const managerValue = safeUpdate.manager_id
        if (managerValue !== null && managerValue !== userId) {
          return jsonResponse(
            {
              error: 'Managers can only assign direct reports to themselves or clear manager assignment',
              code: 'AUTHZ_SCOPE_DENIED',
              requestId,
            },
            403
          )
        }
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(safeUpdate)
        .eq('id', targetUserId)

      if (error) {
        logEvent('admin_update_profile_failed', {
          requestId,
          action,
          actorUserId: userId,
          targetUserId,
          error: error.message,
        })
        return jsonResponse({ error: error.message, code: 'UPDATE_PROFILE_FAILED', requestId }, 400)
      }

      logEvent('admin_update_profile_success', {
        requestId,
        action,
        actorUserId: userId,
        targetUserId,
        fields: Object.keys(safeUpdate),
      })
      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `Unknown action: ${action}`, code: 'UNKNOWN_ACTION', requestId }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    logEvent('admin_user_ops_unexpected_error', {
      requestId,
      error: message,
    })
    return jsonResponse({ error: message, code: 'UNEXPECTED_ERROR', requestId }, 500)
  }
})
