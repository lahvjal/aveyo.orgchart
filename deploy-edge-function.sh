#!/usr/bin/env bash
set -euo pipefail

echo "Setting up secure edge functions for email workflows"
echo ""

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: Supabase CLI is not installed."
  exit 1
fi

if ! supabase projects list >/dev/null 2>&1; then
  echo "Error: Not logged in. Run: supabase login"
  exit 1
fi

: "${RESEND_API_KEY:?Missing RESEND_API_KEY environment variable}"
: "${FROM_EMAIL:?Missing FROM_EMAIL environment variable}"
APP_URL_VALUE="${APP_URL:-}"

echo "Linking project..."
supabase link --project-ref semzdcsumfnmjnhzhtst

echo "Setting function secrets..."
if [ -n "${APP_URL_VALUE}" ]; then
  supabase secrets set \
    RESEND_API_KEY="${RESEND_API_KEY}" \
    FROM_EMAIL="${FROM_EMAIL}" \
    APP_URL="${APP_URL_VALUE}"
else
  supabase secrets set \
    RESEND_API_KEY="${RESEND_API_KEY}" \
    FROM_EMAIL="${FROM_EMAIL}"
fi

echo "Deploying functions..."
# Privileged functions keep JWT verification enabled.
supabase functions deploy send-invitation-email
supabase functions deploy send-notification-email
supabase functions deploy admin-user-ops

# Password reset endpoint is intentionally public; deploy policy should be
# configured as public in the function config instead of CLI flags in scripts.
supabase functions deploy send-password-reset-email

echo ""
echo "Setup complete."
echo "Run: supabase functions list"
