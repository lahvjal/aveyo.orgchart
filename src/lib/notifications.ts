import { Resend } from 'resend'
import { supabase } from './supabase'
import type { Profile } from '../types'

const resendApiKey = import.meta.env.VITE_RESEND_API_KEY
const fromEmail = import.meta.env.VITE_FROM_EMAIL || 'noreply@send.aveyo.com'
const appUrl = import.meta.env.VITE_APP_URL

// Initialize Resend client
const resend = resendApiKey ? new Resend(resendApiKey) : null

interface EmailOptions {
  to: string[]
  subject: string
  html: string
}

async function sendEmail({ to, subject, html }: EmailOptions) {
  console.log('sendEmail: Attempting to send email')
  console.log('sendEmail: Resend client initialized:', !!resend)
  console.log('sendEmail: From:', fromEmail)
  console.log('sendEmail: To:', to)
  console.log('sendEmail: Subject:', subject)
  
  if (!resend) {
    console.warn('Resend not configured - email notification skipped')
    console.warn('VITE_RESEND_API_KEY exists:', !!import.meta.env.VITE_RESEND_API_KEY)
    return { success: false, error: 'Resend not configured' }
  }

  try {
    console.log('sendEmail: Calling resend.emails.send...')
    const data = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    })
    
    console.log('sendEmail: Email sent successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('sendEmail: Failed to send email:', error)
    console.error('sendEmail: Error details:', JSON.stringify(error, null, 2))
    return { success: false, error }
  }
}

// Email Templates

export async function sendWelcomeEmail(profile: Profile) {
  const html = `
    <!DOCTYPE html>
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
          <div class="header">
            <h1>Welcome to the Team! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hi ${profile.full_name},</h2>
            <p>We're excited to have you join us! Your profile has been created in our organization chart system.</p>
            
            <div class="info">
              <div class="info-row">
                <span class="info-label">Name</span>
                <span>${profile.full_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Job Title</span>
                <span>${profile.job_title}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Start Date</span>
                <span>${new Date(profile.start_date).toLocaleDateString()}</span>
              </div>
              ${profile.department ? `
              <div class="info-row">
                <span class="info-label">Department</span>
                <span>${profile.department.name}</span>
              </div>
              ` : ''}
            </div>

            <p>You can now access your profile and view the organization chart:</p>
            
            <a href="${appUrl}/profile" class="button">View My Profile</a>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Update your profile information and photo</li>
              <li>View the organization chart</li>
              <li>Connect with your team members</li>
              <li>Add your social media links</li>
            </ul>

            <p>If you have any questions, feel free to reach out to your manager or HR team.</p>
            
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message from your organization chart system.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: [profile.email],
    subject: '🎉 Welcome to the Team!',
    html,
  })
}

export async function sendProfileUpdateEmail(
  profile: Profile,
  changedBy: { full_name: string; email: string },
  isOwnUpdate: boolean
) {
  const html = `
    <!DOCTYPE html>
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
          <div class="header">
            <h1>Profile Updated ✏️</h1>
          </div>
          <div class="content">
            <h2>Hi ${profile.full_name},</h2>
            
            ${isOwnUpdate ? `
              <p>Your profile has been successfully updated.</p>
            ` : `
              <div class="alert">
                <p><strong>Notice:</strong> Your profile was updated by ${changedBy.full_name} (${changedBy.email}).</p>
              </div>
            `}

            <p>You can review your current profile information:</p>
            
            <a href="${appUrl}/profile" class="button">View My Profile</a>
            
            ${!isOwnUpdate ? `
              <p>If you have questions about these changes, please contact your administrator.</p>
            ` : ''}
            
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message from your organization chart system.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const recipients = [profile.email]
  
  // Also notify manager if profile was updated by admin
  if (!isOwnUpdate && profile.manager) {
    recipients.push(profile.manager.email)
  }

  return sendEmail({
    to: recipients,
    subject: isOwnUpdate ? 'Profile Updated' : 'Profile Updated by Administrator',
    html,
  })
}

