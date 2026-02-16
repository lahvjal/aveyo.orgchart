# Resend Invitation Feature

## Overview

Admins can now resend invitation emails to employees who haven't logged in yet. A "Resend" button appears next to pending users in the User Management panel.

## Features

### Visual Indicators

1. **"Pending" Badge**: Users who haven't logged in yet display a yellow badge with a clock icon
2. **"Resend" Button**: Appears next to pending users to resend the invitation
3. **Loading State**: Shows spinner while resending

### How It Works

The system checks `last_sign_in_at` from Supabase Auth to determine if a user has ever logged in:
- **No login record** → Shows "Pending" badge + "Resend" button
- **Has logged in** → Shows normal user card without resend option

### User Flow

1. Admin goes to **Admin Panel → Users**
2. Sees list of all users
3. Users who haven't logged in show:
   - **Yellow "Pending" badge** with clock icon
   - **"Resend" button** with mail icon
4. Admin clicks "Resend"
5. System:
   - Generates a new magic link
   - Sends invitation email via Edge Function
   - Shows loading spinner
6. Email sent successfully!

## Implementation Details

### New Hook: `useResendInvite`

**File: `src/hooks/useResendInvite.ts`**

Provides two hooks:

#### 1. `useResendInvite()`
React Query mutation that:
- Generates a new magic link for the user
- Sends invitation email with the new link
- No new account creation (user already exists)
- Uses existing profile data

#### 2. `useUserAuthStatus()`
React Query that:
- Fetches all users from `auth.admin.listUsers()`
- Returns a map of `userId → last_sign_in_at`
- Cached for 1 minute for performance
- Used to determine "pending" status

#### 3. `hasUserLoggedIn()`
Helper function that checks if a user has a login record.

### Updated Component

**File: `src/components/admin/UserManagement.tsx`**

Changes:
- Added `useUserAuthStatus()` hook to fetch login status
- Added `useResendInvite()` mutation hook
- Added "Pending" badge for users without login
- Added "Resend" button with mail icon
- Loading state per user (doesn't block other actions)

### Visual Design

**Pending User Card:**
```
[Avatar] John Doe [Pending 🕐]          [Resend ✉️] [Edit ✏️]
        Software Engineer
        [Engineering]
```

**Active User Card:**
```
[Avatar] Jane Smith [Admin 🛡️]               [Edit ✏️]
        Engineering Lead
        [Engineering]
```

## Usage

### For Admins:

1. **View pending users**: Look for yellow "Pending" badges
2. **Resend invitation**: Click the "Resend" button
3. **Wait for confirmation**: Button shows spinner while sending
4. **Check email**: New invitation sent with fresh magic link

### For Employees:

1. Receives new invitation email
2. Clicks magic link
3. Auto-login and redirect to dashboard
4. Can set password and complete profile

## Technical Details

### Auth Status Detection

Uses Supabase Admin API:
```typescript
supabaseAdmin.auth.admin.listUsers()
```

Returns all users with metadata including:
- `last_sign_in_at` - Timestamp of last login (null if never logged in)
- `email_confirmed_at` - Email confirmation status
- `created_at` - Account creation date

### Magic Link Generation

```typescript
supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: profile.email,
  options: {
    redirectTo: `${VITE_APP_URL}/dashboard`,
  },
})
```

Generates a new 24-hour magic link each time.

### Email Delivery

Uses the existing `sendEmployeeInvitationEmail()` function:
- Same branded template
- Same invitation message
- New magic link
- Sent via Supabase Edge Function → Resend

## Benefits

1. **No Manual Work**: Admins don't need to copy/paste magic links
2. **Self-Service**: Admins can resend anytime
3. **Fresh Links**: Each resend generates a new 24-hour link
4. **Clear Status**: Easy to see who's pending at a glance
5. **No Duplicate Accounts**: Works with existing profile, no new account created

## Security

- ✅ Only admins can access this feature
- ✅ Service role key required (already configured)
- ✅ Each magic link is unique and expires in 24 hours
- ✅ No password generation or exposure

## Performance

- Auth status cached for 1 minute
- Batch fetches all users at once
- Individual resend operations don't block UI
- Loading state per user

## Testing

### Test Scenario 1: New Invitation
```
1. Invite a new employee
2. Go to User Management
3. See new user with "Pending" badge
4. Verify "Resend" button appears
```

### Test Scenario 2: Resend
```
1. Click "Resend" on pending user
2. Button shows loading spinner
3. New email sent via Resend
4. Button returns to normal state
```

### Test Scenario 3: After Login
```
1. Employee clicks magic link and logs in
2. Refresh admin panel
3. "Pending" badge disappears
4. "Resend" button no longer appears
```

## Edge Cases Handled

- ✅ User without last_sign_in_at → Shows as pending
- ✅ Service role not configured → Graceful fallback
- ✅ Email send failure → Error logged, user can retry
- ✅ Multiple resends → Each generates new link

## Future Enhancements

Possible improvements:
1. **Toast notifications**: Show success/error messages
2. **Last sent timestamp**: Show when invitation was last sent
3. **Invitation history**: Track all sent invitations
4. **Bulk resend**: Select multiple pending users and resend all
5. **Email preview**: Preview the invitation email before sending
6. **Custom message**: Let admin add a personal note to invitation

## Files Created/Modified

### New Files
- `src/hooks/useResendInvite.ts` - Resend invitation hooks and auth status

### Modified Files
- `src/components/admin/UserManagement.tsx` - Added resend button and pending badge

## Summary

Admins can now easily identify and resend invitations to employees who haven't logged in yet. The feature seamlessly integrates into the existing User Management UI with clear visual indicators and one-click resend functionality! 🎉
