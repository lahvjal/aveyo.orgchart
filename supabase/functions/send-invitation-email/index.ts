import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'

// Supabase automatically provides these
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface InvitationEmailRequest {
  email: string
  fullName: string
  jobTitle: string
  invitedBy: string
  magicLink: string
}

serve(async (req) => {
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

  try {
    console.log('Edge Function: Request received')
    
    // Create Supabase client using service role to bypass RLS
    // The Edge Runtime has already verified the JWT - we can trust the request
    const authorizationHeader = req.headers.get('authorization')
    
    if (!authorizationHeader) {
      console.error('Edge Function: No authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Create client with the authorization from the request
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: authorizationHeader } },
        auth: { persistSession: false },
      }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('Edge Function: Auth error:', userError?.message || 'No user')
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message || 'No user found' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log('Edge Function: User authenticated:', user.id)

    // Check if user is admin using service role client (bypasses RLS)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Edge Function: Error fetching profile:', profileError.message)
      return new Response(
        JSON.stringify({ error: 'Error verifying admin status', details: profileError.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log('Edge Function: Profile fetched:', profile)

    if (!profile?.is_admin) {
      console.error('Edge Function: User is not admin, profile:', profile)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log('Edge Function: Admin verified, parsing request body')

    // Parse request body
    const requestData: InvitationEmailRequest = await req.json()
    const { email, fullName, jobTitle, invitedBy, magicLink } = requestData

    console.log('Sending invitation email to:', email)

    // Send email via Resend
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
              <h1>You're Invited! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hi ${fullName},</h2>
              
              <p>${invitedBy} has invited you to join the organization chart system as <strong>${jobTitle}</strong>.</p>

              <div class="info-box">
                <p><strong>Your Account Details:</strong></p>
                <p>📧 Email: ${email}<br>
                💼 Job Title: ${jobTitle}</p>
              </div>

              <p>Click the button below to access your account and set up your password:</p>
              
              <a href="${magicLink}" class="button">Access My Account</a>

              <p class="warning">⚠️ This link expires in 24 hours for security reasons.</p>

              <p><strong>What's next?</strong></p>
              <ul>
                <li>Click the link above to access your account</li>
                <li>Set a secure password for future logins</li>
                <li>Complete your profile with a photo and additional details</li>
                <li>Explore the organization chart and connect with your team</li>
              </ul>

              <p>If you have any questions or didn't expect this invitation, please contact your administrator.</p>
              
              <p>Best regards,<br>The Team</p>
            </div>
            <div class="footer">
              <p>This is an automated invitation from your organization chart system.</p>
              <p>If the button doesn't work, copy and paste this link into your browser:<br>
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
        to: [email],
        subject: `🎉 You've been invited to join the team as ${jobTitle}`,
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      console.error('Resend API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    const resendData = await resendResponse.json()
    console.log('Email sent successfully:', resendData)

    return new Response(
      JSON.stringify({ success: true, data: resendData }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error in send-invitation-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
