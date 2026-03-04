# Edge Function Setup (Secure)

This guide deploys auth-sensitive functions without exposing secrets in client code or disabling JWT checks.

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
supabase functions deploy admin-user-ops
supabase functions deploy send-invitation-email
supabase functions deploy send-notification-email
supabase functions deploy send-password-reset-email
```

## JWT Verification Policy

- Keep JWT verification enabled for:
  - `admin-user-ops`
  - `send-invitation-email`
  - `send-notification-email`
- `send-password-reset-email` is intentionally public and must include abuse controls
  (rate limiting, generic response, and redirect allowlist).

Do not deploy privileged functions with `--no-verify-jwt`.

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
