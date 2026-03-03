# Edge Function Deployment

## 1) Authenticate And Link

```bash
supabase login
supabase link --project-ref <project-ref>
```

## 2) Set Server-Side Secrets

```bash
supabase secrets set RESEND_API_KEY=...
supabase secrets set FROM_EMAIL=noreply@send.yourdomain.com
supabase secrets set APP_URL=https://orgchart.aveyo.com
```

Never commit secrets to scripts, markdown, or `VITE_` variables.

## 3) Deploy Functions

```bash
supabase functions deploy admin-user-ops
supabase functions deploy send-invitation-email
supabase functions deploy send-notification-email
supabase functions deploy send-password-reset-email
```

## 4) Security Rules

- Keep JWT verification enabled for privileged functions (`admin-user-ops`, invitation, notification).
- `send-password-reset-email` is the only intentionally public endpoint and should include anti-abuse protections.
- Do not use `--no-verify-jwt` for privileged functions.

## 5) Validate

```bash
supabase functions list
supabase functions logs admin-user-ops
supabase functions logs send-invitation-email
```
