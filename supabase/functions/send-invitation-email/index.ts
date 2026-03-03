import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface InvitationEmailRequest {
  targetUserId: string
  redirectTo?: string
}

type RequesterProfile = {
  id: string
  full_name: string | null
  is_admin: boolean | null
  is_manager: boolean | null
  is_super_admin: boolean | null
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice('bearer '.length).trim()
  return token || null
}

function sanitizeRedirectTo(raw: unknown): string {
  const appUrl = (Deno.env.get('APP_URL') || 'https://orgchart.aveyo.com').replace(/\/+$/, '')
  const fallback = `${appUrl}/onboarding`
  if (typeof raw !== 'string' || !raw.trim()) return fallback

  try {
    const base = new URL(appUrl)
    const candidate = new URL(raw, appUrl)
    if (candidate.origin !== base.origin) return fallback
    return candidate.toString()
  } catch {
    return fallback
  }
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

function logEvent(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...details }))
}

serve(async (req) => {
  const requestId = crypto.randomUUID()

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', requestId }, 405)
  }

  try {
    if (!RESEND_API_KEY) {
      return jsonResponse(
        { error: 'Email service is not configured. Please set RESEND_API_KEY.', code: 'EMAIL_NOT_CONFIGURED', requestId },
        500
      )
    }

    const token = getBearerToken(req)
    if (!token) {
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !authData?.user) {
      logEvent('invite_auth_failed', { requestId, error: authError?.message ?? null })
      return jsonResponse({ error: 'Invalid JWT', code: 'INVALID_JWT', requestId }, 401)
    }

    const actorId = authData.user.id
    const { data: requester, error: requesterError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, is_admin, is_manager, is_super_admin')
      .eq('id', actorId)
      .single<RequesterProfile>()

    if (requesterError || !requester) {
      return jsonResponse(
        { error: 'Could not verify requester identity', code: 'REQUESTER_PROFILE_NOT_FOUND', requestId },
        403
      )
    }

    const isAdmin = Boolean(requester.is_admin || requester.is_super_admin)
    const isManager = Boolean(requester.is_manager)
    if (!isAdmin && !isManager) {
      return jsonResponse({ error: 'Admin or manager access required', code: 'AUTHZ_ROLE_DENIED', requestId }, 403)
    }

    const requestData: InvitationEmailRequest = await req.json()
    const { targetUserId } = requestData
    if (!targetUserId) {
      return jsonResponse({ error: 'targetUserId is required', code: 'TARGET_REQUIRED', requestId }, 400)
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, job_title')
      .eq('id', targetUserId)
      .single()

    if (targetProfileError || !targetProfile) {
      return jsonResponse({ error: 'Target user not found', code: 'TARGET_NOT_FOUND', requestId }, 404)
    }

    if (!isAdmin && isManager) {
      const teamIds = await getManagedUserIds(supabaseAdmin, actorId)
      if (!teamIds.has(targetUserId)) {
        return jsonResponse(
          { error: 'Managers can only invite users in their own team', code: 'AUTHZ_SCOPE_DENIED', requestId },
          403
        )
      }
    }

    const redirectTo = sanitizeRedirectTo(requestData.redirectTo)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetProfile.email,
      options: { redirectTo },
    })

    const magicLink = linkData?.properties?.action_link
    if (linkError || !magicLink) {
      logEvent('invite_link_generation_failed', {
        requestId,
        actorId,
        targetUserId,
        error: linkError?.message ?? null,
      })
      return jsonResponse({ error: 'Failed to generate invitation link', code: 'GENERATE_LINK_FAILED', requestId }, 400)
    }

    const invitedBy = requester.full_name || 'Administrator'

    // Use a hosted PNG logo for email client compatibility.
    // Gmail and most email clients block data: URIs and don't support SVG.
    // The white PNG version should be hosted at this URL.
    const APP_URL = Deno.env.get('APP_URL') || 'https://orgchart.aveyo.com'
    const logoUrl = `${APP_URL}/images/logo-white.png`

    // Send email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #111; background: #fff; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: #fff; padding: 32px 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header img { display: block; margin: 0 auto 16px; height: 48px; width: auto; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #000; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .info-box { background: #f5f5f5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #000; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; }
            .warning { color: #b91c1c; font-size: 13px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" alt="Aveyo" width="60" height="47" />
              <h1>You've been invited to Aveyo's OrgChart App</h1>
            </div>
            <div class="content">
              <h2 style="color: #111; margin-top: 0;">Hi ${targetProfile.full_name},</h2>
              
              <p>${invitedBy} has invited you to join the organization chart as <strong>${targetProfile.job_title}</strong>.</p>

              <div class="info-box">
                <p style="margin: 0 0 8px;"><strong>Your account details</strong></p>
                <p style="margin: 0;">Email: ${targetProfile.email}<br>Job title: ${targetProfile.job_title}</p>
              </div>

              <p>Click the button below to access your account and set up your password:</p>
              
              <a href="${magicLink}" class="button">Access my account</a>

              <p class="warning">This link expires in 24 hours for security reasons.</p>

              <p><strong>What's next?</strong></p>
              <ul>
                <li>Click the link above to access your account</li>
                <li>Set a secure password for future logins</li>
                <li>Complete your profile with a photo and additional details</li>
                <li>Explore the organization chart and connect with your team</li>
              </ul>

              <p>If you have any questions or didn't expect this invitation, please contact your administrator.</p>
              
              <p>Best regards,<br>The Aveyo Team</p>
            </div>
            <div class="footer">
              <p style="margin: 0 0 8px;">This is an automated invitation from Aveyo's OrgChart App.</p>
              <p style="margin: 0;">If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="word-break: break-all; font-size: 11px;">${magicLink}</span></p>
            </div>
          </div>
        </body>
      </html>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [targetProfile.email],
        subject: `You've been invited to Aveyo's OrgChart App – ${targetProfile.job_title}`,
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      logEvent('invite_email_send_failed', { requestId, actorId, targetUserId, error })
      return jsonResponse({ error: 'Failed to send email', code: 'EMAIL_SEND_FAILED', requestId }, 500)
    }

    const resendData = await resendResponse.json()
    logEvent('invite_email_sent', { requestId, actorId, targetUserId, resendId: resendData?.id ?? null })
    return jsonResponse({ success: true, data: resendData })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logEvent('invite_unexpected_error', { requestId, error: message })
    return jsonResponse({ error: message, code: 'UNEXPECTED_ERROR', requestId }, 500)
  }
})
