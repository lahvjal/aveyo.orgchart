# Resend Integration (Current Architecture)

## Overview

Resend is integrated through Supabase edge functions. The frontend never receives Resend API credentials.

## Runtime Model

- Client calls edge functions with authenticated requests.
- Edge functions validate identity/permissions.
- Edge functions call Resend API using server-side secrets.

## Required Edge Secrets

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://orgchart.aveyo.com
```

## Function Surfaces

- `send-invitation-email`
- `send-notification-email`
- `send-password-reset-email`

Privileged functions must keep JWT verification enabled.

## Verification

```bash
supabase functions logs send-invitation-email
supabase functions logs send-notification-email
```

## Security Notes

- Do not store Resend or service-role keys in `VITE_` variables.
- Do not commit secrets to docs/scripts.
- Rotate provider keys immediately if leakage is suspected.
