/**
 * Password reset email – generates recovery link (Supabase Admin) and sends via Resend.
 * Deployed URL: https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-password-reset-email
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'
const APP_URL = Deno.env.get('APP_URL') || ''

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PasswordResetRequest {
  email: string
  redirectTo?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const { email, redirectTo }: PasswordResetRequest = await req.json()
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const resetRedirectTo = redirectTo || `${APP_URL}/reset-password`
    if (!APP_URL && !redirectTo) {
      return new Response(
        JSON.stringify({ error: 'APP_URL or redirectTo is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: { redirectTo: resetRedirectTo },
    })

    if (linkError || !linkData.properties?.action_link) {
      console.error('generateLink error:', linkError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not create reset link' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const resetLink = linkData.properties.action_link

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Resend not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
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
        to: [email.trim()],
        subject: 'Reset your password',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const errText = await resendResponse.text()
      console.error('Resend API error:', errText)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const resendData = await resendResponse.json()
    return new Response(
      JSON.stringify({ success: true, data: resendData }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error) {
    console.error('send-password-reset-email error:', error)
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
