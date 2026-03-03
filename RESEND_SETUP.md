# Resend Setup (Secure Runtime)

## Overview

Email delivery is handled by Supabase edge functions, not by client-side `VITE_` secrets.

## Required Secrets (Edge Functions)

Set these values in Supabase:

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://orgchart.aveyo.com
```

Do not set Resend keys in `.env.local`.

## Deploy Functions

```bash
supabase functions deploy send-invitation-email
supabase functions deploy send-notification-email
supabase functions deploy send-password-reset-email
```

## Validate

- Trigger an invitation from Admin Panel.
- Trigger a profile update notification flow.
- Check logs:

```bash
supabase functions logs send-invitation-email
supabase functions logs send-notification-email
```

## Troubleshooting

- Confirm secrets exist: `supabase secrets list`
- Confirm sender domain is verified in Resend
- Review function logs for request-level errors
