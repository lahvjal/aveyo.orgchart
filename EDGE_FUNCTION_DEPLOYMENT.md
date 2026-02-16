# Deploy Edge Function for Email Invitations

## Step 1: Login to Supabase CLI

Run this command in your terminal:

```bash
supabase login
```

This will open your browser to authenticate.

## Step 2: Link Your Project

After logging in, link your project:

```bash
cd /Users/vel/Documents/Aveyo/org-chart-app
supabase link --project-ref semzdcsumfnmjnhzhtst
```

## Step 3: Set Environment Variables

Set the Resend API key and from email for your Edge Function:

```bash
supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
supabase secrets set FROM_EMAIL=noreply@send.aveyo.com
```

## Step 4: Deploy the Edge Function

Deploy the function:

```bash
supabase functions deploy send-invitation-email --no-verify-jwt
```

## Step 5: Test the Function

After deployment, try inviting an employee again from the UI!

---

## Alternative: Serve Locally First (Recommended for Testing)

You can test the Edge Function locally before deploying:

```bash
# Serve the function locally
supabase functions serve send-invitation-email --env-file supabase/.env --no-verify-jwt
```

This will run on `http://localhost:54321/functions/v1/send-invitation-email`

The app will automatically use the local function if it's running!

---

## What This Does

1. **Secure**: Resend API key stays server-side (not exposed in browser)
2. **No CORS**: Edge Function runs on Supabase infrastructure
3. **Admin Check**: Function verifies user is admin before sending
4. **Works Everywhere**: Development, staging, and production

## Files Created

- `supabase/functions/send-invitation-email/index.ts` - Edge Function code
- `supabase/.env` - Environment variables (not committed to git)
- `supabase/.env.example` - Template for environment variables

## Next Steps

After deployment, the invitation feature will work perfectly! The function:
- Receives invitation details from the frontend
- Verifies the user is an admin
- Sends email via Resend API
- Returns success/error to the frontend
