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

uri_no_scheme="${DATABASE_URL#*://}"
host_port_path="${uri_no_scheme##*@}"
host_port="${host_port_path%%/*}"

case "$host_port" in
  db.*.supabase.co:5432)
  echo "DATABASE_URL appears to use Supabase direct Postgres URI (db.<ref>.supabase.co:5432)."
  echo "GitHub runners commonly fail to reach this IPv6 endpoint."
  echo "Use a Supabase pooler URI in DATABASE_URL (Connect -> Session mode preferred for CI)."
  exit 1
  ;;
esac

if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/tests/authz_policy_matrix.sql"; then
  echo "SQL authz checks failed."
  echo "If this is a connection error, verify DATABASE_URL is a Supabase pooler URI (not direct db host:5432)."
  exit 1
fi
