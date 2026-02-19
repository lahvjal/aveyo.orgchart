/**
 * send-notification-email – Server-side notification emails via Resend.
 * Handles: welcome, profileUpdate, managerChange, departmentChange
 *
 * RESEND_API_KEY and FROM_EMAIL must only live in server-side env vars.
 * Callers must pass their userId for admin/auth verification.
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { type, userId } = body

    if (!type || !userId) {
      return jsonResponse({ error: 'type and userId are required' }, 400)
    }

    // Verify the requesting user is authenticated (exists in profiles)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (profileError || !requesterProfile) {
      return jsonResponse({ error: 'Could not verify requester identity' }, 403)
    }

    // ── welcome ────────────────────────────────────────────────────────────
    if (type === 'welcome') {
      const { profile } = body
      if (!profile?.email) return jsonResponse({ error: 'profile with email required' }, 400)

      const html = welcomeEmailHtml(profile)
      const result = await sendEmail([profile.email], 'Welcome to the Team!', html)
      return jsonResponse(result)
    }

    // ── profileUpdate ──────────────────────────────────────────────────────
    if (type === 'profileUpdate') {
      const { profile, changedBy, isOwnUpdate } = body
      if (!profile?.email) return jsonResponse({ error: 'profile with email required' }, 400)

      const html = profileUpdateEmailHtml(
        profile.full_name,
        isOwnUpdate,
        changedBy?.full_name ?? '',
        changedBy?.email ?? ''
      )

      const recipients = [profile.email]
      if (!isOwnUpdate && profile.manager?.email) {
        recipients.push(profile.manager.email)
      }

      const subject = isOwnUpdate ? 'Profile Updated' : 'Profile Updated by Administrator'
      const result = await sendEmail(recipients, subject, html)
      return jsonResponse(result)
    }

    // ── managerChange ──────────────────────────────────────────────────────
    if (type === 'managerChange') {
      const { profile, newManager, oldManager } = body
      if (!profile?.email) return jsonResponse({ error: 'profile with email required' }, 400)

      const html = managerChangeEmailHtml(
        profile.full_name,
        newManager?.full_name ?? null,
        newManager?.job_title ?? null,
        oldManager?.full_name ?? null,
        oldManager?.job_title ?? null
      )

      const recipients = [profile.email]
      if (newManager?.email) recipients.push(newManager.email)
      if (oldManager?.email && oldManager.email !== newManager?.email) {
        recipients.push(oldManager.email)
      }

      const result = await sendEmail(recipients, 'Reporting Structure Updated', html)
      return jsonResponse(result)
    }

    // ── departmentChange ───────────────────────────────────────────────────
    if (type === 'departmentChange') {
      const { profile, oldDepartmentName, newDepartmentName } = body
      if (!profile?.email) return jsonResponse({ error: 'profile with email required' }, 400)

      const html = departmentChangeEmailHtml(
        profile.full_name,
        oldDepartmentName ?? null,
        newDepartmentName
      )

      const result = await sendEmail([profile.email], 'Department Assignment Updated', html)
      return jsonResponse(result)
    }

    return jsonResponse({ error: `Unknown type: ${type}` }, 400)
  } catch (err) {
    console.error('send-notification-email unexpected error:', err)
    return jsonResponse({ error: err?.message ?? 'Internal server error' }, 500)
  }
})
