#!/bin/bash
set -euo pipefail

pnpm install --frozen-lockfile

# Align constraint names left over from the old plural table names. Renaming
# preserves the existing uniqueness enforcement, indexes, and every row.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
SET lock_timeout = '5s';
SET statement_timeout = '30s';
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.admin')
      AND conname = 'admins_clerk_user_id_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.admin')
      AND conname = 'admin_clerk_user_id_unique'
  ) THEN
    ALTER TABLE public.admin RENAME CONSTRAINT
      admins_clerk_user_id_unique TO admin_clerk_user_id_unique;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.invite_token')
      AND conname = 'invite_tokens_token_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = to_regclass('public.invite_token')
      AND conname = 'invite_token_token_unique'
  ) THEN
    ALTER TABLE public.invite_token RENAME CONSTRAINT
      invite_tokens_token_unique TO invite_token_token_unique;
  END IF;
END
$$;
COMMIT;
SQL

# Sync only declared app tables; the config excludes session/legacy tables.
schema_log="$(mktemp)"
trap 'rm -f "$schema_log"' EXIT
pnpm --filter @workspace/db run push-force 2>&1 | tee "$schema_log"
# Drizzle-kit can print an interactive-prompt error but exit with status zero.
# Do not report a successful merge when schema sync did not actually finish.
if grep -Eq 'Error:|Interactive prompts require a TTY|Do you want to truncate' "$schema_log"; then
  echo "Schema sync failed. Resolve the schema change with an explicit, data-preserving migration." >&2
  exit 1
fi
