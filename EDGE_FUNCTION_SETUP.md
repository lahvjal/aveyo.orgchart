# Edge Function Setup - Step by Step Guide

## What We're Doing

We need to deploy the `send-invitation-email` Edge Function to Supabase so it can handle email sending without CORS issues.

## Prerequisites

✅ Supabase CLI installed (you have version 2.22.12)  
✅ Edge Function code already created (`supabase/functions/send-invitation-email/index.ts`)  
✅ Environment variables ready (Resend API key, from email)

## Step-by-Step Instructions

### Step 1: Login to Supabase CLI

Open a **new terminal** and run:

```bash
supabase login
```

**What happens:**
- Opens your browser
- Login with your Supabase account
- CLI gets authenticated

**Expected output:**
```
Opening browser...
Finished supabase login.
```

---

### Step 2: Link Your Project

```bash
cd /Users/vel/Documents/Aveyo/org-chart-app
supabase link --project-ref semzdcsumfnmjnhzhtst
```

**What happens:**
- Connects your local project to your Supabase project
- Creates a config file

**Expected output:**
```
Finished supabase link.
```

**If it asks for database password:**
- Go to Supabase Dashboard → Settings → Database
- Find your database password or reset it
- Enter the password when prompted

---

### Step 3: Set Environment Secrets

These secrets will be available to your Edge Function:

```bash
supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
```

Then:

```bash
supabase secrets set FROM_EMAIL=noreply@send.aveyo.com
```

**Expected output:**
```
Finished supabase secrets set.
```

**What this does:**
- Stores secrets securely on Supabase
- Edge Function can access them via `Deno.env.get('RESEND_API_KEY')`

---

### Step 4: Deploy the Edge Function

```bash
supabase functions deploy send-invitation-email --no-verify-jwt
```

**What happens:**
- Uploads your function code to Supabase
- Makes it available at: `https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-invitation-email`

**Expected output:**
```
Deploying Function send-invitation-email (project ref: semzdcsumfnmjnhzhtst)
Function URL: https://semzdcsumfnmjnhzhtst.supabase.co/functions/v1/send-invitation-email
Finished supabase functions deploy.
```

**Why `--no-verify-jwt`?**
- The function verifies authentication internally
- This flag allows the function to handle auth its own way

---

### Step 5: Test It!

After deployment:

1. Go to your app: http://localhost:5173 or https://aveyo-orgchart.vercel.app
2. Admin Panel → Users
3. Click "Resend" on a pending user
4. Should work without CORS errors!

---

## Troubleshooting

### Error: "Cannot find project ref"

Run step 2 again:
```bash
supabase link --project-ref semzdcsumfnmjnhzhtst
```

### Error: "Database password required"

Get password from:
- Supabase Dashboard → Settings → Database
- Copy the password (or reset it)
- Paste when prompted

### Error: "Unauthorized" or "Invalid token"

Re-login:
```bash
supabase login
```

### Check If Function Is Deployed

```bash
supabase functions list
```

Should show:
```
send-invitation-email
```

### View Function Logs (for debugging)

```bash
supabase functions logs send-invitation-email
```

---

## All Commands in One Block

Copy and paste these one by one:

```bash
# 1. Login
supabase login

# 2. Link project
cd /Users/vel/Documents/Aveyo/org-chart-app
supabase link --project-ref semzdcsumfnmjnhzhtst

# 3. Set secrets
supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
supabase secrets set FROM_EMAIL=noreply@send.aveyo.com

# 4. Deploy function
supabase functions deploy send-invitation-email --no-verify-jwt

# 5. Verify deployment
supabase functions list
```

---

## After Deployment

Once deployed:
- ✅ Invitation emails will work
- ✅ Resend invitations will work
- ✅ No more CORS errors
- ✅ Works on both localhost and production

The Edge Function runs on Supabase's servers, so it works everywhere!

## Need Help?

If you get stuck on any step, share the error message and I'll help you fix it!
