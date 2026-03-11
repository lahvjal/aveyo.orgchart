# Edge Function Setup (Secure)

This guide deploys auth-sensitive functions without exposing secrets in client code.

## Prerequisites

- Supabase CLI installed and authenticated
- Project linked to the correct `project-ref`
- Secrets provided from your shell/session (not hardcoded in files)

## Required Secrets

Set these as Supabase Edge Function secrets:

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://orgchart.aveyo.com
```

Do not store these values in `VITE_` variables.

## Deploy Commands

```bash
supabase functions deploy admin-user-ops --no-verify-jwt
supabase functions deploy send-invitation-email --no-verify-jwt
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy send-password-reset-email --no-verify-jwt
```

## JWT Verification Policy

- Gateway JWT verification is intentionally disabled for all current functions
  (`--no-verify-jwt`) due to ES256 access-token incompatibility at the edge gateway.
- Privileged functions (`admin-user-ops`, `send-invitation-email`, `send-notification-email`)
  still enforce JWT strictly in runtime by:
  - requiring `Authorization: Bearer ...`
  - validating token/user with `auth.getUser(token)`
  - applying role/scope checks server-side
- `send-password-reset-email` remains intentionally public and must keep abuse controls
  (rate limiting, generic response, redirect allowlist).

## Validation

```bash
supabase functions list
supabase functions logs send-invitation-email
supabase functions logs admin-user-ops
```

## Troubleshooting

- Re-authenticate CLI: `supabase login`
- Re-link project: `supabase link --project-ref <project-ref>`
- Confirm secrets exist: `supabase secrets list`
