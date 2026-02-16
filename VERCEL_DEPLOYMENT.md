# Vercel Deployment Guide

## Environment Variables for Vercel

Set these environment variables in your Vercel project settings:

### Required Variables

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `VITE_SUPABASE_URL` | `https://semzdcsumfnmjnhzhtst.supabase.co` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your Supabase anon key |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your Supabase service role key (for admin invites) |
| `VITE_APP_URL` | `https://your-app.vercel.app` | **Your actual Vercel URL** (set after first deploy) |
| `VITE_RESEND_API_KEY` | `re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv` | Your Resend API key |
| `VITE_FROM_EMAIL` | `noreply@send.aveyo.com` | Your verified sending domain |

### Important: VITE_APP_URL

**After your first deployment**, Vercel will give you a URL like:
```
https://aveyo-orgchart.vercel.app
```

You MUST:
1. Go back to Vercel → Settings → Environment Variables
2. Update `VITE_APP_URL` with your actual URL
3. Redeploy (Vercel will auto-redeploy when env vars change)

**Why it's needed:**
- Magic link redirects in invitation emails
- All email links (View Profile, Dashboard, etc.)
- Authentication redirects

## Deployment Steps

### 1. Connect to GitHub

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import from GitHub: `lahvjal/aveyo.orgchart`
4. Vercel auto-detects: Vite + React

### 2. Configure Build Settings

**Framework Preset**: Vite  
**Build Command**: `npm run build` (default)  
**Output Directory**: `dist` (default)  
**Install Command**: `npm install` (default)

Leave these as default - they're already correct!

### 3. Add Environment Variables

Click "Environment Variables" and add all 6 variables listed above.

**For now, set `VITE_APP_URL` to a placeholder:**
```
VITE_APP_URL=https://placeholder.vercel.app
```

We'll update it after deployment.

### 4. Deploy

Click "Deploy" and wait ~2-3 minutes.

### 5. Update VITE_APP_URL

After deployment:
1. Copy your actual Vercel URL (e.g., `https://aveyo-orgchart.vercel.app`)
2. Go to Settings → Environment Variables
3. Click on `VITE_APP_URL`
4. Update the value to your actual URL
5. Click "Save"
6. Vercel will automatically redeploy

### 6. Deploy Edge Functions (Important!)

After your app is deployed, deploy the Edge Function for email invitations:

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref semzdcsumfnmjnhzhtst

# Set environment secrets
supabase secrets set RESEND_API_KEY=re_zJ12TZbm_Gjs6y2ewcCFJtZoSjEnsoVWv
supabase secrets set FROM_EMAIL=noreply@send.aveyo.com

# Deploy the function
supabase functions deploy send-invitation-email --no-verify-jwt
```

**Without this step, employee invitations won't send emails!**

## Post-Deployment Checklist

- [ ] App deployed successfully to Vercel
- [ ] Updated `VITE_APP_URL` with actual Vercel URL
- [ ] App redeployed automatically after env var update
- [ ] Edge Function deployed to Supabase
- [ ] Test login/signup on production URL
- [ ] Test admin features (invite employee)
- [ ] Test email delivery
- [ ] Verify profile photos upload correctly
- [ ] Check org chart renders properly

## Vercel-Specific Configuration

### Custom Domain (Optional)

If you want a custom domain like `orgchart.aveyo.com`:

1. Go to Vercel → Settings → Domains
2. Add your custom domain
3. Update DNS records (Vercel provides instructions)
4. Update `VITE_APP_URL` to your custom domain
5. Redeploy

### Build Cache

Vercel caches dependencies and builds for faster deployments:
- First build: ~1-2 minutes
- Subsequent builds: ~30 seconds

### Auto-Deployments

Every push to `main` branch automatically deploys to production!

- Push to `main` → Production deployment
- Push to other branches → Preview deployment
- Pull requests → Preview deployment with unique URL

## Troubleshooting

### Build Fails with TypeScript Errors

✅ Already fixed! The TypeScript errors have been resolved.

### Environment Variables Not Working

- Make sure to select all environments (Production, Preview, Development)
- Redeploy after changing env vars
- Check that Vite variables start with `VITE_`

### Email Invitations Not Working

- Verify Edge Function is deployed to Supabase
- Check Supabase Function logs for errors
- Verify Resend API key is correct
- Check sending domain is verified in Resend

### Images Not Loading

- Check Supabase Storage is properly configured
- Verify `profile-photos` bucket exists and is public
- Check CORS settings in Supabase Storage

## Production URL Example

After deployment, your app will be available at something like:
```
https://aveyo-orgchart.vercel.app
```

or with custom domain:
```
https://orgchart.aveyo.com
```

## Security Notes

✅ `.env.local` is NOT pushed to GitHub (in .gitignore)  
✅ Service role key is safe (env vars only)  
✅ Vercel environment variables are encrypted  
✅ Edge Functions keep Resend API key server-side

## Next Steps After Deployment

1. Create your first admin user
2. Set up departments
3. Invite your team
4. Build your org chart
5. Share with your organization!

## Support

If deployment fails:
- Check Vercel build logs
- Check GitHub Actions (if configured)
- Verify all env vars are set correctly
- Contact Vercel support or check their documentation

---

**Ready to deploy?** Just connect your GitHub repo to Vercel and follow the steps above! 🚀
