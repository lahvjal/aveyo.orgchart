import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@send.aveyo.com'

// Supabase automatically provides these
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface InvitationEmailRequest {
  userId: string // User ID of the requester (for admin verification)
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

    if (!RESEND_API_KEY) {
      console.error('Edge Function: RESEND_API_KEY is not configured')
      return new Response(
        JSON.stringify({ error: 'Email service is not configured. Please set the RESEND_API_KEY secret.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      )
    }

    // Parse request body first to get userId
    const requestData: InvitationEmailRequest = await req.json()
    const { userId, email, fullName, jobTitle, invitedBy, magicLink } = requestData
    
    console.log('Edge Function: Verifying user is admin:', userId)
    
    // Use service role to verify the user is an admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, is_manager')
      .eq('id', userId)
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

    if (!profile?.is_admin && !profile?.is_manager) {
      console.error('Edge Function: User is not an admin or manager')
      return new Response(
        JSON.stringify({ error: 'Admin or manager access required' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    console.log('Edge Function: Access verified, sending email')

    console.log('Sending invitation email to:', email)

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
              <h2 style="color: #111; margin-top: 0;">Hi ${fullName},</h2>
              
              <p>${invitedBy} has invited you to join the organization chart as <strong>${jobTitle}</strong>.</p>

              <div class="info-box">
                <p style="margin: 0 0 8px;"><strong>Your account details</strong></p>
                <p style="margin: 0;">Email: ${email}<br>Job title: ${jobTitle}</p>
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
        to: [email],
        subject: `You've been invited to Aveyo's OrgChart App – ${jobTitle}`,
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
