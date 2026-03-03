/**
 * send-notification-email – Server-side notification emails via Resend.
 * Handles: welcome, profileUpdate, managerChange, departmentChange
 *
 * RESEND_API_KEY and FROM_EMAIL must only live in server-side env vars.
 * Request identity is derived from bearer JWT (not body parameters).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://orgchart.aveyo.com'

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

type NotificationType = 'welcome' | 'profileUpdate' | 'managerChange' | 'departmentChange'

interface RequesterProfile {
  id: string
  full_name: string | null
  email: string
  is_admin: boolean | null
  is_manager: boolean | null
  is_super_admin: boolean | null
}

interface TargetProfile {
  id: string
  email: string
  full_name: string
  job_title: string
  start_date: string
  manager_id: string | null
  manager?: { id: string; email: string; full_name: string; job_title: string } | null
  department?: { id: string; name: string } | null
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice('bearer '.length).trim()
  return token || null
}

function logEvent(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...details }))
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

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('send-notification-email: RESEND_API_KEY not configured')
    return { success: false, error: 'Resend not configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('send-notification-email: Resend API error:', errText)
    return { success: false, error: errText }
  }

  return { success: true, data: await response.json() }
}

// ── Email Templates ────────────────────────────────────────────────────────

function welcomeEmailHtml(profile: {
  full_name: string
  job_title: string
  start_date: string
  department?: { name: string } | null
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
      .info-label { font-weight: bold; color: #6b7280; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Welcome to the Team!</h1></div>
      <div class="content">
        <h2>Hi ${profile.full_name},</h2>
        <p>We're excited to have you join us! Your profile has been created in our organization chart system.</p>
        <div class="info">
          <div class="info-row"><span class="info-label">Name</span><span>${profile.full_name}</span></div>
          <div class="info-row"><span class="info-label">Job Title</span><span>${profile.job_title}</span></div>
          <div class="info-row"><span class="info-label">Start Date</span><span>${new Date(profile.start_date).toLocaleDateString()}</span></div>
          ${profile.department ? `<div class="info-row"><span class="info-label">Department</span><span>${profile.department.name}</span></div>` : ''}
        </div>
        <p>You can now access your profile and view the organization chart:</p>
        <a href="${APP_URL}/profile" class="button">View My Profile</a>
        <p>If you have any questions, feel free to reach out to your manager or HR team.</p>
        <p>Best regards,<br>The Team</p>
      </div>
      <div class="footer"><p>This is an automated message from your organization chart system.</p></div>
    </div>
  </body>
</html>`
}

function profileUpdateEmailHtml(
  profileName: string,
  isOwnUpdate: boolean,
  changedByName: string,
  changedByEmail: string
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .alert { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Profile Updated</h1></div>
      <div class="content">
        <h2>Hi ${profileName},</h2>
        ${isOwnUpdate
          ? '<p>Your profile has been successfully updated.</p>'
          : `<div class="alert"><p><strong>Notice:</strong> Your profile was updated by ${changedByName} (${changedByEmail}).</p></div>`}
        <p>You can review your current profile information:</p>
        <a href="${APP_URL}/profile" class="button">View My Profile</a>
        ${!isOwnUpdate ? '<p>If you have questions about these changes, please contact your administrator.</p>' : ''}
        <p>Best regards,<br>The Team</p>
      </div>
      <div class="footer"><p>This is an automated message from your organization chart system.</p></div>
    </div>
  </body>
</html>`
}

function managerChangeEmailHtml(
  profileName: string,
  newManagerName: string | null,
  newManagerTitle: string | null,
  oldManagerName: string | null,
  oldManagerTitle: string | null
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .change-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Reporting Structure Updated</h1></div>
      <div class="content">
        <h2>Hi ${profileName},</h2>
        <p>Your reporting structure has been updated in the organization chart.</p>
        <div class="change-box">
          <p><strong>Previous Manager:</strong> ${oldManagerName ? `${oldManagerName} (${oldManagerTitle})` : 'None'}</p>
          <p><strong>New Manager:</strong> ${newManagerName ? `${newManagerName} (${newManagerTitle})` : 'None (Independent)'}</p>
        </div>
        ${newManagerName ? `<p>Please reach out to ${newManagerName} to introduce yourself and discuss your role.</p>` : ''}
        <a href="${APP_URL}/dashboard" class="button">View Org Chart</a>
        <p>Best regards,<br>The Team</p>
      </div>
      <div class="footer"><p>This is an automated message from your organization chart system.</p></div>
    </div>
  </body>
</html>`
}

function departmentChangeEmailHtml(
  profileName: string,
  oldDepartmentName: string | null,
  newDepartmentName: string
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>Department Change</h1></div>
      <div class="content">
        <h2>Hi ${profileName},</h2>
        <p>Your department assignment has been updated:</p>
        <p><strong>Previous:</strong> ${oldDepartmentName || 'None'}<br><strong>New:</strong> ${newDepartmentName}</p>
        <a href="${APP_URL}/dashboard" class="button">View Org Chart</a>
        <p>Best regards,<br>The Team</p>
      </div>
      <div class="footer"><p>This is an automated message from your organization chart system.</p></div>
    </div>
  </body>
</html>`
}

// ── Handler ────────────────────────────────────────────────────────────────

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
    const type = body?.type as NotificationType | undefined

    if (!type) {
      return jsonResponse({ error: 'type is required', code: 'TYPE_REQUIRED', requestId }, 400)
    }

    const token = getBearerToken(req)
    if (!token) {
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const actorId = authData.user.id
    if (body?.userId && body.userId !== actorId) {
      return jsonResponse({ error: 'Requester mismatch', code: 'REQUESTER_MISMATCH', requestId }, 403)
    }

    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, is_admin, is_manager, is_super_admin')
      .eq('id', actorId)
      .single()
      .returns<RequesterProfile>()

    if (profileError || !requesterProfile) {
      return jsonResponse(
        { error: 'Could not verify requester identity', code: 'REQUESTER_PROFILE_NOT_FOUND', requestId },
        403
      )
    }

    const targetProfileId = body?.targetProfileId as string | undefined
    if (!targetProfileId) {
      return jsonResponse({ error: 'targetProfileId is required', code: 'TARGET_REQUIRED', requestId }, 400)
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        job_title,
        start_date,
        manager_id,
        manager:profiles!profiles_manager_id_fkey(id, email, full_name, job_title),
        department:departments(id, name)
      `)
      .eq('id', targetProfileId)
      .single()
      .returns<TargetProfile>()

    if (targetError || !targetProfile) {
      return jsonResponse({ error: 'Target profile not found', code: 'TARGET_NOT_FOUND', requestId }, 404)
    }

    const isAdmin = Boolean(requesterProfile.is_admin || requesterProfile.is_super_admin)
    const isManager = Boolean(requesterProfile.is_manager)
    let canManageTarget = isAdmin
    if (!canManageTarget && isManager) {
      const managedIds = await getManagedUserIds(supabaseAdmin, actorId)
      canManageTarget = managedIds.has(targetProfileId)
    }

    if (type !== 'profileUpdate' && !canManageTarget) {
      logEvent('notification_authz_denied', {
        requestId,
        type,
        actorId,
        targetProfileId,
        reason: 'management_scope_required',
      })
      return jsonResponse({ error: 'Insufficient permissions', code: 'AUTHZ_SCOPE_DENIED', requestId }, 403)
    }

    if (type === 'profileUpdate' && actorId !== targetProfileId && !canManageTarget) {
      logEvent('notification_authz_denied', {
        requestId,
        type,
        actorId,
        targetProfileId,
        reason: 'self_or_manager_scope_required',
      })
      return jsonResponse({ error: 'Insufficient permissions', code: 'AUTHZ_SCOPE_DENIED', requestId }, 403)
    }

    // ── welcome ────────────────────────────────────────────────────────────
    if (type === 'welcome') {
      const html = welcomeEmailHtml(targetProfile)
      const result = await sendEmail([targetProfile.email], 'Welcome to the Team!', html)
      return jsonResponse({ ...result, requestId })
    }

    // ── profileUpdate ──────────────────────────────────────────────────────
    if (type === 'profileUpdate') {
      const isOwnUpdate = actorId === targetProfileId

      const html = profileUpdateEmailHtml(
        targetProfile.full_name,
        isOwnUpdate,
        requesterProfile.full_name ?? 'Unknown user',
        requesterProfile.email
      )

      const recipients = [targetProfile.email]
      if (!isOwnUpdate && targetProfile.manager?.email) {
        recipients.push(targetProfile.manager.email)
      }

      const subject = isOwnUpdate ? 'Profile Updated' : 'Profile Updated by Administrator'
      const result = await sendEmail(recipients, subject, html)
      return jsonResponse({ ...result, requestId })
    }

    // ── managerChange ──────────────────────────────────────────────────────
    if (type === 'managerChange') {
      const oldManagerId = body?.oldManagerId as string | null | undefined
      const newManagerId = body?.newManagerId as string | null | undefined

      const managerIds = [oldManagerId, newManagerId].filter((id): id is string => Boolean(id))
      const managerMap = new Map<string, { email: string; full_name: string; job_title: string }>()

      if (managerIds.length > 0) {
        const { data: managerRows, error: managerError } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, job_title')
          .in('id', managerIds)

        if (managerError) {
          return jsonResponse({ error: managerError.message, code: 'MANAGER_LOOKUP_FAILED', requestId }, 400)
        }

        for (const row of managerRows ?? []) {
          managerMap.set(row.id, row)
        }
      }

      const oldManager = oldManagerId ? managerMap.get(oldManagerId) ?? null : null
      const newManager =
        (newManagerId ? managerMap.get(newManagerId) : undefined) ?? targetProfile.manager ?? null

      const html = managerChangeEmailHtml(
        targetProfile.full_name,
        newManager?.full_name ?? null,
        newManager?.job_title ?? null,
        oldManager?.full_name ?? null,
        oldManager?.job_title ?? null
      )

      const recipients = [targetProfile.email]
      if (newManager?.email) recipients.push(newManager.email)
      if (oldManager?.email && oldManager.email !== newManager?.email) {
        recipients.push(oldManager.email)
      }

      const result = await sendEmail(recipients, 'Reporting Structure Updated', html)
      return jsonResponse({ ...result, requestId })
    }

    // ── departmentChange ───────────────────────────────────────────────────
    if (type === 'departmentChange') {
      const oldDepartmentName = (body?.oldDepartmentName as string | null | undefined) ?? null
      const newDepartmentName =
        (body?.newDepartmentName as string | null | undefined) ??
        targetProfile.department?.name ??
        'Unassigned'

      const html = departmentChangeEmailHtml(
        targetProfile.full_name,
        oldDepartmentName,
        newDepartmentName
      )

      const result = await sendEmail([targetProfile.email], 'Department Assignment Updated', html)
      return jsonResponse({ ...result, requestId })
    }

    return jsonResponse({ error: `Unknown type: ${type}`, code: 'UNKNOWN_TYPE', requestId }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    logEvent('send_notification_unexpected_error', { requestId, error: message })
    return jsonResponse({ error: message, code: 'UNEXPECTED_ERROR', requestId }, 500)
  }
})
