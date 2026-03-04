# Email Notifications Setup

This project sends operational emails through current Supabase Edge Functions.

## Active Notification Functions

- `send-notification-email` (welcome, profile update, manager change, department change)
- `send-invitation-email` (employee invitation flow)
- `send-password-reset-email` (public password reset endpoint with anti-abuse controls)

The legacy `notify-profile-update` function is removed and must not be redeployed.

## Prerequisites

1. Supabase CLI installed
2. Resend account and verified sending domain
3. Supabase project linked locally

## Required Secrets

Set secrets in Supabase (server-side only):

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set FROM_EMAIL=noreply@your-domain.com
supabase secrets set APP_URL=https://your-app-url.com
```

Do not expose these in `VITE_*` env vars.

## Deploy Functions

```bash
supabase link --project-ref semzdcsumfnmjnhzhtst
supabase functions deploy send-notification-email
supabase functions deploy send-invitation-email
supabase functions deploy send-password-reset-email
```

## How Notifications Are Triggered

- App mutations call `src/lib/notifications.ts`.
- The client invokes `send-notification-email` with authenticated JWT context.
- Recipient resolution and authorization checks happen server-side in the edge function.

No database webhook is required for this flow.

## Validation

1. Perform a user/profile update action from the app.
2. Verify edge function logs:

```bash
supabase functions logs send-notification-email
supabase functions logs send-invitation-email
supabase functions logs send-password-reset-email
```

3. Confirm email delivery in Resend dashboard.

## Troubleshooting

- **Missing emails:** verify `RESEND_API_KEY` and `FROM_EMAIL` secrets.
- **Auth errors:** ensure caller is authenticated and has required role/scope.
- **Delivery errors:** inspect Resend response in edge function logs.

## Security Notes

- Keep service-role and Resend keys server-side only.
- Keep JWT verification enabled for privileged functions.
- Keep `send-password-reset-email` generic in responses to prevent account enumeration.
