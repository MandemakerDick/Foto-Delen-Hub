-- Manual, approved rollout only. See photographer-owner-unique.md.
-- Run as one transaction; no existing row is updated or deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE photographer IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT clerk_user_id FROM photographer
    WHERE clerk_user_id IS NOT NULL
    GROUP BY clerk_user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate photographer owners exist; approve a per-account resolution plan before retrying';
  END IF;
END $$;

ALTER TABLE photographer
  ADD CONSTRAINT photographer_clerk_user_id_unique UNIQUE (clerk_user_id);
COMMIT;