import { supabase } from './supabase'
import type { Profile } from '../types'

const appUrl = import.meta.env.VITE_APP_URL

// ── Notification email helpers (all sent server-side via edge function) ──────

async function invokeNotificationEmail(type: string, payload: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.warn('invokeNotificationEmail: Not authenticated, skipping', type)
    return { success: false, error: 'Not authenticated' }
  }

  const { data, error } = await supabase.functions.invoke('send-notification-email', {
    body: { type, userId: user.id, ...payload },
  })

  if (error) {
    console.error('invokeNotificationEmail: edge function error', type, error)
    return { success: false, error: error.message }
  }

  return data ?? { success: false, error: 'No response from edge function' }
}

export async function sendWelcomeEmail(profile: Profile) {
  return invokeNotificationEmail('welcome', {
    profile: {
      email: profile.email,
      full_name: profile.full_name,
      job_title: profile.job_title,
      start_date: profile.start_date,
      department: profile.department ? { name: profile.department.name } : null,
    },
  })
}

export async function sendProfileUpdateEmail(
  profile: Profile,
  changedBy: { full_name: string; email: string },
  isOwnUpdate: boolean
) {
  return invokeNotificationEmail('profileUpdate', {
    profile: {
      email: profile.email,
      full_name: profile.full_name,
      manager: profile.manager ? { email: profile.manager.email } : null,
    },
    changedBy,
    isOwnUpdate,
  })
}

export async function sendManagerChangeEmail(
  profile: Profile,
  newManager: Profile | null,
  oldManager: Profile | null
) {
  return invokeNotificationEmail('managerChange', {
    profile: { email: profile.email, full_name: profile.full_name },
    newManager: newManager
      ? { email: newManager.email, full_name: newManager.full_name, job_title: newManager.job_title }
      : null,
    oldManager: oldManager
      ? { email: oldManager.email, full_name: oldManager.full_name, job_title: oldManager.job_title }
      : null,
  })
}

export async function sendDepartmentChangeEmail(
  profile: Profile,
  oldDepartmentName: string | null,
  newDepartmentName: string
) {
  return invokeNotificationEmail('departmentChange', {
    profile: { email: profile.email, full_name: profile.full_name },
    oldDepartmentName,
    newDepartmentName,
  })
}

// ── Invitation email (already uses edge function) ────────────────────────────

export async function sendEmployeeInvitationEmail(
  email: string,
  fullName: string,
  jobTitle: string,
  invitedBy: string,
  magicLink: string
) {
  console.log('sendEmployeeInvitationEmail: Calling Edge Function')

  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('sendEmployeeInvitationEmail: No active user')
      return { success: false, error: 'Not authenticated' }
    }

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
      error: error instanceof Error ? error.message : 'Failed to send invitation email',
    }
  }
}

/**
 * Request a password reset email. Sends a magic link via Resend (Edge Function).
 * No auth required - call from ForgotPassword page.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const resolvedAppUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    const redirectTo = resolvedAppUrl ? `${resolvedAppUrl}/reset-password` : undefined

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