export async function sendManagerChangeEmail(
  profile: Profile,
  newManager: Profile | null,
  oldManager: Profile | null
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .change-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .change-row { display: flex; align-items: center; gap: 20px; padding: 10px 0; }
          .arrow { color: #667eea; font-size: 24px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reporting Structure Updated 👥</h1>
          </div>
          <div class="content">
            <h2>Hi ${profile.full_name},</h2>
            
            <p>Your reporting structure has been updated in the organization chart.</p>

            <div class="change-box">
              <div class="change-row">
                <div>
                  <strong>Previous Manager:</strong><br>
                  ${oldManager ? `${oldManager.full_name} (${oldManager.job_title})` : 'None'}
                </div>
                <span class="arrow">→</span>
                <div>
                  <strong>New Manager:</strong><br>
                  ${newManager ? `${newManager.full_name} (${newManager.job_title})` : 'None (Independent)'}
                </div>
              </div>
            </div>

            ${newManager ? `
              <p>Please reach out to ${newManager.full_name} to introduce yourself and discuss your role.</p>
            ` : ''}
            
            <a href="${appUrl}/dashboard" class="button">View Org Chart</a>
            
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message from your organization chart system.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const recipients = [profile.email]
  
  // Notify new manager
  if (newManager) {
    recipients.push(newManager.email)
  }
  
  // Optionally notify old manager
  if (oldManager && oldManager.email !== newManager?.email) {
    recipients.push(oldManager.email)
  }

  return sendEmail({
    to: recipients,
    subject: 'Reporting Structure Updated',
    html,
  })
}

export async function sendDepartmentChangeEmail(
  profile: Profile,
  oldDepartmentName: string | null,
  newDepartmentName: string
) {
  const html = `
    <!DOCTYPE html>
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
          <div class="header">
            <h1>Department Change 🏢</h1>
          </div>
          <div class="content">
            <h2>Hi ${profile.full_name},</h2>
            
            <p>Your department assignment has been updated:</p>

            <p>
              <strong>Previous:</strong> ${oldDepartmentName || 'None'}<br>
              <strong>New:</strong> ${newDepartmentName}
            </p>
            
            <a href="${appUrl}/dashboard" class="button">View Org Chart</a>
            
            <p>Best regards,<br>The Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message from your organization chart system.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: [profile.email],
    subject: 'Department Assignment Updated',
    html,
  })
}

export async function sendEmployeeInvitationEmail(
  email: string,
  fullName: string,
  jobTitle: string,
  invitedBy: string,
  magicLink: string
) {
  console.log('sendEmployeeInvitationEmail: Calling Edge Function')
  
  try {
    // Get the current user ID to include in the request
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('sendEmployeeInvitationEmail: No active user')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('sendEmployeeInvitationEmail: Calling Edge Function with user ID:', user.id)

    // Call Supabase Edge Function with user ID in body
    // JWT verification is disabled (--no-verify-jwt), so no auth header needed
    const { data, error } = await supabase.functions.invoke('send-invitation-email', {
      body: {
        userId: user.id,
        email,
        fullName,
        jobTitle,
        invitedBy,
        magicLink,
      },
    })

    if (error) {
      console.error('sendEmployeeInvitationEmail: Edge Function error:', error)
      return { success: false, error: error.message || 'Failed to send invitation email' }
    }

    console.log('sendEmployeeInvitationEmail: Email sent successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('sendEmployeeInvitationEmail: Unexpected error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send invitation email' }
  }
}

/**
 * Request a password reset email. Sends a magic link via Resend (Edge Function).
 * No auth required - call from ForgotPassword page.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    const redirectTo = appUrl ? `${appUrl}/reset-password` : undefined

    const { data, error } = await supabase.functions.invoke('send-password-reset-email', {
      body: { email: email.trim(), redirectTo },
    })

    if (error) {
      return { success: false, error: error.message || 'Failed to send reset email' }
    }

    if (data?.error) {
      return { success: false, error: data.error }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reset email',
    }
  }
}
