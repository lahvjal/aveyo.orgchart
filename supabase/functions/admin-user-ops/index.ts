/**
 * admin-user-ops – Server-side admin operations using the service role key.
 * Handles: createUser, generateLink, deleteUser, listUsers, updateProfile
 *
 * The service role key MUST NOT be in the client bundle.
 * All auth.admin operations are proxied through this edge function.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const { action, userId } = body

    if (!action || !userId) {
      return jsonResponse({ error: 'action and userId are required' }, 400)
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify the requesting user exists and has the required permission
    const { data: requesterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, is_manager, is_super_admin')
      .eq('id', userId)
      .single()

    if (profileError || !requesterProfile) {
      console.error('admin-user-ops: failed to verify requester', profileError)
      return jsonResponse({ error: 'Could not verify requester identity' }, 403)
    }

    const isAdmin = requesterProfile.is_admin || requesterProfile.is_super_admin
    const isManager = requesterProfile.is_manager

    // ── createUser ──────────────────────────────────────────────────────────
    if (action === 'createUser') {
      if (!isAdmin && !isManager) {
        return jsonResponse({ error: 'Admin or manager access required' }, 403)
      }

      const { email, emailConfirm = true, userMetadata = {} } = body

      if (!email) return jsonResponse({ error: 'email is required' }, 400)

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: emailConfirm,
        user_metadata: userMetadata,
      })

      if (error) {
        console.error('admin-user-ops createUser error:', error)
        return jsonResponse({ error: error.message }, 400)
      }

      return jsonResponse({ success: true, user: { id: data.user.id, email: data.user.email } })
    }

    // ── generateLink ─────────────────────────────────────────────────────────
    if (action === 'generateLink') {
      if (!isAdmin && !isManager) {
        return jsonResponse({ error: 'Admin or manager access required' }, 403)
      }

      const { email, linkType = 'magiclink', redirectTo } = body

      if (!email) return jsonResponse({ error: 'email is required' }, 400)

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: linkType,
        email,
        options: { redirectTo },
      })

      if (error || !data.properties?.action_link) {
        console.error('admin-user-ops generateLink error:', error)
        return jsonResponse({ error: error?.message ?? 'Failed to generate link' }, 400)
      }

      return jsonResponse({ success: true, actionLink: data.properties.action_link })
    }

    // ── deleteUser ────────────────────────────────────────────────────────────
    if (action === 'deleteUser') {
      if (!isAdmin) {
        return jsonResponse({ error: 'Admin access required' }, 403)
      }

      const { targetUserId } = body
      if (!targetUserId) return jsonResponse({ error: 'targetUserId is required' }, 400)

      if (targetUserId === userId) {
        return jsonResponse({ error: 'You cannot delete your own account' }, 400)
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)

      if (error) {
        console.error('admin-user-ops deleteUser error:', error)
        return jsonResponse({ error: error.message }, 400)
      }

      return jsonResponse({ success: true })
    }

    // ── listUsers ─────────────────────────────────────────────────────────────
    if (action === 'listUsers') {
      if (!isAdmin && !isManager) {
        return jsonResponse({ error: 'Admin or manager access required' }, 403)
      }

      // Paginate through all users — the default page size is 50, so without
      // pagination any user beyond the first page would be missing from the
      // auth-status map and incorrectly shown as "Pending" in the UI.
      const allUsers: Array<{ id: string; last_sign_in_at: string | null }> = []
      let page = 1
      const perPage = 1000

      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage, page })

        if (error) {
          console.error('admin-user-ops listUsers error:', error)
          return jsonResponse({ error: error.message }, 500)
        }

        for (const u of data.users) {
          allUsers.push({ id: u.id, last_sign_in_at: u.last_sign_in_at ?? null })
        }

        if (!data.nextPage) break
        page = data.nextPage
      }

      return jsonResponse({ success: true, users: allUsers })
    }

    // ── updateProfile ─────────────────────────────────────────────────────────
    if (action === 'updateProfile') {
      if (!isAdmin && !isManager) {
        return jsonResponse({ error: 'Admin or manager access required' }, 403)
      }

      const { targetUserId, profileData } = body
      if (!targetUserId || !profileData) {
        return jsonResponse({ error: 'targetUserId and profileData are required' }, 400)
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(profileData)
        .eq('id', targetUserId)

      if (error) {
        console.error('admin-user-ops updateProfile error:', error)
        return jsonResponse({ error: error.message }, 400)
      }

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    console.error('admin-user-ops unexpected error:', err)
    return jsonResponse({ error: err?.message ?? 'Internal server error' }, 500)
  }
})
