/**
 * Password reset email – generates recovery link (Supabase Admin) and sends via Resend.
 * Deployed URL: https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-password-reset-email
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://orgchart.aveyo.com'
const RESET_ALLOWLIST = (Deno.env.get('PASSWORD_RESET_REDIRECT_ALLOWLIST') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PasswordResetRequest {
  email: string
  redirectTo?: string
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitBuckets = new Map<string, number[]>()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function genericOkResponse() {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'If an account exists for that email, a password reset link will be sent.',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || !email.includes('@')) return null
  return email
}

function withinRateLimit(key: string): boolean {
  const now = Date.now()
  const existing = rateLimitBuckets.get(key) ?? []
  const recent = existing.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(key, recent)
    return false
  }

  recent.push(now)
  rateLimitBuckets.set(key, recent)
  return true
}

function resolveResetRedirect(redirectTo: unknown): string {
  const normalizedAppUrl = APP_URL.replace(/\/+$/, '')
  const defaultRedirect = `${normalizedAppUrl}/reset-password`

  if (typeof redirectTo !== 'string' || !redirectTo.trim()) {
    return defaultRedirect
  }

  try {
    const allowlistedOrigins = new Set([
      new URL(normalizedAppUrl).origin,
      ...RESET_ALLOWLIST.map((item) => new URL(item).origin),
    ])

    const candidate = new URL(redirectTo, normalizedAppUrl)
    if (!allowlistedOrigins.has(candidate.origin)) {
      return defaultRedirect
    }

    if (!candidate.pathname.endsWith('/reset-password')) {
      candidate.pathname = '/reset-password'
      candidate.search = ''
      candidate.hash = ''
    }

    return candidate.toString()
  } catch {
    return defaultRedirect
  }
}

function logEvent(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...details }))
}

serve(async (req) => {
  const requestId = crypto.randomUUID()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const { email, redirectTo }: PasswordResetRequest = await req.json()
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) {
      return genericOkResponse()
    }

    const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const rateLimitKey = `${ip}:${normalizedEmail}`
    if (!withinRateLimit(rateLimitKey)) {
      logEvent('password_reset_rate_limited', { requestId, ip })
      return genericOkResponse()
    }

    const resetRedirectTo = resolveResetRedirect(redirectTo)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: resetRedirectTo },
    })

    if (linkError || !linkData.properties?.action_link) {
      logEvent('password_reset_link_generation_failed', {
        requestId,
        ip,
        error: linkError?.message ?? null,
      })
      return genericOkResponse()
    }

    const resetLink = linkData.properties.action_link

    if (!RESEND_API_KEY) {
      logEvent('password_reset_email_not_configured', { requestId, ip })
      return genericOkResponse()
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .info-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #667eea; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
            .warning { color: #dc2626; font-size: 13px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reset your password</h1>
            </div>
            <div class="content">
              <p>You requested a password reset. Click the button below to choose a new password:</p>
              <a href="${resetLink}" class="button">Set new password</a>
              <p class="warning">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
              <div class="footer">
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <span style="word-break: break-all; font-size: 11px;">${resetLink}</span>
              </div>
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
        to: [normalizedEmail],
        subject: 'Reset your password',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const errText = await resendResponse.text()
      logEvent('password_reset_email_send_failed', { requestId, ip, error: errText })
      return genericOkResponse()
    }

    await resendResponse.json()
    logEvent('password_reset_email_sent', { requestId, ip })
    return genericOkResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    logEvent('password_reset_unexpected_error', { requestId, error: message })
    return genericOkResponse()
  }
})
