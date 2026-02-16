# Quick Start: Employee Invitation Feature

## Setup (5 minutes)

### 1. Add Service Role Key

Get your service role key from Supabase Dashboard:
- Go to your Supabase project
- Settings → API
- Copy "service_role" key (the secret one)

Add to `.env.local`:
```env
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANT**: Never commit this to Git! It's already in `.gitignore` via `.env.local`.

### 2. Restart Dev Server

```bash
npm run dev
```

## Using the Feature

### As Admin:

1. Navigate to **Admin Panel** (click "Admin Panel" in header)
2. Click **"Users"** tab
3. Click **"Invite Employee"** button (top right)
4. Fill in the form:
   - **Email**: employee@company.com (required)
   - **Full Name**: John Doe (required)
   - **Job Title**: Software Engineer (required)
   - **Start Date**: (defaults to today, optional)
5. Click **"Send Invitation"**
6. ✅ Success! Employee receives email with magic link

### What Happens:

1. ✅ User account created in Supabase Auth
2. ✅ Profile automatically created in database
3. ✅ Magic link generated (valid 24 hours)
4. ✅ Invitation email sent via Resend
5. ✅ Employee appears in user list

### As Employee:

1. 📧 Receive invitation email
2. 🔗 Click magic link
3. ✨ Automatically logged in
4. 🏠 Redirected to dashboard
5. 👤 Can set password in Profile settings
6. 📝 Can complete profile details

## Troubleshooting

### "Admin features are not configured"
- Service role key not set or incorrect
- Check `.env.local` file
- Restart dev server after adding key

### "This email address is already registered"
- User already exists in system
- Check user list or ask them to log in

### "Failed to send invitation email"
- Check Resend API key is configured
- Check sending email domain is verified
- View Resend dashboard for logs

### Email not received
- Check spam/junk folder
- Check Resend dashboard logs
- Verify sending domain in Resend
- Check email address is valid

## Console Debugging

Watch for these logs:
```
useInviteEmployee: Starting invitation process for email@example.com
useInviteEmployee: Creating user account
useInviteEmployee: User created successfully: abc123...
useInviteEmployee: Generating magic link
useInviteEmployee: Magic link generated successfully
useInviteEmployee: Sending invitation email
Email sent successfully: { id: 'xyz789...' }
useInviteEmployee: Invitation process completed successfully
```

If any step fails, the error will be logged and shown to admin.

## Environment Variables Required

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # NEW! For invitations

# App (required)
VITE_APP_URL=http://localhost:5173

# Resend (required for emails)
VITE_RESEND_API_KEY=re_...
VITE_FROM_EMAIL=noreply@send.yourdomain.com
```

## Files You Can Ignore

These were created/modified automatically:
- ✅ `src/lib/supabaseAdmin.ts`
- ✅ `src/hooks/useInviteEmployee.ts`
- ✅ `src/components/admin/AddEmployeeDialog.tsx`
- ✅ `src/lib/notifications.ts` (updated)
- ✅ `src/components/admin/UserManagement.tsx` (updated)

## That's It! 🎉

The feature is fully implemented and ready to use. Just add the service role key and you're good to go!

For detailed documentation, see `ADMIN_INVITATION_FEATURE.md`.
