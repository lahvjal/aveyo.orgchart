#!/usr/bin/env bash
set -euo pipefail

echo "Deploying secure invitation email function"
echo "========================================="

if [ ! -f "package.json" ]; then
  echo "Error: run this from repository root."
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: Supabase CLI is not installed."
  exit 1
fi

if ! supabase projects list >/dev/null 2>&1; then
  echo "Error: Supabase CLI is not authenticated. Run: supabase login"
  exit 1
fi

# Required runtime secrets.
# Do not hardcode secrets in this script or repository.
: "${RESEND_API_KEY:?Missing RESEND_API_KEY environment variable}"
: "${FROM_EMAIL:?Missing FROM_EMAIL environment variable}"

# Optional public app URL for links in email templates.
APP_URL_VALUE="${APP_URL:-}"

echo "Linking project..."
supabase link --project-ref semzdcsumfnmjnhzhtst

echo "Setting edge secrets..."
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

echo "Deploying send-invitation-email with explicit no-verify-jwt..."
echo "JWT is enforced in-function via bearer token + auth.getUser(token)."
supabase functions deploy send-invitation-email --no-verify-jwt

echo "Done. Useful checks:"
echo "  supabase functions list"
echo "  supabase functions logs send-invitation-email"
