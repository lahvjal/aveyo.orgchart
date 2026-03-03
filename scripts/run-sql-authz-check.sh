#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Skipping SQL authz checks: DATABASE_URL is not set."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for SQL authz checks."
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/tests/authz_policy_matrix.sql"
