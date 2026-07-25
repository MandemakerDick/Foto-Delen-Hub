#!/bin/bash
set -e

pnpm install --frozen-lockfile

# Migrate photographer themes from two nullable FK columns to a junction table.
# Safe to run multiple times (all statements are idempotent).
psql "$DATABASE_URL" <<'SQL'
-- 1. Create junction table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS photographer_themes (
  photographer_id integer NOT NULL,
  theme_id        integer NOT NULL,
  added_at        timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (photographer_id, theme_id)
);

-- 2. Copy existing data from the old columns (only if they still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'photographers' AND column_name = 'theme_id_1'
  ) THEN
    INSERT INTO photographer_themes (photographer_id, theme_id)
    SELECT id, theme_id_1 FROM photographers WHERE theme_id_1 IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO photographer_themes (photographer_id, theme_id)
    SELECT id, theme_id_2 FROM photographers WHERE theme_id_2 IS NOT NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE photographers
      DROP COLUMN IF EXISTS theme_id_1,
      DROP COLUMN IF EXISTS theme_id_2;
  END IF;
END
$$;
SQL

# Sync any remaining schema changes (non-interactive)
pnpm --filter @workspace/db run push-force
