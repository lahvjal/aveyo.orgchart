// Supabase Edge Function for email notifications
// Deploy with: supabase functions deploy notify-profile-update

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: 'profile_updated' | 'new_employee' | 'manager_changed'
  profile_id: string
  changed_by: string
  changes?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: NotificationPayload = await req.json()

    // Get profile details
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, manager:profiles!profiles_manager_id_fkey(email, full_name)')
      .eq('id', payload.profile_id)
      .single()

    if (!profile) {
      throw new Error('Profile not found')
    }

    // Get who made the change
    const { data: changedBy } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', payload.changed_by)
      .single()

    let emailRecipients: string[] = []
    let emailSubject = ''
    let emailBody = ''

    switch (payload.type) {
      case 'new_employee':
        emailRecipients = [profile.email]
        emailSubject = 'Welcome to the team!'
        emailBody = `
          <h2>Welcome, ${profile.full_name}!</h2>
          <p>Your profile has been created in our organization chart.</p>
          <p>You can view and edit your profile at: ${Deno.env.get('APP_URL')}/profile</p>
          <p>Job Title: ${profile.job_title}</p>
          ${profile.manager ? `<p>Manager: ${profile.manager.full_name}</p>` : ''}
        `
        break

      case 'profile_updated':
        // Notify the employee
        emailRecipients.push(profile.email)
        
        // Notify manager if profile was updated by admin
        if (profile.manager && payload.changed_by !== payload.profile_id) {
          emailRecipients.push(profile.manager.email)
        }

        emailSubject = 'Your profile has been updated'
        emailBody = `
          <h2>Profile Update</h2>
          <p>${profile.full_name}'s profile has been updated by ${changedBy?.full_name || 'an administrator'}.</p>
          <p>View the updated profile at: ${Deno.env.get('APP_URL')}/profile</p>
        `
        break

      case 'manager_changed':
        emailRecipients = [profile.email]
        if (profile.manager) {
          emailRecipients.push(profile.manager.email)
        }
        emailSubject = 'Reporting structure updated'
        emailBody = `
          <h2>Manager Update</h2>
          <p>${profile.full_name} now reports to ${profile.manager?.full_name || 'no one (independent)'}</p>
        `
        break
    }

    // Send emails using Resend or SendGrid
    // You'll need to configure your email service here
    // Example with Resend:
    /*
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    for (const recipient of emailRecipients) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'noreply@yourcompany.com',
          to: recipient,
          subject: emailSubject,
          html: emailBody,
        }),
      })
    }
    */

    console.log(`Notification sent to: ${emailRecipients.join(', ')}`)

    return new Response(
      JSON.stringify({ success: true, recipients: emailRecipients }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
